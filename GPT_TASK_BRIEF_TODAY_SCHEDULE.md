# GPT 작업 지시서 — 사용 시점 기준 회복 편집기 토글 + 메인 화면 오늘의 시간표

> Claude가 작성했다. 사용자가 직접 요청한 두 가지다. 데이터 계층(엔진)은 Claude가 이미 구현·테스트·커밋했다 — 기준 커밋 `760da70`. `TODO_TRACKER_REDESIGN.md` §10의 "`refillOnUse`" 및 "`todaySchedule(now)` / `realtimeRefreshList(now)`" 절을 먼저 읽어라 — 정확한 계약과 사용자와의 논의 경위가 거기 있다. 이번 지시서 범위는 **UI/편집기뿐**이다.

## 배경 요약 (읽고 시작해라)

1. **사용 시점 기준 회복(Part A)**: 포켓몬 포켓 "무료 팩"/"챌린지 파워", 듀얼링크스 "일반 듀얼리스트"는 실제 게임에서 고정 벽시계 시각이 아니라 "가득 찬 상태에서 소모되는 순간부터" 개별적으로 회복 카운트가 돈다. 사용자 확정 예시: 최대 2개 항목이 12:00에 2/2→1/2, 12:05에 1/2→0/2가 되면 13:00에 1/2, 14:00에 2/2로 회복된다(하나의 체인 타이머 — 소모할 때마다 새로 도는 게 아니다). 엔진에 `r.refillOnUse`(boolean)와 이를 처리하는 `settleRefillAnchor`/`syncOnUseRefill`이 이미 있다. **편집기에서 이 설정을 켜고 끌 수 있는 UI가 아직 없다** — 이번 지시서 1부.
2. **오늘의 시간표(Part B)**: 메인 화면에 오늘 KST 기준 갱신 시각표(`todaySchedule()`)와, 초단위 간격이라 고정 시각으로 볼 수 없는 항목들의 실시간 카운트다운 목록(`realtimeRefreshList()`)을 보여준다. 두 함수 다 이미 있고 순수 함수라 그대로 호출만 하면 된다 — 이번 지시서 2부.

## 네가 소유하는 파일 (자유롭게 수정)

- `catalog-editor.js` — `mountUniversalEditor`(편집기 1단계)와 `validateTrackerRule`/`validateTrackerInterval`만.
- `overview.js` — `renderOverview()`만.
- `catalog-view.js` — `updateCatalogClocks()`만(현재 빈 함수).
- `manager.css`/`styles.css` — 아래 필요한 만큼.

## 절대 건드리지 않을 파일

- `catalog-engine.js`/`game-config.js`/`catalog-presets.js` 등 Track 1 소유 파일. `refillOnUse`/`settleRefillAnchor`/`syncOnUseRefill`/`todaySchedule`/`realtimeRefreshList`/`ruleRemaining`은 이미 완성돼 있다 — 정렬·계산 로직을 새로 만들지 마라, 호출만 해라.
- `overview.js`의 `renderNavigation()`(사이드바 드래그, 별개 작업) — 이번 범위 아니다.

## git 규칙 (기존과 동일)

1. `git add -A`/`git add .`/`git checkout .`/`git reset --hard` 쓰지 마라.
2. 커밋 전 `npm.cmd test` 실행(최소 98개).
3. **작업이 끝나면 반드시 커밋해라.**

---

## 1부 — "사용 시점 기준 회복" 편집기 토글

### 1. `catalog-editor.js:337-354` (`mountUniversalEditor` 1단계, 포맷이 `interval`일 때)

