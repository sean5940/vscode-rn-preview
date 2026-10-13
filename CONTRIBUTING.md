# Contributing

_Korean: [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md)_

## Building

The extension ships the [`rn-preview`](https://github.com/sean5940/rn-preview) tool, so a build needs its
sources. A sibling clone is the default layout.

```bash
git clone https://github.com/sean5940/rn-preview.git ../rn-preview
npm install
npm run verify        # types · format · tests · bundle
npm run sync-tool     # copy rn-preview sources into tool/ (package:vsix runs it automatically)
npm run package:vsix  # produce the .vsix
```

To install the result into an editor:

```bash
code --install-extension "$(ls -1 vscode-rn-preview-*.vsix | tail -1)" --force
# Cursor on macOS
/Applications/Cursor.app/Contents/Resources/app/bin/cursor \
    --install-extension "$(ls -1 vscode-rn-preview-*.vsix | tail -1)" --force
```

## When the tool changes

`rn-preview` sources are copied into `tool/` and shipped inside the extension. The copy is not committed, so each
build pulls the sources as of that moment.

**The version has to be bumped for it to reach people who already installed.** `toolBootstrap` compares a stamp
against the extension version, so if the version is unchanged it keeps using the old copy even when the tool sources
are newer. Only first-time installers get the latest.

So after changing the tool, bump the version and rebuild.

```bash
npm version patch --no-git-tag-version
npm run package:vsix
```

When `rn-preview`'s main branch changes, a workflow does this instead.

| Repository          | Workflow            | What it does                                                        |
| ------------------- | ------------------- | ------------------------------------------------------------------- |
| `rn-preview`        | `notify-extension`  | On a push that changed tool sources, calls the extension repo       |
| `vscode-rn-preview` | `release-extension` | Verify · copy · bump · release the `.vsix` · publish to both stores |

To run it by hand, use `Run workflow` on the release workflow in the Actions tab. You can choose which part to bump
(patch · minor).

## Secrets

| Secret                     | Lives in            | Needed for                                                                            |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `EXTENSION_DISPATCH_TOKEN` | `rn-preview`        | Calling this repository's workflow. Fine-grained token: contents write here           |
| `VSCE_PAT`                 | `vscode-rn-preview` | Publishing to the VS Code Marketplace. Azure DevOps token, scope Marketplace › Manage |
| `OVSX_PAT`                 | `vscode-rn-preview` | Publishing to Open VSX, where Cursor and other VS Code forks install from             |

Each store step runs only when its token is set, so without them a run still produces the GitHub release.

`TOOL_REPO_TOKEN` is needed only when the tool repository is private. A public one checks out with the default
token.
