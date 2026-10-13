import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        // Swaps the vscode module for a stand-in so extension code can run without launching an editor.
        alias: { vscode: fileURLToPath(new URL('./test/vscodeStub.ts', import.meta.url)) },
    },
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
    },
});
