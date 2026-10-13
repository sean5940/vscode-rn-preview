import { spawn, type ChildProcess } from 'node:child_process';
import * as vscode from 'vscode';
import { toRealPath } from './previewFile.ts';

const READY_PATTERN = /ready in|Local:\s+http/i;

/** One server per target. Several open worktrees find their slot within this range. */
const PORT_RANGE = 10;

export type Target = { projectPath: string; previewRoot: string };

/**
 * Host used to probe a running server.
 *
 * A hostname rather than the `127.0.0.1` literal. Vite binds the dev server to `[::1]` (IPv6
 * loopback) only, which an IPv4 literal never reaches, so **both probes below fail against a server
 * that is running perfectly well.** The extension then concludes the port is free: it restarts the
 * dev server on every open, and the checkout comparison that keeps worktrees apart silently never
 * matches. A hostname lets Node try both address families.
 */
const LOOPBACK = 'localhost';

/**
 * Normalizes a target to real paths.
 *
 * The declaration directory is usually a symlink pointing outside the repository. The dev server
 * holds it resolved, while the editor holds it as written in config. Comparing with only one side
 * resolved **treats the same target as a different one every time**, so another server is started
 * and the previous one discarded. The screen still comes up, which makes it hard to notice.
 */
export const normalizeTarget = (target: Target): Target => ({
    projectPath: toRealPath(target.projectPath),
    previewRoot: toRealPath(target.previewRoot),
});

/** The checkout the server on that port is looking at. `undefined` if nobody is there. */
const askTarget = async (port: number): Promise<Target | undefined> => {
    try {
        const response = await fetch(`http://${LOOPBACK}:${port}/__rn-preview/target`, {
            signal: AbortSignal.timeout(1500),
        });
        if (!response.ok) return undefined;

        const body = (await response.json()) as { projectRoot?: string; previewRoot?: string };
        return body.projectRoot === undefined || body.previewRoot === undefined
            ? undefined
            : normalizeTarget({ projectPath: body.projectRoot, previewRoot: body.previewRoot });
    } catch {
        return undefined;
    }
};

const isTaken = async (port: number): Promise<boolean> => {
    try {
        await fetch(`http://${LOOPBACK}:${port}/`, { signal: AbortSignal.timeout(1500) });
        return true;
    } catch {
        return false;
    }
};

const sameTarget = (a: Target, b: Target): boolean =>
    a.projectPath === b.projectPath && a.previewRoot === b.previewRoot;

/**
 * Starts and stops the preview dev server.
 *
 * If a server is already running on that port it is used. The intent is that only one server comes
 * up whether the user started it in a terminal themselves or the extension ran twice.
 */
export class PreviewServer {
    /**
     * One per port.
     *
     * Holding only one would mean discarding the previous target when starting the next. Moving
     * between the main checkout and a worktree would then restart the dev server every time and
     * make you wait. Keeping both alive means the second visit onward reuses them.
     */
    private readonly processes = new Map<number, ChildProcess>();

    constructor(private readonly output: vscode.OutputChannel) {}

    /**
     * @param toolPath Path to the preview tool (rn-preview)
     * @param target The RN project to preview and its declaration directory
     *
     * The tool receives which project to look at through environment variables. That is what lets
     * one copy of the tool move between projects. Per-project settings live in
     * `rn-preview.config.json` in the declaration directory, because they point at code that knows
     * that project's circumstances, such as module overrides.
     */
    async ensureRunning(toolPath: string, target: Target, basePort: number, timeoutMs: number): Promise<number> {
        const wanted = normalizeTarget(target);
        const port = await this.findPort(wanted, basePort);
        if (port === undefined) {
            throw new Error(
                `All ${PORT_RANGE} ports from ${basePort} are taken. Choose a different port in the settings.`,
            );
        }

        // If a server looking at the same target is already up, use it.
        if (await isTaken(port)) return port;

        // One that is not responding but still tracked is one we started that then died. Restart in its place.
        this.processes.get(port)?.kill();
        this.output.appendLine(`[rn-preview] Starting the dev server: ${wanted.projectPath} (port ${port})`);

        const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
            cwd: toolPath,
            env: {
                ...process.env,
                FORCE_COLOR: '0',
                MOBILE_APP_PATH: wanted.projectPath,
                PREVIEW_DIR: wanted.previewRoot,
                // Declares that this is a target the editor is looking at. Without this signal the
                // tool treats the run as ephemeral, like a capture, and does not refresh the
                // editor's alias file.
                RN_PREVIEW_EDITOR_TARGET: '1',
            },
        });
        this.processes.set(port, child);
        child.on('exit', () => {
            if (this.processes.get(port) === child) this.processes.delete(port);
        });

        await this.waitForReady(child, port, timeoutMs);
        return port;
    }

    /**
     * Decides which port this target uses.
     *
     * Reusing by port alone means using **a server that is drawing a different worktree.** The
     * screen comes up while the content is from another branch, which is hard to notice. The server
     * is asked what it is looking at and reused only when the target matches. A different target
     * steps to the next port.
     */
    private async findPort(target: Target, basePort: number): Promise<number | undefined> {
        for (let port = basePort; port < basePort + PORT_RANGE; port += 1) {
            const running = await askTarget(port);
            if (running !== undefined && sameTarget(running, target)) return port;
            if (running === undefined && !(await isTaken(port))) return port;
        }
        return undefined;
    }

    private waitForReady(child: ChildProcess, port: number, timeoutMs: number): Promise<void> {
        return new Promise((resolvePromise, rejectPromise) => {
            const timer = setTimeout(() => {
                rejectPromise(new Error(`The dev server did not come up within ${timeoutMs}ms. Check the log.`));
            }, timeoutMs);

            const settle = (error?: Error) => {
                clearTimeout(timer);
                if (error === undefined) resolvePromise();
                else rejectPromise(error);
            };

            const readChunk = (chunk: Buffer) => {
                const text = chunk.toString();
                this.output.append(text);
                if (READY_PATTERN.test(text)) settle();
            };

            child.stdout?.on('data', readChunk);
            child.stderr?.on('data', readChunk);
            child.on('error', (error) => settle(error));
            child.on('exit', (code) => {
                // If it went down after already coming up there is nothing to do here. settle only takes once.
                settle(new Error(`The dev server exited (code ${code ?? 'null'}). Check port ${port}.`));
            });
        });
    }

    /** Stops every server started. Called by command, so it does not discriminate by checkout. */
    stop(): void {
        for (const child of this.processes.values()) child.kill();
        this.processes.clear();
    }
}
