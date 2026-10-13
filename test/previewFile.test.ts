import { describe, expect, test } from 'vitest';
import { isComponentSource, isPreviewFile } from '../src/previewFile.ts';

const MOBILE_APP = '/Users/me/Source/my-rn-app';

describe('isPreviewFile', () => {
    test('identifies a declaration file', () => {
        expect(isPreviewFile('/repo/previews/ui/Badge.preview.tsx')).toBe(true);
    });

    test('rejects lookalike names', () => {
        expect(isPreviewFile('/repo/src/PreviewGrid.tsx')).toBe(false);
        expect(isPreviewFile('/repo/previews/Badge.preview.ts')).toBe(false);
        expect(isPreviewFile('/repo/previews/Badge.preview.tsx.map')).toBe(false);
    });

    test('is false when no editor is open', () => {
        expect(isPreviewFile(undefined)).toBe(false);
    });
});

describe('isComponentSource', () => {
    test('identifies tsx anywhere in the target project', () => {
        expect(isComponentSource(`${MOBILE_APP}/app/ui/components/badge/Badge.tsx`, MOBILE_APP)).toBe(true);
        expect(isComponentSource(`${MOBILE_APP}/src/components/Badge.tsx`, MOBILE_APP)).toBe(true);
        expect(isComponentSource(`${MOBILE_APP}/App.tsx`, MOBILE_APP)).toBe(true);
    });

    test('is false outside the repository', () => {
        expect(isComponentSource('/elsewhere/app/Foo.tsx', MOBILE_APP)).toBe(false);
        expect(isComponentSource(`${MOBILE_APP}-other/src/Foo.tsx`, MOBILE_APP)).toBe(false);
    });

    test('is false inside node_modules', () => {
        expect(isComponentSource(`${MOBILE_APP}/node_modules/some-ui/Badge.tsx`, MOBILE_APP)).toBe(false);
    });

    test('excludes declaration files, tests, and stories', () => {
        expect(isComponentSource(`${MOBILE_APP}/app/x/Badge.preview.tsx`, MOBILE_APP)).toBe(false);
        expect(isComponentSource(`${MOBILE_APP}/app/x/Badge.test.tsx`, MOBILE_APP)).toBe(false);
        expect(isComponentSource(`${MOBILE_APP}/app/x/Badge.stories.tsx`, MOBILE_APP)).toBe(false);
    });

    test('is false when it is not tsx', () => {
        expect(isComponentSource(`${MOBILE_APP}/app/lib/Utils.ts`, MOBILE_APP)).toBe(false);
    });
});
