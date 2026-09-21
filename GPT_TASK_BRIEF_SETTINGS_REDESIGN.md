# GPT 작업 지시서 — 게임 설정 다이얼로그 전면 재설계

> Claude가 작성했다. 사용자가 직접 지적한 내용이다: 게임 설정 관련 다이얼로그의 UI/UX가 "가독성도 없고, 구분도 없고, 설명도 부족하고, 구현된 스타일조차 박스와 버튼을 제외하면 거의 없다." 두 차례 재확인했고, "전면 재설계"(타이포그래피 계층 + 아이콘 + 버튼 역할별 색상 + 호버/포커스 강화)를 명시적으로 선택했다. **다른 대기 중인 작업(카드 상시 표시·배지 조건 개편)보다 이걸 먼저 처리해 달라는 우선순위 재조정 요청**이었다 — 그 작업은 별도 지시서로 나중에 온다.
>
> 이번 범위는 **설정 관련 다이얼로그 3개의 마크업/CSS 재구조화뿐**이다. 기능(이벤트 리스너, 검증 로직, 엔진 호출)은 단 하나도 바뀌지 않는다 — 모든 input id/button id/`data-*` 속성이 그대로 유지되고, 기존 `addEventListener` 코드는 손대지 않아도 계속 작동해야 한다.

## 대상 3개 다이얼로그

1. `openUniversalSettings(id)` — `catalog-editor.js:106-227` (게임 설정)
2. `mountUniversalEditor(initial, parent, initialSetup)` — `catalog-editor.js:228-412` (규칙 구성 5단계 마법사) + 그 셸인 `openCatalogEditor(gameId)` — `setup.js:46-63`
3. `openRuleDetails(id, ruleId)` — `catalog-editor.js:61-105` (항목 상세 설정)

셋 다 공용 셸 `openDialog(title, body)`(`setup.js:1-18`)를 쓴다 — 셸의 구조(백드롭, `.manager-dialog` 카드, `#dialogContent`, 닫기 버튼)는 그대로 두고 `<h2>` 타이포그래피만 보강한다.

## 네가 소유하는 파일 (자유롭게 수정)

- `catalog-editor.js` — 위 3개 함수의 반환 HTML/템플릿 리터럴만. 함수 본문의 로직(이벤트 리스너, 검증, `catalogAction`/`runCatalogAction`/`updateResetSchedule` 호출)은 건드리지 마라.
- `setup.js` — `openCatalogEditor`의 `openDialog(...)` 호출 인자만.
- `manager.css`, `styles.css` — 이번 작업에 필요한 새 클래스 추가 + `.rule-editor`/`.manager-dialog h2` 두 규칙 수정.

## 절대 건드리지 않을 파일

- `catalog-engine.js`, `legacy-migrations.js`, `catalog-presets.js`, `game-config.js`, `reward-ledger.js`, `app.js` — Track 1 소유.
- `catalog-view.js` — 이번 범위 아니다(카드 렌더링은 다음 지시서에서 다룬다).
- `tests/catalog-*.test.cjs` 중 기존 파일들, `package.json`.

## git 규칙 (기존과 동일)

1. `git add -A`/`git add .`/`git checkout .`/`git reset --hard` 쓰지 마라. 파일명을 명시해서만 스테이징해라.
2. 작은 단위로 자주 커밋해라.
3. 커밋 전에 `npm.cmd test`를 돌려라(이번 작업은 순수 마크업/CSS라 실패할 이유가 없어야 한다 — 혹시 실패하면 반드시 원인을 확인해라).

## 재사용해야 할 기존 디자인 시스템 (새 색상 발명 금지)

- `:root` 토큰(`styles.css:1`): `--ink #171918 · --panel #202321 · --line #383d39 · --muted #8d958e · --cream #f3f1e8 · --lime #c8ee72 · --coral #ff866e · --blue #8fc7dc · --yellow #f2cf68 · --danger-bg #5d2a2a · --danger-border #a35a5a · --danger-text #edf3e8`.
- `.section-kicker`(`styles.css:19`): 앱 기존 "작은 캡션 라벨" 패턴. 각 섹션 헤더 위에 붙인다.
- `.game-tab-mark`(`styles.css:24-30`): 22×22px 색상 배경 + 1글자 글리프 배지(`lime`/`blue`/`coral`/`violet`/`gold`/`yellow` 클래스). 각 섹션의 아이콘 배지로 재사용.
- `.wizard-help`(`styles.css:78`): 이미 쓰이는 설명 문구 스타일 — 비어 있던 곳(알림 섹션 등)에 채운다.
- `button.danger`(`manager.css:32`): 기존 위험 버튼 색 — 이번엔 공간적 분리(별도 섹션/행)까지 추가한다.
- **아이콘은 이모지 대신 유니코드 기호만 써라** — 앱 전체(`game-data.js`/`overview.js`/`index.html`)가 이미 `✦ ⌂ ✓ ! ◇` 같은 단색 유니코드 기호만 쓰고 컬러 이모지는 전혀 안 쓴다. 이번에 쓸 글리프: `⟳`(일정) `▦`(항목) `↓`(백업) `₩`(지출) `⚠`(위험) `▤`(슬롯 상세) `◎`(게이지 상세) `▦`(마법사 헤더, violet).
- 키커 라벨은 한국어로: `일정` `항목` `백업` `지출` `위험` `상세`.

