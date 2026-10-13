import * as vscode from 'vscode';

const VIEW_TYPE = 'rnPreview.panel';

/** Whether the panel is the active tab. The title-bar buttons are enabled by this value. */
const ACTIVE_KEY = 'rnPreview.panelActive';

const OPEN_CODE = 'openCode';
const SHOW_LOG = 'showLog';

/** No first paint within this window means it is blocked rather than starting. */
const LOAD_TIMEOUT_MS = 15_000;

const buildHtml = (frameUrl: string, origin: string, nonce: string): string => `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta
            http-equiv="Content-Security-Policy"
            content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
        <style>
            html,
            body {
                height: 100%;
                margin: 0;
                background: #ffffff;
            }
            iframe {
                width: 100%;
                height: 100%;
                border: 0;
            }
            button {
                padding: 4px 10px;
                border: 1px solid var(--vscode-button-border, transparent);
                border-radius: 4px;
                background: var(--vscode-button-secondaryBackground, #3a3d41);
                color: var(--vscode-button-secondaryForeground, #ffffff);
                font-family: var(--vscode-font-family);
                font-size: 12px;
                cursor: pointer;
            }
            #actions {
                position: fixed;
                top: 8px;
                right: 8px;
                display: flex;
                gap: 6px;
                opacity: 0.55;
            }
            #actions:hover {
                opacity: 1;
            }
            /* A blank view gives no way to tell loading from failure, so it is covered. It lifts once loaded. */
            #status {
                position: fixed;
                inset: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                background: var(--vscode-editor-background, #ffffff);
                color: var(--vscode-descriptionForeground, #666666);
                font-family: var(--vscode-font-family);
                font-size: 13px;
                text-align: center;
                padding: 24px;
            }
            #status[hidden] {
                display: none;
            }
        </style>
    </head>
    <body>
        <iframe id="frame" src="${frameUrl}" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
        <div id="actions">
            <button type="button" id="refresh">Refresh</button>
            <button type="button" id="code">Open code</button>
        </div>
        <div id="status"><span id="message">Loading the preview…</span></div>
        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const status = document.getElementById('status');
            const message = document.getElementById('message');
            const frame = document.getElementById('frame');

            // The first address is held and put back verbatim on refresh, so there is somewhere to
            // return to even if the address changes inside.
            const source = frame.src;
            let timer;

            const armTimeout = () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    message.textContent = 'The preview server is not responding.';
                    // Refresh can arm this several times, so the button is added only once.
                    if (document.getElementById('log') !== null) return;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.id = 'log';
                    button.textContent = 'Show server log';
                    button.addEventListener('click', () => vscode.postMessage({ type: '${SHOW_LOG}' }));
                    status.appendChild(button);
                }, ${LOAD_TIMEOUT_MS});
            };

            document.getElementById('code').addEventListener('click', () => vscode.postMessage({ type: '${OPEN_CODE}' }));

            // Discards the variant and state chosen in a cell and returns to the initial view.
            document.getElementById('refresh').addEventListener('click', () => {
                message.textContent = 'Loading the preview…';
                status.hidden = false;
                frame.src = source;
                armTimeout();
            });

            frame.addEventListener('load', () => {
                clearTimeout(timer);
                status.hidden = true;
            });

            armTimeout();
        </script>
    </body>
</html>
`;

/** When no target could be decided. Says what to do instead of showing a blank view. */
const buildEmptyHtml = (nonce: string): string => `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta
            http-equiv="Content-Security-Policy"
            content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
        <style>
            body {
                height: 100vh;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--vscode-editor-background, #ffffff);
                color: var(--vscode-descriptionForeground, #666666);
                font-family: var(--vscode-font-family);
                font-size: 13px;
                text-align: center;
                padding: 24px;
            }
        </style>
    </head>
    <body>
        <p>
            Could not decide what to draw.<br />
            Open a component source or a declaration file, then open the preview again.
        </p>
    </body>
</html>
`;

