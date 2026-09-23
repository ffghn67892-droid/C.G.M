# GPT 작업 지시서 — 사이드바 게임 탭 드래그 순서 변경 (UI/인터랙션)

> Claude가 작성했다. 사용자가 직접 요청한 기능이다: "왼쪽 게임 탭 이동 버튼의 순서를 바꿀 수 있도록 기능을 추가해줘. 탭을 누르고 드래그 하면 이동시킬 수 있도록 해." (사이드바에 KARDS/마블스냅/... 등록된 게임 탭이 세로로 나열된 스크린샷 첨부됨.)
>
> **데이터 계층은 이미 Claude가 구현·테스트·커밋했다** — 기준 커밋 `3836887`. `game-config.js`에 추가된 `orderedGameIds(ids)`/`moveGameOrder(id, beforeId)`를 그대로 갖다 쓰면 된다. 이번 지시서 범위는 **드래그 이벤트 바인딩과 시각 효과뿐**이다. 정렬 로직이나 저장 로직은 절대 새로 만들지 마라 — 이미 있다.

## 이미 있는 것 (그대로 믿고 써라)

- `orderedGameIds(ids)`(game-config.js): id 배열을 받아 `state.gameOrder` 기준으로 정렬해서 새 배열을 돌려주는 순수 함수. `overview.js`의 `renderNavigation()`(20-50번 줄)은 이미 이걸로 `registered` 목록을 정렬한 뒤 필터링하도록 고쳐져 있다(22-24번 줄) — **이 부분은 건드릴 필요 없다**, 그대로 쓰면 된다.
- `moveGameOrder(id, beforeId)`(game-config.js): `id`를 `beforeId` 바로 앞으로 옮기고(`beforeId`가 `null`이면 맨 끝) 전체 순서를 `state.gameOrder`에 저장까지 한다(`save()` 내부 호출 포함). **네가 할 일은 드래그 종료 시점에 정확한 `id`/`beforeId`를 계산해서 이 함수 한 번 호출하는 것뿐**이다.
- 이미 저장을 포함하므로, 이 함수 호출 뒤에 또 `save()`를 부를 필요 없다. 화면 갱신만 `renderNavigation()`으로 하면 된다(`renderAll()`은 안 써도 된다 — 게임 데이터는 안 바뀌었고 순서만 바뀌었으므로 메인 콘텐츠까지 다시 그리면 불필요한 깜빡임만 생긴다).

## 고쳐야 할 지점

**`overview.js:20-50` (`renderNavigation()`)** — 드래그 이벤트 바인딩과 시각 효과를 추가한다.

1. **`draggable` 속성**: 38번 줄, 등록된 게임 탭을 만드는 템플릿 리터럴의 `<button class="game-tab ...">`에 `draggable="true"`를 추가한다. **26번 줄의 "메인" 탭과 41번 줄의 "새 게임 만들기" 버튼에는 절대 추가하지 마라** — 이 둘은 드래그 대상도 드롭 대상도 아니다.

2. **이벤트 바인딩**: 42-48번 줄의 기존 클릭 리스너 루프(`$$('.game-tab[data-game]').forEach(b => b.addEventListener('click', ...))`) 옆에, 같은 선택자로 드래그 리스너들을 추가한다. 단 **"메인"(`data-game="overview"`)은 드래그/드롭 로직에서 제외**해야 하므로, 셀렉터를 그대로 쓰되 각 핸들러 안에서 `b.dataset.game === 'overview'`면 바로 return하거나, 애초에 `querySelectorAll('.game-tab[data-game]:not([data-game="overview"])')`처럼 셀렉터에서 걸러도 된다 — 편한 쪽으로 해라.

   - `dragstart`: 드래그 중인 요소의 `id`(즉 `b.dataset.game`)를 클로저 변수(예: `let draggingId = null;`, `renderNavigation()` 함수 맨 위에 선언)에 저장하고, 그 버튼에 `.dragging` 클래스를 추가한다. `event.dataTransfer.effectAllowed = 'move'`도 설정해라(브라우저 기본 드래그 고스트 이미지·커서 힌트에 필요).
   - `dragover`: **`event.preventDefault()`를 반드시 호출**해야 `drop` 이벤트가 발생한다(HTML5 드래그앤드롭의 기본 동작). `draggingId`와 대상 탭이 같으면 아무것도 안 한다(자기 자신 위 드래그는 무시). 아니면 `event.clientY`와 대상 탭의 `getBoundingClientRect()` 세로 중앙(`rect.top + rect.height / 2`)을 비교해서, 커서가 위쪽 절반이면 "이 탭 앞에 삽입"(그 탭에 `.drop-before` 클래스), 아래쪽 절반이면 "이 탭 뒤에 삽입"(`.drop-after` 클래스)으로 표시한다. 다른 탭에 이미 붙어있던 `.drop-before`/`.drop-after`는 새로 계산하기 전에 지워라(한 번에 하나의 탭에만 삽입선이 보여야 한다).
   - `dragleave`: 그 탭에서 벗어나면 `.drop-before`/`.drop-after`를 지운다.
   - `drop`: `event.preventDefault()` 호출 후, 그 시점까지 계산해둔 삽입 위치로 `beforeId`를 정한다 — "이 탭 앞"이면 `beforeId = b.dataset.game`(그 탭 자신의 id), "이 탭 뒤"면 그 탭의 **다음** 탭의 `data-game`(마지막 탭이면 `null`, 즉 맨 끝으로 이동)으로 정한다. `moveGameOrder(draggingId, beforeId)` 호출 후 `renderNavigation()`만 다시 부른다. 모든 `.dragging`/`.drop-before`/`.drop-after` 클래스는 이 재렌더로 자동 사라진다(매번 `innerHTML`을 통째로 다시 만드므로).
   - `dragend`: 드롭이 되든 안 되든(취소 포함) 항상 발생하는 이벤트다 — 혹시 위에서 놓친 `.dragging`/`.drop-before`/`.drop-after` 잔여 클래스를 정리하는 안전망으로 써라(정상 흐름이면 어차피 `renderNavigation()` 재호출로 사라지지만, 드롭 없이 Esc나 창 밖으로 드래그가 취소된 경우엔 `drop`이 안 불려서 재렌더가 안 일어난다 — 이때를 위한 정리다).

