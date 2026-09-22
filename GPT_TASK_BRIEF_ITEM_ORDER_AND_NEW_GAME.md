# GPT 작업 지시서 — 항목 순서 변경 + 새 게임 만들기 마법사 재설계

> Claude가 작성했다. 사용자가 직접 요청한 두 가지다: "새 게임 만들기의 UI와 UX도 개선해야 할 것 같다"(설정 다이얼로그 3종은 지난번에 재설계됐지만 새 게임 만들기 3단계 마법사는 그때 범위 밖이었다), "게임의 항목을 위 아래로 옮겨 배치를 바꿀 수 있도록 만들어"(규칙 구성 마법사에 순서 변경 수단이 없다).
>
> 이번 계획은 사용자가 Plan Mode에서 검토했고, 당신(GPT)이 다섯 가지를 지적해 반영했다: (1) "이동한 항목"과 "현재 편집 중인 항목"을 구분할 것, (2) 이동 후 포커스 복원, (3) `.settings-section`으로 감싸는 것만으로는 입력창 스타일이 해결되지 않으니 `.form-grid`로 감쌀 것, (4) "패스 건너뛰기"도 게임을 생성하는 커밋 버튼이니 설명·문구를 정확히 할 것, (5) 항목 순서 변경의 핵심 보존 조건(id·진행량·revision·실행취소 기록 유지)을 완료 기준에 넣을 것. 아래 지시서는 이미 그 다섯 가지를 반영한 최종안이다.
>
> 기준: 직전 포커스 수정 커밋 `dc74ada`(당신이 검증까지 마쳤다). 조사 결과 **엔진(Track 1) 변경이 전혀 필요 없다** — `catalogRules(g)`(catalog-engine.js:86)는 `g.ruleCatalog` 배열을 순서 그대로 반환하고, `updateCatalog(gameId, rules)`(game-config.js:35)는 id로만 매칭하며, `ruleRevisionKey(r)`(catalog-engine.js:156)는 순서를 전혀 포함하지 않는다. 즉 순서만 바꿔 기존 "규칙 저장" 버튼으로 커밋하면 끝 — 진행량·revision·실행취소 기록이 전부 안전하게 유지된다.

## 네가 소유하는 파일 (자유롭게 수정)

- `catalog-editor.js` — `mountUniversalEditor` 함수만(항목 순서 변경).
- `setup.js` — `openCustomSetup`/`openGameResetStep`/`openGamePassStep` 3개 함수만(새 게임 만들기 마법사).
- `manager.css` — 아래 CSS 추가만.

## 절대 건드리지 않을 파일

- `catalog-engine.js`, `legacy-migrations.js`, `catalog-presets.js`, `game-config.js`, `reward-ledger.js`, `app.js` — Track 1 소유. 이번 작업은 엔진 변경이 전혀 없다.
- `catalog-editor.js`의 나머지 부분(`openUniversalSettings`, `openRuleDetails` — 직전 설정 재설계·카드 표시 작업 범위, 이번엔 손대지 마라).
- `setup.js`의 `openCatalogEditor`(직전 설정 재설계에서 이미 손봤다 — 이번 범위 아님).

## git 규칙 (기존과 동일)

1. `git add -A`/`git add .`/`git checkout .`/`git reset --hard` 쓰지 마라. 파일명을 명시해서만 스테이징해라.
2. 작은 단위로 자주 커밋해라(파트 A/B를 별도 커밋으로 나눠도 좋다).
3. 커밋 전에 `npm.cmd test`를 돌려라(최소 79개 — 이번엔 엔진 변경이 없으니 기존 스위트가 그대로 통과해야 한다).

---

## 파트 A — 항목 순서 변경 (`catalog-editor.js`의 `mountUniversalEditor`)

`catalog-editor.js:365` 부근, 항목 전환 바를 아래로 교체한다:

기존:
```js
`<div class="settings-section-head">...</div><p class="wizard-help">...</p><div class="rule-nav">${draft.map((x, i) => `<button data-edit-rule="${i}" aria-pressed="${selected === i}">${escapeHtml(x.name)}</button>`).join('')}<button id="addTrackerRule">항목 추가</button></div>...`
```
`<div class="rule-nav">...</div>` 부분만 아래로 교체(그 앞뒤 마크업은 그대로 둔다):
```html
<div class="rule-order-list" role="list" aria-label="항목 순서">${draft
  .map(
    (x, i) => `<div class="rule-order-row" role="listitem">
      <button class="rule-order-name" data-edit-rule="${i}" aria-pressed="${selected === i}">${escapeHtml(x.name)}</button>
      <span class="rule-order-move">
        <button data-move-rule="${i}" data-move-dir="up" aria-label="${escapeHtml(x.name)} 위로 이동" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button data-move-rule="${i}" data-move-dir="down" aria-label="${escapeHtml(x.name)} 아래로 이동" ${i === draft.length - 1 ? 'disabled' : ''}>▼</button>
      </span>
    </div>`
  )
  .join('')}</div><button id="addTrackerRule">항목 추가</button>
```

