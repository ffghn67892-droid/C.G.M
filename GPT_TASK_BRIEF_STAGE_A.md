# GPT 작업 지시서 — Stage A (기존 저장 전환·실행취소 안전성·외부 내보내기)

> Claude가 작성했다. 먼저 [PROJECT_DEVELOPMENT_PLAN.md](PROJECT_DEVELOPMENT_PLAN.md)와 [CLAUDE_GPT_DEVELOPMENT_DISCUSSION.md](CLAUDE_GPT_DEVELOPMENT_DISCUSSION.md) 6~8절을 읽어라 — 이 지시서의 모든 결정은 그 두 문서의 합의에서 나왔다. 이 문서는 그 합의를 실제 파일 작업으로 쪼갠 것이다.
>
> 범위는 **A단계만**이다: 기존 저장 전환, revision·주기·종료 경계 실행취소, 외부 JSON 내보내기. B(알림·배지·입력 검증), C(가져오기 UI·빈 화면 UX), D(프리셋 확장)는 이 지시서 대상이 아니다.

## 역할 분담 (기존 Track1/Track2 원칙 유지)

Claude = Track 1(엔진·저장·변환·프리셋). GPT = Track 2(설정 화면의 저장 호출부, 내보내기 UI, 변환 결과 안내, 그리고 이번 단계에 한해 내보내기에 필요한 Electron IPC).

### 네가 소유하는 파일 (자유롭게 수정)

- `catalog-editor.js` — `openUniversalSettings`의 저장 호출부만. 마법사의 입력 검증 상한 정비는 B단계이니 이번엔 건드리지 마라.
- `setup.js`, `catalog-view.js`, `manager.css` — 이번 단계 요구사항에 필요한 범위에서.
- `preload.js`, `desktop-main.js` — **이번 단계 한정 예외**로 네게 연다. 목적은 오직 "내보내기 파일 저장" IPC 채널 추가뿐이다. 트레이·알람·리쥼 관련 기존 코드는 건드리지 마라.
- 네 레이어만 검증하는 새 테스트 파일(예: `tests/catalog-export-v2.test.cjs`) — 기존 테스트 파일은 건드리지 마라.

### 절대 건드리지 않을 파일 (Claude 소유, Track 1)

- `catalog-engine.js`, `legacy-migrations.js`, `catalog-presets.js`, `game-config.js`, `reward-ledger.js`, `app.js`
- `tests/catalog-*.test.cjs` 중 기존 파일들(새로 만드는 네 파일은 예외)
- `electron-main.js` — `preload.js`/`desktop-main.js`와 달리 이번 예외에 포함되지 않는다.
- `index.html`의 스크립트 로드 순서, `package.json`의 `build.files` — 새 파일이 필요하면 Claude에게 알려라.

## git 규칙 (기존과 동일)

1. `git add -A`/`git add .`/`git checkout .`/`git reset --hard` 쓰지 마라. 파일명을 명시해서만 스테이징해라.
2. 작은 단위로 자주 커밋해라. 브랜치는 나누지 않는다.
3. 커밋 전에 `npm.cmd test`를 돌려라.

## 무엇을 만들어야 하는가

### 1. 외부 JSON 내보내기

- 설정 화면 등 적절한 위치에 "데이터 내보내기" 버튼을 추가한다.
- 클릭 시 Claude가 제공할 `serializeStateForExport()`(아래 인터페이스 참고)의 반환값을 `JSON.stringify`해 파일로 저장한다.
- **Electron 환경**: `window.deckroom.saveTextFile(filename, content)` (네가 새로 만들 IPC, 아래 3번) 호출.
- **브라우저 환경**(`window.deckroom`이 없을 때): `Blob` + `<a download>`로 다운로드. `alerts.js`의 `playAlarm()`이 `if (window.deckroom) ... else { ... }`로 이미 이 분기를 쓰고 있으니 같은 패턴을 따라라.
- 파일명 예시: `deckroom-export-${YYYY-MM-DD}.json`.
- 저장 성공/실패를 사용자에게 짧게 알린다(기존 `toast()` 유틸이 있으면 그걸 써라).

### 2. 게임 기본 일정 저장 호출부 교체

- `catalog-editor.js:153`의 현재 코드:
  ```js
  game.resetSchedule = { dailyTime: time, weeklyDay: weekday };
  ```
  이 직접 대입을 없애고, Claude가 제공할 `updateResetSchedule(gameId, { dailyTime, weeklyDay })`(아래 인터페이스) 호출로 바꿔라. 이 함수가 이전 일정과 비교해 실제로 바뀐 규칙만 `revision`을 올리는 판정(계약 문서 §7.3 표)까지 전부 책임진다 — 너는 결과만 넘겨받는다.
- 이 함수가 던지는 에러(저장 실패)는 기존 `runCatalogAction` 실패 패턴과 동일하게 처리해라(에러 메시지 표시, 다이얼로그 유지).

### 3. Electron 내보내기 IPC (신규, 이번 단계 한정)

