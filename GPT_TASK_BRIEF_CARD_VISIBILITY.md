# GPT 작업 지시서 — 완료된 카드 상시 표시 (체크 표시로 전환)

> Claude가 작성했다. 사용자가 직접 요청한 기능이다: "카드를 없애는게 아니라 남기되, 해당 카드의 항목 이름과 해당 항목에 체크 표시. 슬롯형일 경우 남은 수를 0으로 표기, 게이지 형이라면 사용자 지정 목표 수치를 넘어설 경우 체크 표시." 게임 배지(사이드바 느낌표/체크) 쪽 절반은 Claude가 이미 `catalog-engine.js`의 `universalStatus`를 고쳐서 커밋 `4e7cfc0`으로 반영했다 — 게이지의 개인 목표(foldTarget) 도달이 이제 "완료"로 집계되고, `weekly` 포맷 규칙은 배지 계산에서 제외된다. 이번 지시서는 **카드 자체의 표시 방식**(당신 담당, Track 2)만 다룬다.
>
> 기준 지시서: 이 문서. 기준 커밋: `4e7cfc0`(엔진), `0e53725`(직전 설정 화면 재설계 — 이번 작업과 파일이 겹치지 않는다).

## 네가 소유하는 파일 (자유롭게 수정)

- `catalog-view.js` — `trackerRuleCard(r, p)` 함수만.
- `catalog-editor.js` — `openRuleDetails`의 게이지 안내 문구 한 줄만(아래 3번).
- `manager.css` — 아래 CSS 추가만.

## 절대 건드리지 않을 파일

- `catalog-engine.js`, `legacy-migrations.js`, `catalog-presets.js`, `game-config.js`, `reward-ledger.js`, `app.js` — Track 1 소유.
- `catalog-editor.js`의 나머지 부분(설정 다이얼로그 마크업은 방금 재설계됐다 — 이번엔 손대지 마라).

## git 규칙 (기존과 동일)

1. `git add -A`/`git add .`/`git checkout .`/`git reset --hard` 쓰지 마라. 파일명을 명시해서만 스테이징해라.
2. 작은 단위로 자주 커밋해라.
3. 커밋 전에 `npm.cmd test`를 돌려라(최소 79개 — Claude가 방금 `universalStatus` 테스트 2개를 추가했다).

## 핵심 설계: "완료"를 3단계로 나눈다

엔진의 실제 액션 게이트(`catalog-engine.js`의 `catalogAction`)와 정확히 일치시켜야 한다 — 게이지형에는 슬롯형과 달리 상세설정에 수동 +/- 버튼이 없어서(`openRuleDetails` 확인해봐라 — 슬롯형만 `detailManualAdd`/`detailManualRemove`가 있다), 카드 클릭(`increment`)이 유일한 증가 수단이다. 그래서 게이지가 **개인 목표만** 넘은 상태에서 카드를 하드 비활성화하면 진짜 목표를 향한 증가 수단 자체가 사라지는 실제 기능 락아웃이 된다(사용자에게 이 tension을 직접 확인받았다 — "계속 클릭 가능" 쪽으로 확정됨).

- **`achieved`**(게이지 전용): `p.foldTarget != null && value >= p.foldTarget`. **계속 클릭 가능한 살아있는 버튼**으로 남긴다. 라임색 테두리로만 구분(회색 비활성화 안 함).
- **`hardDone`**: 슬롯은 `value <= 0`(엔진 `complete` 게이트와 정확히 일치), 게이지는 `value >= r.max`(엔진 `increment` 게이트와 정확히 일치). 엔진이 실제로 더 이상 액션을 거부하는 경우만 여기 해당하므로, **이 경우만 `disabled` 처리**(기존 `pending`/"시작 전" 카드와 동일한 회색 처리).
- **`done = achieved || hardDone`**: 항목 이름 옆에 체크 표시(`✓`)를 붙이는 기준.

## 1. `trackerRuleCard(r, p)` — `catalog-view.js:37-66`

40번째 줄의 조기 `return ''`을 제거한다(이게 카드가 사라지지 않게 만드는 핵심 변경이다). 함수 전체를 아래로 교체:

