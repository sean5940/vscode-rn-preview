# Agent setup guide

A procedure written for a coding agent to execute verbatim. Every step is a **command to run plus a pass condition.**
If a pass condition is not met, do not move on — follow that step's "If it blocks".

_Korean: [AGENT-SETUP.ko.md](AGENT-SETUP.ko.md)_

This extension does not draw anything itself. It starts the `rn-preview` tool's dev server and mounts its output in an
editor panel. So even after the extension is installed, **the tool is installed once more the first time you open a
preview.**

## 0. Check prerequisites

```bash
node -v
ls -d "/Applications/Cursor.app" 2>/dev/null || ls -d "/Applications/Visual Studio Code.app"
```

Pass condition: node major version 22 or higher, and at least one of Cursor or VS Code present.

If it blocks: without an editor this extension is unusable. To view previews without an editor, use `rn-preview`
directly instead of the extension.

## 1. Install from the extension store

VS Code installs from the Visual Studio Marketplace, Cursor from Open VSX. The same build is published to both.

```bash
code --install-extension sean5940.vscode-rn-preview
/Applications/Cursor.app/Contents/Resources/app/bin/cursor --install-extension sean5940.vscode-rn-preview
```

Run the line for the editor in use.

Pass condition: a `successfully installed` message. Then skip to step 5.

If it blocks: "not found" means that store does not carry it yet. Build it from source with steps 1-a to 4.

## 1-a. Clone and install (building from source)

```bash
git clone https://github.com/sean5940/vscode-rn-preview.git
cd vscode-rn-preview
npm install
```

Pass condition: `npm install` exits 0.

## 2. Verify

```bash
npm run verify
```

Runs type checking, format checking, tests, and bundling in order.

Pass condition: all four pass and `dist/extension.cjs` is produced.

If it blocks: a format-check failure is fixed with `npm run format`, then run it again. A type or test failure means
the clone is not intact — report that output to the user verbatim. Do not edit code to force it through.

## 3. Build the installable

**You need the `rn-preview` tool sources first**, because the extension does not draw anything itself — it ships that
tool. A sibling directory is the default layout.

```bash
git clone https://github.com/sean5940/rn-preview.git ../rn-preview
npm run package:vsix
```

If the tool lives somewhere other than a sibling, call the copy step with an explicit path and package separately.

```bash
node scripts/syncTool.mjs <path to rn-preview>
npx vsce package --no-dependencies
```

Pass condition: `vscode-rn-preview-<version>.vsix` is produced.

```bash
ls *.vsix
```

If it blocks: "could not find the preview tool" means the tool sources are not at that location. Check that the clone
is at `../rn-preview`, or pass the path as an argument.

## 4. Install into the editor

Cursor:

```bash
/Applications/Cursor.app/Contents/Resources/app/bin/cursor \
  --install-extension "$(ls *.vsix | head -1)" --force
```

For VS Code, use `code` in place of `cursor`.

Pass condition: a `successfully installed` message.

If it blocks: a "command not found" means the editor's CLI is not on PATH. Call it by absolute path as above, or use
`Extensions: Install from VSIX...` in the editor UI to pick the file.

## 5. Choose the target project and declaration directory

Open an RN project in the editor. The extension picks an open folder that depends on `react-native` as the target.
If it cannot find one, or you need a different folder, name it in settings.

| Setting                 | When                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `rnPreview.projectRoot` | Several folders are open, or the target is a subdirectory    |
| `rnPreview.previewRoot` | Declarations live outside the default (`previews`)           |
| `rnPreview.projectPath` | Using a local `rn-preview` clone instead of the bundled tool |

**The tool that draws is always the bundled one.** An `rn-preview` clone sitting next to it is not used. If different
code runs per machine, the path that actually ships never gets verified. Point `rnPreview.projectPath` at your own
clone only when you are working on the tool itself.

**A `tsconfig.json` for the editor is generated in the declaration directory.** If you keep that directory inside the
target repository, add it to that repository's `.gitignore`. Otherwise the generated file shows up as a commit
candidate.

## 6. First run

Open a component source and press `▶ Open preview` above the component declaration.

**The first run takes 1–2 minutes and needs network.** That is when the bundled tool sources have their dependencies
installed. They are installed in the extension's own storage, so nothing is left in the target project. Follow
progress with `RN Preview: Show preview server log`.

Pass condition: the component renders in the panel, and `Refresh` · `Open code` appear at the top right.

`Refresh` returns to the initial view. Use it after changing a variant or state in a cell and wanting the original
back. It leaves the server alone and only reloads the view, which is different from restarting the dev server.

If it blocks: `npm install failed` in the log is a network or registry access problem — report that output. If the
server came up but the view is empty, no declaration was found; check `previewRoot` from step 5.

## Deciding setup is done

Setup is finished when all of these hold.

- [ ] The editor reports `successfully installed`, from the store (step 1) or for the `.vsix` built in step 3
- [ ] When built from source, `npm run verify` passes
- [ ] `▶ Open preview` is visible from a component source
- [ ] The component renders in the panel
