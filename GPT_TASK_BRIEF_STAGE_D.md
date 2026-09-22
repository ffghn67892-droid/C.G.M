# GPT 작업 지시서 — Stage D 시작 (매 N분/시간마다 갱신, 편집기 UI)

> Claude가 작성했다. 사용자가 직접 요청한 기능이다: "규칙 구성 세부값에서 '갱신 주기' 값 입력할 수 있도록 추가... x시간마다 갱신이라고 하면 앞에 갱신 수만큼 x시간마다 갱신." 엔진 쪽(`format:'interval'`)은 Claude가 이미 구현·테스트·커밋했다 — 기준: `catalog-engine.js`, `catalog-presets.js`, `TODO_TRACKER_REDESIGN.md` §10의 "Stage D" 절, `tests/catalog-interval-v2.test.cjs`. 먼저 그 §10 절을 읽어라 — 정확한 필드 이름과 검증 범위가 거기 있다.
>
> **필드명이 한 번 바뀌었다**: 처음엔 `intervalHours`(1~168시간)로 구현했다가, 사용자가 듀얼링크스 "일반 듀얼리스트"(최대 10, 30분마다 1 회복)를 예로 들며 시간 미만 주기가 필요하다고 지적해 `intervalMinutes`(정수 1~10080분, 1분~7일)로 다시 정의했다. 이 문서는 최신 필드명(`intervalMinutes`) 기준이다 — 혹시 이전 버전을 이미 봤다면 그 내용은 무시해라.
>
> 이번 지시서 범위는 **편집기(마법사) UI뿐**이다. 프리셋으로 게임을 만드는 경로(Snap/포켓몬 포켓/듀얼링크스)는 이미 이 UI 변경 없이 완전히 동작한다 — 사용자가 "규칙 구성"에서 직접 새 `interval` 규칙을 만들거나 기존 규칙을 `interval`로 바꾸는 경로만 아직 막혀 있다.
>
> **2026-09-23 재발행**: 이 지시서는 애초에 승인·커밋(`GPT_TASK_BRIEF_STAGE_D.md` 최초 커밋)됐지만, 곧바로 사용자가 "게임 설정 UI/UX 개편이 우선"이라며 순서를 바꿔달라고 요청했고, 그 뒤로 설정 다이얼로그 재설계 → 카드 상시 표시 → 포커스 수정 → 항목 순서 변경·새 게임 마법사까지 이어지면서 이 작업 자체가 대기열에서 완전히 빠졌다 — **한 번도 구현되지 않았다**(`catalog-editor.js`에 `interval` 문자열이 전혀 없다). 사용자가 "분명 갱신 주기가 구현됐다고 했는데 실제로는 쓸 수 없다"고 다시 지적해서 재발행한다. 아래 "고쳐야 할 지점"의 줄 번호는 그 사이 있었던 다른 커밋들(설정 재설계, 카드 상시 표시, 항목 순서 변경)로 달라졌으므로 **이번 버전 기준으로 다시 확인했다** — 이전에 이 문서를 이미 읽었어도 줄 번호는 새로 봐라. 설계 자체(필드명, 검증 범위, UI 동작)는 전혀 안 바뀌었다.

## 엔진이 이미 확정한 것 (그대로 믿고 써라)

- 새 포맷 값 `'interval'`. 규칙 필드: `anchorTime`('HH:MM', KST), `intervalMinutes`(정수, **1~10080**).
- `validateCatalog`(catalog-engine.js)가 검증하는 정확한 범위: `anchorTime`은 기존 `time()` 정규식(`/^([01]\d|2[0-3]):[0-5]\d$/`)과 동일, `intervalMinutes`는 1 이상 10080 이하 정수. **네 쪽 `validateTrackerRule`도 정확히 이 범위를 써야 한다** — 다르면 3.5절에서 지적됐던 "편집기는 통과, 엔진은 거부" 문제가 이 새 필드에서 그대로 재발한다.
- `interval` 포맷에는 `resetOverride`가 의미 없다(게임 기본 리셋과 완전히 무관, 자체 완결형). 편집기는 `interval`일 때 리셋 재지정 체크박스 자체를 보여주지 않아야 한다.
- 나머지(슬롯 갱신 수/최대 보유 수, 게이지 범위/마일스톤)는 `daily`/`weekly`와 완전히 같은 필드·같은 검증이다 — 세부값 단계 자체는 바뀌지 않는다.
- 화면 표시 문구는 엔진의 `ruleScheduleText`/`intervalLengthText`가 만드는 형태를 참고해라: 480분 → "8시간", 30분 → "30분", 90분 → "1시간 30분". UI 입력은 "시간"과 "분"을 따로 받든 분 하나로 받든 자유지만, 편집기에서 계산한 값을 최종적으로 `intervalMinutes`(정수, 분 단위)로 저장해야 한다.

