import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { Target } from './previewServer.ts';

const run = promisify(execFile);

const GENERATOR = ['--experimental-strip-types', 'scripts/generatePreview.ts'];

/**
 * Gets the declaration file corresponding to a source file, creating a draft if there is none.
 *
 * The extension keeps no separate copy of the path calculation or the generation rules. It calls the
 * project's own script, so the two cannot drift.
 *
 * @param target Which checkout this source belongs to. Left unsaid, the script picks the app root
 * from its own default, and a worktree file is then rejected as "not under app".
 */
export const resolveDeclaration = async (
    toolPath: string,
    target: Target,
    sourcePath: string,
    output: vscode.OutputChannel,
): Promise<string | undefined> => {
    try {
        const { stdout } = await run('node', [...GENERATOR, sourcePath], {
            cwd: toolPath,
            env: { ...process.env, MOBILE_APP_PATH: target.projectPath, PREVIEW_DIR: target.previewRoot },
        });
        return stdout.trim();
    } catch (error) {
        output.appendLine(`[rn-preview] Could not create the declaration: ${(error as Error).message}`);
        return undefined;
    }
};
