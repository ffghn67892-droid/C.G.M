// Track 2 consumes the slot/gauge contract in TODO_TRACKER_REDESIGN.md §10.
function trackerRuleCard(r, p) {
  const ended = r.format === 'fixed' && p.ended;
  const value = r.kind === 'slot' ? p.held : p.value;
  if (!ended && (r.kind === 'slot' ? value <= 0 : value >= r.max)) return '';
  const name = escapeHtml(r.name || '이름 없는 항목');
  const ruleId = escapeHtml(r.id);
  const pending =
    r.format === 'fixed' &&
    r.startDate &&
    Date.parse(r.startDate.length === 10 ? r.startDate + 'T00:00:00+09:00' : r.startDate) >
      Date.now();
  const achieved = r.kind === 'gauge' && p.foldTarget != null && value >= p.foldTarget;
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
  const content = `<span class="tracker-name">${name}</span>${count}${achieved ? `<span class="tracker-achieved">개인 목표 ${p.foldTarget} 달성</span>` : ''}${milestones ? `<span class="tracker-milestones">${milestones}</span>` : ''}`;
  if (ended)
    return `<section class="tracker-card tracker-ended" data-card="${ruleId}">${content}<span class="tracker-caption">종료됨</span><button data-catalog-action="delete-rule" data-rule-id="${ruleId}" aria-label="${name} 삭제">삭제</button></section>`;
  return `<button class="tracker-card ${achieved ? 'tracker-goal-achieved' : ''}" data-card="${ruleId}" data-catalog-action="${r.kind === 'slot' ? 'complete' : 'increment'}" data-rule-id="${ruleId}" aria-label="${name}, ${r.kind === 'slot' ? `남은 수 ${value}, 하나 완료` : `${value} / ${r.max}, 1 증가`}" ${pending ? 'disabled' : ''}>${content}${pending ? '<span class="tracker-caption">시작 전</span>' : ''}</button>`;
}
function renderUniversalGame(id) {
  const g = state.games[id];
  const rules = catalogRules(g);
  clearQuestSummary();
  const cards = rules.map(r => trackerRuleCard(r, ruleProgress(g, r))).join('');
  const history = g.actionHistory || [];
  const latest = history.at(-1);
  const ruleName = entry => rules.find(r => r.id === entry.ruleId)?.name || '삭제된 항목';
  const undo = history.length
    ? `<section class="tracker-history" aria-label="실행취소 기록"><button data-catalog-action="undo" data-rule-id="${escapeHtml(latest.ruleId || '')}">최근 클릭 실행취소 · ${escapeHtml(ruleName(latest))}</button><details><summary>최근 기록 ${history.length}개 · 최신순</summary><ol>${history
        .slice()
        .reverse()
        .map(
          (entry, index) =>
            `<li>${escapeHtml(ruleName(entry))} · ${entry.kind === 'slot' ? '완료' : '+1'}${index === 0 ? ' (다음 실행취소)' : ''}</li>`
        )
        .join('')}</ol><p>최근 클릭부터 하나씩 되돌립니다.</p></details></section>`
    : '';
  const pass = g.pass?.active
    ? `<button class="tracker-pass" data-catalog-action="bump-pass-level" data-rule-id="" aria-label="패스 레벨 ${g.pass.level || 0}, 1 증가"><span>패스 레벨</span><strong>${g.pass.level || 0}</strong><span>+1</span>${g.pass.endDate ? `<small>종료 ${escapeHtml(g.pass.endDate)}</small>` : ''}</button>`
    : '';
  const host = $('#questList');
  host.innerHTML = `${undo}<div class="tracker-grid">${cards}</div>${!cards ? '<p class="tracker-empty" role="status">남은 할 일이 없습니다. 규칙과 수동 추가는 상세 설정에서 관리할 수 있습니다.</p>' : ''}${pass}`;
  host.querySelectorAll('[data-catalog-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.catalogAction;
      const ruleId = button.dataset.ruleId;
      try {
        catalogAction(id, ruleId, action);
        renderAll();
        const updated = [...$('#questList').querySelectorAll('[data-catalog-action]')];
        const focus =
          updated.find(b => b.dataset.ruleId === ruleId && b.dataset.catalogAction === action) ||
          updated.find(b => b.dataset.catalogAction === 'undo');
        focus?.focus();
      } catch (error) {
        renderUniversalGame(id);
        renderNavigation();
        toast(error.message);
      }
    });
  });
}
// Kept for the renderer shell; the tracker has no resource recovery clocks.
function updateCatalogClocks() {}