```js
function trackerRuleCard(r, p) {
  const ended = r.format === 'fixed' && p.ended;
  const value = r.kind === 'slot' ? p.held : p.value;
  const name = escapeHtml(r.name || '이름 없는 항목');
  const ruleId = escapeHtml(r.id);
  const pending =
    r.format === 'fixed' &&
    r.startDate &&
    Date.parse(r.startDate.length === 10 ? r.startDate + 'T00:00:00+09:00' : r.startDate) >
      Date.now();
  const achieved = r.kind === 'gauge' && p.foldTarget != null && value >= p.foldTarget;
  // hardDone mirrors the engine's own complete/increment gates exactly (catalog-engine.js
  // catalogAction) - only here do we disable the button, so "disabled" never promises a
  // click the engine would reject anyway.
  const hardDone = r.kind === 'slot' ? value <= 0 : value >= r.max;
  const done = achieved || hardDone;
  const checkmark = done ? '<span class="tracker-check" aria-hidden="true">✓</span>' : '';
  const count =
    r.kind === 'slot'
      ? `<span class="tracker-caption">남은 수</span><strong class="tracker-number">${value}</strong>`
      : `<strong class="tracker-number">${value}<small> / ${r.max}</small></strong>`;
  const milestones =
    r.kind === 'gauge'
      ? (r.milestones || [])
          .map(n => {
            const done = (p.achievedMilestones || []).includes(n) || value >= n;
            return `<span class="tracker-milestone ${done ? 'achieved' : ''}">${n}${done ? ' 달성' : ''}</span>`;
          })
          .join('')
      : '';
  const content = `<span class="tracker-name">${name}${checkmark}</span>${count}${achieved ? `<span class="tracker-achieved">개인 목표 ${p.foldTarget} 달성</span>` : ''}${milestones ? `<span class="tracker-milestones">${milestones}</span>` : ''}`;
  if (ended)
    return `<section class="tracker-card tracker-ended" data-card="${ruleId}">${content}<span class="tracker-caption">종료됨</span><button data-catalog-action="delete-rule" data-rule-id="${ruleId}" aria-label="${name} 삭제">삭제</button></section>`;
  const disabled = pending || hardDone;
  const stateClass = hardDone ? 'tracker-done' : achieved ? 'tracker-goal-achieved' : '';
  return `<button class="tracker-card ${stateClass}" data-card="${ruleId}" data-catalog-action="${r.kind === 'slot' ? 'complete' : 'increment'}" data-rule-id="${ruleId}" aria-label="${name}, ${hardDone ? '완료됨' : r.kind === 'slot' ? `남은 수 ${value}, 하나 완료` : `${value} / ${r.max}, 1 증가`}" ${disabled ? 'disabled' : ''}>${content}${pending ? '<span class="tracker-caption">시작 전</span>' : ''}</button>`;
}
```

기존 `개인 목표 N 달성` 텍스트와 마일스톤 표시는 그대로 유지(체크 표시와 다른 정보라 공존한다).

## 2. CSS 추가 (`manager.css`)

```css
.tracker-check { margin-left: 6px; color: var(--lime); font-weight: 700; }
.tracker-card.tracker-goal-achieved { border-color: var(--lime); background: rgb(38, 48, 32); }
.tracker-card.tracker-goal-achieved:hover { border-color: var(--lime); background: rgb(46, 58, 36); }
```

`tracker-done`(disabled 상태)엔 **새 CSS 규칙을 만들지 마라** — 기존 `button:disabled { opacity: 0.45; cursor: default !important; }`(manager.css:33)가 `.tracker-card`(버튼 요소)에 이미 적용되므로 별도 규칙이 필요 없다. `tracker-done` 클래스는 순수 시맨틱 훅이다.

## 3. `openRuleDetails`의 게이지 안내 문구 수정 — `catalog-editor.js:68`

현재 문구:
```
개인 목표에 도달하면 달성으로 표시합니다. 항목은 전체 목표에 도달할 때 사라집니다.
```
이제 거짓이다(더 이상 사라지지 않는다). 아래로 교체:
```
개인 목표에 도달하면 달성으로 표시합니다. 전체 목표에 도달하면 완료로 표시되고, 더 이상 진행할 수 없습니다.
```
이 문구가 들어 있는 줄의 나머지(입력 필드 id, 버튼 등)는 절대 바꾸지 마라 — 딱 이 문장만 교체.

## 하지 말아야 할 것

- `catalog-engine.js` 등 Track 1 소유 파일을 건드리지 마라.
- 방금 재설계된 설정 다이얼로그 마크업(`openUniversalSettings`, `mountUniversalEditor`, `openCatalogEditor`)을 건드리지 마라 — 이번 범위 아니다.
- 게이지 `achieved` 카드를 `disabled` 처리하지 마라(위 tension 설명 참고 — 사용자가 명시적으로 "계속 클릭 가능"을 선택했다).
- `npm.cmd test`를 깨뜨리는 커밋을 남기지 마라.

## 완료 기준 / 보고

- `npm.cmd test` 통과(최소 79개).
- 브라우저에서 실제로 확인:
  - 슬롯형 규칙을 완료(남은 수 0)까지 클릭해봐라 — 카드가 사라지지 않고 남은 수 "0"과 체크 표시가 뜨는지, 더 이상 클릭이 안 먹는지(비활성화).
  - 게이지형 규칙에 개인 목표를 설정하고 그 값까지 클릭해봐라 — 카드가 사라지지 않고 체크 표시 + 라임 테두리가 뜨는지, **여전히 클릭해서 더 증가시킬 수 있는지**(진짜 목표까지).
  - 게이지형을 진짜 목표(max)까지 채워봐라 — 카드가 비활성화(회색)되는지.
  - 항목 상세 설정에서 게이지 안내 문구가 새 텍스트로 보이는지.
- 커밋 메시지에 무엇을 했는지 남겨라 — Claude가 나중에 리뷰한다.