## 버튼 역할 3단 구분 (이번에 새로 도입하는 관례)

- **주행동(`primary` 클래스 추가)**: 다이얼로그당 실제로 커밋하는 버튼 하나만 — `#saveUniversalSettings`, `#saveRuleCatalog`, `#saveFoldTarget`. 라임 배경.
- **보조(기본값, 클래스 추가 안 함)**: 나머지 전부(규칙 구성/내보내기/지출 기록/항목 추가/이전·다음/1개 추가·제거/게임 설정으로 등). 기존 올리브색 그대로.
- **위험(기존 `.danger` 유지)**: 이 게임 전체 초기화, 항목 삭제, 이 게임 초기화. 색은 그대로, **공간적으로 분리**한다(전용 섹션 또는 별도 행 + 상단 점선 구분선).

## 1. `openUniversalSettings` — 5개 섹션 카드로 재구성

`catalog-editor.js:112-118`의 현재 반환 HTML(하나의 flat 템플릿 리터럴)을 아래로 교체해라. **모든 id는 원본과 완전히 동일**하다 — `trackerResetTime`, `trackerResetWeekday`, `trackerPassActive`, `trackerPassDates`, `trackerPassPurchase`, `trackerPassEnd`, `resetAlert`, `fullAlert`, `saveUniversalSettings`, `trackerSettingsError`, `data-rule-detail`, `editUniversalRules`, `exportTrackerData`, `trackerExportStatus`, `field()`가 만드는 `data-field` 속성들, `recordUniversalSpending`, `resetUniversalGame`.

```js
openDialog(
  '게임 설정',
  `<section class="settings-section"><span class="section-kicker">일정</span><div class="settings-section-head"><span class="game-tab-mark lime">⟳</span><h3>일정 &amp; 알림</h3></div><p class="wizard-help">일일·주간 리셋 시각, 패스, 갱신 알림을 함께 저장합니다.</p><div class="form-grid"><label>일일 리셋 시각 (KST)<input id="trackerResetTime" type="time" value="${escapeHtml(reset.dailyTime)}" /></label><label>주간 리셋 요일<select id="trackerResetWeekday">${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((day, i) => `<option value="${i}" ${i === reset.weeklyDay ? 'selected' : ''}>${day}</option>`).join('')}</select></label><label class="check-field"><input id="trackerPassActive" type="checkbox" ${pass?.active ? 'checked' : ''} />패스 사용</label></div><div id="trackerPassDates" class="form-grid settings-subsection" ${pass?.active ? '' : 'hidden'}><label>구매일<input id="trackerPassPurchase" type="date" value="${escapeHtml(pass?.purchaseDate || '')}" /></label><label>종료일<input id="trackerPassEnd" type="date" value="${escapeHtml(pass?.endDate || '')}" /></label></div><label class="check-field"><input id="resetAlert" type="checkbox" ${g.profile?.alerts?.reset ? 'checked' : ''} />갱신 알림</label><label class="check-field"><input id="fullAlert" type="checkbox" ${g.profile?.alerts?.full ? 'checked' : ''} />보유 상한 알림</label><button id="saveUniversalSettings" class="primary">설정 저장</button><p id="trackerSettingsError" role="status"></p></section><section class="settings-section"><span class="section-kicker">항목</span><div class="settings-section-head"><span class="game-tab-mark blue">▦</span><h3>항목 상세 설정</h3></div><p class="wizard-help">슬롯 수량과 개인 목표를 조정합니다. 완료한 항목도 여기서 관리할 수 있습니다.</p><div class="rule-nav">${catalogRules(g).map((r, i) => `<button data-rule-detail="${i}">${escapeHtml(r.name)}</button>`).join('')}</div><button id="editUniversalRules">규칙 구성</button></section><section class="settings-section"><span class="section-kicker">백업</span><div class="settings-section-head"><span class="game-tab-mark gold">↓</span><h3>데이터 보관</h3></div><p class="wizard-help">모든 게임의 데이터를 JSON 파일로 내보냅니다.</p><button id="exportTrackerData">데이터 내보내기</button><p id="trackerExportStatus" role="status" aria-live="polite"></p></section><section class="settings-section"><span class="section-kicker">지출</span><div class="settings-section-head"><span class="game-tab-mark coral">₩</span><h3>현금 지출</h3></div><div class="form-grid">${field('amount', '금액', 0, 100000000)}${field('currency', '통화', 'KRW', 0, 'text')}${field('item', '항목', '', 0, 'text')}</div><button id="recordUniversalSpending">지출 기록</button><p>${escapeHtml(spendingText(g.profile))}</p></section><section class="settings-section danger-zone"><span class="section-kicker">위험</span><div class="settings-section-head"><span class="game-tab-mark settings-icon-danger">⚠</span><h3>위험 구역</h3></div><p class="wizard-help">항목, 진행도, 패스, 지출 기록을 포함한 모든 데이터를 삭제합니다. 되돌릴 수 없습니다.</p><button id="resetUniversalGame" class="danger">이 게임 전체 초기화</button></section>`
);
```

