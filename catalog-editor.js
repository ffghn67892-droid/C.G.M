function newUniversalRule(kind = 'slot') {
  const rule = {
    id: 'rule-' + crypto.randomUUID(),
    name: '새 항목',
    format: 'daily',
    resetOverride: null,
    kind: kind === 'gauge' ? 'gauge' : 'slot'
  };
  return Object.assign(
    rule,
    rule.kind === 'slot' ? { refillCount: 1, maxHeld: 3 } : { min: 0, max: 15, milestones: [] }
  );
}
function initializeCatalogProgress(id) {
  for (const rule of catalogRules(state.games[id])) ruleProgress(state.games[id], rule);
}
// Kept while older setup callers are transitioned; new entries have no initial awards.
function initializeCatalogRewards() {}
function trackerDateValid(date) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}
function trackerTimeValid(time) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time || '');
}
function validateTrackerRule(rule) {
  if (!rule.name.trim() || rule.name.length > 60) throw Error('이름은 1~60자로 입력하세요.');
  if (!['daily', 'weekly', 'fixed'].includes(rule.format)) throw Error('포맷을 선택하세요.');
  if (
    rule.format === 'fixed' &&
    (!trackerDateValid(rule.startDate) ||
      !trackerDateValid(rule.endDate) ||
      !trackerTimeValid(rule.endTime) ||
      Date.parse(`${rule.endDate}T${rule.endTime}:00+09:00`) <=
        Date.parse(`${rule.startDate}T00:00:00+09:00`))
  )
    throw Error('시작일과 종료일·종료 시각을 확인하세요.');
  if (
    rule.resetOverride &&
    (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.resetOverride.time) ||
      (rule.format === 'weekly' &&
        (!Number.isInteger(rule.resetOverride.weekday) ||
          rule.resetOverride.weekday < 0 ||
          rule.resetOverride.weekday > 6)))
  )
    throw Error('리셋 시각과 요일을 확인하세요.');
  if (rule.kind === 'slot') {
    if (![rule.refillCount, rule.maxHeld].every(n => Number.isSafeInteger(n) && n > 0))
      throw Error('갱신 수와 최대 보유 수는 1 이상의 정수로 입력하세요.');
  } else if (rule.kind === 'gauge') {
    if (![rule.min, rule.max].every(Number.isSafeInteger) || rule.min < 0 || rule.max <= rule.min)
      throw Error('최소값은 0 이상, 목표값은 최소값보다 큰 정수여야 합니다.');
    if (!rule.milestones.every(n => Number.isSafeInteger(n) && n > rule.min && n <= rule.max))
      throw Error('마일스톤은 최소값보다 크고 목표값 이하인 정수로 입력하세요.');
  } else throw Error('형태를 선택하세요.');
  return rule;
}
function openRuleDetails(id, ruleId) {
  const game = state.games[id],
    rule = catalogRules(game).find(r => r.id === ruleId);
  if (!rule) return;
  const progress = ruleProgress(game, rule);
  openDialog(
    '항목 상세 설정',
    `<div class="settings-section-head"><span class="game-tab-mark ${rule.kind === 'slot' ? 'blue' : 'coral'}">${rule.kind === 'slot' ? '▤' : '◎'}</span><h3>${escapeHtml(rule.name)}</h3></div>${rule.kind === 'slot' ? `<p>남은 수 <strong>${progress.held}</strong> / ${rule.maxHeld}</p><div class="rule-nav"><button id="detailManualAdd" ${progress.held >= rule.maxHeld ? 'disabled' : ''}>1개 추가</button><button id="detailManualRemove" ${progress.held <= 0 ? 'disabled' : ''}>1개 제거</button></div>` : `<p>현재 ${progress.value} / ${rule.max}</p><label>개인 목표 (비워두면 사용 안 함)<input id="detailFoldTarget" type="number" min="${rule.min}" max="${rule.max}" step="1" value="${progress.foldTarget ?? ''}" /></label><p class="wizard-help">개인 목표에 도달하면 달성으로 표시합니다. 항목은 전체 목표에 도달할 때 사라집니다.</p><button id="saveFoldTarget" class="primary">개인 목표 저장</button>`}<p id="detailError" role="status"></p><div class="dialog-back-row"><button id="detailBack">게임 설정으로</button></div>`
  );
  for (const [button, action] of [
    ['#detailManualAdd', 'manual-add'],
    ['#detailManualRemove', 'manual-remove']
  ])
    $(button)?.addEventListener('click', () => {
      try {
        catalogAction(id, ruleId, action);
        renderAll();
        openRuleDetails(id, ruleId);
      } catch (error) {
        $('#detailError').textContent = error.message;
      }
    });
  $('#saveFoldTarget')?.addEventListener('click', () => {
    try {
      const raw = $('#detailFoldTarget').value.trim(),
        target = raw === '' ? null : Number(raw);
      if (
        target !== null &&
        (!Number.isSafeInteger(target) || target < rule.min || target > rule.max)
      )
        throw Error('개인 목표는 최소값 이상, 전체 목표 이하인 정수로 입력하세요.');
      runCatalogAction(id, g => {
        const p = ruleProgress(g, rule);
        p.foldTarget = target;
        delete p.collapsed;
        return true;
      });
      renderAll();
      openRuleDetails(id, ruleId);
    } catch (error) {
      $('#detailError').textContent = error.message;
    }
  });
  $('#detailBack').addEventListener('click', () => openUniversalSettings(id));
}
function openUniversalSettings(id) {
  const g = state.games[id],
    reset = g.resetSchedule || { dailyTime: '09:00', weeklyDay: 3 },
    pass = g.pass;
  openDialog(
    '게임 설정',
    `<section class="settings-section"><span class="section-kicker">일정</span><div class="settings-section-head"><span class="game-tab-mark lime">⟳</span><h3>일정 &amp; 알림</h3></div><p class="wizard-help">일일·주간 리셋 시각, 패스, 갱신 알림을 함께 저장합니다.</p><div class="form-grid"><label>일일 리셋 시각 (KST)<input id="trackerResetTime" type="time" value="${escapeHtml(reset.dailyTime)}" /></label><label>주간 리셋 요일<select id="trackerResetWeekday">${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((day, i) => `<option value="${i}" ${i === reset.weeklyDay ? 'selected' : ''}>${day}</option>`).join('')}</select></label><label class="check-field"><input id="trackerPassActive" type="checkbox" ${pass?.active ? 'checked' : ''} />패스 사용</label></div><div id="trackerPassDates" class="form-grid settings-subsection" ${pass?.active ? '' : 'hidden'}><label>구매일<input id="trackerPassPurchase" type="date" value="${escapeHtml(pass?.purchaseDate || '')}" /></label><label>종료일<input id="trackerPassEnd" type="date" value="${escapeHtml(pass?.endDate || '')}" /></label></div><label class="check-field"><input id="resetAlert" type="checkbox" ${g.profile?.alerts?.reset ? 'checked' : ''} />갱신 알림</label><label class="check-field"><input id="fullAlert" type="checkbox" ${g.profile?.alerts?.full ? 'checked' : ''} />보유 상한 알림</label><button id="saveUniversalSettings" class="primary">설정 저장</button><p id="trackerSettingsError" role="status"></p></section><section class="settings-section"><span class="section-kicker">항목</span><div class="settings-section-head"><span class="game-tab-mark blue">▦</span><h3>항목 상세 설정</h3></div><p class="wizard-help">슬롯 수량과 개인 목표를 조정합니다. 완료한 항목도 여기서 관리할 수 있습니다.</p><div class="rule-nav">${catalogRules(
      g
    )
      .map((r, i) => `<button data-rule-detail="${i}">${escapeHtml(r.name)}</button>`)
      .join(
        ''
      )}</div><button id="editUniversalRules">규칙 구성</button></section><section class="settings-section"><span class="section-kicker">백업</span><div class="settings-section-head"><span class="game-tab-mark gold">↓</span><h3>데이터 보관</h3></div><p class="wizard-help">모든 게임의 데이터를 JSON 파일로 내보냅니다.</p><button id="exportTrackerData">데이터 내보내기</button><p id="trackerExportStatus" role="status" aria-live="polite"></p></section><section class="settings-section"><span class="section-kicker">지출</span><div class="settings-section-head"><span class="game-tab-mark coral">₩</span><h3>현금 지출</h3></div><div class="form-grid">${field('amount', '금액', 0, 100000000)}${field('currency', '통화', 'KRW', 0, 'text')}${field('item', '항목', '', 0, 'text')}</div><button id="recordUniversalSpending">지출 기록</button><p>${escapeHtml(spendingText(g.profile))}</p></section><section class="settings-section danger-zone"><span class="section-kicker">위험</span><div class="settings-section-head"><span class="game-tab-mark settings-icon-danger">⚠</span><h3>위험 구역</h3></div><p class="wizard-help">항목, 진행도, 패스, 지출 기록을 포함한 모든 데이터를 삭제합니다. 되돌릴 수 없습니다.</p><button id="resetUniversalGame" class="danger">이 게임 전체 초기화</button></section>`
  );
  $('#exportTrackerData').addEventListener('click', async event => {
    const button = event.currentTarget,
      status = $('#trackerExportStatus');
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = '내보내는 중…';
    try {
      status.textContent = await exportTrackerData();
    } catch (error) {
      status.textContent = `내보내지 못했습니다: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
  $('#trackerPassActive').addEventListener('change', () => {
    $('#trackerPassDates').hidden = !$('#trackerPassActive').checked;
  });
  document
    .querySelectorAll('[data-rule-detail]')
    .forEach(button =>
      button.addEventListener('click', () =>
        openRuleDetails(id, catalogRules(state.games[id])[Number(button.dataset.ruleDetail)].id)
      )
    );
  $('#editUniversalRules').addEventListener('click', () => openCatalogEditor(id));
  $('#saveUniversalSettings').addEventListener('click', () => {
    try {
      const time = $('#trackerResetTime').value,
        weekday = Number($('#trackerResetWeekday').value),
        active = $('#trackerPassActive').checked,
        purchaseDate = $('#trackerPassPurchase').value,
        endDate = $('#trackerPassEnd').value;
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
        !Number.isInteger(weekday) ||
        weekday < 0 ||
        weekday > 6
      )
        throw Error('리셋 시각과 요일을 확인하세요.');
      if (
        active &&
        ((purchaseDate && !trackerDateValid(purchaseDate)) ||
          (endDate && !trackerDateValid(endDate)) ||
          (purchaseDate && endDate && endDate < purchaseDate))
      )
        throw Error('패스 구매일과 종료일을 확인하세요.');
      // Stage A: let the engine commit settings once, including schedule revisions.
      // A second runCatalogAction/save after this call could partially commit settings.
      const previous = structuredClone(state.games[id]);
      try {
        const game = state.games[id];
        game.pass = active
          ? { active: true, purchaseDate, endDate, level: game.pass?.level || 0 }
          : null;
        game.profile.alerts = {
          ...game.profile.alerts,
          reset: $('#resetAlert').checked,
          full: $('#fullAlert').checked
        };
        updateResetSchedule(id, { dailyTime: time, weeklyDay: weekday });
      } catch (error) {
        state.games[id] = previous;
        throw error;
      }
      closeDialog();
      renderAll();
    } catch (error) {
      $('#trackerSettingsError').textContent = error.message;
    }
  });
  $('#recordUniversalSpending').addEventListener('click', () => {
    try {
      const v = values();
      if (v.amount <= 0 || !/^[A-Z]{3}$/.test(v.currency))
        throw Error('금액과 통화 코드를 확인하세요.');
      runCatalogAction(id, game => {
        game.profile.spending.push({
          id: crypto.randomUUID(),
          amount: v.amount,
          currency: v.currency,
          item: v.item,
          at: new Date().toISOString()
        });
        activity(id);
        return true;
      });
      openUniversalSettings(id);
    } catch (error) {
      $('#trackerSettingsError').textContent = error.message;
    }
  });
  $('#resetUniversalGame').addEventListener('click', () => {
    openDialog(
      '게임 전체 초기화',
      '<p>이 게임의 항목, 진행도, 패스, 게임 설정과 지출 기록을 모두 삭제합니다.</p><button id="confirmUniversalReset" class="danger">초기화</button>'
    );
    $('#confirmUniversalReset').addEventListener('click', () => {
      try {
        resetGame(id);
        closeDialog();
        renderAll();
        openCustomSetup(id);
      } catch (error) {
        toast(error.message);
      }
    });
  });
}
function mountUniversalEditor(initial, parent, initialSetup = false) {
  const draft = structuredClone(initial);
  let selected = 0,
    step = initial.length ? 4 : 0;
  const host = document.createElement('section');
  host.className = 'rule-editor';
  parent.appendChild(host);
  const input = (key, label, value, type = 'text') =>
    `<label>${label}<input data-rule-field="${key}" type="${type}" value="${escapeHtml(value ?? '')}" ${type === 'number' ? 'step="1"' : ''} /></label>`;
  const select = (key, label, value, options) =>
    `<label>${label}<select data-rule-field="${key}">${options.map(([k, n]) => `<option value="${k}" ${String(k) === String(value) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  function capture() {
    const r = draft[selected];
    if (!r) return;
    const el = key => host.querySelector(`[data-rule-field="${key}"]`);
    if (el('name')) r.name = el('name').value.trim();
    if (el('format')) r.format = el('format').value;
    if (el('startDate')) {
      r.startDate = el('startDate').value;
      r.endDate = el('endDate').value;
      r.endTime = el('endTime').value;
    }
    if (r.format !== 'fixed') {
      delete r.startDate;
      delete r.endDate;
      delete r.endTime;
    }
    if (el('kind') && r.kind !== el('kind').value) {
      r.kind = el('kind').value;
      if (r.kind === 'slot') {
        delete r.min;
        delete r.max;
        delete r.milestones;
        r.refillCount = 1;
        r.maxHeld = 3;
      } else {
        delete r.refillCount;
        delete r.maxHeld;
        r.min = 0;
        r.max = 15;
        r.milestones = [];
      }
    }
    for (const key of ['refillCount', 'maxHeld', 'min', 'max'])
      if (el(key)) r[key] = el(key).value.trim() ? Number(el(key).value) : NaN;
    if (el('milestones'))
      r.milestones = [
        ...new Set(
          el('milestones')
            .value.split(',')
            .map(v => v.trim())
            .filter(Boolean)
            .map(Number)
        )
      ].sort((a, b) => a - b);
    if (el('override'))
      r.resetOverride = el('override').checked
        ? {
            time: el('resetTime')?.value || r.resetOverride?.time || '09:00',
            ...(r.format === 'weekly'
              ? { weekday: Number(el('weekday')?.value ?? r.resetOverride?.weekday ?? 0) }
              : {})
          }
        : null;
    if (r.format === 'fixed') r.resetOverride = null;
  }
  function edit(fn) {
    try {
      capture();
      fn();
      render();
    } catch (error) {
      host.querySelector('[data-rule-error]').textContent = error.message;
    }
  }
  function render() {
    const r = draft[selected];
    if (!r) {
      host.innerHTML =
        '<div class="settings-section-head"><span class="game-tab-mark violet">▦</span><h3>규칙 구성</h3></div><p class="wizard-help">항목 이름, 포맷, 형태를 차례로 입력합니다.</p><button id="addTrackerRule">항목 추가</button><p data-rule-error role="status"></p>';
      host.querySelector('#addTrackerRule').addEventListener('click', () => {
        draft.push(newUniversalRule());
        selected = draft.length - 1;
        step = 0;
        render();
      });
      return;
    }
    const names = ['이름', '포맷', '형태', '세부값', '확인'];
    let body = '';
    if (step === 0) body = input('name', '항목 이름', r.name);
    if (step === 1)
      body =
        select('format', '포맷', r.format, [
          ['daily', '일일'],
          ['weekly', '주간'],
          ['fixed', '지정 기간']
        ]) +
        (r.format === 'fixed'
          ? input('startDate', '시작일 (KST)', r.startDate, 'date') +
            input('endDate', '종료일 (KST)', r.endDate, 'date') +
            input('endTime', '종료 시각 (KST)', r.endTime || '00:00', 'time') +
            '<p class="wizard-help">이 시각이 지나면 규칙이 종료됩니다. 자동으로 정해지지 않으니 직접 입력하세요.</p>'
          : '<p class="wizard-help">게임의 기본 리셋 시각을 따릅니다.</p>');
    if (step === 2)
      body =
        select('kind', '형태', r.kind, [
          ['slot', '슬롯형'],
          ['gauge', '게이지형']
        ]) +
        '<p class="wizard-help">슬롯형은 남은 수를 하나씩 완료합니다. 게이지형은 클릭할 때마다 1씩 증가합니다.</p>';
    if (step === 3) {
      body =
        r.kind === 'slot'
          ? input('refillCount', '갱신 수', r.refillCount, 'number') +
            input('maxHeld', '최대 보유 수', r.maxHeld, 'number') +
            '<p class="wizard-help">생성 직후에는 0개입니다. 상세 설정에서 수동으로 추가할 수 있습니다.</p>'
          : input('min', '최소값', r.min, 'number') +
            input('max', '목표값', r.max, 'number') +
            input('milestones', '마일스톤 (선택 · 쉼표로 구분)', (r.milestones || []).join(', '));
      if (r.format !== 'fixed')
        body += `<label class="check-field"><input data-rule-field="override" type="checkbox" ${r.resetOverride ? 'checked' : ''} />이 항목만 리셋 시각을 게임 기본값과 다르게</label>${
          r.resetOverride
            ? input('resetTime', '리셋 시각 (KST)', r.resetOverride.time, 'time') +
              (r.format === 'weekly'
                ? select(
                    'weekday',
                    '리셋 요일',
                    r.resetOverride.weekday ?? 0,
                    ['일', '월', '화', '수', '목', '금', '토'].map((d, i) => [i, d + '요일'])
                  )
                : '')
            : ''
        }`;
    }
    if (step === 4)
      body = `<p>${escapeHtml(r.name)} · ${{ daily: '일일', weekly: '주간', fixed: '지정 기간' }[r.format]} · ${r.kind === 'slot' ? '슬롯형' : '게이지형'}</p><p>${r.kind === 'slot' ? `갱신 ${r.refillCount}개 · 최대 ${r.maxHeld}개` : `${r.min} → ${r.max} · 마일스톤 ${(r.milestones || []).join(', ') || '없음'}`}</p>${r.format === 'fixed' ? `<p>${escapeHtml(r.startDate || '')} ~ ${escapeHtml(r.endDate || '')} ${escapeHtml(r.endTime || '')} KST</p>` : `<p>리셋: ${r.resetOverride ? escapeHtml(r.resetOverride.time) : '게임 기본값'}</p>`}<p class="wizard-help">규칙 저장 버튼을 누르면 적용됩니다.</p>`;
    host.innerHTML = `<div class="settings-section-head"><span class="game-tab-mark violet">▦</span><h3>규칙 구성</h3></div><p class="wizard-help">항목 이름 → 포맷 → 형태 → 세부값 → 확인 순서로 입력합니다.</p><div class="rule-nav">${draft.map((x, i) => `<button data-edit-rule="${i}" aria-pressed="${selected === i}">${escapeHtml(x.name)}</button>`).join('')}<button id="addTrackerRule">항목 추가</button></div><div class="wizard-steps" role="list" aria-label="5단계 중 ${step + 1}단계">${names.map((n, i) => `<span class="wizard-step ${i === step ? 'current' : i < step ? 'done' : ''}" role="listitem"><b>${i + 1}</b></span>`).join('')}</div><p class="wizard-progress">${step + 1} / 5 · ${names[step]}</p><div class="form-grid">${body}</div><div class="wizard-nav"><div class="wizard-nav-primary">${step > 0 ? '<button id="wizardPrev">이전</button>' : ''}${step < 4 ? '<button id="wizardNext">다음</button>' : '<button id="editRuleStart">항목 수정</button>'}</div><div class="wizard-nav-danger"><button id="removeRule" class="danger">항목 삭제</button></div></div><p data-rule-error role="status"></p>`;
    const bind = (selector, fn) =>
      host
        .querySelectorAll(selector)
        .forEach(button => button.addEventListener('click', () => edit(() => fn(button))));
    bind('#addTrackerRule', () => {
      draft.push(newUniversalRule());
      selected = draft.length - 1;
      step = 0;
    });
    bind('[data-edit-rule]', button => {
      selected = Number(button.dataset.editRule);
      step = 4;
    });
    bind('#wizardPrev', () => step--);
    bind('#wizardNext', () => {
      if (step === 0 && (!r.name || r.name.length > 60)) throw Error('이름은 1~60자로 입력하세요.');
      if (
        step === 1 &&
        r.format === 'fixed' &&
        (!trackerDateValid(r.startDate) ||
          !trackerDateValid(r.endDate) ||
          !trackerTimeValid(r.endTime) ||
          Date.parse(`${r.endDate}T${r.endTime}:00+09:00`) <=
            Date.parse(`${r.startDate}T00:00:00+09:00`))
      )
        throw Error('시작일과 종료일·종료 시각을 확인하세요.');
      if (step === 3) validateTrackerRule(r);
      step++;
    });
    bind('#editRuleStart', () => (step = 0));
    bind('#removeRule', () => {
      draft.splice(selected, 1);
      selected = Math.max(0, selected - 1);
      step = 4;
    });
    for (const key of ['format', 'kind', 'override'])
      host
        .querySelector(`[data-rule-field="${key}"]`)
        ?.addEventListener('change', () => edit(() => {}));
  }
  render();
  return () => {
    capture();
    draft.forEach(validateTrackerRule);
    return structuredClone(draft);
  };
}
