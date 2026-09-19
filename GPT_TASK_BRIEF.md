# GPT 작업 지시서 — DECKROOM "할 일 추적기" 개편, Track 2 (화면/입력)

> 이 문서는 Claude(프로젝트 매니저 역할)가 작성했다. 같은 저장소(`C:\Project_1`)에서 Claude와 병렬로 작업하기 위한 지시서다. 먼저 [TODO_TRACKER_REDESIGN.md](TODO_TRACKER_REDESIGN.md) 전체를 읽어라 — 이 프로젝트가 무엇이고 왜 이렇게 바뀌는지, 그리고 이 지시서의 모든 결정이 어디서 나왔는지가 그 문서에 있다.

## 너의 역할

너는 **Track 2 — 화면/입력**을 맡는다. Claude는 **Track 1 — 엔진/데이터**를 맡는다. 두 트랙은 파일이 겹치지 않게 나뉘어 있으니, 그대로 지켜라.

### 네가 소유하는 파일 (자유롭게 수정)

- `catalog-editor.js` — 규칙 추가/편집 마법사
- `catalog-view.js` — 게임 화면의 카드 렌더링
- `setup.js` — 새 게임 생성 흐름
- `manager.css` — 위 화면들의 스타일 (필요한 만큼)
- 네 레이어만 검증하는 새 테스트 파일 (예: `tests/catalog-view-v2.test.cjs`, `tests/catalog-editor-v2.test.cjs`) — 기존 테스트 파일은 건드리지 마라.

### 절대 건드리지 않을 파일 (Claude 소유, Track 1)

- `catalog-engine.js`, `legacy-migrations.js`, `catalog-presets.js`, `game-config.js`, `reward-ledger.js`
- `tests/catalog-*.test.cjs` 중 기존 파일들 (새로 만드는 네 파일은 예외)
- `index.html`의 스크립트 로드 순서, `package.json`의 `build.files` — 새 파일 추가/삭제가 필요하면 Claude에게 알리고 맡겨라. 직접 고치지 마라.

## 지켜야 할 git 규칙 (같은 폴더를 공유하기 때문에 중요함)

1. **`git add -A`, `git add .`, `git checkout .`, `git reset --hard` 절대 쓰지 마라.** 항상 네가 수정한 파일명을 명시해서 `git add catalog-view.js catalog-editor.js ...` 식으로만 스테이징해라. Claude가 아직 커밋하지 않은 작업 중인 파일을 건드릴 수 있다.
2. 작은 단위로 자주 커밋해라. 브랜치는 나누지 않는다 — 소유 파일이 겹치지 않으므로 `master`에 각자 커밋해도 충돌이 없다.
3. 커밋 전에 `npm.cmd test`를 돌려서 (적어도 네가 건드린 부분과 관련된 테스트가) 통과하는지 확인해라.

## 무엇을 만들어야 하는가

전체 배경과 확정된 설계는 [TODO_TRACKER_REDESIGN.md](TODO_TRACKER_REDESIGN.md)에 있다. 요약하면:

1. **보상 정보 완전 삭제**: 골드/카드/상자 등급 같은 보상 내용·선택지는 화면 어디에도 없어야 한다. 오직 "몇 개 남았는가"만 보여준다.
2. **새 게임 생성 마법사** (`setup.js`): 게임 이름 → 일일 리셋 시각 + 주간 리셋 요일 입력 → 패스 아이템 구매 여부(예/아니오, 예 선택 시 구매일·종료일 입력, 건너뛰기 가능) → 완료.
3. **새 규칙 추가 마법사** (`catalog-editor.js`): 이름 입력 → **포맷** 선택(일일/주간/지정 기간, 지정 기간이면 시작~종료일 입력) → **형태** 선택(슬롯형/게이지형) → 형태별 세부값 입력:
   - 슬롯형: 갱신 수, 최대 보유 수
   - 게이지형: 최소값~목표값(목표값), 마일스톤 지점들(선택)
   - 두 경우 모두 "이 항목만 리셋 시각을 게임 기본값과 다르게" 옵션(드물게 씀, 기본은 꺼짐)
