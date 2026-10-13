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

| Repository          | Workflow            | What it does                                                     |
| ------------------- | ------------------- | ---------------------------------------------------------------- |
| `rn-preview`        | `notify-extension`  | On a push that changed tool sources, calls the extension repo    |
| `vscode-rn-preview` | `release-extension` | Verify · copy · bump · release the `.vsix` · publish to Open VSX |

To run it by hand, use `Run workflow` on the release workflow in the Actions tab. You can choose which part to bump
(patch · minor).

## VS Code Marketplace

The workflow does not publish to the Marketplace. It only accepts Azure DevOps tokens scoped to all organizations, and
those are [retired on 2026-12-01](https://devblogs.microsoft.com/devops/retirement-of-global-personal-access-tokens-in-azure-devops/).
Upload the `.vsix` from the GitHub release by hand instead:

1. Open the [publisher management page](https://marketplace.visualstudio.com/manage/publishers/sean5940).
2. For a new version, open the `···` menu on `RN Preview` and choose `Update`. Pick the `.vsix`.
3. The Marketplace verifies the package for a few minutes before the new version shows.

## Secrets

| Secret                     | Lives in            | Needed for                                                                  |
| -------------------------- | ------------------- | --------------------------------------------------------------------------- |
| `EXTENSION_DISPATCH_TOKEN` | `rn-preview`        | Calling this repository's workflow. Fine-grained token: contents write here |
| `OVSX_PAT`                 | `vscode-rn-preview` | Publishing to Open VSX, where Cursor and other VS Code forks install from   |

The Open VSX step runs only when its token is set, so without it a run still produces the GitHub release.

`TOOL_REPO_TOKEN` is needed only when the tool repository is private. A public one checks out with the default
token.