## 고쳐야 할 지점 (2026-09-23 기준, `ea52a26` 이후 코드 줄 번호로 다시 확인함)

1. **`catalog-editor.js:320-332` (마법사 1단계, 포맷 선택, `mountUniversalEditor`의 `if (step === 1)` 블록)**
   - `select('format', ...)`의 옵션 목록(322-326줄)에 `['interval', '시간 간격']`을 추가한다.
   - `r.format === 'fixed' ? ... : '게임의 기본 리셋 시각을 따릅니다.'` 분기(327-332줄)에 `interval` 케이스를 추가한다: `anchorTime`(time input, 기본값 예: `'00:00'`)과 간격 입력(예: `intervalMinutes` number input, 기본값 `480` = 8시간 — "시간"/"분" 두 입력을 따로 받아 저장 시 분으로 합산해도 무방하다) 두 입력을 보여주고, "이 기준 시각부터 N분/시간마다 반복됩니다" 정도의 안내 문구를 단다.

2. **`catalog-editor.js:340-363` (마법사 3단계, 세부값)**
   - 349줄의 `if (r.format !== 'fixed')`를 `if (r.format !== 'fixed' && r.format !== 'interval')`로 바꿔서, `interval`일 때도 리셋 재지정 체크박스가 나오지 않게 한다.

3. **`catalog-editor.js:364-365` (마법사 4단계, 확인)**
   - 365줄의 `{ daily: '일일', weekly: '주간', fixed: '지정 기간' }` 매핑에 `interval: '시간 간격'`을 추가한다.
   - 같은 줄의 `r.format === 'fixed' ? ... : '리셋: ...게임 기본값'` 분기에 `interval` 케이스를 추가한다. 엔진의 `ruleScheduleText`가 실제로 만드는 문구 `'${anchorTime} 기준 매 ${intervalLengthText(intervalMinutes)}마다 KST'`(catalog-engine.js:139-142)와 표현을 맞추면 나중에 헷갈릴 일이 없다.

4. **`catalog-editor.js:395-409` (`#wizardNext` 클릭 핸들러)**
   - 397-406줄의 `step === 1 && r.format === 'fixed' && (...)` 검사 옆에, `step === 1 && r.format === 'interval'`일 때 `anchorTime`/`intervalMinutes`를 미리 검사하는 분기를 추가한다(형식은 `trackerTimeValid`/정수 범위 검사, 범위는 위와 동일하게 1~10080). 그래야 3단계까지 진행한 뒤에야 오류가 뜨는 일이 없다.

5. **`catalog-editor.js:29-60` (`validateTrackerRule`)**
   - 31줄의 `['daily', 'weekly', 'fixed']`에 `'interval'`을 추가한다.
   - `fixed` 전용 블록(32-40줄) 바로 아래에 `interval` 전용 블록을 추가한다: `rule.format === 'interval' && (!trackerTimeValid(rule.anchorTime) || !Number.isSafeInteger(rule.intervalMinutes) || rule.intervalMinutes < 1 || rule.intervalMinutes > 10080)`이면 에러.
   - 41-49줄의 `resetOverride` 검사는 `rule.format === 'interval'`일 때 `resetOverride`가 애초에 없을 것이므로 그대로 둬도 되지만, 혹시 남아있는 값이 있어도 무시되도록(검증하지 않도록) 조건에서 제외해도 된다 — 필수는 아니다.