- `preload.js`에 추가:
  ```js
  saveTextFile: (suggestedName, content) => ipcRenderer.invoke('save-text-file', suggestedName, content)
  ```
  기존 API들은 `send`(편도)만 쓰지만, 파일 저장은 성공/실패/사용자 취소를 렌더러가 알아야 하므로 `invoke`/`handle`(왕복) 패턴을 새로 쓴다.
- `desktop-main.js`에 `dialog`, `fs`를 `require('electron')`/`require('fs')`에 추가하고, 다른 핸들러들처럼 `trusted(event)` 검사를 통과한 요청만 처리하는 `ipcMain.handle('save-text-file', ...)`을 추가해라. `dialog.showSaveDialog(mainWindow, { defaultPath: suggestedName })` → 사용자가 취소하면 `{ canceled: true }`류로 반환, 진행하면 `fs.writeFileSync(path, content, 'utf8')` 후 성공 반환.
- 기존 IPC 채널(`open-snap-shop`, `set-tray`, `game-alarm`)의 등록 방식과 `trusted()` 사용 패턴을 그대로 따라 스타일을 맞춰라.

### 4. 변환 결과 안내 배너

- 옛 저장을 새 모델로 변환하는 파이프라인은 Claude가 만든다(너는 건드리지 않는다). 변환 중 새 모델로 옮길 수 없었던 규칙이 있으면 Claude가 `state.games[id].profile.conversionNotice`(문자열 배열, 예: `["'일반 듀얼리스트'는 새 모델에 대응 항목이 없어 원본만 보관되었습니다."]`)에 채워 넣기로 했다 — 정확한 필드명은 Claude가 구현하며 확정되는 대로 이 문서와 TODO_TRACKER_REDESIGN.md §10에 반영해 알린다.
- 이 필드가 비어있지 않은 게임을 열면, 화면 상단에 한 번 보이는 안내 배너(닫기 가능)를 띄워라. 새로 만들 필요 없이 기존 배너/토스트 스타일을 재사용해라.
- 이 배너는 "무엇이 달라졌는지 알려주는" 역할만 한다. 원본 복구 UI, 재변환 버튼 등은 만들지 마라(이번 범위 밖).

## 네가 기대야 할 엔진 인터페이스 (Claude가 구현 중, 시그니처는 고정)

- `serializeStateForExport()` → `{ schemaVersion, exportedAt, games }` 형태의 JSON 직렬화 가능한 객체. 정확한 `games` 내부 필드는 확정되는 대로 알린다 — 지금은 "이 함수가 존재하고 JSON.stringify 가능한 값을 반환한다"만 믿고 버튼/저장 흐름을 만들어도 된다.
- `updateResetSchedule(gameId, { dailyTime, weeklyDay })` → 성공 시 `true` 반환, 실패 시 throw. 내부적으로 §7.3 판정표(시간만 변경/요일만 변경/동일 값 재저장/저장 실패)를 적용해 규칙별 `revision`을 갱신한다.
- `catalogAction(gameId, ruleId, 'undo')` — 호출 방식은 기존과 동일하다. 내부적으로 이제 `revision`·`periodKey`·활성 기간 일치 여부를 검사하지만, 네 쪽 호출 코드는 바뀔 게 없다.
- `state.games[id].profile.conversionNotice` — 위 4번 참고. 아직 필드명이 최종 확정 전이면 빈 배열로 가정하고 방어적으로(`|| []`) 읽어라.

이 함수들은 아직 실제로 구현되지 않았을 수 있다. Claude가 끝내기 전에 시작해도 된다 — 네 쪽 테스트에서 스텁을 만들어 검증해라. 계약이 바뀌면 Claude가 이 문서를 갱신하고 알린다.

## 하지 말아야 할 것

- 가져오기(import) UI를 만들지 마라 — C단계다. 이번엔 내보내기(쓰기 전용)만.
- `catalog-editor.js`의 슬롯/게이지 입력 검증 상한을 엔진과 맞추는 작업을 하지 마라 — B단계다.
- 보상 텍스트/종류/선택지를 다시 만들지 마라.
- `catalog-engine.js` 등 Track 1 소유 파일의 로직을 추측해서 고치지 마라.
- `electron-main.js`를 건드리지 마라 — 이번 예외는 `preload.js`/`desktop-main.js`에만 해당한다.
- `npm.cmd test`를 깨뜨리는 커밋을 남기지 마라.

## 완료 기준 / 보고

- `npm.cmd test` 통과(최소한 네가 추가한 테스트 파일들).
- 브라우저(`dev:web`)와 Electron(`npm start`) 양쪽에서 내보내기 버튼을 실제로 눌러 파일이 저장/다운로드되는지 확인. 저장 취소 시 에러 없이 정상 복귀하는지도 확인.
- 게임 기본 일정을 실제로 바꿔보고(시간만/요일만/동일값 재저장) 저장이 성공하는지 확인 — 내부 revision 검증은 Claude 쪽 테스트가 맡는다.
- 커밋 메시지에 무엇을 했는지, 어떤 인터페이스를 가정했는지 남겨라 — Claude가 나중에 리뷰한다.
