/**
 * Copies the preview tool sources into the extension.
 *
 *   node scripts/syncTool.mjs [tool path]
 *
 * For previews to work from the extension alone, the tool has to be inside the published artifact.
 * Including its dependencies would make that hundreds of megabytes, so only the sources are shipped
 * and installed once on first use (`toolBootstrap.ts`).
 *
 * The copy is excluded from version control. The original is the single source of truth, and
 * committing the copy alongside it would let the two drift.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(here, '..');

/**
 * What makes up the tool. node_modules, dist, and tests are excluded.
 *
 * `tsconfig.paths.json` is excluded too. It is a relative path to the target project, so it gets
 * built against the build machine and points nowhere once installed. The tool's postinstall creates
 * an empty file to satisfy the extends in `tsconfig.json`, and the dev server rewrites the real
 * contents to match the target.
 */
const ENTRIES = [
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    'tsconfig.json',
    '.prettierrc.json',
    'index.html',
    'src',
    'scripts',
];

const source = resolve(process.argv[2] ?? join(extensionRoot, '..', 'rn-preview'));
const target = join(extensionRoot, 'tool');

if (!existsSync(join(source, 'package.json'))) {
    console.error(`Could not find the preview tool: ${source}`);
    process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const copied = ENTRIES.filter((entry) => existsSync(join(source, entry)));
copied.forEach((entry) => cpSync(join(source, entry), join(target, entry), { recursive: true }));

const missing = ENTRIES.filter((entry) => !copied.includes(entry));
if (missing.length > 0) console.warn(`Skipped because absent: ${missing.join(', ')}`);

console.log(`Bundled the tool: ${source} -> ${target} (${copied.length} entries)`);
