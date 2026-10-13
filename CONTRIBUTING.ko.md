# 기여

_English: [CONTRIBUTING.md](CONTRIBUTING.md)_

## 만들기

확장은 [`rn-preview`](https://github.com/sean5940/rn-preview) 도구를 실어 나르므로 빌드에 그 소스가
필요합니다. 옆 디렉토리에 클론하는 배치가 기본입니다.

```bash
git clone https://github.com/sean5940/rn-preview.git ../rn-preview
npm install
npm run verify        # 타입·포맷·테스트·번들
npm run sync-tool     # rn-preview 소스를 tool/ 로 복사 (package:vsix 가 자동 실행)
npm run package:vsix  # .vsix 만들기
```

만든 결과를 편집기에 넣을 때는 아래를 씁니다.

```bash
code --install-extension "$(ls -1 vscode-rn-preview-*.vsix | tail -1)" --force
# macOS 의 Cursor
/Applications/Cursor.app/Contents/Resources/app/bin/cursor \
    --install-extension "$(ls -1 vscode-rn-preview-*.vsix | tail -1)" --force
```

## 도구가 바뀌면

`rn-preview` 소스는 `tool/` 로 복사돼 확장에 실립니다. 사본은 커밋하지 않으므로 다시 만들 때마다 그 시점 소스를
새로 가져옵니다.

**판을 올려야 이미 설치한 사람에게 넘어갑니다.** `toolBootstrap` 은 확장 판으로 스탬프를 비교합니다. 판이 그대로면
도구 소스가 새것이어도 예전 사본을 계속 씁니다. 처음 설치하는 사람만 최신을 받습니다.

그래서 도구를 고친 뒤에는 판을 올려 다시 만듭니다.

```bash
npm version patch --no-git-tag-version
npm run package:vsix
```

`rn-preview` 의 main 이 바뀌면 이 과정을 워크플로가 대신합니다.

| 저장소              | 워크플로            | 하는 일                                             |
| ------------------- | ------------------- | --------------------------------------------------- |
| `rn-preview`        | `notify-extension`  | 도구 소스가 바뀐 push 에서 확장 저장소를 부름       |
| `vscode-rn-preview` | `release-extension` | 검증·복사·판 올리기·`.vsix` 릴리스·두 스토어에 배포 |

손으로 돌리려면 Actions 탭에서 `Build and release the extension` 을 `Run workflow` 합니다. 올릴 자리(patch·minor)를
고를 수 있습니다.

## secret

| secret                     | 두는 곳             | 쓰는 곳                                                                |
| -------------------------- | ------------------- | ---------------------------------------------------------------------- |
| `EXTENSION_DISPATCH_TOKEN` | `rn-preview`        | 이 저장소의 워크플로 호출. fine-grained 토큰, 이 저장소 contents 쓰기  |
| `VSCE_PAT`                 | `vscode-rn-preview` | VS Code Marketplace 배포. Azure DevOps 토큰, 범위 Marketplace › Manage |
| `OVSX_PAT`                 | `vscode-rn-preview` | Open VSX 배포. Cursor 와 다른 VS Code 계열 편집기는 여기서 설치합니다  |

스토어 단계는 토큰이 있을 때만 돕니다. 토큰이 없어도 GitHub 릴리스는 만들어집니다.

`TOOL_REPO_TOKEN` 은 도구 저장소가 private 일 때만 필요합니다. public 이면 기본 토큰으로 체크아웃됩니다.
