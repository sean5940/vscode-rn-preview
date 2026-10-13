import { createServer, type Server } from 'node:http';
import { mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { activate } from '../src/extension.ts';
import { findMobileAppPath } from '../src/projectPath.ts';
import { resetState, state } from './vscodeStub.ts';

/** The extension does not start a server if one is running on that port. An empty server stands in. */
let server: Server;
let port: number;
let projectPath: string;
/** The RN project to preview. Judged by whether it depends on `react-native`, so that is all it has. */
let appPath: string;

const runOpen = async () => {
    const open = state.commands.get('rnPreview.open');
    if (open === undefined) throw new Error('rnPreview.open was not registered');
    await open();
};

type Lens = { command: { title: string } };

const provideLenses = (path: string, text: string): Lens[] => {
    const provider = state.codeLensProviders[0] as { provideCodeLenses: (document: unknown) => Lens[] } | undefined;
    if (provider === undefined) throw new Error('No CodeLens provider was registered');
    return provider.provideCodeLenses({ uri: { fsPath: path }, getText: () => text });
};

beforeAll(async () => {
    projectPath = mkdtempSync(join(tmpdir(), 'rn-preview-'));
    writeFileSync(join(projectPath, 'package.json'), JSON.stringify({ name: 'rn-preview' }));

    appPath = mkdtempSync(join(tmpdir(), 'rn-app-'));
    writeFileSync(join(appPath, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.81.0' } }));

    // The extension asks "which checkout is this server looking at" and reuses it only when it matches.
    server = createServer((request, response) => {
        if (request.url === '/__rn-preview/target') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ projectRoot: appPath, previewRoot: appPath }));
            return;
        }
        response.end('ok');
    });
    await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
    port = (server.address() as { port: number }).port;
});

afterAll(() => {
    server.close();
});

beforeEach(() => {
    resetState();
    state.settings.set('projectPath', projectPath);
    state.settings.set('projectRoot', appPath);
    state.settings.set('port', port);
    state.settings.set('startTimeoutMs', 5000);
    activate({ subscriptions: [] } as never);
});

describe('extension registration', () => {
    test('registers the commands and the CodeLens provider', () => {
        expect([...state.commands.keys()].sort()).toEqual([
            'rnPreview.open',
            'rnPreview.openDeclaration',
            'rnPreview.restartServer',
            'rnPreview.showOutput',
            'rnPreview.stopServer',
        ]);
        expect(state.codeLensProviders).toHaveLength(1);
    });
});