현재:
```js
: r.format === 'interval'
    ? input('anchorTime', '기준 시각 (KST)', r.anchorTime ?? '00:00', 'time') +
      input('intervalMinutes', '갱신 간격 (분)', r.intervalMinutes ?? 480, 'number') +
      '<p class="wizard-help">기준 시각부터 이 간격마다 반복됩니다. 1~10080분 · 30분은 30, 8시간은 480을 입력하세요.</p>'
    : '<p class="wizard-help">게임의 기본 리셋 시각을 따릅니다.</p>');
```
체크박스를 추가하고, 체크 상태면 `anchorTime` 입력을 감춰라:
```js
: r.format === 'interval'
    ? `<label class="check-field"><input data-rule-field="refillOnUse" type="checkbox" ${r.refillOnUse ? 'checked' : ''} />사용 시점 기준 회복 (기준 시각 대신, 마지막으로 가득 찬 상태에서 줄어든 시점부터 간격마다 회복)</label>` +
      (r.refillOnUse ? '' : input('anchorTime', '기준 시각 (KST)', r.anchorTime ?? '00:00', 'time')) +
      input('intervalMinutes', '갱신 간격 (분)', r.intervalMinutes ?? 480, 'number') +
      (r.refillOnUse
        ? '<p class="wizard-help">가득 찬 상태에서 처음 줄어드는 순간부터 이 간격마다 하나씩 회복됩니다. 소모할 때마다 다시 시작하지 않습니다 — 예: 최대 2개가 12:00에 줄고 12:05에 또 줄면, 13:00과 14:00에 하나씩 순서대로 회복됩니다.</p>'
        : '<p class="wizard-help">기준 시각부터 이 간격마다 반복됩니다. 1~10080분 · 30분은 30, 8시간은 480을 입력하세요.</p>')
    : '<p class="wizard-help">게임의 기본 리셋 시각을 따릅니다.</p>');
```
체크박스의 `data-rule-field="refillOnUse"`는 나머지 `format`/`kind`/`override`와 같은 관례를 따라 `mountUniversalEditor` 안쪽, `for (const key of ['format', 'kind', 'override'])`로 `change` 리스너를 다는 부분(파일 맨 아래쪽)에 `'refillOnUse'`도 추가해야 체크 즉시 다시 렌더링돼 `anchorTime` 입력이 숨는다.

### 2. `capture()`(`catalog-editor.js:252-311`)

- 305번 줄 근처 `if (el('anchorTime')) r.anchorTime = el('anchorTime').value;` 위나 아래에 `if (el('refillOnUse')) r.refillOnUse = el('refillOnUse').checked;`를 추가해라(체크박스는 `.value`가 아니라 `.checked`를 읽어야 한다 — 이 파일에 체크박스를 읽는 다른 예시는 없으니 `resetOverride` 체크박스가 `el('override').checked`를 쓰는 305번 줄 위 296번 줄 패턴을 참고해라).
- 306-309번 줄의 `if (r.format !== 'interval') { delete r.anchorTime; delete r.intervalMinutes; }`에 `delete r.refillOnUse;`도 추가해라.
- **체크가 꺼지면(`refillOnUse`가 `false`/삭제됨) `r.anchorTime`이 없을 수 있다** — 그 경우 렌더링 시 위 1번 코드의 `r.anchorTime ?? '00:00'` 폴백이 이미 처리하므로 별도 작업 불필요.
- 268-283번 줄, `kind`가 `gauge`로 바뀌는 분기(이미 있음)에 `delete r.refillOnUse;`도 추가해라 — 이 설정은 슬롯형에서만 의미 있다(엔진의 `validateCatalog`가 `refillOnUse`면 `kind==='slot'`를 요구하므로, 안 지우면 게이지로 바꾼 뒤 저장 시 엔진에서 거부당한다).

### 3. `validateTrackerInterval`(`catalog-editor.js:29-37`)과 `validateTrackerRule`(`catalog-editor.js:38-72`)

지금 `validateTrackerInterval`은 무조건 `anchorTime`을 요구한다 — 엔진의 `validateCatalog`(catalog-engine.js)는 `refillOnUse`일 때 `anchorTime` 검증을 건너뛰므로, 편집기도 똑같이 맞춰야 한다(안 그러면 "편집기는 막는데 엔진은 허용"하거나 그 반대인 기존에 여러 번 나온 불일치가 재발한다):
```js
function validateTrackerInterval(rule) {
  if (rule.refillOnUse) {
    if (rule.kind !== 'slot') throw Error('사용 시점 기준 회복은 슬롯형에서만 사용할 수 있습니다.');
    if (!Number.isSafeInteger(rule.intervalMinutes) || rule.intervalMinutes < 1 || rule.intervalMinutes > 10080)
      throw Error('갱신 간격은 1~10080분의 정수로 입력하세요.');
    return;
  }
  if (
    !trackerTimeValid(rule.anchorTime) ||
    !Number.isSafeInteger(rule.intervalMinutes) ||
    rule.intervalMinutes < 1 ||
    rule.intervalMinutes > 10080
  )
    throw Error('기준 시각과 갱신 간격을 확인하세요. 간격은 1~10080분의 정수로 입력하세요.');
}
```
`validateTrackerRule`은 이미 `if (rule.format === 'interval') validateTrackerInterval(rule);`을 호출하므로 그대로 재사용된다 — 여기는 안 바꿔도 된다.

### 4. `wizardNext` 검증(`catalog-editor.js:417-430` 근처)

