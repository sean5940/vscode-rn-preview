import { basename } from 'node:path';
import * as vscode from 'vscode';
import { componentLine } from './componentAnchor.ts';
import { resolveDeclaration } from './previewDeclaration.ts';
import { isComponentSource, isPreviewFile, toRealPath } from './previewFile.ts';

const lensRange = (document: vscode.TextDocument): vscode.Range => {
    const line = componentLine(document.getText().split('\n'), basename(document.uri.fsPath));
    return new vscode.Range(line, 0, line, 0);
};
import { PreviewPanel } from './previewPanel.ts';
import { normalizeTarget, PreviewServer, type Target } from './previewServer.ts';
import { findMobileAppPath, findPreviewRoot, findProjectPath } from './projectPath.ts';
import { ensureTool } from './toolBootstrap.ts';

const readSettings = () => {
    const config = vscode.workspace.getConfiguration('rnPreview');
    return {
        port: config.get<number>('port') ?? 5173,
        startTimeoutMs: config.get<number>('startTimeoutMs') ?? 60_000,
    };
};

/** The checkout the open file belongs to. The dev server and the generator both work from this one set. */
const toCheckout = (mobileAppPath: string): Target =>
    normalizeTarget({ projectPath: mobileAppPath, previewRoot: findPreviewRoot(mobileAppPath) });

/** The file currently in view. Which checkout to look at is decided by this file, not by the window. */
const activePath = (): string | undefined => vscode.window.activeTextEditor?.document.uri.fsPath;

/**
 * The checkout to draw this time.
 *
 * A declaration file cannot say which checkout it belongs to. It lives outside the project (in the
 * declaration directory), so walking up finds no RN project and it falls back to the open folder.
 * That is why returning from Open code used to switch a worktree back to the main checkout. In that
 * case whatever was being shown is kept.
 */
export const pickCheckout = (path: string | undefined, remembered: Target | undefined, fromFile: Target): Target =>
    isPreviewFile(path) ? (remembered ?? fromFile) : fromFile;

/**
 * What to open as a preview.
 *
 * With a declaration file open it takes that declaration; with a component source open it takes
 * that source. The source side may have no declaration yet, so one is created at open time.
 */
const activeTarget = (mobileAppPath: string | undefined) => {
    const path = activePath();
    if (isPreviewFile(path)) return { kind: 'declaration' as const, path: toRealPath(path) };
    if (mobileAppPath !== undefined && isComponentSource(path, mobileAppPath)) {
        return { kind: 'source' as const, path };
    }
    return undefined;
};

class PreviewLens implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const path = document.uri.fsPath;
        const mobileAppPath = findMobileAppPath(path);
        if (!isPreviewFile(path) && !isComponentSource(path, mobileAppPath ?? '\0')) return [];

        // From a declaration file this is the way back to the preview. From a source it is the first open.
        const title = isPreviewFile(path) ? '▶ Show preview' : '▶ Open preview';
        return [new vscode.CodeLens(lensRange(document), { title, command: 'rnPreview.open' })];
    }
}

export const activate = (context: vscode.ExtensionContext): void => {
    const output = vscode.window.createOutputChannel('RN Preview');
    const server = new PreviewServer(output);
    const panel = new PreviewPanel(
        () => void openDeclarationFile(),
        () => output.show(true),
    );

    /**
     * Decides which preview tool to use.
     *
     * The default is the one bundled with the extension. The same code has to run whether or not a
     * clone exists on the machine, so that the path which actually ships gets verified daily. A
     * clone is used only when `rnPreview.projectPath` is set, which is the case when working on the
     * tool itself.
     */
    let installedTool: string | undefined;

    const resolveToolPath = async (): Promise<string | undefined> => {
        installedTool = findProjectPath() ?? (await ensureTool(context, output).catch(() => undefined));
        return installedTool;
    };

    const open = async () => {
        const toolPath = await resolveToolPath();
        if (toolPath === undefined) {
            void vscode.window.showErrorMessage(
                'Could not prepare the preview tool. Check the log, or set a path in rnPreview.projectPath.',
            );
            output.show(true);
            return;
        }

        const appPath = findMobileAppPath(activePath());
        if (appPath === undefined) {
            void vscode.window.showErrorMessage(
                'Could not find a React Native project. Set a path in rnPreview.projectRoot.',
            );
            return;
        }

        const checkout = pickCheckout(activePath(), panel.checkout, toCheckout(appPath));
        const target = activeTarget(checkout.projectPath);
        const { port, startTimeoutMs } = readSettings();

        let running: number;
        try {
            running = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: 'Starting the preview server' },
                () => server.ensureRunning(toolPath, checkout, port, startTimeoutMs),
            );
        } catch (error) {
            output.show(true);
            void vscode.window.showErrorMessage(`Could not start the preview server: ${(error as Error).message}`);
            return;
        }

        const declaration =
            target?.kind === 'source'
                ? await resolveDeclaration(toolPath, checkout, target.path, output)
                : target?.path;

        // In remote development the port is not open as is. The address the editor tunnels is used.
        const baseUrl = await vscode.env.asExternalUri(vscode.Uri.parse(`http://localhost:${running}`));
        panel.show(baseUrl, declaration, checkout);
    };

    /**
     * Opens the declaration code where the preview was.
     *
     * The code could be rendered in a webview, but that is read-only. Preview code is a file made
     * for people and agents to edit, so it has to be **a real editor** with type checking,
     * completion, and saving. It therefore opens as a tab in the same column as the panel. To get
     * back to the preview, press `▶ Show preview` in that tab.
     */
    const openDeclarationFile = async () => {
        // This button is only pressable after the preview has been opened, so a path was already
        // decided then. Going through the preparation routine again here could kick off an install
        // on a single button press.
        const toolPath = findProjectPath() ?? installedTool;
        const appPath = findMobileAppPath(activePath());
        const target = activeTarget(appPath);

        const declaration =
            toolPath !== undefined && appPath !== undefined && target?.kind === 'source'
                ? await resolveDeclaration(toolPath, toCheckout(appPath), target.path, output)
                : panel.declarationPath;
        if (declaration === undefined) {
            void vscode.window.showErrorMessage(
                'There is no open declaration. Open a preview from a component source first.',
            );
            return;
        }

        const document = await vscode.workspace.openTextDocument(declaration);
        await vscode.window.showTextDocument(document, { viewColumn: panel.column, preview: false });
    };

    context.subscriptions.push(
        output,
        vscode.commands.registerCommand('rnPreview.open', open),
        vscode.commands.registerCommand('rnPreview.openDeclaration', openDeclarationFile),
        vscode.commands.registerCommand('rnPreview.restartServer', async () => {
            server.stop();
            await open();
        }),
        vscode.commands.registerCommand('rnPreview.stopServer', () => {
            server.stop();
            panel.dispose();
        }),
        vscode.commands.registerCommand('rnPreview.showOutput', () => output.show(true)),
        vscode.languages.registerCodeLensProvider({ language: 'typescriptreact' }, new PreviewLens()),
        { dispose: () => server.stop() },
    );
};

export const deactivate = (): void => undefined;