**주의**: 알림 체크박스(`resetAlert`/`fullAlert`)를 "일정 & 알림" 섹션으로 옮겼다 — 원래는 저장 버튼보다 아래 별도 `<h3>알림</h3>`에 있었는데, `#saveUniversalSettings`의 클릭 핸들러가 실제로 이 두 체크박스 값까지 같이 저장하고 있어서(코드 확인 필요 없음 — 그대로 둬라) 저장 버튼이 "무엇을 저장하는지"와 화면 배치가 안 맞았다. 이번에 저장 버튼 바로 위로 옮겨 그 불일치를 없앤다. 이벤트 리스너는 `id` 기준으로 찾으므로 위치 이동은 아무 영향 없다.

## 2. 규칙 구성 마법사 (`mountUniversalEditor`) — 헤더 + 5단계 점 인디케이터 + 위험 버튼 분리

`catalog-editor.js`의 `render()` 함수 안, 빈 상태 분기(`draft`가 비었을 때, 현재 `host.innerHTML = '...'` 한 줄짜리)를 아래로 교체:

```js
host.innerHTML =
  '<div class="settings-section-head"><span class="game-tab-mark violet">▦</span><h3>규칙 구성</h3></div><p class="wizard-help">항목 이름, 포맷, 형태를 차례로 입력합니다.</p><button id="addTrackerRule">항목 추가</button><p data-rule-error role="status"></p>';
```

그리고 `r`이 있을 때의 `host.innerHTML = ...` 큰 템플릿을 아래로 교체 (`body`/`draft`/`step`/`names`/`selected` 등 기존 변수는 그대로 쓴다):

```js
host.innerHTML = `<div class="settings-section-head"><span class="game-tab-mark violet">▦</span><h3>규칙 구성</h3></div><p class="wizard-help">항목 이름 → 포맷 → 형태 → 세부값 → 확인 순서로 입력합니다.</p><div class="rule-nav">${draft.map((x, i) => `<button data-edit-rule="${i}" aria-pressed="${selected === i}">${escapeHtml(x.name)}</button>`).join('')}<button id="addTrackerRule">항목 추가</button></div><div class="wizard-steps" role="list" aria-label="5단계 중 ${step + 1}단계">${names.map((n, i) => `<span class="wizard-step ${i === step ? 'current' : i < step ? 'done' : ''}" role="listitem"><b>${i + 1}</b></span>`).join('')}</div><p class="wizard-progress">${step + 1} / 5 · ${names[step]}</p><div class="form-grid">${body}</div><div class="wizard-nav"><div class="wizard-nav-primary">${step > 0 ? '<button id="wizardPrev">이전</button>' : ''}${step < 4 ? '<button id="wizardNext">다음</button>' : '<button id="editRuleStart">항목 수정</button>'}</div><div class="wizard-nav-danger"><button id="removeRule" class="danger">항목 삭제</button></div></div><p data-rule-error role="status"></p>`;
```

이 아래 `bind(...)` 호출들(`#addTrackerRule`, `[data-edit-rule]`, `#wizardPrev`, `#wizardNext`, `#editRuleStart`, `#removeRule`, 그리고 `format`/`kind`/`override` 필드 변경 리스너)은 전부 `host.querySelectorAll`/`host.querySelector`로 찾으므로 새 `<div>` 안에 중첩돼도 그대로 작동한다 — **건드리지 마라**.