4. **압축 카드 UI** (`catalog-view.js`) — TODO_TRACKER_REDESIGN.md 7절 참고. 현재(Stage K)의 아코디언+큰 박스 레이아웃을 완전히 버리고 항목당 작은 카드 하나로 바꾼다:
   - 카드에는 이름 + "남은 수"(슬롯형) 또는 현재값/목표값(게이지형)만 표시. 보상 텍스트 없음.
   - **카드 전체가 클릭 영역**이다. 슬롯형은 클릭 = 완료(held -= 1), 게이지형은 클릭 = +1. 둘 다 즉시 실제 상태에 반영되고 화면이 바로 갱신된다 — "반영" 확인 버튼 같은 건 없다.
   - 슬롯형은 남은 수가 0이 되면 카드가 화면에서 완전히 사라진다.
   - 게이지형은 **진짜 목표값**에 도달했을 때만 카드가 사라진다. 개인 목표(`foldTarget`)에 도달한 경우엔 카드는 남고 "달성" 표시만 뜬다. 마일스톤도 도달 시 "달성" 표시만 뜨고 사라지지 않는다.
   - 지정 기간 항목은 기간이 끝나면 자동으로 사라지지 않고 "종료됨" 표시 + 삭제 버튼이 뜬다. 사용자가 누르기 전까진 유지.
5. **실행취소 UI**: 최근 몇 번의 클릭을 순서대로 되돌릴 수 있는 목록/버튼을 어딘가에 둔다(카드 목록 위·아래 등 배치는 네 판단). Claude가 제공하는 `catalogAction(id, ruleId, 'undo')`를 호출하면 된다 — 어떤 클릭을 되돌릴지 UI에서 고를 수 있어야 한다(가장 최근 것부터 역순으로 하나씩, 또는 목록에서 특정 항목 선택).

## 네가 기대야 할 엔진 인터페이스 (Claude가 구현 중, 시그니처는 고정)

TODO_TRACKER_REDESIGN.md **10절 "엔진 인터페이스 계약"**에 정확한 데이터 모양과 함수 목록이 있다. 핵심만 요약:

- `catalogRules(g)` → 규칙 배열 (`format`, `kind`, 슬롯/게이지별 필드)
- `ruleProgress(g, r)` → 진행도 객체 (`held` 또는 `value`/`foldTarget`/`collapsed`/`achievedMilestones`)
- `catalogAction(gameId, ruleId, action, payload)` → `'complete'`/`'increment'`/`'undo'`/`'manual-add'`/`'manual-remove'`/`'delete-rule'`/`'bump-pass-level'`
- `universalStatus(g)` → `{color, label, count}` (사이드바 배지용, 이미 Stage K7 화면에 연결돼 있음 — 값 계산 방식만 바뀜)
- `state.games[id].actionHistory` → 실행취소용 최근 액션 배열 (엔진이 관리, 너는 읽기만)

**이 함수들은 아직 실제로 구현되지 않았을 수 있다.** Claude가 구현을 끝내기 전에 시작해도 된다 — 위 시그니처를 그대로 신뢰하고 화면을 만들어라. 필요하면 네 쪽 테스트에서 임시 스텁(가짜 함수)을 만들어 검증해도 된다. 계약이 바뀌면 Claude가 TODO_TRACKER_REDESIGN.md 10절을 갱신하고 알린다 — 그 전까지는 이 문서 그대로 믿어도 된다.

## 하지 말아야 할 것

- 보상 텍스트/종류/선택지를 다시 만들지 마라(이번 개편의 핵심 취지가 그걸 없애는 것이다).
- `catalog-engine.js` 등 Track 1 소유 파일의 로직을 추측해서 직접 고치지 마라 — 인터페이스 계약에 없는 게 필요하면 Claude(사용자를 통해)에게 요청해라.
- `npm.cmd test`를 깨뜨리는 커밋을 남기지 마라.

## 완료 기준 / 보고

- `npm.cmd test` 통과 (최소한 네가 추가한 테스트 파일들)
- 브라우저에서 새 게임 생성 → 규칙 추가(슬롯형·게이지형 각 1개 이상) → 카드 클릭으로 완료/증가 → 실행취소 → 지정 기간 규칙 종료 후 삭제까지 한 번 실제로 눌러서 확인
- 커밋 메시지에 무엇을 했는지, 어떤 인터페이스를 가정했는지 남겨라 — Claude가 나중에 리뷰한다.