`if (step === 1 && r.format === 'interval') validateTrackerInterval(r);`는 이미 있다 — `validateTrackerInterval` 자체가 위에서 `refillOnUse`를 처리하므로 이 줄은 그대로 둬도 된다.

### 5. 확인 화면(`catalog-editor.js:386-387`, step 4)

`r.format === 'interval'` 분기가 무조건 `${r.anchorTime}` 기준 문구를 쓴다 — `refillOnUse`일 때는 그 필드가 없으므로 분기 추가:
```js
${
  r.format === 'fixed'
    ? `<p>${escapeHtml(r.startDate || '')} ~ ${escapeHtml(r.endDate || '')} ${escapeHtml(r.endTime || '')} KST</p>`
    : r.format === 'interval'
      ? r.refillOnUse
        ? `<p>사용 시점 기준 매 ${escapeHtml(intervalLengthText(r.intervalMinutes))}마다 회복</p>`
        : `<p>${escapeHtml(r.anchorTime || '')} 기준 매 ${escapeHtml(intervalLengthText(r.intervalMinutes))}마다 KST</p>`
      : `<p>리셋: ${r.resetOverride ? escapeHtml(r.resetOverride.time) : '게임 기본값'}</p>`
}
```
(엔진의 `ruleScheduleText`가 refillOnUse일 때 반환하는 문구 "사용 시점 기준 매 N마다 회복"과 표현을 맞췄다 — 그대로 따라가면 나중에 헷갈릴 일이 없다.)

### 완료 기준(1부)

- 새 규칙을 만들 때 포맷을 "시간 간격"으로 선택 → "사용 시점 기준 회복" 체크 → 기준 시각 입력이 사라지는지, 간격만 입력해도 저장되는지.
- 체크 해제 시 기준 시각 입력이 다시 나타나는지.
- 형태를 게이지형으로 바꾸면 체크가 자동으로 풀리는지(그리고 다시 슬롯형으로 돌아와도 꺼진 채로 남아있는지 — 사용자가 다시 켜야 함, 자동 복원 안 함).
- 기존 프리셋 규칙(포켓몬 포켓 "무료 팩", 듀얼링크스 "일반 듀얼리스트" — 둘 다 이미 `refillOnUse:true`) 을 편집기로 열면 체크박스가 이미 켜져 있고 기준 시각 입력이 안 보이는지, 그대로 저장해도 문제없는지.
- 확인 화면과 카드 화면(`catalog-view.js`, 이번 범위 아니지만 `ruleScheduleText`를 그대로 쓰는 곳이 있다면 자동으로 올바르게 뜨는지 정도만 확인, 코드 수정은 하지 마라)에 올바른 문구가 뜨는지.

---

## 2부 — 메인 화면 "오늘의 시간표" + "실시간 갱신 목록"

### 1. `overview.js:115-131` (`renderOverview()`) — `.overview-heading` 바로 다음, 게임 그리드 앞에 두 섹션 삽입