**항목 삭제 확인 절차는 이번에 추가하지 않는다** — 시각적 분리(별도 줄, 점선 구분, 우측 정렬)만 한다. 확인 단계를 추가하려면 `bind('#removeRule', ...)` 핸들러 로직을 바꿔야 하는데, 그건 이번 마크업/CSS 전용 범위 밖이다. 필요하다고 판단되면 별도로 제안만 하고 구현하지는 마라.

`setup.js`의 `openCatalogEditor`도 함께 수정:

```js
function openCatalogEditor(gameId) {
  const g = state.games[gameId];
  openDialog(
    '규칙 구성',
    `<div id="catalogMount"></div><div class="wizard-commit"><button id="saveRuleCatalog" class="primary">규칙 저장</button>${isCustomGame(gameId) ? '<button id="resetCustomGame" class="danger">이 게임 초기화</button>' : ''}</div><p id="ruleSaveResult" role="status"></p>`
  );
  ...
```
(`...` 이하 기존 로직 그대로 — `id`는 안 바뀌었다.)

## 3. `openRuleDetails` — 헤더 강화

`catalog-editor.js:66-69`의 `openDialog(...)` 호출을 아래로 교체:

```js
openDialog(
  '항목 상세 설정',
  `<div class="settings-section-head"><span class="game-tab-mark ${rule.kind === 'slot' ? 'blue' : 'coral'}">${rule.kind === 'slot' ? '▤' : '◎'}</span><h3>${escapeHtml(rule.name)}</h3></div>${rule.kind === 'slot' ? `<p>남은 수 <strong>${progress.held}</strong> / ${rule.maxHeld}</p><div class="rule-nav"><button id="detailManualAdd" ${progress.held >= rule.maxHeld ? 'disabled' : ''}>1개 추가</button><button id="detailManualRemove" ${progress.held <= 0 ? 'disabled' : ''}>1개 제거</button></div>` : `<p>현재 ${progress.value} / ${rule.max}</p><label>개인 목표 (비워두면 사용 안 함)<input id="detailFoldTarget" type="number" min="${rule.min}" max="${rule.max}" step="1" value="${progress.foldTarget ?? ''}" /></label><p class="wizard-help">개인 목표에 도달하면 달성으로 표시합니다. 항목은 전체 목표에 도달할 때 사라집니다.</p><button id="saveFoldTarget" class="primary">개인 목표 저장</button>`}<p id="detailError" role="status"></p><div class="dialog-back-row"><button id="detailBack">게임 설정으로</button></div>`
);
```

**주의**: 게이지 안내 문구 "항목은 전체 목표에 도달할 때 사라집니다"는 **이번엔 그대로 둬라, 고치지 마라** — 별도 진행 중인 작업(카드가 더 이상 사라지지 않고 체크 표시로 남는 변경)이 끝나면 그 작업의 지시서에서 이 문구를 같이 고친다. 지금 미리 고치면 그 작업이 오기 전까지 오히려 화면 동작과 안 맞는 설명이 된다.

## 4. CSS 추가/수정 (`manager.css`)

```css
.settings-section { padding: 18px 20px; margin: 16px 0; border: 1px solid rgb(70, 83, 68); border-radius: 10px; background: rgb(29, 34, 29); }
.settings-section:first-child { margin-top: 4px; }
.settings-section .section-kicker { display: block; margin-bottom: 6px; }
.settings-section-head { display: flex; align-items: center; gap: 10px; }
.settings-section-head h3 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.settings-section .wizard-help { margin-top: 8px; }
.settings-section .form-grid { margin: 14px 0 4px; }
.settings-section .rule-nav { margin-top: 12px; }
.settings-subsection { margin-top: 12px; padding: 12px 14px; border: 1px dashed rgb(70, 83, 68); border-radius: 8px; background: rgba(0, 0, 0, 0.15); }
.settings-section.danger-zone { border-color: var(--danger-border); background: rgba(93, 42, 42, 0.16); margin-top: 26px; }
.game-tab-mark.settings-icon-danger { background: var(--danger-bg); color: var(--danger-text); border: 1px solid var(--danger-border); }
.manager-dialog button.primary { background: var(--lime); border-color: var(--lime); color: var(--ink); font-weight: 600; }
.manager-dialog button.primary:hover:not(:disabled) { background: rgb(179, 230, 100); border-color: rgb(179, 230, 100); }
.manager-dialog button:hover:not(:disabled) { border-color: var(--lime); background: rgb(61, 77, 54); }
.manager-dialog button.danger:hover:not(:disabled) { background: rgb(107, 51, 51); border-color: rgb(196, 108, 108); }
#addTrackerRule { border-style: dashed; border-color: var(--lime); color: var(--lime); background: transparent; }
#addTrackerRule:hover:not(:disabled) { background: rgb(43, 55, 34); }
.manager-dialog input:hover, .manager-dialog select:hover { border-color: rgb(140, 158, 128); }
.manager-dialog input:focus-visible, .manager-dialog select:focus-visible { border-color: var(--lime); }
.wizard-nav { display: flex; flex-direction: column; gap: 14px; margin-top: 18px; }
.wizard-nav-primary { display: flex; gap: 8px; flex-wrap: wrap; }
.wizard-nav-danger { display: flex; justify-content: flex-end; padding-top: 12px; border-top: 1px dashed rgb(70, 83, 68); }
.wizard-steps { display: flex; align-items: center; gap: 6px; margin: 14px 0 2px; }
.wizard-step { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgb(70, 83, 68); color: var(--muted); font: 600 10px "DM Mono", monospace; background: rgb(29, 34, 29); }
.wizard-step.done { border-color: var(--lime); color: var(--lime); background: rgb(43, 55, 34); }
.wizard-step.current { border-color: var(--lime); background: var(--lime); color: var(--ink); }
.wizard-commit { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; padding-top: 16px; border-top: 1px solid rgb(70, 83, 68); flex-wrap: wrap; }
.dialog-back-row { margin-top: 16px; }
```