describe('opening a preview', () => {
    test('reuses a running server and mounts the dev server in the panel', async () => {
        state.activeFilePath = '/repo/previews/ui/Badge.preview.tsx';
        await runOpen();

        expect(state.errors).toEqual([]);
        expect(state.panels).toHaveLength(1);
        expect(state.panels[0]?.webview.html).toContain(`<iframe id="frame" src="http://localhost:${port}/?file=`);
        expect(state.panels[0]?.webview.html).toContain(`frame-src http://localhost:${port}`);
    });

    // A blank view gave no way to tell loading from failure. It lifts on load, and sends you to the log otherwise.
    test('says it is loading before the view comes up', async () => {
        state.activeFilePath = '/repo/previews/ui/Badge.preview.tsx';
        await runOpen();

        const html = state.panels[0]?.webview.html ?? '';
        expect(html).toContain('Loading the preview');
        expect(html).toContain('The preview server is not responding');
        expect(html).toContain('Show server log');
    });

    // There was no way back to the initial view after changing a state in a cell.
    test('the refresh button puts the original address back', async () => {
        state.activeFilePath = '/repo/previews/ui/Badge.preview.tsx';
        await runOpen();

        const html = state.panels[0]?.webview.html ?? '';
        expect(html).toContain('<button type="button" id="refresh">Refresh</button>');
        expect(html).toContain('frame.src = source');
    });

    // Previously, with no target it drew some arbitrary declaration and you could not tell why.
    test('says what to do when no target can be decided', async () => {
        await runOpen();

        const html = state.panels[0]?.webview.html ?? '';
        expect(html).toContain('Could not decide what to draw');
        expect(html).not.toContain('<iframe');
    });

    test('puts the open declaration file in the query', async () => {
        state.activeFilePath = '/repo/previews/ui/Badge.preview.tsx';
        await runOpen();

        const html = state.panels[0]?.webview.html ?? '';
        expect(html).toContain(`file=${encodeURIComponent(state.activeFilePath)}`);
    });

    test('passes the real path for a declaration file opened through a symlink', async () => {
        // Declaration files are usually opened through a symlink inside the target project. The dev
        // server knows the real path.
        const realDir = mkdtempSync(join(tmpdir(), 'rn-preview-real-'));
        const realFile = join(realDir, 'Badge.preview.tsx');
        writeFileSync(realFile, 'export default {};');

        const linkDir = join(mkdtempSync(join(tmpdir(), 'rn-preview-link-')), 'linked-previews');
        symlinkSync(realDir, linkDir);

        state.activeFilePath = join(linkDir, 'Badge.preview.tsx');
        await runOpen();

        const html = state.panels[0]?.webview.html ?? '';
        expect(html).toContain(`file=${encodeURIComponent(realpathSync(realFile))}`);
        expect(html).not.toContain(encodeURIComponent(linkDir));
    });

    test('adds no query when what is open is not a declaration file', async () => {
        state.activeFilePath = '/repo/src/PreviewGrid.tsx';
        await runOpen();

        expect(state.panels[0]?.webview.html ?? '').not.toContain('file=');
    });

    test('opens without the list', async () => {
        state.activeFilePath = '/repo/previews/ui/Badge.preview.tsx';
        await runOpen();

        expect(state.panels[0]?.webview.html ?? '').toContain('embed=1');
    });

    // When the panel is the active tab there is no open source, so no target can be decided. It must
    // not fall back to the list then.
    test('keeps the declaration it was showing when no target can be decided', async () => {
        const path = '/repo/previews/ui/Badge.preview.tsx';
        state.activeFilePath = path;
        await runOpen();

        state.activeFilePath = undefined;
        await runOpen();

        expect(state.panels[0]?.webview.html ?? '').toContain(`file=${encodeURIComponent(path)}`);
    });

    test('enables the open-code button only while the panel is active', async () => {
        await runOpen();

        expect(state.contexts.get('rnPreview.panelActive')).toBe(true);
    });

    test('does not create the panel twice', async () => {
        await runOpen();
        await runOpen();

        expect(state.panels).toHaveLength(1);
    });

    // Rendered in a webview it would be read-only. Preview code is made to be edited, so it needs a real editor.
    test('open code opens an editor tab in the column the preview was in', async () => {
        const path = '/repo/previews/ui/Badge.preview.tsx';
        state.activeFilePath = path;
        await runOpen();

        state.activeFilePath = undefined;
        await state.commands.get('rnPreview.openDeclaration')?.();

        expect(state.shownDocuments).toEqual([{ path, viewColumn: state.panels[0]?.viewColumn }]);
    });

    // Cursor collapses extension title-bar icons into the overflow menu. A button inside the view is always visible.
    test('the in-view open-code button opens the same declaration', async () => {
        const path = '/repo/previews/ui/Badge.preview.tsx';
        state.activeFilePath = path;
        await runOpen();

        expect(state.panels[0]?.webview.html ?? '').toContain('Open code');

        state.activeFilePath = undefined;
        state.panels[0]?.webview.post?.({ type: 'openCode' });
        await Promise.resolve();

        expect(state.shownDocuments).toEqual([{ path, viewColumn: state.panels[0]?.viewColumn }]);
    });

    // Uri.with({ query }).toString() re-wraps an already-encoded path (%2F becomes %252F).
    test('does not encode the declaration path twice', async () => {
        const path = '/repo/previews/ui/Badge.preview.tsx';
        state.activeFilePath = path;
        await runOpen();

        const html = state.panels[0]?.webview.html ?? '';
        expect(html).toContain(`file=${encodeURIComponent(path)}&embed=1`);
        expect(html).not.toContain('%252F');
    });

    test('open code reports when there is no open declaration', async () => {
        await state.commands.get('rnPreview.openDeclaration')?.();

        expect(state.errors).toHaveLength(1);
        expect(state.shownDocuments).toEqual([]);
    });

    test('reports and creates no panel when the tool project is not found', async () => {
        resetState();
        state.settings.set('projectPath', join(tmpdir(), 'rn-preview-missing'));
        activate({ subscriptions: [] } as never);

        await runOpen();

        expect(state.errors).toHaveLength(1);
        expect(state.panels).toEqual([]);
    });

    // For one tool to move between projects, the target has to come from config or an open folder.
    test('reports and creates no panel when the RN project is not found', async () => {
        resetState();
        state.settings.set('projectPath', projectPath);
        state.settings.set('projectRoot', join(tmpdir(), 'rn-app-missing'));
        activate({ subscriptions: [] } as never);

        await runOpen();

        expect(state.errors).toHaveLength(1);
        expect(state.panels).toEqual([]);
    });

    // With several worktrees open, reusing by port alone would use a server drawing another branch.
    test('does not reuse a server looking at a different checkout', async () => {
        const other = mkdtempSync(join(tmpdir(), 'rn-worktree-'));
        writeFileSync(join(other, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.81.0' } }));

        resetState();
        state.settings.set('projectPath', projectPath);
        state.settings.set('projectRoot', other);
        state.settings.set('port', port);
        state.settings.set('startTimeoutMs', 3000);
        activate({ subscriptions: [] } as never);

        await runOpen();

        // The server on that port is looking at appPath, so it has to step aside, and there is
        // nothing to start on the empty port, so it fails.
        expect(state.errors).toHaveLength(1);
        expect(state.panels).toEqual([]);
    });

    test('takes an open folder that depends on react-native as the target', () => {
        resetState();
        state.settings.set('projectPath', projectPath);
        state.workspaceFolders = [{ uri: { fsPath: appPath } }];
        activate({ subscriptions: [] } as never);

        expect(findMobileAppPath()).toBe(appPath);
    });

    // The declaration directory is usually a symlink pointing outside the repository. The dev server
    // resolves it before reporting.
    test('treats a declaration directory reached through a symlink as the same target', async () => {
        const linkedRoot = join(mkdtempSync(join(tmpdir(), 'rn-preview-root-')), 'linked-previews');
        symlinkSync(appPath, linkedRoot);

        resetState();
        state.settings.set('projectPath', projectPath);
        state.settings.set('projectRoot', appPath);
        state.settings.set('previewRoot', linkedRoot);
        state.settings.set('port', port);
        state.settings.set('startTimeoutMs', 3000);
        activate({ subscriptions: [] } as never);

        await runOpen();

        expect(state.errors).toEqual([]);
        expect(state.panels).toHaveLength(1);
    });
});

/**
 * Worktree files sit outside the open folder. Fixing one project per window means the lens never
 * attaches to those files, leaving no option but a new window per worktree.
 */
describe('worktrees', () => {
    let worktree: string;

    beforeEach(() => {
        worktree = mkdtempSync(join(tmpdir(), 'rn-worktree-'));
        writeFileSync(join(worktree, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.81.0' } }));

        resetState();
        state.settings.set('projectPath', projectPath);
        state.workspaceFolders = [{ uri: { fsPath: appPath } }];
        activate({ subscriptions: [] } as never);
    });

    test('picks up its own checkout even for a file outside the open folder', () => {
        expect(findMobileAppPath(join(worktree, 'app', 'screens', 'Badge.tsx'))).toBe(worktree);
    });

    test('falls back to the open folder when no file is open', () => {
        expect(findMobileAppPath()).toBe(appPath);
    });

    test('attaches the lens to worktree sources too', () => {
        const lenses = provideLenses(join(worktree, 'app', 'screens', 'Badge.tsx'), 'export const Badge = () => null;');

        expect(lenses.map((lens) => lens.command.title)).toEqual(['▶ Open preview']);
    });

    test('does not attach it to files outside that checkout', () => {
        const outside = join(`${worktree}-elsewhere`, 'app', 'screens', 'Badge.tsx');
        expect(provideLenses(outside, 'export const Badge = () => null;')).toEqual([]);
    });
});

/**
 * Vite binds the dev server to IPv6 loopback only, so probing with the `127.0.0.1` literal never
 * reaches a server that is running fine. The extension then treated the port as free: it restarted
 * the dev server on every open, and the checkout comparison never matched.
 *
 * The other tests bind their stub on 127.0.0.1, which matched the old probe, so they stayed green
 * while real use was broken. This one binds where Vite actually binds.
 */
describe('a dev server listening only on IPv6 loopback', () => {
    let sixServer: Server;
    let sixPort: number;

    beforeAll(async () => {
        sixServer = createServer((request, response) => {
            if (request.url === '/__rn-preview/target') {
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({ projectRoot: appPath, previewRoot: appPath }));
                return;
            }
            response.end('ok');
        });
        await new Promise<void>((resolvePromise) => sixServer.listen(0, '::1', resolvePromise));
        sixPort = (sixServer.address() as { port: number }).port;
    });

    afterAll(() => {
        sixServer.close();
    });

    test('is found and reused instead of being restarted', async () => {
        resetState();
        state.settings.set('projectPath', projectPath);
        state.settings.set('projectRoot', appPath);
        state.settings.set('port', sixPort);
        state.settings.set('startTimeoutMs', 3000);
        activate({ subscriptions: [] } as never);

        state.activeFilePath = '/repo/previews/ui/Badge.preview.tsx';
        await runOpen();

        expect(state.errors).toEqual([]);
        expect(state.panels).toHaveLength(1);
        expect(state.panels[0]?.webview.html).toContain(`http://localhost:${sixPort}/?file=`);
    });
});