`mountUniversalEditor` 함수 맨 위(`const draft = ...` 근처)에 렌더 후 포커스를 걸어야 할 선택자 후보 배열을 담을 변수를 하나 선언한다:
```js
let pendingFocus = null; // render() 끝에서 소비하는, 우선순위 순 선택자 배열
```

`render()` 함수 안, `host.innerHTML = ...`과 기존 `bind(...)` 호출들이 전부 끝난 다음(함수 맨 끝, `return` 전)에 추가:
```js
if (pendingFocus) {
  const target = pendingFocus.map(sel => host.querySelector(sel)).find(el => el && !el.disabled);
  target?.focus();
  pendingFocus = null;
}
```

`render()` 안의 기존 `bind(...)` 호출들 옆에 새 바인딩을 추가한다(`bind()`는 이미 `edit(() => fn(button))`으로 감싸므로 `capture()`가 먼저 실행돼 현재 편집 중인 입력값이 순서 변경 전에 안전하게 저장된다):
```js
bind('[data-move-rule]', button => {
  const i = Number(button.dataset.moveRule),
    dir = button.dataset.moveDir,
    j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= draft.length) return;
  const selectedId = draft[selected]?.id; // "지금 편집 중"인 항목 — B를 이동시켜도 A 편집은 유지되어야 한다
  [draft[i], draft[j]] = [draft[j], draft[i]];
  if (selectedId) selected = draft.findIndex(x => x.id === selectedId);
  const sameDirStillValid = dir === 'up' ? j > 0 : j < draft.length - 1;
  pendingFocus = [
    `[data-move-rule="${j}"][data-move-dir="${sameDirStillValid ? dir : dir === 'up' ? 'down' : 'up'}"]`,
    `[data-move-rule="${j}"][data-move-dir="${dir === 'up' ? 'down' : 'up'}"]`,
    `[data-edit-rule="${j}"]`
  ];
});
```

**왜 `selected`(편집 대상)와 포커스 대상을 분리하는가**: `selected`는 "지금 이름/세부값을 편집 중인 항목"을 가리킨다. 사용자가 A를 편집하다가 B의 ▲를 누르면, 편집 대상은 계속 A여야 한다 — 그래서 이동 전에 `draft[selected]`의 id를 먼저 저장해두고, 배열 교환 뒤 그 id의 새 인덱스로 `selected`를 복원한다. 반면 키보드 포커스는 방금 클릭한 ▲/▼ 버튼 쪽(즉 `j`, 방금 이동한 항목)에 남아야 연속으로 여러 번 눌러 계속 이동시킬 수 있다 — 이건 `selected`와 별개의 관심사라 `pendingFocus`로 따로 다룬다. 같은 방향 버튼이 경계(맨 위/맨 아래)에 도달해 비활성화됐으면 반대 방향 버튼으로, 그것도 없으면 항목 이름 버튼으로 폴백한다 — `catalog-view.js`의 완료 카드 포커스 복원(`dc74ada`)과 같은 패턴이다.

기존 `data-edit-rule` 클릭 핸들러(`selected = Number(...); step = 4;`)는 그대로 둔다 — 이름 버튼 자체의 동작은 안 바꾼다.

CSS 추가 (`manager.css`, 기존 `.rule-nav` 규칙 근처):
```css
.rule-order-list { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.rule-order-row { display: flex; align-items: center; gap: 8px; }
.rule-order-name { flex: 1; text-align: left; }
.rule-order-name[aria-pressed="true"] { border-color: var(--lime); }
.rule-order-move { display: flex; gap: 4px; flex: 0 0 auto; }
.rule-order-move button { width: 28px; height: 28px; padding: 0; display: grid; place-items: center; }
```

이 바는 5단계 중 어느 단계에서도 항상 렌더링되므로, 사용자는 이름/세부값을 편집하는 도중에도 언제든 순서를 바꿀 수 있다. 순서 변경은 로컬 `draft` 배열에서만 일어나고, "규칙 저장" 버튼(`#saveRuleCatalog`, `setup.js`)을 눌러야 `updateCatalog`를 통해 실제로 반영된다 — 새 엔진 호출은 전혀 필요 없다.

