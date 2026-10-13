import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import * as vscode from 'vscode';

const PROJECT_NAME = 'rn-preview';

type Manifest = { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

const readManifest = (path: string): Manifest | undefined => {
    const manifest = resolve(path, 'package.json');
    if (!existsSync(manifest)) return undefined;

    try {
        return JSON.parse(readFileSync(manifest, 'utf-8')) as Manifest;
    } catch {
        return undefined;
    }
};

const isPreviewProject = (path: string): boolean => readManifest(path)?.name === PROJECT_NAME;

/**
 * Remembers the verdict per directory.
 *
 * The lens asks on every file open, and getting an answer walks up the parent directories. Reading
 * package.json each time slows the editor down by that much. Project boundaries do not change
 * while you are editing.
 */
const reactNativeProjects = new Map<string, boolean>();

/**
 * Whether this is a React Native project.
 *
 * Not found by name or by directory, which would make a tool that fits one repository only.
 * Depending on `react-native` is a test that holds for any project.
 */
const isReactNativeProject = (path: string): boolean => {
    const remembered = reactNativeProjects.get(path);
    if (remembered !== undefined) return remembered;

    const manifest = readManifest(path);
    const dependsOnReactNative =
        manifest !== undefined &&
        (manifest.dependencies?.['react-native'] !== undefined ||
            manifest.devDependencies?.['react-native'] !== undefined);

    reactNativeProjects.set(path, dependsOnReactNative);
    return dependsOnReactNative;
};

/**
 * Finds the RN project this file belongs to.
 *
 * Worktree files sit outside the open folder. Fixing one project per window means the lens never
 * attaches to those files, forcing a new window per worktree. Walking up from the file lets one
 * window cover the main checkout and its worktrees together.
 */
const enclosingProject = (filePath: string): string | undefined => {
    const { root } = parse(filePath);
    let directory = dirname(filePath);

    while (!isReactNativeProject(directory)) {
        if (directory === root) return undefined;
        directory = dirname(directory);
    }

    return directory;
};

/**
 * Path to the `rn-preview` repository to use as the preview tool.
 *
 * Used only when set in configuration. Left empty, the bundled tool runs, so the same code runs
 * whether or not a clone exists on the machine.
 *
 * This used to search the open folders and their siblings and prefer a clone if one was found. That
 * meant **the path which actually ships never ran on a developer's machine**, so nobody saw
 * problems that only occur with the bundled tool. Point this setting at your own clone only when
 * working on the tool itself.
 */
export const findProjectPath = (): string | undefined => {
    const configured = vscode.workspace.getConfiguration('rnPreview').get<string>('projectPath')?.trim();
    if (configured === undefined || configured === '') return undefined;

    return isPreviewProject(configured) ? configured : undefined;
};

/**
 * Finds the path of the RN project to preview.
 *
 * Used to decide which files get an "Open preview" lens and which project the dev server is pointed
 * at.
 *
 * @param documentPath The file currently in view. The checkout this file belongs to is considered
 * first. Worktree files sit outside the open folder, so going by the open folder alone leaves no
 * option but to launch another window.
 *
 * Configuration wins when present. It says "look at this project", so it outranks the file's
 * location. With neither a file nor configuration, an open folder that depends on `react-native` is
 * used.
 */
export const findMobileAppPath = (documentPath?: string): string | undefined => {
    const configured = vscode.workspace.getConfiguration('rnPreview').get<string>('projectRoot')?.trim();
    if (configured !== undefined && configured !== '') {
        return isReactNativeProject(configured) ? configured : undefined;
    }

    const enclosing = documentPath === undefined ? undefined : enclosingProject(documentPath);
    if (enclosing !== undefined) return enclosing;

    return (vscode.workspace.workspaceFolders ?? [])
        .map((folder) => folder.uri.fsPath)
        .find((path) => isReactNativeProject(path));
};

/**
 * The declaration file directory, configured relative to the project.
 *
 * The default lives in the extension's configuration schema. Repeating it here would let the two
 * drift.
 */
export const findPreviewRoot = (projectPath: string): string => {
    const configured = vscode.workspace.getConfiguration('rnPreview').get<string>('previewRoot')?.trim();
    return configured === undefined || configured === '' ? projectPath : resolve(projectPath, configured);
};
