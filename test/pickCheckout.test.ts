import { describe, expect, test } from 'vitest';
import { pickCheckout } from '../src/extension.ts';

const worktree = { projectPath: '/repo/worktree', previewRoot: '/previews' };
const main = { projectPath: '/repo/main', previewRoot: '/previews' };

describe('pickCheckout', () => {
    // A declaration lives outside the project (in the declaration directory), so walking up finds
    // no RN project. It then fell back to the open folder, and a screen that exists only in a
    // worktree died with "module not found".
    test('keeps the checkout being shown when on a declaration file', () => {
        expect(pickCheckout('/previews/screens/Only.preview.tsx', worktree, main)).toBe(worktree);
    });

    test('uses the checkout the file belongs to when on a source file', () => {
        expect(pickCheckout('/repo/worktree/app/screens/Only.tsx', main, worktree)).toBe(worktree);
    });

    test('uses the one found from the file when nothing was being shown', () => {
        expect(pickCheckout('/previews/screens/Only.preview.tsx', undefined, main)).toBe(main);
    });

    test('uses the one found from the file when no file is open', () => {
        expect(pickCheckout(undefined, worktree, main)).toBe(main);
    });
});
