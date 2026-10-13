/**
 * Stand-in for the `vscode` module used in tests.
 *
 * Seeing whether the extension code actually runs requires the editor API, but the point is to
 * check it without launching an editor, so only as much as is used is mimicked.
 */
export type Panel = {
    viewType: string;
    title: string;
    viewColumn: number;
    webview: {
        html: string;
        onDidReceiveMessage: (listener: (message: { type?: string }) => void) => void;
        /** Where a test presses a button inside the view. */
        post?: (message: { type?: string }) => void;
    };
    reveal: (column?: number, preserveFocus?: boolean) => void;
    onDidDispose: (listener: () => void) => void;
    onDidChangeViewState: (listener: (event: { webviewPanel: Panel & { active: boolean } }) => void) => void;
    dispose: () => void;
};

export const state = {
    commands: new Map<string, (...args: unknown[]) => unknown>(),
    settings: new Map<string, unknown>(),
    workspaceFolders: [] as { uri: { fsPath: string } }[],
    activeFilePath: undefined as string | undefined,
    errors: [] as string[],
    panels: [] as Panel[],
    codeLensProviders: [] as unknown[],
    outputLines: [] as string[],
    files: new Map<string, string>(),
    contexts: new Map<string, unknown>(),
    shownDocuments: [] as { path: string; viewColumn: number | undefined }[],
};

export const resetState = () => {
    state.commands.clear();
    state.settings.clear();
    state.workspaceFolders = [];
    state.activeFilePath = undefined;
    state.errors = [];
    state.panels = [];
    state.codeLensProviders = [];
    state.outputLines = [];
    state.files.clear();
    state.contexts.clear();
    state.shownDocuments = [];
};

class StubUri {
    constructor(
        readonly scheme: string,
        readonly authority: string,
        readonly path: string,
        readonly query: string,
        readonly fsPath: string,
    ) {}

    static parse(value: string): StubUri {
        const url = new URL(value);
        return new StubUri(url.protocol.replace(':', ''), url.host, url.pathname, url.search.replace('?', ''), value);
    }

    static file(path: string): StubUri {
        return new StubUri('file', '', path, '', path);
    }

    with(change: { query?: string }): StubUri {
        return new StubUri(this.scheme, this.authority, this.path, change.query ?? this.query, this.fsPath);
    }

    toString(): string {
        const query = this.query === '' ? '' : `?${this.query}`;
        return `${this.scheme}://${this.authority}${this.path}${query}`;
    }
}

export const Uri = StubUri;

export const ViewColumn = { Beside: -2 };
export const ProgressLocation = { Window: 10, Notification: 15 };

export class Range {
    constructor(
        readonly startLine: number,
        readonly startCharacter: number,
        readonly endLine: number,
        readonly endCharacter: number,
    ) {}
}

export class CodeLens {
    constructor(
        readonly range: Range,
        readonly command: { title: string; command: string },
    ) {}
}

export const window = {
    createOutputChannel: () => ({
        append: (text: string) => state.outputLines.push(text),
        appendLine: (text: string) => state.outputLines.push(text),
        show: () => undefined,
        dispose: () => undefined,
    }),
    showErrorMessage: (message: string) => {
        state.errors.push(message);
        return Promise.resolve(undefined);
    },
    withProgress: <T>(_options: unknown, task: () => Promise<T>) => task(),
    createWebviewPanel: (viewType: string, title: string, column: number): Panel => {
        const panel: Panel = {
            viewType,
            title,
            viewColumn: column,
            webview: {
                html: '',
                onDidReceiveMessage: (listener) => {
                    panel.webview.post = listener;
                },
            },
            reveal: () => undefined,
            onDidDispose: () => undefined,
            onDidChangeViewState: () => undefined,
            dispose: () => undefined,
        };
        state.panels.push(panel);
        return panel;
    },
    showTextDocument: (document: { path: string }, options?: { viewColumn?: number }) => {
        state.shownDocuments.push({ path: document.path, viewColumn: options?.viewColumn });
        return Promise.resolve(undefined);
    },
    get activeTextEditor() {
        return state.activeFilePath === undefined ? undefined : { document: { uri: { fsPath: state.activeFilePath } } };
    },
};

export const workspace = {
    getConfiguration: () => ({ get: (key: string) => state.settings.get(key) }),
    get workspaceFolders() {
        return state.workspaceFolders;
    },
    openTextDocument: (path: string) => Promise.resolve({ path }),
};

export const commands = {
    registerCommand: (name: string, handler: (...args: unknown[]) => unknown) => {
        state.commands.set(name, handler);
        return { dispose: () => undefined };
    },
    executeCommand: (name: string, key?: unknown, value?: unknown) => {
        if (name === 'setContext') state.contexts.set(String(key), value);
        return Promise.resolve(undefined);
    },
};

export const languages = {
    registerCodeLensProvider: (_selector: unknown, provider: unknown) => {
        state.codeLensProviders.push(provider);
        return { dispose: () => undefined };
    },
};

export const env = {
    asExternalUri: (uri: StubUri) => Promise.resolve(uri),
};