/** CSP requires a nonce. It only means anything if the value differs every time. */
const buildNonce = (): string => Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');

/**
 * Appends a query to the dev server address.
 *
 * `Uri.with({ query })` must not be used. Its `toString()` re-encodes the query, so a path already
 * put through `encodeURIComponent` is wrapped twice (`%2F` becomes `%252F`). The dev server then
 * cannot find that path and draws the wrong declaration. `toString(true)` takes it as is and it is
 * joined by hand.
 */
const withQuery = (baseUrl: vscode.Uri, query: string): string => {
    const base = baseUrl.toString(true);
    return `${base}${base.includes('?') ? '&' : '?'}${query}`;
};

/** The checkout the preview is looking at. Holds the same thing as `Target` in `previewServer`. */
type Checkout = { projectPath: string; previewRoot: string };

/**
 * Puts the preview view in an editor panel.
 *
 * The dev server is mounted directly in an iframe rather than captured and forwarded. That needs no
 * protocol and no input injection, and it responds without lag inside the panel.
 *
 * Only one panel is used. A new tab every time you move between declaration files would clutter the
 * editor quickly.
 */
export class PreviewPanel {
    private panel: vscode.WebviewPanel | undefined;
    private declaration: string | undefined;
    private shown: Checkout | undefined;

    /**
     * @param onOpenCode Called when `Open code` inside the view is pressed.
     *
     * The same command is bound in the title bar, but Cursor collapses extension title-bar icons
     * into the overflow menu by default. A button inside the view is always visible regardless of
     * that setting.
     */
    constructor(
        private readonly onOpenCode: () => void,
        private readonly onShowLog: () => void,
    ) {}

    /** Open code has to know "the one you are looking at now". */
    get declarationPath(): string | undefined {
        return this.declaration;
    }

    /**
     * The checkout currently being drawn.
     *
     * Used when returning to the preview from a declaration file. Declarations live outside the
     * project, so they cannot say which checkout they belong to.
     */
    get checkout(): Checkout | undefined {
        return this.shown;
    }

    /** Code opens where the preview was. Pushing it aside again would make three columns. */
    get column(): vscode.ViewColumn {
        return this.panel?.viewColumn ?? vscode.ViewColumn.Beside;
    }

    show(baseUrl: vscode.Uri, previewFile: string | undefined, checkout: Checkout): void {
        // When the panel is the active tab there is no open source, so no target can be decided.
        // In that case whatever was being shown is kept.
        this.declaration = previewFile ?? this.declaration;
        this.shown = checkout;

        if (this.panel === undefined) {
            this.panel = vscode.window.createWebviewPanel(VIEW_TYPE, 'RN Preview', vscode.ViewColumn.Beside, {
                enableScripts: true,
                // Recreating it every time the tab is briefly hidden would restart the dev server each time.
                retainContextWhenHidden: true,
            });
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                void setActive(false);
            });
            this.panel.onDidChangeViewState((event) => setActive(event.webviewPanel.active));
            this.panel.webview.onDidReceiveMessage((message: { type?: string }) => {
                if (message.type === OPEN_CODE) this.onOpenCode();
                if (message.type === SHOW_LOG) this.onShowLog();
            });
        }

        const nonce = buildNonce();
        const origin = `${baseUrl.scheme}://${baseUrl.authority}`;

        // The list is not put in the panel. The editor tab already says what you are looking at.
        this.panel.webview.html =
            this.declaration === undefined
                ? buildEmptyHtml(nonce)
                : buildHtml(withQuery(baseUrl, `file=${encodeURIComponent(this.declaration)}&embed=1`), origin, nonce);
        this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Beside, false);
        void setActive(true);
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }
}

const setActive = (active: boolean): Thenable<unknown> =>
    vscode.commands.executeCommand('setContext', ACTIVE_KEY, active);