```js
function todayScheduleHtml() {
  const rows = todaySchedule();
  if (!rows.length) return '';
  const date = new Date(),
    weekday = ['일', '월', '화', '수', '목', '금', '토'][kstWeekday(date)],
    label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} (${weekday}요일) 오늘의 시간표`;
  return `<section class="guide-card today-schedule"><span class="section-kicker">일정</span><div class="settings-section-head"><span class="game-tab-mark lime">⟳</span><h3>${escapeHtml(label)}</h3></div>${rows
    .map(row => {
      const time = new Date(row.ms),
        hh = String(time.getHours()).padStart(2, '0'),
        mm = String(time.getMinutes()).padStart(2, '0');
      return `<div class="schedule-row"><span class="schedule-time">${hh}:${mm}</span><div class="schedule-games">${row.games.map(g => `<p>${escapeHtml(g.name)} / ${g.items.map(name => `[${escapeHtml(name)}]`).join(', ')} 업데이트</p>`).join('')}</div></div>`;
    })
    .join('')}</section>`;
}
function realtimeRefreshHtml() {
  const rows = realtimeRefreshList();
  if (!rows.length) return '';
  return `<section class="guide-card realtime-refresh"><span class="section-kicker">실시간</span><div class="settings-section-head"><span class="game-tab-mark blue">◎</span><h3>실시간 갱신 목록</h3></div>${rows
    .map(
      row =>
        `<p class="realtime-row" data-next-at="${row.nextAt}">${escapeHtml(row.gameName)} · ${escapeHtml(row.ruleName)} — <span class="realtime-countdown"></span></p>`
    )
    .join('')}</section>`;
}
```
`renderOverview()`의 `$('#questList').innerHTML = ...` 템플릿에서 `<div class="overview-heading">...</div>` 바로 뒤, `${registered.length ? ... }` 앞에 `${todayScheduleHtml()}${realtimeRefreshHtml()}`를 끼워 넣어라. `new Date()`는 브라우저 실제 시각(로컬)을 쓰는데 `time.getHours()`가 로컬 타임존 기준이라는 점에 주의해라 — 이 앱은 지금까지 KST 사용자를 전제로 만들어졌고(다른 화면들도 로컬 시각을 그냥 쓴다) `row.ms`가 이미 KST 기준으로 계산된 절대 시각(UTC ms)이므로, 사용자의 OS가 KST면 `new Date(row.ms).getHours()`가 정확한 KST 시각을 보여준다 — 이 이상의 타임존 보정은 이번 범위 밖이다.

각 시간표 행의 게임 이름을 클릭해 그 게임으로 이동하는 것까지는 필수 아니다 — 자연스럽게 넣을 수 있으면 넣어도 좋다(예: 게임 이름을 `<button data-open-game>`으로 바꾸면 아래 121번 줄 근처 기존 `$$('[data-open-game]').forEach(...)` 리스너가 그대로 먹는다).

### 2. `catalog-view.js:137` (`updateCatalogClocks()`) — 실시간 목록의 초 단위 카운트다운

지금은 빈 함수다. 아래로 교체:
```js
function updateCatalogClocks() {
  const now = Date.now();
  $$('.realtime-row').forEach(row => {
    const remaining = Number(row.dataset.nextAt) - now;
    const el = row.querySelector('.realtime-countdown');
    if (!el) return;
    if (remaining <= 0) {
      el.textContent = '갱신 대기 중…';
      return;
    }
    const h = Math.floor(remaining / 3600000),
      m = Math.floor((remaining % 3600000) / 60000),
      s = Math.floor((remaining % 60000) / 1000);
    el.textContent = h ? `${h}시간 ${String(m).padStart(2, '0')}분 남음` : `${m}:${String(s).padStart(2, '0')} 남음`;
  });
}
```
이 함수는 `manager.js`의 `attachRendererShell()`이 이미 매초 호출하고 있다(`setInterval(() => { refreshAllGames(); updateResourceTimers(); }, 1000)`, `updateResourceTimers`가 이 함수를 그대로 호출) — **새 타이머를 만들지 마라**, 이 훅을 채우는 것만으로 충분하다. `remaining<=0`인데 아직 화면이 안 바뀐 경우(다음 `renderAll()`이 아직 안 돌아서 그 행이 남아있는 경우)는 "갱신 대기 중…"으로 잠깐 보이다가 다음 정식 렌더에서 사라지므로 정상이다.

### 3. CSS 추가(`manager.css` 또는 `styles.css`) — 새 색상 발명 금지, 기존 토큰만

```css
.today-schedule .schedule-row { display: flex; gap: 14px; padding: 8px 0; border-top: 1px dashed rgb(70, 83, 68); }
.today-schedule .schedule-row:first-of-type { border-top: none; }
.today-schedule .schedule-time { flex: 0 0 auto; color: var(--lime); font: 600 12px "DM Mono", monospace; }
.today-schedule .schedule-games p { margin: 0 0 4px; }
.realtime-refresh .realtime-row { margin: 6px 0; color: var(--muted); }
.realtime-refresh .realtime-countdown { color: var(--cream); font-weight: 600; }
```
(`.guide-card`/`.section-kicker`/`.game-tab-mark`는 이미 있는 클래스이므로 새로 정의하지 마라 — 위 목록만 추가하면 된다.)

### 완료 기준(2부)

- 여러 게임을 등록하고 각각 규칙 완료/게임 알람 끄기를 시험해, `npm.cmd test`가 이미 검증한 것과 같은 동작(클리어되면 사라짐, 알람 끄면 그 게임 전체가 사라짐, 같은 시각은 한 줄로 묶임)이 실제 화면에도 그대로 나타나는지.
- 실시간 갱신 목록의 카운트다운이 실제로 매초 줄어드는지(새로고침 없이).
- 오늘 갱신 예정이 하나도 없으면 "오늘의 시간표" 섹션 자체가 안 보이는지(빈 섹션 껍데기만 남지 않아야 함), 실시간 목록도 마찬가지.
- `npm.cmd test` 통과(최소 98개, 이번 커밋은 UI뿐이라 개수는 안 바뀐다).
- 커밋 메시지에 무엇을 했는지 남겨라 — Claude가 리뷰한다.