6. **`catalog-editor.js:240-294` (`capture()`) — 이전 지시서에 빠져 있던 지점, 반드시 추가해야 한다**
   - `input(key, ...)` 헬퍼가 만드는 `<input data-rule-field="${key}">`는 `capture()`가 그 `key`를 명시적으로 알고 있을 때만 `draft`에 반영된다(범용 폴백이 없다). 1번에서 `anchorTime`/`intervalMinutes` 입력을 추가해도, `capture()`에 대응하는 읽기 로직이 없으면 사용자가 값을 입력해도 `r.anchorTime`/`r.intervalMinutes`에 절대 반영되지 않는다 — 기존 규칙을 열었을 때는 옛날 값이 그대로 남고(수정한 값이 조용히 버려짐), 새 규칙은 `undefined`로 남아 저장 시점에야 "기준 시각과 갱신 간격을 확인하세요" 에러가 난다.
   - 272-273줄의 `for (const key of ['refillCount', 'maxHeld', 'min', 'max']) if (el(key)) r[key] = el(key).value.trim() ? Number(el(key).value) : NaN;` 루프에 `'intervalMinutes'`도 추가하면 숫자 필드는 해결된다. `anchorTime`은 문자열이므로 `if (el('anchorTime')) r.anchorTime = el('anchorTime').value;`를 별도로 추가해라(time input이라 `.value`가 이미 `'HH:MM'` 형식).
   - 251-255줄의 `if (r.format !== 'fixed') { delete r.startDate; delete r.endDate; delete r.endTime; }`와 같은 패턴으로, `if (r.format !== 'interval') { delete r.anchorTime; delete r.intervalMinutes; }`도 추가해라 — 포맷을 `interval`에서 다른 걸로 바꿨을 때 고아 필드가 안 남게.

이 여섯 지점 외에, 최근 항목 순서 변경 작업으로 `mountUniversalEditor`에 `pendingFocus`/`rule-order-list`/`bind('[data-move-rule]', ...)`가 추가돼 있다(catalog-editor.js:232, 366, 380-393, 420-426) — 이번 작업과 무관하니 건드리지 말고 그대로 둬라.

## 하지 말아야 할 것

- `catalog-engine.js`/`catalog-presets.js` 등 Track 1 소유 파일을 고치지 마라 — `interval` 포맷 자체는 이미 완성돼 있다.
- 이번 범위에 없는 다른 작업(B의 알림 통일, C의 가져오기 UI, 항목 순서 변경·새 게임 마법사 등 이미 끝난 작업)을 같이 하지 마라.
- `npm.cmd test`를 깨뜨리는 커밋을 남기지 마라.
- 이번 작업이 끝나면 **반드시 커밋해라** — 직전 항목 순서 변경 작업 때 커밋을 빠뜨려서 Claude가 검증 후 대신 커밋한 적이 있다.

## 완료 기준 / 보고

- `npm.cmd test` 통과(현재 기준 79개 — Claude가 추가한 `tests/catalog-interval-v2.test.cjs` 포함, 이번 커밋은 UI뿐이라 엔진 테스트 수는 안 바뀐다).
- 브라우저에서 실제로: 새 규칙 추가 → 포맷을 "시간 간격"으로 선택 → 기준 시각·간격 입력 → 슬롯형 세부값 입력(리셋 재지정 체크박스가 안 보이는지 확인) → 저장 → 4단계 확인 화면과 카드 화면에 올바른 문구가 뜨는지 확인. 30분처럼 시간 미만 간격도 한 번 넣어 확인해라.
- 잘못된 값(기준 시각 형식 오류, 간격 0 또는 10081)을 넣었을 때 3단계까지 안 가고 1단계에서 바로 막히는지 확인.
- 기존 `interval` 프리셋 게임(마블스냅 "일반 임무", 포켓몬 포켓 "무료 팩"/"챌린지 파워", 듀얼링크스 "일반 듀얼리스트")을 규칙 구성 마법사로 열어서, 편집기가 그 값을 깨뜨리지 않고 그대로 보여주는지(그리고 그대로 다시 저장해도 문제없는지)도 확인해라 — 지금까지는 이 규칙들을 편집기로 연 적 자체가 없었다.
- 커밋 메시지에 무엇을 했는지 남겨라 — Claude가 리뷰한다.
