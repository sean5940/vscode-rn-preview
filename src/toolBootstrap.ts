import { spawn } from 'node:child_process';
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';

/** Which version is installed. Bumping the extension changes this value and triggers a reinstall. */
const STAMP = 'installed.json';

const readStamp = (path: string): string | undefined => {
    try {
        return (JSON.parse(readFileSync(path, 'utf-8')) as { version?: string }).version;
    } catch {
        return undefined;
    }
};

const runNpmInstall = (cwd: string, output: vscode.OutputChannel): Promise<void> =>
    new Promise((resolvePromise, rejectPromise) => {
        const child = spawn('npm', ['install', '--no-audit', '--no-fund'], {
            cwd,
            env: { ...process.env, FORCE_COLOR: '0' },
        });

        child.stdout?.on('data', (chunk: Buffer) => output.append(chunk.toString()));
        child.stderr?.on('data', (chunk: Buffer) => output.append(chunk.toString()));
        child.on('error', rejectPromise);
        child.on('exit', (code) => {
            if (code === 0) resolvePromise();
            else rejectPromise(new Error(`npm install failed (code ${code ?? 'null'}). Check the log.`));
        });
    });

/**
 * Makes the bundled preview tool usable.
 *
 * The tool runs on Vite and react-native-web. Including those dependencies in the extension would
 * make the artifact hundreds of megabytes, so only the sources are shipped and installed once on
 * first use. They are installed in the extension's own storage, so nothing is left in the target
 * project.
 *
 * A bump in the extension version triggers a reinstall. A mismatch between the tool sources and the
 * installed dependencies is hard to diagnose.
 */
export const ensureTool = async (
    context: vscode.ExtensionContext,
    output: vscode.OutputChannel,
): Promise<string | undefined> => {
    const shipped = join(context.extensionPath, 'tool');
    if (!existsSync(join(shipped, 'package.json'))) return undefined;

    const installed = join(context.globalStorageUri.fsPath, 'tool');
    const stamp = join(installed, STAMP);
    const version = context.extension.packageJSON.version as string;

    if (readStamp(stamp) === version && existsSync(join(installed, 'node_modules'))) return installed;

    output.appendLine(`[rn-preview] Preparing the preview tool: ${installed}`);
    cpSync(shipped, installed, { recursive: true });

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Installing the preview tool (one time only)' },
        () => runNpmInstall(installed, output),
    );

    writeFileSync(stamp, JSON.stringify({ version }));
    return installed;
};
