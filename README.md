# RN Preview

See React Native components in a VS Code · Cursor panel without building the app.

_Korean: [README.ko.md](README.ko.md)_

![Variants and device widths of one component, side by side](images/screenshot.png)

The drawing is done by the bundled [`rn-preview`](https://github.com/sean5940/rn-preview) tool's dev server,
which renders your components through `react-native-web`. This extension starts that server and mounts it in a panel.
No frames are captured and forwarded, so the panel responds without lag.

Every variant, device width, font scale and data state you declare sits side by side, which a real device can only
show one at a time. It is an approximation: what renders the same and what does not is listed in
[COMPATIBILITY](https://github.com/sean5940/rn-preview/blob/main/COMPATIBILITY.md).

To hand installation to a coding agent, pass [docs/AGENT-SETUP.md](docs/AGENT-SETUP.md) as-is.

## Install

- **VS Code**: from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=sean5940.vscode-rn-preview),
  or `code --install-extension sean5940.vscode-rn-preview`.
- **Cursor and other VS Code forks**: from [Open VSX](https://open-vsx.org/extension/sean5940/vscode-rn-preview), or
  `cursor --install-extension sean5940.vscode-rn-preview`.
- **Any editor**: download the `.vsix` from [Releases](https://github.com/sean5940/vscode-rn-preview/releases) and run
  `Extensions: Install from VSIX...`.

## Requirements

- VS Code 1.96 or later, or Cursor.
- Node.js 22 or later and npm, on the `PATH` the editor sees.
- Network access the first time a preview opens. The bundled tool installs its dependencies then (1–2 minutes).
- A React Native project: a folder whose `package.json` depends on `react-native`.

## Usage

1. Open an RN project. A folder that depends on `react-native` is picked as the target.
2. From a component source or a declaration file, press `▶ Open preview` above the component declaration.

The first open installs the tool into the extension's storage once. Nothing is left in the target project except the
declaration directory.

If there is no declaration, a draft is created on the spot and rendered. Two buttons sit at the top right of the panel.

| Button      | What it does                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `Refresh`   | Returns to the initial view, discarding variant and state changes made in cells, and reloads          |
| `Open code` | Opens the declaration you are looking at in an editor tab. Come back via `▶ Open preview` in that tab |

How to write a declaration (variants, widths, font scales, mocked responses, states) is in the
[rn-preview README](https://github.com/sean5940/rn-preview#declaration-files).

**The bundled tool is always used.** An `rn-preview` clone sitting next to it is not. If different code runs per
machine, the path that actually ships never gets verified. Point `rnPreview.projectPath` at your own clone only when
you are working on the tool itself.

## Worktrees and branches

Each checkout gets its own server. The extension asks a server which checkout it is looking at and reuses it only when
the target matches, stepping to the next port otherwise. Reuse a server by port alone and **you get one that is
drawing a different branch**: the screen renders, but the content is wrong.

To share declarations across branches, put an absolute path in `rnPreview.previewRoot`.

## Per-project settings

Anything that differs per project lives in `rn-preview.config.json` in the declaration directory. It points at code
that knows the project's circumstances, such as module overrides, so it cannot live in extension settings.

```json
{
    "sourceRoot": "src",
    "nonRenderingPackages": ["react-native-vision-camera"],
    "moduleOverrides": { "src/config/index.ts": "_overrides/appConfig.ts" },
    "importRedirects": [
        {
            "importerUnder": "src/ui/foundation",
            "from": "src/ui/index.ts",
            "to": "src/ui/foundation/index.ts"
        }
    ]
}
```

| Field                  | Meaning                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `sourceRoot`           | Directory holding the sources to preview. Declaration paths mirror the layout below it. Defaults to `.` |
| `nonRenderingPackages` | Packages to empty out because they draw nothing. `*` is allowed; there is no default                    |
| `moduleOverrides`      | Files to swap for a preview-only implementation. Values are relative to the declaration directory       |
| `rootProviders`        | Providers wrapped around every cell. Relative to the declaration directory                              |
| `importRedirects`      | Resolution redirected only inside a given directory, e.g. to cut a barrel cycle                         |

**Comments are not allowed.** This file is read with `JSON.parse`, so a `//` stops it with a "could not read the
preview config" error. The full field list is in the rn-preview README under
["Per-project settings"](https://github.com/sean5940/rn-preview#per-project-settings), and a copyable example is
[docs/rn-preview.config.example.json](https://github.com/sean5940/rn-preview/blob/main/docs/rn-preview.config.example.json).

`nonRenderingPackages` has no default, so leaving it out means any screen that brushes against a native package for
analytics, push, or permissions fails to mount entirely. The log names the module that was blocked.

## Commands

| Command                               | What it does                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `RN Preview: Open preview`            | Starts the server and opens the panel. With a declaration file open, selects it |
| `RN Preview: Open preview code`       | Opens the declaration you are looking at in an editor tab                       |
| `RN Preview: Restart preview server`  | Stops the server and starts it again                                            |
| `RN Preview: Stop preview server`     | Closes the server and the panel                                                 |
| `RN Preview: Show preview server log` | Shows the dev server's output                                                   |

If the title-bar buttons are missing, Cursor has collapsed the extension icons. Turn them on via
`Configure Icon Visibility` in the overflow menu. The `Refresh` and `Open code` buttons inside the panel are unaffected
by that setting.

## Settings

| Setting                    | Default    | Meaning                                                                      |
| -------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `rnPreview.projectRoot`    | (empty)    | Target RN project. Empty means an open folder that depends on `react-native` |
| `rnPreview.previewRoot`    | `previews` | Declaration directory, relative to the project                               |
| `rnPreview.projectPath`    | (empty)    | Path to the `rn-preview` tool. Empty means the bundled copy                  |
| `rnPreview.port`           | `5173`     | Base port for the dev server. One is taken per checkout                      |
| `rnPreview.startTimeoutMs` | `60000`    | How long to wait for the server to come up                                   |

## When nothing renders

Open `RN Preview: Show preview server log` first.

- `npm install failed`: the first-run install could not reach the npm registry. Check the network or proxy.
- `Not a source file under sourceRoot`: the file sits outside the `sourceRoot` of `rn-preview.config.json`.
- A cell fails to mount: a package that draws nothing (analytics, push, permissions) was loaded and threw on the web.
  The log names it; add it to `nonRenderingPackages`.
- A native view (a map, a video, a camera) is an empty box with the right size. That is expected: `react-native-web`
  has no counterpart, so only the layout around it is meaningful.

Tool-side diagnosis is in the rn-preview README under
["When nothing renders"](https://github.com/sean5940/rn-preview#when-nothing-renders).

## Contributing

Building, packaging, and how a tool change reaches the extension are in [CONTRIBUTING.md](CONTRIBUTING.md).