---

## 파트 B — 새 게임 만들기 마법사 재설계 (`setup.js`)

대상 3개 함수: `openCustomSetup`(171번 줄), `openGameResetStep`(205번 줄), `openGamePassStep`(229번 줄). 지난 설정 다이얼로그 재설계 때 만든 것과 **동일한 CSS 클래스를 재사용**한다(`manager.css`/`styles.css`에 이미 있다 — 새 CSS 추가 없음): `.settings-section`, `.settings-subsection`, `.section-kicker`, `.game-tab-mark`, `.wizard-steps`/`.wizard-step`/`.wizard-step.done`/`.wizard-step.current`, `.wizard-progress`, `.wizard-nav`/`.wizard-nav-primary`, `.dialog-back-row`, `button.primary`, `.form-grid`.

모든 input/select/button id는 그대로 유지 — 마크업 wrapping + 클래스 추가만.

**아이콘/키커** (3단계 전부, 새 색상 발명 없이 기존 팔레트 재사용):
- 1단계(이름/시작 구성): 키커 `이름`, `<span class="game-tab-mark lime">+</span>` — 사이드바 `#newGameTab`의 `+` 마크와 동일.
- 2단계(리셋 일정): 키커 `일정`, `<span class="game-tab-mark lime">⟳</span>` — 게임 설정 다이얼로그 "일정 & 알림" 섹션과 동일 아이콘/색.
- 3단계(패스): 키커 `패스`, `<span class="game-tab-mark violet">◈</span>`.

**입력창은 반드시 `.form-grid`로 감싼다.** `.settings-section`으로만 감싸면 `.form-grid input/select`(manager.css:28)의 어두운 배경 스타일이 안 걸려서 기존 밝은 기본 입력창이 그대로 남는다. 3단계 전부 확인해라: 1단계의 이름 입력과 프리셋 선택창, 2단계의 리셋 시각/요일, 3단계의 "패스 구매 여부" 선택창(**지금 코드는 `.form-grid` 밖에 있다 — 이번에 안으로 옮겨라**)과 구매일/종료일 입력.

### 1단계 — `openCustomSetup`

```html
<section class="settings-section">
  <span class="section-kicker">이름</span>
  <div class="settings-section-head"><span class="game-tab-mark lime">+</span><h3>게임 이름</h3></div>
  <div class="wizard-steps" role="list" aria-label="3단계 중 1단계">
    <span class="wizard-step current" role="listitem"><b>1</b></span>
    <span class="wizard-step" role="listitem"><b>2</b></span>
    <span class="wizard-step" role="listitem"><b>3</b></span>
  </div>
  <p class="wizard-progress">1 / 3 · 이름</p>
  <div class="form-grid"><label>게임 이름<input id="customGameName" maxlength="60" value="${escapeHtml(draft.name ?? GAMES.find(x => x[0] === existingId)?.[1] ?? '')}" /></label></div>
  ${presetOptions
    ? `<div class="settings-subsection">
        <div class="form-grid"><label>시작 구성<select id="customGamePreset">...(기존 옵션 그대로)</select></label></div>
        <p class="wizard-help">이전 고정 탭에 있던 게임을 고르면 그 게임의 일정·항목 구성(리셋 시각, 항목 이름·개수)을 그대로 채워줍니다. 보상 내용은 없습니다 — 저장 후에도 자유롭게 추가·수정할 수 있습니다.</p>
      </div>`
    : ''}
  <p id="customGameError" role="status"></p>
  <div class="wizard-nav"><div class="wizard-nav-primary"><button id="customSetupNext">다음</button></div></div>
</section>
```
기존 이벤트 리스너(`#customGamePreset` change, `#customSetupNext` click)는 로직 변경 없이 그대로 유지.

### 2단계 — `openGameResetStep`

같은 패턴: `.settings-section`(키커 `일정`, 아이콘 `⟳` lime) + `.wizard-steps`(`[done, current, neutral]`) + `.wizard-progress` + `.form-grid`로 감싼 리셋 시각/요일 입력 + 안내 문구(`wizard-help`, 기존 텍스트 유지) + `.wizard-nav .wizard-nav-primary`에 "다음" 버튼. "이전" 버튼(`#customSetupBack`)은 `.dialog-back-row`로 감싸 살짝 분리한다(항목 상세 설정의 "게임 설정으로" 버튼과 동일 패턴). 기존 이벤트 리스너·검증 로직은 그대로.

### 3단계 — `openGamePassStep`

