# GPT 작업 지시서 — Stage D 시작 (매 N시간마다 갱신, 편집기 UI)

> Claude가 작성했다. 사용자가 직접 요청한 기능이다: "규칙 구성 세부값에서 '갱신 주기' 값 입력할 수 있도록 추가... x시간마다 갱신이라고 하면 앞에 갱신 수만큼 x시간마다 갱신." 엔진 쪽(`format:'interval'`)은 Claude가 이미 구현·테스트·커밋했다 — 기준: `catalog-engine.js`, `catalog-presets.js`, `TODO_TRACKER_REDESIGN.md` §10의 "Stage D" 절, `tests/catalog-interval-v2.test.cjs`. 먼저 그 §10 절을 읽어라 — 정확한 필드 이름과 검증 범위가 거기 있다.
>
> 이번 지시서 범위는 **편집기(마법사) UI뿐**이다. 프리셋으로 게임을 만드는 경로(Snap/포켓몬 포켓)는 이미 이 UI 변경 없이 완전히 동작한다 — 사용자가 "규칙 구성"에서 직접 새 `interval` 규칙을 만들거나 기존 규칙을 `interval`로 바꾸는 경로만 아직 막혀 있다.

## 엔진이 이미 확정한 것 (그대로 믿고 써라)

- 새 포맷 값 `'interval'`. 규칙 필드: `anchorTime`('HH:MM', KST), `intervalHours`(정수, **1~168**).
- `validateCatalog`(catalog-engine.js)가 검증하는 정확한 범위: `anchorTime`은 기존 `time()` 정규식(`/^([01]\d|2[0-3]):[0-5]\d$/`)과 동일, `intervalHours`는 1 이상 168 이하 정수. **네 쪽 `validateTrackerRule`도 정확히 이 범위를 써야 한다** — 다르면 3.5절에서 지적됐던 "편집기는 통과, 엔진은 거부" 문제가 이 새 필드에서 그대로 재발한다.
- `interval` 포맷에는 `resetOverride`가 의미 없다(게임 기본 리셋과 완전히 무관, 자체 완결형). 편집기는 `interval`일 때 리셋 재지정 체크박스 자체를 보여주지 않아야 한다.
- 나머지(슬롯 갱신 수/최대 보유 수, 게이지 범위/마일스톤)는 `daily`/`weekly`와 완전히 같은 필드·같은 검증이다 — 세부값 단계 자체는 바뀌지 않는다.

## 고쳐야 할 지점 (현재 코드 기준 줄 번호)

1. **`catalog-editor.js:319-331` (마법사 1단계, 포맷 선택)**
   - `select('format', ...)`의 옵션 목록(321-325줄)에 `['interval', '시간 간격']`을 추가한다.
   - `r.format === 'fixed' ? ... : '게임의 기본 리셋 시각을 따릅니다.'` 분기(326-331줄)에 `interval` 케이스를 추가한다: `anchorTime`(time input, 기본값 예: `'00:00'`)과 `intervalHours`(number input, 기본값 예: `8`) 두 입력을 보여주고, "N시간마다 갱신 시각 하나를 기준으로 입력하세요" 정도의 안내 문구를 단다.

2. **`catalog-editor.js:339-361` (마법사 3단계, 세부값)**
   - 348줄의 `if (r.format !== 'fixed')`를 `if (r.format !== 'fixed' && r.format !== 'interval')`로 바꿔서, `interval`일 때도 리셋 재지정 체크박스가 나오지 않게 한다.

3. **`catalog-editor.js:363-364` (마법사 4단계, 확인)**
   - 364줄의 `{ daily: '일일', weekly: '주간', fixed: '지정 기간' }` 매핑에 `interval: '시간 간격'`을 추가한다.
   - 같은 줄의 `r.format === 'fixed' ? ... : '리셋: ...게임 기본값'` 분기에 `interval` 케이스를 추가한다: 예) `기준 ${r.anchorTime} · 매 ${r.intervalHours}시간마다`. (엔진의 `ruleScheduleText`가 실제로 만드는 문구 `'${anchorTime} 기준 매 ${intervalHours}시간마다 KST'`와 표현을 맞추면 나중에 헷갈릴 일이 없다.)

4. **`catalog-editor.js:380-394` (`#wizardNext` 클릭 핸들러)**
   - 382-391줄의 `step === 1 && r.format === 'fixed' && (...)` 검사 옆에, `step === 1 && r.format === 'interval'`일 때 `anchorTime`/`intervalHours`를 미리 검사하는 분기를 추가한다(형식은 `trackerTimeValid`/정수 범위 검사, 범위는 위와 동일하게 1~168). 그래야 3단계까지 진행한 뒤에야 오류가 뜨는 일이 없다.

5. **`catalog-editor.js:29-59` (`validateTrackerRule`)**
   - 31줄의 `['daily', 'weekly', 'fixed']`에 `'interval'`을 추가한다.
   - `fixed` 전용 블록(32-40줄) 바로 아래에 `interval` 전용 블록을 추가한다: `rule.format === 'interval' && (!trackerTimeValid(rule.anchorTime) || !Number.isSafeInteger(rule.intervalHours) || rule.intervalHours < 1 || rule.intervalHours > 168)`이면 에러.
   - 41-49줄의 `resetOverride` 검사는 `rule.format === 'interval'`일 때 `resetOverride`가 애초에 없을 것이므로 그대로 둬도 되지만, 혹시 남아있는 값이 있어도 무시되도록(검증하지 않도록) 조건에서 제외해도 된다 — 필수는 아니다.

## 하지 말아야 할 것

- `catalog-engine.js`/`catalog-presets.js` 등 Track 1 소유 파일을 고치지 마라 — `interval` 포맷 자체는 이미 완성돼 있다.
- 이번 범위에 없는 다른 작업(B의 알림 통일, C의 가져오기 UI)을 같이 하지 마라.
- `npm.cmd test`를 깨뜨리는 커밋을 남기지 마라.

## 완료 기준 / 보고

- `npm.cmd test` 통과(최소 76개 — Claude가 추가한 `tests/catalog-interval-v2.test.cjs` 포함).
- 브라우저에서 실제로: 새 규칙 추가 → 포맷을 "시간 간격"으로 선택 → 기준 시각·간격 입력 → 슬롯형 세부값 입력(리셋 재지정 체크박스가 안 보이는지 확인) → 저장 → 4단계 확인 화면과 카드 화면에 올바른 문구가 뜨는지 확인.
- 잘못된 값(기준 시각 형식 오류, 간격 0 또는 169)을 넣었을 때 3단계까지 안 가고 1단계에서 바로 막히는지 확인.
- 커밋 메시지에 무엇을 했는지 남겨라 — Claude가 리뷰한다.
