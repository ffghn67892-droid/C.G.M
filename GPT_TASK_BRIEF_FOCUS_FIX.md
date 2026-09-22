# GPT 작업 지시서 — 완료 후 포커스가 사라지는 회귀 수정 (작음)

> Claude가 작성했다. 직전 커밋 `db408a5`(완료 카드 상시 표시) 검증 중 실제 Claude 브라우저 도구로 발견했다 — 자동 테스트(harness의 `focus()` 셰임은 `disabled` 여부를 무시하고 항상 activeElement를 바꾼다)로는 안 잡히는, 실제 브라우저에서만 재현되는 버그다.

## 증상

슬롯 규칙을 클릭해서 남은 수가 0이 되는 순간(방금 커밋에서 카드가 사라지지 않고 `disabled` 처리로 바뀜), 포커스가 `document.body`로 빠진다 — 키보드 사용자가 다음 조작을 하려면 처음부터 다시 Tab을 눌러야 한다. 게이지형이 진짜 목표에 도달해 `disabled`될 때도 동일하다.

## 원인

`catalog-view.js:122-126`:
```js
const updated = [...$('#questList').querySelectorAll('[data-catalog-action]')];
const focus =
  updated.find(b => b.dataset.ruleId === ruleId && b.dataset.catalogAction === action) ||
  updated.find(b => b.dataset.catalogAction === 'undo');
focus?.focus();
```
예전엔(카드가 사라지던 시절) 방금 클릭한 카드가 `updated` 목록에서 아예 없어져서 첫 번째 `find`가 항상 실패하고, `undo` 버튼으로 자연스럽게 넘어갔다. 지금은 카드가 `disabled` 상태로 그대로 남아 있어서 첫 번째 `find`가 그 **비활성화된 자기 자신**을 찾아버린다. 실제 브라우저는 `disabled`인 요소에 `.focus()`를 호출해도 포커스를 주지 않으므로(스펙 동작), 포커스가 그냥 사라진다.

## 수정

`disabled`인 버튼은 첫 번째 후보에서 제외해라:

```js
const updated = [...$('#questList').querySelectorAll('[data-catalog-action]')];
const focus =
  updated.find(
    b => b.dataset.ruleId === ruleId && b.dataset.catalogAction === action && !b.disabled
  ) || updated.find(b => b.dataset.catalogAction === 'undo');
focus?.focus();
```
(`increment`처럼 클릭해도 카드가 계속 활성 상태인 경우엔 여전히 같은 버튼에 포커스가 남는다 — 그 동작은 그대로 유지된다. 방금 클릭으로 `disabled`가 된 경우에만 `undo` 버튼으로 넘어가게 된다.)

## 소유 파일

`catalog-view.js`만. 다른 파일은 이번 범위 아니다.

## 완료 기준

- `npm.cmd test` 통과.
- (가능하면) `tests/catalog-view-v2.test.cjs`의 관련 테스트에 disabled 버튼으로는 포커스가 안 가고 `undo`로 넘어가는지 확인하는 assert를 하나 추가해라 — 다만 이 harness의 `.focus()` 셰임이 `disabled`를 무시한다는 걸 감안해서, 필요하면 셰임을 고치거나(다른 기존 테스트에 영향 없는지 확인) 아니면 이 시나리오는 실제 브라우저 확인으로 대체해도 된다. 어느 쪽이든 실제 Claude 브라우저 도구로 슬롯을 0까지 완료했을 때 `document.activeElement`가 `undo` 버튼인지 직접 확인해라.
- 커밋 메시지에 무엇을 했는지 남겨라.