같은 패턴: `.settings-section`(키커 `패스`, 아이콘 `◈` violet) + `.wizard-steps`(`[done, done, current]`) + `.wizard-progress`. "패스 구매 여부" 선택창을 `.form-grid`로 감싸고, 날짜 영역(`#gamePassDates`)의 `hidden` 토글 로직(`$('#gamePassActive')` change 리스너)은 그대로 유지 — 그 안의 구매일/종료일 입력도 이미 있던 `.form-grid`를 유지.

**버튼 역할**: `#createCustomGame`("완료")과 `#skipGamePass`는 **둘 다 `finish()`를 호출해 게임을 실제로 생성하는 커밋 버튼**이다(setup.js:246 — "완료 버튼에서만 저장한다"가 아니다, 착각하지 마라). 그래서:
- `#customSetupBack`("이전"): secondary, `.dialog-back-row`로 분리.
- `#createCustomGame`("완료"): **`class="primary"` 추가** — 패스 정보까지 채운 완전한 경로.
- `#skipGamePass`: secondary로 두되, **버튼 표시 텍스트를 "패스 없이 만들기"로 바꿔라**(id·클릭 핸들러는 그대로, 실제 동작 — 즉시 게임 생성 — 을 정확히 전달하기 위한 문구 수정일 뿐이다).

셋 다 `.wizard-nav .wizard-nav-primary` 행 안에 나열한다(이전 버튼은 `.dialog-back-row`로 별도 분리했으니 나머지 두 개만 이 행에 들어간다).

---

## 하지 말아야 할 것

- `catalog-engine.js` 등 Track 1 소유 파일을 건드리지 마라. 이번 작업은 엔진 변경이 전혀 없다.
- `openUniversalSettings`, `openRuleDetails`, `openCatalogEditor`(직전 설정 재설계 범위)를 건드리지 마라 — 이번 범위 아니다.
- 항목 순서 변경에서 `selected`(편집 대상)와 이동한 항목을 같은 변수로 취급하지 마라 — 위 "왜 분리하는가" 설명을 반드시 따라라.
- 순서 변경 버튼에 `disabled` 상태에서도 클릭되는 등 엔진이 거부할 리 없는 액션을 막지 마라 — 이건 순수 로컬 배열 조작이라 실패할 이유가 없다(엔진 검증은 "규칙 저장" 시점에 이미 있는 `validateTrackerRule`/`updateCatalog`가 처리한다).
- `npm.cmd test`를 깨뜨리는 커밋을 남기지 마라.

## 완료 기준 / 보고

- `npm.cmd test` 통과(최소 79개 — 이번엔 엔진 변경이 없으므로 정확히 79개여야 정상이다. 늘었다면 왜 늘었는지 보고서에 적어라).
- 브라우저에서 실제로 확인:
  - 규칙 구성 마법사에서 항목 2개 이상일 때 ▲/▼로 순서를 바꾼 뒤 "규칙 저장"하면 카드 목록(`renderUniversalGame`) 순서가 바뀌는지.
  - 순서만 바꿔 저장한 경우 규칙 id·진행량(`ruleProgress`)·revision·실행취소 기록(`actionHistory`)이 유지되는지(devtools로 저장 전후 `state.games[id]` 비교), 저장 후 기존 행동의 실행취소(undo)가 정상 작동하는지.
  - 저장하지 않고 다이얼로그를 닫으면(취소) 원래 순서가 유지되는지.
  - A 항목을 편집(이름/세부값 입력 단계)하는 도중 B 항목의 ▲/▼를 눌러도 편집 대상이 A로 유지되고 입력값이 사라지지 않는지.
  - 첫 항목의 ▲, 마지막 항목의 ▼가 비활성화되는지, 이동 버튼을 누른 뒤 포커스가 이동한 항목의 버튼(또는 규칙에 따른 대체 후보)으로 정상 복원되는지 — 실제 `document.activeElement`로 확인하고, 여러 번 연속으로 눌러 키보드만으로 끝까지 이동시킬 수 있는지도 확인.
  - 새 게임 만들기 3단계가 전부 섹션 카드 + 점 인디케이터 + 어두운 입력창 스타일로 보이는지.
  - 기존 동작(이름 길이 검증, 프리셋 선택 시 이름 자동 채움, 리셋 일정 검증, "패스 없이 만들기"와 "완료" 둘 다 게임이 실제로 생성되는지, 패스 날짜 검증)이 전부 그대로 작동하는지.
- 커밋 메시지에 무엇을 했는지 남겨라 — Claude가 나중에 diff와 브라우저로 직접 검증한다.
