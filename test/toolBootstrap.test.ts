import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { ensureTool } from '../src/toolBootstrap.ts';
import { resetState, window } from './vscodeStub.ts';

const buildContext = (extensionPath: string, storagePath: string, version = '0.1.0') =>
    ({
        extensionPath,
        globalStorageUri: { fsPath: storagePath },
        extension: { packageJSON: { version } },
    }) as never;

const output = window.createOutputChannel() as never;

beforeEach(() => {
    resetState();
});

describe('ensureTool', () => {
    // It uses the extension's own storage, so nothing is left in the target project.
    test('does nothing when there is no bundled tool', async () => {
        const extensionPath = mkdtempSync(join(tmpdir(), 'ext-'));
        const storagePath = mkdtempSync(join(tmpdir(), 'storage-'));

        expect(await ensureTool(buildContext(extensionPath, storagePath), output)).toBeUndefined();
    });

    test('does not reinstall when the same version is already installed', async () => {
        const extensionPath = mkdtempSync(join(tmpdir(), 'ext-'));
        mkdirSync(join(extensionPath, 'tool'), { recursive: true });
        writeFileSync(join(extensionPath, 'tool', 'package.json'), '{}');

        const storagePath = mkdtempSync(join(tmpdir(), 'storage-'));
        const installed = join(storagePath, 'tool');
        mkdirSync(join(installed, 'node_modules'), { recursive: true });
        writeFileSync(join(installed, 'installed.json'), JSON.stringify({ version: '0.1.0' }));

        // If npm install ran, this test would take minutes. Returning immediately is what proves it did not.
        expect(await ensureTool(buildContext(extensionPath, storagePath), output)).toBe(installed);
    });
});
