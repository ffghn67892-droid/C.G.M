function openDialog(title, body) {
  let el = $('#managerDialog');
  if (!el) {
    el = document.createElement('div');
    el.id = 'managerDialog';
    el.className = 'difficulty-modal';
    $('body').appendChild(el);
  }
  el.innerHTML = `<div class="manager-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2><div id="dialogContent">${body}</div><button id="closeManagerDialog">취소 / 닫기</button></div>`;
  el.hidden = false;
  $('#closeManagerDialog').addEventListener('click', closeDialog);
  const first = el.querySelector('input') || el.querySelector('button');
  first?.focus({ preventScroll: true });
  el.querySelector('.manager-dialog').scrollTop = 0;
}
function closeDialog() {
  if ($('#managerDialog')) $('#managerDialog').hidden = true;
}
function field(key, label, value = 0, max = 99999, type = 'number') {
  return `<label>${label}<input data-field="${key}" type="${type}" value="${escapeHtml(value)}" ${type === 'number' ? `min="0" max="${max}" step="${['amount', 'initialCash'].includes(key) ? '0.01' : '1'}"` : ''} /></label>`;
}
function values() {
  const v = {};
  $$('[data-field]').forEach(el => {
    const numeric = el.getAttribute('type') === 'number';
    const n = numeric ? Number(el.value) : el.value;
    if (
      numeric &&
      (!Number.isFinite(n) ||
        (!['amount', 'initialCash'].includes(el.dataset.field) && !Number.isInteger(n)) ||
        n < 0 ||
        n > Number(el.getAttribute('max')))
    )
      throw Error('입력 범위를 확인하세요.');
    v[el.dataset.field] = n;
  });
  $$('[data-mask]').forEach(el => {
    v[el.dataset.mask] ||= [];
    if (el.checked) v[el.dataset.mask].push(Number(el.value));
  });
  return v;
}
function mountRuleEditor(...args) {
  return mountUniversalEditor(...args);
}
function openCatalogEditor(gameId) {
  const g = state.games[gameId];
  openDialog(
    '규칙 구성',
    `<div id="catalogMount"></div><div class="wizard-commit"><button id="saveRuleCatalog" class="primary">규칙 저장</button>${isCustomGame(gameId) ? '<button id="resetCustomGame" class="danger">이 게임 초기화</button>' : ''}</div><p id="ruleSaveResult" role="status"></p>`
  );
  const read = mountRuleEditor(catalogRules(g), $('#catalogMount'));
  $('#saveRuleCatalog').addEventListener('click', () => {
    try {
      updateCatalog(gameId, read());
    } catch (e) {
      $('#ruleSaveResult').textContent = e.message;
      return;
    }
    closeDialog();
    renderAll();
  });
  $('#resetCustomGame')?.addEventListener('click', () => {
    openDialog(
      '게임 초기화',
      '<p>이 게임의 규칙과 진행도를 삭제하고 최초 설정으로 돌아갑니다.</p><button id="confirmCustomReset">초기화</button>'
    );
    $('#confirmCustomReset').addEventListener('click', () => {
      try {
        resetGame(gameId);
        closeDialog();
        renderAll();
        openCustomSetup(gameId);
      } catch (e) {
        toast(e.message);
      }
    });
  });
}
function cloneCatalog(rules) {
  return structuredClone(rules).map(r => ({ ...r, id: 'rule-' + crypto.randomUUID() }));
}
function validateSetupOptions(options = {}) {
  const reset = options.reset || { time: '09:00', weekday: 3 };
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(reset.time) ||
    !Number.isInteger(reset.weekday) ||
    reset.weekday < 0 ||
    reset.weekday > 6
  )
    throw Error('리셋 시각과 요일을 확인하세요.');
  const pass = options.pass?.active
    ? {
        active: true,
        purchaseDate: options.pass.purchaseDate || '',
        endDate: options.pass.endDate || '',
        level: 0
      }
    : null;
  if (pass) {
    for (const value of [pass.purchaseDate, pass.endDate]) {
      if (
        value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        throw Error('패스 날짜를 확인하세요.');
    }
    if (pass.purchaseDate && pass.endDate && pass.purchaseDate > pass.endDate)
      throw Error('패스 종료일은 구매일 이후여야 합니다.');
  }
  return { reset: { time: reset.time, weekday: reset.weekday }, pass };
}
function createCustomGame(name, rules, existingId, profileOptions = {}) {
  if (
    existingId &&
    ((!isCustomGame(existingId) &&
      !CATALOG_PRESETS.includes(existingId) &&
      existingId !== 'kards') ||
      !state.games[existingId] ||
      state.games[existingId].profile?.registeredAt)
  )
    throw Error('최초 설정 대상이 아닙니다.');
  name = name.trim();
  if (!name || name.length > 60) throw Error('게임 이름은 1~60자로 입력하세요.');
  const options = validateSetupOptions(profileOptions);
  validateRuleCatalog(rules);
  const id = existingId || 'game-' + crypto.randomUUID(),
    g = freshGame();
  g.ruleCatalog = structuredClone(rules);
  g.catalogVersion = 2;
  g.profile ||= {};
  g.profile.registeredAt = new Date().toISOString();
  // Track 1 integration contract: game reset defaults and optional pass metadata.
  g.resetSchedule = {
    dailyTime: options.reset.time,
    weeklyDay: options.reset.weekday
  };
  g.pass = options.pass;
  g.ruleProgress = {};
  g.actionHistory = [];
  const before = structuredClone(state);
  try {
    state.games[id] = g;
    state.customGames ||= [];
    if (!GAMES.some(x => x[0] === id) && !state.customGames.some(x => x[0] === id))
      state.customGames.push([id, name, '◇', 'lime']);
    else if (isCustomGame(id)) {
      const index = state.customGames.findIndex(x => x[0] === id);
      // GAMES may share this entry; keep its displayed name unchanged until save succeeds.
      const entry = [...state.customGames[index]];
      entry[1] = name;
      state.customGames[index] = entry;
    } else {
      state.gameNames ||= {};
      state.gameNames[id] = name;
    }
    syncUniversalCatalog(g, new Date());
    state.activeGame = id;
    save();
  } catch (e) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, before);
    throw e;
  }
  if (!GAMES.some(x => x[0] === id)) GAMES.push(state.customGames.find(x => x[0] === id));
  else GAMES.find(x => x[0] === id)[1] = name;
  return id;
}
function openCustomSetup(existingId, draft = {}) {
  const presetOptions = existingId
    ? ''
    : ['kards', ...CATALOG_PRESETS]
        .filter(id => !state.games[id]?.profile?.registeredAt && GAMES.some(x => x[0] === id))
        .map(id => {
          const name = GAMES.find(x => x[0] === id)[1];
          return `<option value="${id}" ${draft.presetId === id ? 'selected' : ''}>${escapeHtml(name)}</option>`;
        })
        .join('');
  openDialog(
    '새 게임 만들기 — 이름',
    `<p class="wizard-help">1 / 3 · 게임 이름을 입력하세요.</p><label>게임 이름<input id="customGameName" maxlength="60" value="${escapeHtml(draft.name ?? GAMES.find(x => x[0] === existingId)?.[1] ?? '')}" /></label>${
      presetOptions
        ? `<label>시작 구성<select id="customGamePreset"><option value="">빈 구성 — 요소를 하나씩 직접 추가합니다</option>${presetOptions}</select></label><p class="wizard-help">이전 고정 탭에 있던 게임을 고르면 그 게임의 일정·항목 구성(리셋 시각, 항목 이름·개수)을 그대로 채워줍니다. 보상 내용은 없습니다 — 저장 후에도 자유롭게 추가·수정할 수 있습니다.</p>`
        : ''
    }<p id="customGameError" role="status"></p><button id="customSetupNext">다음</button>`
  );
  $('#customGamePreset')?.addEventListener('change', () => {
    if (!$('#customGameName').value.trim()) {
      const preset = $('#customGamePreset').value;
      if (preset) $('#customGameName').value = GAMES.find(x => x[0] === preset)[1];
    }
  });
  $('#customSetupNext').addEventListener('click', () => {
    const name = $('#customGameName').value.trim();
    if (!name || name.length > 60) {
      $('#customGameError').textContent = '게임 이름은 1~60자로 입력하세요.';
      return;
    }
    const presetId = $('#customGamePreset')?.value || null;
    openGameResetStep(existingId, { ...draft, name, presetId });
  });
}
function openGameResetStep(existingId, draft) {
  const reset =
    draft.reset ||
    (draft.presetId ? presetTrackerReset(draft.presetId) : { time: '09:00', weekday: 3 });
  openDialog(
    '새 게임 만들기 — 리셋 일정',
    `<p class="wizard-help">2 / 3 · 일일·주간 항목에 적용할 기본 일정을 정하세요. 시각은 한국 표준시(KST) 기준입니다.</p><div class="form-grid"><label>일일 리셋 시각<input type="time" id="gameResetTime" value="${escapeHtml(reset.time)}" /></label><label>주간 리셋 요일<select id="gameResetWeekday">${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((day, i) => `<option value="${i}" ${i === reset.weekday ? 'selected' : ''}>${day}</option>`).join('')}</select></label></div><p class="wizard-help">주간 리셋도 위 시각을 사용합니다. 항목별로 다른 일정을 지정할 수 있습니다.</p><p id="customGameError" role="status"></p><button id="customSetupBack">이전</button><button id="customSetupNext">다음</button>`
  );
  const readReset = () => ({
    time: $('#gameResetTime').value,
    weekday: Number($('#gameResetWeekday').value)
  });
  $('#customSetupBack').addEventListener('click', () =>
    openCustomSetup(existingId, { ...draft, reset: readReset() })
  );
  $('#customSetupNext').addEventListener('click', () => {
    try {
      const { reset } = validateSetupOptions({ reset: readReset() });
      openGamePassStep(existingId, { ...draft, reset });
    } catch (e) {
      $('#customGameError').textContent = e.message;
    }
  });
}
function openGamePassStep(existingId, draft) {
  const pass = draft.pass || { active: false, purchaseDate: '', endDate: '' };
  openDialog(
    '새 게임 만들기 — 패스',
    `<p class="wizard-help">3 / 3 · 패스 아이템을 구매했나요?</p><label>패스 구매 여부<select id="gamePassActive"><option value="no" ${!pass.active ? 'selected' : ''}>아니오</option><option value="yes" ${pass.active ? 'selected' : ''}>예</option></select></label><div id="gamePassDates" ${pass.active ? '' : 'hidden'}><p class="wizard-help">날짜는 비워 두고 시작할 수 있습니다. 레벨은 게임 화면에서 직접 올립니다.</p><div class="form-grid"><label>구매일 (선택)<input type="date" id="gamePassPurchaseDate" value="${escapeHtml(pass.purchaseDate)}" /></label><label>종료일 (선택)<input type="date" id="gamePassEndDate" value="${escapeHtml(pass.endDate)}" /></label></div></div><p id="customGameError" role="status"></p><button id="customSetupBack">이전</button><button id="skipGamePass">패스 건너뛰기</button><button id="createCustomGame">완료</button>`
  );
  const readPass = () => ({
    active: $('#gamePassActive').value === 'yes',
    purchaseDate: $('#gamePassPurchaseDate').value,
    endDate: $('#gamePassEndDate').value
  });
  $('#gamePassActive').addEventListener('change', () => {
    $('#gamePassDates').hidden = $('#gamePassActive').value !== 'yes';
  });
  $('#customSetupBack').addEventListener('click', () =>
    openGameResetStep(existingId, { ...draft, pass: readPass() })
  );
  const finish = pass => {
    try {
      createCustomGame(
        draft.name,
        draft.presetId ? presetTrackerRules(draft.presetId) : [],
        draft.presetId || existingId,
        { reset: draft.reset, pass }
      );
    } catch (e) {
      $('#customGameError').textContent = e.message;
      return;
    }
    closeDialog();
    renderAll();
  };
  $('#skipGamePass').addEventListener('click', () => finish(null));
  $('#createCustomGame').addEventListener('click', () => finish(readPass()));
}
