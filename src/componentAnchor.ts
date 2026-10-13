/** `export const Badge = …` · `export function SubscriptionScreen() …` · `export default function …` */
const EXPORTED_VALUE = /^\s*export\s+(?:default\s+)?(?:const|function|class)\s+([A-Za-z_$][\w$]*)/;

const DECLARE_PREVIEW = /^\s*export\s+default\s+definePreview/;

const isPascalCase = (name: string): boolean => /^[A-Z]/.test(name);

/**
 * Finds the line to anchor the preview lens on.
 *
 * At the top of the file it floats above the import block, where you cannot see what it is a
 * preview of. It is placed directly above whatever that file opens as a preview.
 *
 * The selection rule matches the generator (`findComponent` in `analyzeComponent`): first a name
 * equal to the file name, otherwise the first exported PascalCase value. `export type` and
 * `export interface` are skipped because they are not values.
 */
export const componentLine = (lines: string[], fileName: string): number => {
    const declaration = lines.findIndex((line) => DECLARE_PREVIEW.test(line));
    if (declaration !== -1) return declaration;

    const exported = lines.flatMap((line, index) => {
        const name = EXPORTED_VALUE.exec(line)?.[1];
        return name !== undefined && isPascalCase(name) ? [{ name, index }] : [];
    });

    const expected = fileName.replace(/\.preview\.tsx$/, '').replace(/\.tsx?$/, '');
    const found = exported.find((candidate) => candidate.name === expected) ?? exported[0];

    return found?.index ?? 0;
};
