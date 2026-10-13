# 에이전트 설치 가이드

코딩 에이전트가 그대로 실행하도록 쓴 절차입니다. 각 단계는 **실행할 명령과 통과 조건**으로 되어
있습니다. 통과 조건을 만족하지 못하면 다음 단계로 넘어가지 말고 그 단계의 "막히면"을 따릅니다.

_English: [AGENT-SETUP.md](AGENT-SETUP.md)_

이 확장은 그림을 직접 그리지 않습니다. `rn-preview` 도구의 개발 서버를 띄우고 그 화면을 편집기
패널에 답니다. 그래서 확장 설치가 끝나도 **처음 프리뷰를 열 때 도구를 한 번 더 설치**합니다.

## 0. 전제 확인

```bash
node -v
ls -d "/Applications/Cursor.app" 2>/dev/null || ls -d "/Applications/Visual Studio Code.app"
```

통과 조건: node 메이저 버전이 22 이상이고, Cursor 또는 VS Code 가 하나는 있음.

막히면: 편집기가 없으면 이 확장은 쓸 수 없습니다. 편집기 없이 프리뷰만 보려면 확장 대신
[rn-preview](https://github.com/sean5940/rn-preview) 를 직접 씁니다.

## 1. 확장 스토어에서 설치

VS Code 는 Visual Studio Marketplace 에서, Cursor 는 Open VSX 에서 설치합니다. 두 곳에 같은 빌드를 올립니다.

```bash
code --install-extension sean5940.vscode-rn-preview
/Applications/Cursor.app/Contents/Resources/app/bin/cursor --install-extension sean5940.vscode-rn-preview
```

쓰는 편집기의 줄만 실행합니다.

통과 조건: `successfully installed` 메시지. 통과하면 5단계로 건너뜁니다.

막히면: "not found" 는 그 스토어에 아직 없다는 뜻입니다. 1-a 부터 4 단계로 소스에서 빌드합니다.

## 1-a. 클론과 설치 (소스로 빌드할 때)

```bash
git clone https://github.com/sean5940/vscode-rn-preview.git
cd vscode-rn-preview
npm install
```

통과 조건: `npm install` 이 0 으로 끝남.

## 2. 검증

```bash
npm run verify
```

타입 검사, 포맷 검사, 테스트, 번들을 차례로 돕니다.

통과 조건: 네 단계가 모두 통과하고 `dist/extension.cjs` 가 생김.

막히면: 포맷 검사에서 걸리면 `npm run format` 으로 고친 뒤 다시 돕니다. 타입이나 테스트에서
걸리면 클론이 온전하지 않은 것이니 그 출력을 그대로 사용자에게 보고합니다. 임의로 코드를
고쳐 통과시키지 않습니다.

## 3. 설치 파일 만들기

**먼저 `rn-preview` 도구 소스가 있어야 합니다.** 확장은 그림을 직접 그리지 않고 그 도구를 실어
나르기 때문입니다. 형제 디렉토리에 두는 것이 기본입니다.

```bash
git clone https://github.com/sean5940/rn-preview.git ../rn-preview
npm run package:vsix
```

도구가 형제가 아닌 다른 곳에 있으면 복사만 경로를 지정해 부르고 따로 포장합니다.

```bash
node scripts/syncTool.mjs <rn-preview 경로>
npx vsce package --no-dependencies
```

통과 조건: `vscode-rn-preview-<버전>.vsix` 가 생김.

```bash
ls *.vsix
```

막히면: `프리뷰 도구를 찾지 못했습니다` 는 도구 소스가 그 자리에 없다는 뜻입니다. 위 클론이
`../rn-preview` 에 있는지 확인하거나 경로를 인자로 넘깁니다.

## 4. 편집기에 설치

Cursor:

```bash
/Applications/Cursor.app/Contents/Resources/app/bin/cursor \
  --install-extension "$(ls *.vsix | head -1)" --force
```

VS Code 면 `cursor` 자리에 `code` 를 씁니다.

통과 조건: `successfully installed` 메시지.

막히면: 명령을 못 찾으면 편집기의 명령줄 도구가 PATH 에 없는 것입니다. 위처럼 절대경로로
부르거나, 편집기 UI 에서 `Extensions: Install from VSIX...` 로 그 파일을 고릅니다.

## 5. 대상 프로젝트와 선언 디렉토리 정하기

편집기에서 RN 프로젝트를 엽니다. 확장은 `react-native` 를 의존하는 열린 폴더를 대상으로 잡습니다.
자동으로 못 잡거나 다른 폴더를 봐야 하면 설정으로 지정합니다.

| 설정                    | 언제                                                 |
| ----------------------- | ---------------------------------------------------- |
| `rnPreview.projectRoot` | 열린 폴더가 여럿이거나 대상이 하위 디렉토리일 때     |
| `rnPreview.previewRoot` | 선언을 기본값(`previews`) 밖에 둘 때                 |
| `rnPreview.projectPath` | 확장에 실린 도구 대신 로컬 `rn-preview` 클론을 쓸 때 |

**그리는 도구는 항상 확장에 실린 것입니다.** 옆에 `rn-preview` 클론이 있어도 쓰지 않습니다.
기기마다 다른 코드가 돌면 배포되는 경로가 정작 검증되지 않기 때문입니다. 도구 자체를 고칠 때만
`rnPreview.projectPath` 로 자기 클론을 가리킵니다.

**선언 디렉토리에는 편집기용 `tsconfig.json` 이 생깁니다.** 그 디렉토리를 대상 저장소 안에 둔다면
대상 저장소의 `.gitignore` 에 넣으세요. 넣지 않으면 그 생성물이 커밋 후보로 올라옵니다.

## 6. 첫 실행

컴포넌트 소스를 열고 컴포넌트 선언 위의 `▶ Open preview` 를 누릅니다.

**처음 한 번은 1~2분 걸리고 네트워크가 필요합니다.** 확장에 실린 도구 소스의 의존성을 그때
설치하기 때문입니다. 설치 위치는 확장 저장소라 대상 프로젝트에는 아무것도 남지 않습니다.
진행 상황은 `RN Preview: Show preview server log` 로 봅니다.

통과 조건: 패널에 컴포넌트가 그려지고, 우측 상단에 `Refresh`·`Open code` 버튼이 보임.

`Refresh` 는 처음 화면으로 되돌립니다. 칸에서 변형이나 상태를 바꿔 본 뒤 원래대로 보고 싶을 때
씁니다. 서버는 그대로 두고 화면만 다시 불러오므로 개발 서버 재시작과 다릅니다.

막히면: 로그에 `npm install 이 실패했습니다` 가 있으면 네트워크나 레지스트리 접근 문제입니다.
그 출력을 보고합니다. 서버는 떴는데 화면이 비면 선언을 못 찾은 것이니 5단계의 `previewRoot` 를
확인합니다.

## 설치가 끝났는지 판정

아래가 모두 참이면 끝난 것입니다.

- [ ] 편집기에 `successfully installed`. 스토어(1단계)에서든 3단계에서 만든 `.vsix` 로든
- [ ] 소스로 빌드했다면 `npm run verify` 통과
- [ ] 컴포넌트 소스에서 `▶ Open preview` 가 보임
- [ ] 패널에 컴포넌트가 그려짐