`styles.css`에서 두 규칙 수정:

```css
/* .manager-dialog h2 { ... } 를 아래로 교체 — 이 규칙은 openDialog를 쓰는 모든 다이얼로그(새 게임 만들기 등)에 공통 적용된다. 셸 구조 자체는 안 바뀌므로 부작용 없는 순수 타이포그래피 보강이다. */
.manager-dialog h2 { margin: 0 0 4px; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
```

`manager.css`에서 기존 `.rule-editor` 규칙(하드코딩된 색상 버그, 팔레트 토큰 대신 `rgb(70, 80, 93)`을 썼다) 한 줄 수정:

```css
.rule-editor { margin: 18px 0px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; }
```

**중첩 확인 다이얼로그**(`#resetUniversalGame`/`#resetCustomGame` 클릭 핸들러 안의 `#confirmUniversalReset`/`#confirmCustomReset` 등, 별도 `openDialog(...)` 호출)는 이번에 건드리지 마라 — 기존 `.danger` 버튼 스타일이 이미 자동 적용되므로 색상 일관성은 유지된다. 1개 버튼짜리 단순 확인 화면을 섹션 카드로 감싸는 건 과설계다.

## 하지 말아야 할 것

- `catalog-view.js`, `catalog-engine.js` 등 이번 범위 밖 파일을 건드리지 마라.
- 이벤트 리스너 로직(검증, `catalogAction`/`runCatalogAction`/`updateResetSchedule` 호출, 에러 처리)을 바꾸지 마라 — 이번은 순수 마크업/CSS다.
- `openRuleDetails`의 "사라집니다" 문구를 고치지 마라(위 3번 참고).
- 항목 삭제에 확인 절차를 추가하지 마라(위 2번 참고).
- 새 색상을 발명하지 마라 — 위에 나열한 기존 토큰/색만 써라.
- `npm.cmd test`를 깨뜨리는 커밋을 남기지 마라.

## 완료 기준 / 보고

- `npm.cmd test` 통과(이번은 순수 마크업/CSS라 실패할 이유가 없어야 한다 — 실패하면 원인을 확인해라).
- 브라우저에서 실제로 확인:
  - 게임 설정을 열어 5개 섹션이 테두리 카드로 시각 분리되어 보이는지, 저장 버튼이 라임색으로 강조되고 위험 구역이 붉은 톤으로 분리되어 보이는지.
  - 규칙 구성 마법사를 열어 5단계 점 인디케이터가 현재 단계에 맞게 채워지는지, "항목 삭제"가 이전/다음 버튼과 분리된 별도 줄에 있는지.
  - 항목 상세 설정을 열어 아이콘+이름 헤더가 보이는지, 개인 목표 저장 버튼이 강조돼 보이는지.
  - 기존 동작(리셋 저장, 패스 체크박스 토글, 내보내기, 지출 기록, 게임 초기화, 규칙 추가/수정/삭제, 1개 추가/제거, 개인 목표 저장)이 전부 그대로 작동하는지 — 특히 알림 체크박스가 옮겨진 뒤에도 저장이 정상 반영되는지 반드시 확인해라.
- 커밋 메시지에 무엇을 했는지 남겨라 — Claude가 나중에 리뷰한다.
