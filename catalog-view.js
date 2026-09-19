function catalogResourceClock(r, p) {
  const duration = r.intervalMinutes * 60000,
    remaining = p.value >= r.capacity ? 0 : Math.max(0, duration - (Date.now() - p.clock));
  return {
    label:
      p.value >= r.capacity
        ? '회복 완료'
        : `다음 회복 ${String(Math.floor(remaining / 3600000)).padStart(2, '0')}:${String(Math.floor(remaining / 60000) % 60).padStart(2, '0')}:${String(Math.floor(remaining / 1000) % 60).padStart(2, '0')}`,
    percent: p.value >= r.capacity ? 100 : Math.max(0, 100 - (remaining / duration) * 100)
  };
}
function renderUniversalGame(id) {
  const g = state.games[id],
    rules = catalogRules(g),
    guide = rules.flatMap(r => r.guide || []).length
      ? rules.flatMap(r => r.guide || [])
      : g.catalogGuide || [];
  clearQuestSummary();
  setQuestSummary('누적 획득', rewardText(totals(id)));
  const button = (r, action, label, extra = '', disabled = false) =>
    `<button data-catalog-action="${action}" data-rule-id="${r.id}" ${extra} ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`;
  function scheduleCounts(list) {
    const counts = new Map();
    for (const r of list) {
      const key = ruleScheduleText(r);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }
  function card(r, counts) {
    const p = ruleProgress(g, r),
      blocked = !catalogActive(g, r) || catalogBlocked(g, r),
      showSchedule = counts.get(ruleScheduleText(r)) === 1;
    let body = '';
    if (r.type === 'quest') {
      body =
        `<div class="catalog-actions">${button(r, 'remove', '−', 'class="icon-btn"', blocked || !p.missions.some(m => !m.done))}${button(r, 'spawn', '＋', 'class="icon-btn"', blocked || p.missions.length >= r.capacity)}<span>${p.missions.filter(m => !m.done).length} / ${r.capacity}</span></div><div class="catalog-missions" style="display:grid;grid-template-columns:repeat(${Math.min(3, Math.max(1, r.columns || 1))},minmax(0,1fr))">` +
        p.missions
          .map(
            m =>
              `<div class="quest-row catalog-mission ${m.done ? 'done' : ''}"><div>${
                r.chooseType && !m.done
                  ? `<select data-mission-type="${m.id}" data-rule-id="${r.id}" aria-label="퀘스트 종류">${r.quests
                      .filter(
                        q =>
                          !r.unique ||
                          q.id === m.templateId ||
                          !p.missions.some(x => x.templateId === q.id)
                      )
                      .map(
                        q =>
                          `<option value="${q.id}" ${q.id === m.templateId ? 'selected' : ''}>${escapeHtml(q.label)}</option>`
                      )
                      .join('')}</select>`
                  : `<span>${escapeHtml(m.label)}</span>`
              }${m.points ? `<small>${m.points} 포인트</small>` : ''}</div><div class="catalog-actions">${
                m.done
                  ? `<span>완료 · ${escapeHtml(rewardText(m.rewardReceived || {}))}</span>`
                  : missionRewards(r, m)
                      .map(x =>
                        button(
                          r,
                          'complete',
                          x.label,
                          `data-mission="${m.id}" data-reward="${x.id}"`,
                          blocked || (r.completionLimit && catalogDone(g, r))
                        )
                      )
                      .join('')
              }</div></div>`
          )
          .join('') +
        Array.from(
          { length: r.showEmpty === false ? 0 : Math.max(0, r.capacity - p.missions.length) },
          () => '<div class="quest-row catalog-mission empty-slot">현재 퀘스트가 없습니다.</div>'
        ).join('') +
        '</div>';
    } else if (r.type === 'claim') {
      if (r.hideCompleted && catalogDone(g, r)) return '';
      body = `<div class="card-row"><p>${p.claimed || 0} / ${ruleClaimLimit(g, r)}${r.monthlyLimit ? ` · 이번 달 ${p.monthCount || 0}/${r.monthlyLimit}` : ''}</p><div class="catalog-actions">${r.rewards.map(x => button(r, 'complete', x.label, `data-reward="${x.id}"`, blocked || catalogDone(g, r))).join('')}</div></div>`;
    } else if (r.type === 'resource') {
      const clock = catalogResourceClock(r, p);
      body = `<div class="card-row"><div class="card-row-label"><strong class="catalog-value">${p.value} / ${r.capacity}</strong><p data-clock="${r.id}">${clock.label}</p></div><div class="win-progress card-row-bar"><span data-clock-bar="${r.id}" style="width:${clock.percent}%"></span></div>${button(r, 'consume', r.consumeLabel || '1개 사용', '', blocked || p.value < 1)}</div>`;
    } else {
      const value = p.value || 0,
        steps = catalogSteps(r),
        start = r.window
          ? Math.min(Math.max(1, value - 1), Math.max(1, r.target - r.window + 1))
          : 1;
      const pageKey = 'stepPage-' + r.id,
        page = Math.min(g[pageKey] || 0, Math.max(0, Math.ceil(steps.length / 12) - 1));
      const shown = r.window
        ? steps.filter(x => x.at >= start && x.at < start + r.window)
        : steps.slice(page * 12, page * 12 + 12);
      body = `<div class="card-row"><strong class="catalog-value">${value} / ${r.target}</strong><div class="win-progress card-row-bar"><span style="width:${Math.min(100, (value / r.target) * 100)}%"></span></div>${r.totalResource ? `<p>누적 ${(totals(id)[r.totalResource] || 0).toLocaleString()} ${escapeHtml(REWARD_NAMES[r.totalResource] || r.totalResource)}</p>` : ''}</div>${!r.hideAction ? `<div class="catalog-actions">${button(r, 'progress', r.eventLabel || '+1', 'data-amount="1"', blocked || (!r.event && value >= r.target))}<input data-progress-value="${r.id}" type="number" min="${value}" max="${r.target}" value="${value}" aria-label="${escapeHtml(r.label)} 진행도" />${button(r, 'set-progress', '진행도 반영', '', blocked)}</div>` : ''}`;
      if (!r.window && steps.length > 12)
        body += `<div class="catalog-pages"><button class="icon-btn" data-step-page="${r.id}" data-delta="-1" ${page === 0 ? 'disabled' : ''}>‹</button><span>${page + 1} / ${Math.ceil(steps.length / 12)}</span><button class="icon-btn" data-step-page="${r.id}" data-delta="1" ${(page + 1) * 12 >= steps.length ? 'disabled' : ''}>›</button></div>`;
      if (shown.length)
        body += `<details class="catalog-steps" ${r.window || shown.length <= 6 ? 'open' : ''}><summary>구간 달성 보상</summary><div class="catalog-step-grid">${shown.map(x => `<div class="${value >= x.at ? 'claimed' : ''}"><b>${x.at}</b><span>${escapeHtml(rewardText(x.free || {}))}</span>${Object.keys(x.paid || {}).length ? `<small>유료 ${escapeHtml(rewardText(x.paid))}</small>` : ''}</div>`).join('')}</div></details>`;
    }
    return `<section class="compact-card catalog-card" data-card="${r.id}"><div class="card-head"><h3>${escapeHtml(r.label)}</h3><small>${showSchedule ? escapeHtml(ruleScheduleText(r)) : ''}${blocked ? ' · 진행 불가' : ''}</small></div>${r.note ? `<p>${escapeHtml(r.note)}</p>` : ''}${body}</section>`;
  }
  const groups = [...new Set(rules.filter(r => r.page).map(r => r.page))];
  g.catalogPage = groups.includes(g.catalogPage) ? g.catalogPage : groups[0];
  const topRules = rules.filter(r => !r.page),
    topCounts = scheduleCounts(topRules),
    pageRules = rules.filter(r => r.page === g.catalogPage),
    pageCounts = scheduleCounts(pageRules);
  $('#questList').innerHTML = `<div class="catalog-grid">${topRules
    .map(r => card(r, topCounts))
    .join('')}</div>${
    groups.length
      ? `<div class="catalog-pages"><button class="icon-btn" data-catalog-page="-1" ${groups.indexOf(g.catalogPage) <= 0 ? 'disabled' : ''}>‹</button><strong>${escapeHtml(g.catalogPage)}</strong><button class="icon-btn" data-catalog-page="1" ${groups.indexOf(g.catalogPage) >= groups.length - 1 ? 'disabled' : ''}>›</button></div><div class="catalog-grid">${pageRules
          .map(r => card(r, pageCounts))
          .join('')}</div>`
      : ''
  }${guide.length ? `<section class="guide-card"><h3>추천 플레이 가이드</h3><ul>${guide.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul></section>` : ''}<details class="catalog-earned"><summary>누적 획득 목록</summary><p>${escapeHtml(rewardText(totals(id)))}</p></details>`;
  const act = fn => {
    try {
      fn();
      renderAll();
    } catch (e) {
      renderUniversalGame(id);
      renderNavigation();
      toast(e.message);
    }
  };
  $$('[data-catalog-action]').forEach(b => {
    const r = rules.find(r => r.id === b.dataset.ruleId),
      period = rulePeriod(r);
    b.addEventListener('click', () =>
      act(() => {
        let action = b.dataset.catalogAction,
          amount = Number(b.dataset.amount || 1);
        if (action === 'set-progress') {
          amount =
            Number($(`[data-progress-value="${r.id}"]`).value) - (ruleProgress(g, r).value || 0);
          action = 'progress';
        }
        return catalogAction(id, r.id, action, {
          period,
          amount,
          mission: b.dataset.mission,
          reward: b.dataset.reward
        });
      })
    );
  });
  $$('[data-mission-type]').forEach(b =>
    b.addEventListener('change', () =>
      act(() =>
        catalogAction(id, b.dataset.ruleId, 'choose', {
          mission: b.dataset.missionType,
          template: b.value
        })
      )
    )
  );
  $$('[data-step-page]').forEach(b =>
    b.addEventListener('click', () => {
      const key = 'stepPage-' + b.dataset.stepPage;
      g[key] = (g[key] || 0) + Number(b.dataset.delta);
      renderAll();
    })
  );
  $$('[data-catalog-page]').forEach(b =>
    b.addEventListener('click', () => {
      g.catalogPage = groups[groups.indexOf(g.catalogPage) + Number(b.dataset.catalogPage)];
      renderAll();
    })
  );
}
function updateCatalogClocks() {
  const g = data();
  if (!g || !catalogEnabled(state.activeGame)) return;
  for (const r of catalogRules(g).filter(x => x.type === 'resource')) {
    const clock = catalogResourceClock(r, ruleProgress(g, r)),
      label = $(`[data-clock="${r.id}"]`),
      bar = $(`[data-clock-bar="${r.id}"]`);
    if (label) label.textContent = clock.label;
    if (bar) bar.setAttribute('style', `width:${clock.percent}%`);
  }
}
