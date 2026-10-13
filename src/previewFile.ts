import { realpathSync } from 'node:fs';
import { sep } from 'node:path';

const PREVIEW_FILE_PATTERN = /\.preview\.tsx$/;
const COMPONENT_FILE_PATTERN = /\.tsx$/;
const TEST_FILE_PATTERN = /\.(test|spec|stories)\.tsx$/;

/** Whether this is a preview declaration file. */
export const isPreviewFile = (path: string | undefined): path is string =>
    path !== undefined && PREVIEW_FILE_PATTERN.test(path);

/**
 * Whether this is a source file worth making a preview for.
 *
 * Any `.tsx` inside the target project, outside `node_modules`. Declaration files themselves, tests,
 * and stories are excluded. Which directory holds previewable sources (`sourceRoot`) and whether the
 * file actually exports a component are the tool's judgement; reading its config or the types here
 * would slow the editor down.
 */
export const isComponentSource = (path: string | undefined, mobileAppPath: string): path is string =>
    path !== undefined &&
    path.startsWith(`${mobileAppPath}${sep}`) &&
    !path.slice(mobileAppPath.length).split(sep).includes('node_modules') &&
    COMPONENT_FILE_PATTERN.test(path) &&
    !PREVIEW_FILE_PATTERN.test(path) &&
    !TEST_FILE_PATTERN.test(path);

/**
 * Normalizes to the path the dev server knows.
 *
 * Declaration files are usually opened through a symlink inside the target project. The path the
 * editor gives is the symlink side while the dev server holds the real path, so without resolving
 * it, the declaration cannot be matched.
 */
export const toRealPath = (path: string): string => {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
};