3. **CSS 추가** (`manager.css` 또는 `styles.css`, 기존 `.game-tab`/`.game-tab.active` 옆 — 새 색상 발명 금지, `var(--lime)`만 재사용):

```css
.game-tab[draggable] { cursor: grab; }
.game-tab.dragging { opacity: 0.5; cursor: grabbing; }
.game-tab.drop-before { box-shadow: inset 0 2px 0 var(--lime); }
.game-tab.drop-after { box-shadow: inset 0 -2px 0 var(--lime); }
```
   (`box-shadow: inset`을 쓴 이유: 기존 `.game-tab.active`가 이미 `border-color`를 쓰고 있어서(styles.css:23) `border-top`/`border-bottom`을 새로 주면 레이아웃이 1-2px씩 밀릴 수 있다 — `inset box-shadow`는 레이아웃에 영향을 안 준다. 다른 방식이 더 낫다고 판단되면 바꿔도 된다, 요지는 "레이아웃 흔들림 없이 삽입선을 보여준다".)

## 하지 말아야 할 것

- `game-config.js`(Track 1 소유)를 고치지 마라. `orderedGameIds`/`moveGameOrder`는 이미 완성돼 있다.
- 정렬/저장 로직을 `overview.js`에 새로 만들지 마라 — `moveGameOrder` 한 번 호출로 끝나야 한다.
- "메인"과 "새 게임 만들기"를 드래그 가능하게 만들거나 드롭 타겟으로 취급하지 마라.
- 드롭 후 `renderAll()`을 부르지 마라(불필요한 전체 재렌더) — `renderNavigation()`이면 충분하다.
- `npm.cmd test`를 깨뜨리는 커밋을 남기지 마라. `tests/catalog-additional.test.cjs`에 이미 있는 사이드바 순서 테스트 4개(정확한 이름: "sidebar tabs render in GAMES order until the user drags one" 등)는 렌더링 결과만 확인하는 테스트라 이번 드래그 이벤트 추가로 깨지면 안 된다 — 만약 깨진다면 마크업 구조(탭 개수, `data-game` 속성)를 실수로 바꾼 것이니 확인해라.
- 작업이 끝나면 **반드시 커밋해라.**

## 완료 기준 / 보고

- `npm.cmd test` 통과(현재 기준 83개).
- 브라우저에서 실제 마우스 드래그로:
  - 탭 3개 이상의 순서를 바꿀 수 있는지.
  - 순서를 바꾼 뒤 새로고침(`F5`)해도 순서가 유지되는지(`state.gameOrder`가 `localStorage`에 저장됐는지).
  - "메인"과 "새 게임 만들기"는 드래그해도 움직이지 않고, 다른 탭을 그 위로 드래그해도 드롭 위치로 인식되지 않는지.
  - 드래그 후에도 일반 클릭으로 탭 전환(게임 화면 이동)이 정상 작동하는지 — 드래그 종료 시 실수로 클릭이 함께 발동해 의도치 않은 화면 전환이 일어나지 않는지.
  - 드래그를 시작했다가 취소(Esc 또는 사이드바 밖에 드롭)해도 시각 효과(`.dragging` 등)가 잔여로 남지 않는지.
- 커밋 메시지에 무엇을 했는지 남겨라 — Claude가 리뷰한다.
