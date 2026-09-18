function newUniversalRule(type = 'quest') {
  const r = newCatalogRule(type);
  r.label = '새 ' + CATALOG_TYPES[type];
  if (!['quest', 'claim'].includes(type)) {
    r.rewards = [];
    r.quests = [];
    r.target = 15;
    r.steps = [];
  }
  if (type === 'resource') {
    r.capacity = 2;
    r.intervalMinutes = 720;
    r.recoverAmount = 1;
    r.consumeRewards = {};
  }
  if (type === 'pass' || type === 'counter') r.schedule.kind = 'once';
  return r;
}
function initializeCatalogRewards(id) {
  const g = state.games[id];
  for (const r of catalogRules(g)) {
    const p = ruleProgress(g, r);
    for (const [rewardId, n] of Object.entries(r.initialReceived || {})) {
      if (!Number.isInteger(n) || n < 0 || n > 100) throw Error('기수령 횟수를 확인하세요.');
      const reward = r.rewards.find(x => x.id === rewardId);
      if (!reward && n) throw Error('보상 종류를 확인하세요.');
      for (let i = 0; i < n; i++) {
        if (r.paidOnly && !g.profile.pass.active)
          throw Error('유료 보상의 최초 기록은 유료 활성 후 가능합니다.');
        let m = null;
        if (r.type === 'quest') {
          const q = r.quests.find(
            q =>
              q.rewardIds.includes(rewardId) &&
              (!r.unique || !p.missions.some(m => m.templateId === q.id))
          );
          if (!q || p.missions.length >= r.capacity)
            throw Error('남은 퀘스트와 기수령 퀘스트의 합계 또는 종류를 확인하세요.');
          m = catalogMission({ ...r, quests: [q] });
          m.done = true;
          m.rewardReceived = structuredClone(reward.resources);
          p.missions.push(m);
          p.completed.push(m.id);
        } else if (r.type !== 'claim' || catalogDone(g, r))
          throw Error('기수령 횟수가 수령 상한을 초과합니다.');
        const count = p.claimed || 0;
        award(
          id,
          catalogAdapter(g).key(r, m, rulePeriod(r), count),
          reward.resources,
          r.label,
          true
        );
        recordCatalogExpense(g, r);
        if (!m) {
          p.claimed = count + 1;
          p.monthCount = (p.monthCount || 0) + 1;
        }
        catalogAdapter(g).flush?.(r, p);
        catalogEmit(id, r, 'complete', { points: m?.points || 0 }, true);
        if (m && r.removeCompleted) p.missions = p.missions.filter(x => x !== m);
      }
    }
    delete r.initialReceived;
  }
}
function initializeCatalogProgress(id) {
  const g = state.games[id];
  for (const r of catalogRules(g)) {
    const p = ruleProgress(g, r);
    if (r.type === 'quest' && r.initialCount !== undefined) {
      if (!Number.isInteger(r.initialCount) || r.initialCount < 0 || r.initialCount > r.capacity)
        throw Error('최초 퀘스트 수를 확인하세요.');
      p.missions = [];
      catalogSpawn(r, p, r.initialCount);
    }
    if (['goal', 'pass', 'counter', 'resource'].includes(r.type) && r.initialValue !== undefined) {
      if (
        !Number.isSafeInteger(r.initialValue) ||
        r.initialValue < 0 ||
        r.initialValue > (r.type === 'resource' ? r.capacity : r.target)
      )
        throw Error('최초 진행도를 확인하세요.');
      p.value = r.initialValue;
      if (r.type === 'pass') g.profile.pass.level = p.value;
      if (r.profileXp) g.profile.pass.xp = p.value;
      if (r.type !== 'resource') catalogAwardSteps(id, r, p, true);
    }
    delete r.initialCount;
    delete r.initialValue;
  }
}
function catalogProfileFields() {
  return (
    '<div class="form-grid">' +
    field(
      'registered',
      '등록일',
      new Date(Date.now() + 9 * HOUR_MS).toISOString().slice(0, 10),
      0,
      'date'
    ) +
    '<label class="check-field"><input id="initialPaid" type="checkbox" />유료 / 추가 공급 활성</label></div>'
  );
}
function readCatalogProfile() {
  const date = document.querySelector('[data-field="registered"]').value,
    at = date + 'T00:00:00+09:00';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(at)) ||
    Date.parse(at) > Date.now() ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw Error('등록일을 확인하세요.');
  return { registeredAt: at, paid: document.querySelector('#initialPaid').checked };
}
function openPresetSetup(id) {
  const opened = new Date();
  openDialog(
    '최초 규칙 구성',
    catalogProfileFields() +
      '<div id="presetEditor"></div><button id="savePreset">설정 저장</button><p id="presetError" role="status"></p>'
  );
  const read = mountUniversalEditor(
    presetCatalog(id),
    document.querySelector('#presetEditor'),
    true
  );
  document.querySelector('#savePreset').addEventListener('click', () => {
    try {
      const rules = read();
      if (rules.some(r => rulePeriod(r, opened) !== rulePeriod(r)))
        throw Error('갱신 시각이 지났습니다. 닫은 후 다시 설정하세요.');
      createCustomGame(GAMES.find(x => x[0] === id)[1], rules, id, readCatalogProfile());
      closeDialog();
      renderAll();
    } catch (e) {
      document.querySelector('#presetError').textContent = e.message;
    }
  });
}
function openUniversalSettings(id) {
  const g = state.games[id],
    p = g.profile;
  openDialog(
    '게임 설정',
    `<div class="form-grid"><label class="check-field"><input id="universalPaid" type="checkbox" ${p.pass.active ? 'checked' : ''} />유료 / 추가 공급 활성</label>${field('catalogPassEnd', '패스 종료 KST', p.pass.end ? new Date(Date.parse(p.pass.end) + 9 * HOUR_MS).toISOString().slice(0, 16) : '', 0, 'datetime-local')}<label class="check-field"><input id="resetAlert" type="checkbox" ${p.alerts.reset ? 'checked' : ''} />갱신 알림</label><label class="check-field"><input id="fullAlert" type="checkbox" ${p.alerts.full ? 'checked' : ''} />충전 완료 알림</label></div><button id="saveUniversalSettings">설정 저장</button><button id="editUniversalRules">규칙 구성</button><h3>현금 지출</h3><div class="form-grid">${field('amount', '금액', 0, 100000000)}${field('currency', '통화', 'KRW', 0, 'text')}${field('item', '항목', '', 0, 'text')}</div><button id="recordUniversalSpending">지출 기록</button><p>${escapeHtml(spendingText(p))}</p><button id="resetUniversalGame">이 게임 전체 초기화</button>`
  );
  $('#editUniversalRules').addEventListener('click', () => openCatalogEditor(id));
  $('#saveUniversalSettings').addEventListener('click', () => {
    try {
      const v = values();
      runCatalogAction(id, g => {
        setCatalogBonus(g, $('#universalPaid').checked);
        g.profile.pass.end = v.catalogPassEnd ? v.catalogPassEnd + '+09:00' : '';
        g.profile.alerts = { reset: $('#resetAlert').checked, full: $('#fullAlert').checked };
        for (const r of catalogRules(g).filter(x => x.type === 'pass'))
          if (catalogActive(g, r)) catalogAwardSteps(id, r, ruleProgress(g, r));
        return true;
      });
      closeDialog();
      renderAll();
    } catch (e) {
      toast(e.message);
    }
  });
  $('#recordUniversalSpending').addEventListener('click', () => {
    try {
      const v = values();
      if (v.amount <= 0 || !/^[A-Z]{3}$/.test(v.currency))
        throw Error('금액과 통화 코드를 확인하세요.');
      runCatalogAction(id, g => {
        g.profile.spending.push({
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
    } catch (e) {
      toast(e.message);
    }
  });
  $('#resetUniversalGame').addEventListener('click', () => {
    openDialog(
      '게임 전체 초기화',
      '<p>진행도와 규칙, 보상 및 지출 기록을 모두 삭제합니다.</p><button id="confirmUniversalReset">초기화</button>'
    );
    $('#confirmUniversalReset').addEventListener('click', () => {
      resetGame(id);
      closeDialog();
      renderAll();
      isCustomGame(id) ? openCustomSetup(id) : openPresetSetup(id);
    });
  });
}
function mountUniversalEditor(initial, parent, initialSetup = false) {
  const draft = structuredClone(initial);
  let selected = 0;
  const host = document.createElement('section');
  host.className = 'rule-editor';
  parent.appendChild(host);
  const input = (key, label, value, type = 'text') =>
    `<label>${label}<input data-rule-field="${key}" type="${type}" value="${escapeHtml(value ?? '')}" /></label>`;
  const select = (key, label, value, options) =>
    `<label>${label}<select data-rule-field="${key}">${options.map(([k, n]) => `<option value="${k}" ${String(k) === String(value) ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></label>`;
  const check = (key, label, on) =>
    `<label class="check-field"><input type="checkbox" data-rule-field="${key}" ${on ? 'checked' : ''} />${label}</label>`;
  const bundle = b =>
    Object.entries(b || {})
      .map(([k, n]) => `${REWARD_NAMES[k] || k}:${n}`)
      .join(', ');
  function parseBundle(value) {
    const out = {};
    for (const part of value
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)) {
      const i = part.lastIndexOf(':'),
        label = part.slice(0, i).trim(),
        n = Number(part.slice(i + 1));
      if (i < 1 || !Number.isSafeInteger(n) || n < 0) throw Error('재화:수량 형식으로 입력하세요.');
      const key = Object.keys(REWARD_NAMES).find(k => REWARD_NAMES[k] === label) || label;
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw Error('재화 이름을 확인하세요.');
      out[key] = n;
    }
    return out;
  }
  function capture() {
    const r = draft[selected];
    if (!r) return;
    const el = k => host.querySelector(`[data-rule-field="${k}"]`),
      get = k => el(k)?.value,
      number = k => Number(get(k));
    r.label = get('label');
    r.schedule = {
      kind: get('kind'),
      time: get('time'),
      weekday: number('weekday'),
      days: number('days'),
      anchor: get('anchor'),
      times: get('times')
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
    };
    for (const k of ['spawnCount', 'capacity', 'passExtra']) r[k] = number(k);
    for (const k of [
      'enabled',
      'unique',
      'replace',
      'removeCompleted',
      'chooseType',
      'hideCompleted',
      'hideAction',
      'paidOnly'
    ])
      r[k] = !!el(k)?.checked;
    r.span = number('span') || 1;
    r.columns = number('columns') || 1;
    r.note = get('note');
    if (number('expenseAmount'))
      r.expense = { currency: get('expenseCurrency'), amount: number('expenseAmount') };
    else delete r.expense;
    r.attention = get('attention');
    r.page = get('page');
    r.event = get('event');
    r.eventLabel = get('eventLabel');
    r.start = get('start') ? get('start') + '+09:00' : '';
    r.end = get('end') ? get('end') + '+09:00' : '';
    r.stopAt = get('stopAt') || undefined;
    r.requires = [...host.querySelectorAll('[data-requires]')]
      .filter(x => x.checked)
      .map(x => x.value);
    for (const k of ['monthlyLimit', 'completionLimit']) {
      if (number(k)) r[k] = number(k);
      else delete r[k];
    }
    if (['goal', 'pass', 'counter'].includes(r.type)) {
      r.target = number('target');
      r.steps.forEach((x, i) => {
        x.at = number('stepAt' + i);
        x.free = parseBundle(get('stepFree' + i));
        x.paid = parseBundle(get('stepPaid' + i));
      });
      if (number('repeatFrom'))
        r.repeat = {
          from: number('repeatFrom'),
          every: number('repeatEvery'),
          free: parseBundle(get('repeatFree')),
          paid: parseBundle(get('repeatPaid'))
        };
      else delete r.repeat;
    }
    if (r.type === 'resource') {
      r.intervalMinutes = number('intervalMinutes');
      r.recoverAmount = number('recoverAmount');
      r.consumeRewards = parseBundle(get('consumeRewards'));
      r.consumeLabel = get('consumeLabel');
    }
    r.rewards.forEach((x, i) => {
      x.label = get('rewardLabel' + i);
      x.resources = parseBundle(get('resources' + i));
      if (initialSetup) {
        r.initialReceived ||= {};
        r.initialReceived[x.id] = number('received' + i);
      }
    });
    r.quests.forEach((q, i) => {
      q.label = get('questLabel' + i);
      q.points = number('questPoints' + i);
      q.rewardIds = [...host.querySelectorAll(`[data-quest-reward="${i}"]`)]
        .filter(x => x.checked)
        .map(x => x.value);
    });
    r.links = (r.links || []).map((l, i) => ({
      target: get('linkTarget' + i),
      event: get('linkEvent' + i),
      value: get('linkValue' + i)
    }));
    if (initialSetup) {
      r.initialValue = number('initialValue');
      r.initialCount = number('initialCount');
    }
  }
  function edit(fn) {
    try {
      capture();
      fn();
      render();
    } catch (e) {
      host.querySelector('[data-rule-error]').textContent = e.message;
    }
  }
  function render() {
    const r = draft[selected],
      add = Object.entries(CATALOG_TYPES)
        .map(([k, v]) => `<button data-add-rule="${k}" data-new-empty="${k}">${v} 추가</button>`)
        .join('');
    if (!r) {
      host.innerHTML = `<h3>규칙 구성</h3><div class="rule-nav">${add}</div><p data-rule-error="true"></p>`;
      host.querySelectorAll('[data-add-rule]').forEach(b =>
        b.addEventListener('click', () => {
          draft.push(newUniversalRule(b.dataset.addRule));
          selected = 0;
          render();
        })
      );
      return;
    }
    r.steps ||= [];
    r.links ||= [];
    r.quests ||= [];
    const others = draft.filter(x => x !== r).map(x => [x.id, x.label]),
      date = v => (v ? new Date(Date.parse(v) + 9 * HOUR_MS).toISOString().slice(0, 16) : '');
    host.innerHTML = `<h3>규칙 구성 · ${CATALOG_TYPES[r.type]}</h3><div class="rule-nav">${draft.map((x, i) => `<button data-edit-rule="${i}" aria-pressed="${selected === i}">${escapeHtml(x.label)}</button>`).join('')}</div><div class="rule-nav">${add}<button id="copyRule">규칙 복제</button><button id="moveRuleUp">앞으로 이동</button><button id="removeRule" class="danger">이 규칙 삭제</button></div>
   <div class="form-grid">${input('label', '이름', r.label)}${input('page', '페이지 그룹 (비워두면 항상 표시)', r.page)}${select(
     'span',
     '카드 너비',
     r.span || 1,
     [
       [1, '1칸'],
       [2, '2칸'],
       [3, '3칸']
     ]
   )}${select('columns', '퀘스트 목록 열 수', r.columns || 1, [
     [1, '1열'],
     [2, '2열'],
     [3, '3열']
   ])}${input('note', '메모', r.note)}${check('enabled', '활성', r.enabled !== false)}${select(
     'attention',
     '알림 중요도',
     r.attention || 'normal',
     [
       ['normal', '일반'],
       ['urgent', '오늘 확인'],
       ['warning', '진행 권장'],
       ['none', '별도 알림 없음']
     ]
   )}${select('kind', '갱신 주기', r.schedule.kind, [
     ['daily', '매일'],
     ['weekly', '매주'],
     ['intervalDays', 'N일마다'],
     ['slots', '하루 여러 시각'],
     ['monthly', '매월'],
     ['once', '기간 내 유지']
   ])}${input('time', '갱신 시각', r.schedule.time, 'time')}${select(
     'weekday',
     '요일',
     r.schedule.weekday || 0,
     ['일', '월', '화', '수', '목', '금', '토'].map((x, i) => [i, x])
   )}${input('days', 'N일 간격', r.schedule.days || 1, 'number')}${input('anchor', '기준 날짜', r.schedule.anchor || '2026-01-01', 'date')}${input('times', '여러 시각 (쉼표 구분)', (r.schedule.times || ['04:00', '12:00', '20:00']).join(', '))}${input('start', '시작 KST', date(r.start), 'datetime-local')}${input('end', '종료 KST', date(r.end), 'datetime-local')}${input('spawnCount', '갱신 시 생성 / 수령 수', r.spawnCount, 'number')}${input('capacity', '보관 상한', r.capacity, 'number')}${input('passExtra', '추가 공급 활성 시 추가 수', r.passExtra, 'number')}${check('paidOnly', '유료 활성 시 사용', r.paidOnly)}</div>
   ${r.type === 'quest' ? `<div class="form-grid">${check('unique', '같은 종류 중복 금지', r.unique)}${check('chooseType', '퀘스트 종류 선택 허용', r.chooseType)}${check('replace', '갱신 시 전체 교체', r.replace)}${check('removeCompleted', '완료 즉시 제거', r.removeCompleted)}${input('completionLimit', '필요 완료 수 (0이면 전체)', r.completionLimit || 0, 'number')}</div>` : `<div hidden>${check('unique', '', false)}${check('chooseType', '', false)}${check('replace', '', false)}${check('removeCompleted', '', false)}${input('completionLimit', '', 0, 'number')}</div>`}
   <div class="form-grid">${check('hideCompleted', '수령 완료 시 숨김', r.hideCompleted)}${check('hideAction', '직접 진행 버튼 숨김', r.hideAction)}${input('monthlyLimit', '월간 수령 상한 (0이면 없음)', r.monthlyLimit || 0, 'number')}${input('event', '공동 진행 이름 (같은 이름끼리 함께 증가)', r.event)}${input('eventLabel', '진행 버튼 이름', r.eventLabel)}${select('stopAt', '대상 달성 시 이 항목 종료', r.stopAt || '', [['', '없음'], ...others])}</div>
   <details><summary>구매 기록 설정</summary><div class="form-grid">${input('expenseCurrency', '소비 재화 ID', r.expense?.currency || 'gems')}${input('expenseAmount', '소비 수량 (0이면 구매 기록 안 함)', r.expense?.amount || 0, 'number')}</div></details><details><summary>선행 완료 조건</summary>${others.map(([id, label]) => `<label class="check-field"><input data-requires="true" type="checkbox" value="${id}" ${(r.requires || []).includes(id) ? 'checked' : ''} />${escapeHtml(label)}</label>`).join('')}</details>
   ${r.type === 'resource' ? `<div class="form-grid">${input('intervalMinutes', '회복 간격 (분)', r.intervalMinutes, 'number')}${input('recoverAmount', '회복 수량', r.recoverAmount, 'number')}${input('consumeLabel', '사용 버튼 이름', r.consumeLabel || '1개 사용')}${input('consumeRewards', '사용 시 기록할 재화:수량', bundle(r.consumeRewards))}</div>` : ''}
   ${['goal', 'pass', 'counter'].includes(r.type) ? `<h4>목표와 구간 보상</h4>${input('target', '목표 상한', r.target, 'number')}${r.steps.map((s, i) => `<div class="form-grid">${input('stepAt' + i, '도달값', s.at, 'number')}${input('stepFree' + i, '무료 재화:수량', bundle(s.free))}${input('stepPaid' + i, '유료 재화:수량', bundle(s.paid))}<button data-remove-step="${i}">구간 삭제</button></div>`).join('')}<button id="addStep">구간 추가</button><details><summary>반복 구간</summary><div class="form-grid">${input('repeatFrom', '반복 시작 (0이면 없음)', r.repeat?.from || 0, 'number')}${input('repeatEvery', '반복 간격', r.repeat?.every || 1, 'number')}${input('repeatFree', '무료 보상', bundle(r.repeat?.free))}${input('repeatPaid', '유료 보상', bundle(r.repeat?.paid))}</div></details>` : ''}
   <h4>보상 종류</h4>${r.rewards.map((x, i) => `<div class="form-grid">${input('rewardLabel' + i, '보상 이름', x.label)}${input('resources' + i, '재화:수량 (쉼표 구분)', bundle(x.resources))}${initialSetup ? input('received' + i, '기수령 횟수', r.initialReceived?.[x.id] || 0, 'number') : ''}<button data-remove-reward="${i}">보상 삭제</button></div>`).join('')}${['quest', 'claim'].includes(r.type) ? '<button id="addRuleReward">보상 추가</button>' : ''}
   ${r.quests.map((q, i) => `<fieldset>${input('questLabel' + i, '퀘스트 내용', q.label)}${input('questPoints' + i, '연동할 포인트', q.points || 0, 'number')}${r.rewards.map(x => `<label class="check-field"><input type="checkbox" data-quest-reward="${i}" value="${x.id}" ${q.rewardIds.includes(x.id) ? 'checked' : ''} />${escapeHtml(x.label)}</label>`).join('')}<button data-remove-quest="${i}">종류 삭제</button></fieldset>`).join('')}${r.type === 'quest' ? '<button id="addRuleQuest">퀘스트 종류 추가</button>' : ''}
   <details><summary>다른 항목과 연동</summary>${r.links
     .map(
       (l, i) =>
         `<div class="form-grid">${select('linkTarget' + i, '대상', l.target, others)}${select(
           'linkEvent' + i,
           '발생 동작',
           l.event,
           [
             ['complete', '완료 / 수령'],
             ['progress', '진행'],
             ['consume', '자원 사용']
           ]
         )}${select('linkValue' + i, '증가량', l.value, [
           ['one', '1'],
           ['points', '퀘스트 포인트'],
           ['amount', '진행 증가량'],
           ['date', '서로 다른 활동 날짜']
         ])}<button data-remove-link="${i}">연동 삭제</button></div>`
     )
     .join('')}<button id="addLink">연동 추가</button></details>
   ${initialSetup ? `<h4>최초 진행도</h4><div class="form-grid">${input('initialValue', '기존 목표 진행도 / 남은 자원 (기수령 연동분 제외)', r.initialValue ?? (r.type === 'resource' ? r.capacity : 0), 'number')}${input('initialCount', '남은 퀘스트 수', r.initialCount ?? r.spawnCount, 'number')}</div>` : ''}<p data-rule-error="true" role="status"></p>`;
    const bind = (selector, fn) =>
      host
        .querySelectorAll(selector)
        .forEach(b => b.addEventListener('click', () => edit(() => fn(b))));
    bind('[data-edit-rule]', b => (selected = Number(b.dataset.editRule)));
    bind('[data-add-rule]', b => {
      draft.push(newUniversalRule(b.dataset.addRule));
      selected = draft.length - 1;
    });
    bind('#copyRule', () => {
      draft.push(cloneCatalog([r])[0]);
      selected = draft.length - 1;
    });
    bind('#moveRuleUp', () => {
      if (selected) {
        [draft[selected - 1], draft[selected]] = [draft[selected], draft[selected - 1]];
        selected--;
      }
    });
    bind('#removeRule', () => {
      if (
        draft.some(
          x =>
            x !== r &&
            ((x.links || []).some(l => l.target === r.id) ||
              x.stopAt === r.id ||
              (x.requires || []).includes(r.id))
        )
      )
        throw Error('이 항목을 참조하는 연동과 조건을 먼저 해제하세요.');
      draft.splice(selected, 1);
      selected = 0;
    });
    bind('#addRuleReward', () =>
      r.rewards.push({ id: 'r-' + crypto.randomUUID(), label: '보상', resources: { gold: 50 } })
    );
    bind('[data-remove-reward]', b => {
      const [x] = r.rewards.splice(Number(b.dataset.removeReward), 1);
      r.quests.forEach(q => (q.rewardIds = q.rewardIds.filter(id => id !== x.id)));
    });
    bind('#addRuleQuest', () =>
      r.quests.push({
        id: 'q-' + crypto.randomUUID(),
        label: '퀘스트',
        rewardIds: r.rewards.map(x => x.id)
      })
    );
    bind('[data-remove-quest]', b => r.quests.splice(Number(b.dataset.removeQuest), 1));
    bind('#addStep', () => r.steps.push({ at: (r.steps.at(-1)?.at || 0) + 1, free: {}, paid: {} }));
    bind('[data-remove-step]', b => r.steps.splice(Number(b.dataset.removeStep), 1));
    bind('#addLink', () =>
      r.links.push({ target: others[0]?.[0] || '', event: 'complete', value: 'one' })
    );
    bind('[data-remove-link]', b => r.links.splice(Number(b.dataset.removeLink), 1));
  }
  render();
  return () => {
    capture();
    return structuredClone(validateRuleCatalog(draft));
  };
}
