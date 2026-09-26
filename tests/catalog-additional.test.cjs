const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./harness.cjs');

// Consolidated from the pre-catalog-engine test files retired in Stage H4 of the
// AI-friendly reorg (2026-09-19). Only tests that still pass against the current
// engine/UI were kept verbatim; see REGRESSION_TEST_COVERAGE.md for what was
// deliberately not carried forward and why.
//
// Stage L1 (2026-09-19, tracker redesign): 4 tests removed - 2 tested the retired
// reward/schedule schema directly, 1 tested a since-deleted collapsed field (superseded
// by tests/catalog-engine-v2.test.cjs), and 1 ("catalog rejects invalid references...")
// was a false positive that only passed because the function it called
// (updateKardsCatalog) no longer exists - any edit threw a ReferenceError before real
// validation ever ran. See REGRESSION_TEST_COVERAGE.md.

test('스냅 화면 렌더링은 주간 보상을 지급하지 않는다', () => {
  const app = start();
  app.select('snap');
  app.run(`const snap = data();
    snap.weeklyCount = 5;
    snap.weeklyCreditClaims = [];
    snap.ledger = {};
    snap.rewards = { credits: 0, seasonXp: 0 };
    renderAll();`);
  assert.equal(
    app.run("Object.keys(data().ledger).filter(key => key.startsWith('weekly/')).length"),
    0
  );
  assert.equal(app.run("totals('snap').credits || 0"), 0);
});

test('main reset button asks for confirmation and cancellation preserves every game', () => {
  const a = start();
  a.run("award('mtga','example',{gold:750});state.activeGame='overview';renderAll()");
  const before = a.run('JSON.stringify(state)');
  a.click('#resetAllGames');
  assert.ok(a.document.querySelector('#confirmAllGamesReset'));
  assert.equal(a.run('JSON.stringify(state)'), before);
  a.click('#closeManagerDialog');
  assert.equal(a.run('JSON.stringify(state)'), before);
});

test('confirmed all-game reset clears rewards, progress, alerts and backups across restart', () => {
  const a = start();
  a.run(
    "for(const [id] of GAMES){award(id,'example',{gold:100});state.games[id].profile.pendingAlerts=['test'];state.games[id].profile.spending.push({amount:100,currency:'KRW'});}localStorage.setItem('deckroom-backup-v1',JSON.stringify(state));localStorage.setItem('deckroom-corrupt-backup','old');state.tray=true;state.activeGame='overview';renderAll()"
  );
  a.click('#resetAllGames');
  a.click('#confirmAllGamesReset');
  assert.equal(
    a.run('GAMES.every(([id])=>JSON.stringify(state.games[id])===JSON.stringify(freshGame()))'),
    true
  );
  assert.equal(a.run('state.tray'), true);
  assert.equal(a.run("localStorage.getItem('deckroom-backup-v1')"), null);
  assert.equal(a.run("localStorage.getItem('deckroom-corrupt-backup')"), null);
  assert.equal(a.document.querySelectorAll('.overview-card').length, 0);
  const reopened = start(a.saved());
  assert.equal(reopened.document.querySelectorAll('.overview-card').length, 0);
  assert.equal(
    reopened.run('Object.values(state.games).some(g=>g.profile.pendingAlerts?.length)'),
    false
  );
});

test('all supplied daily and weekly boundaries are KST, including Sunday and Monday', () => {
  const app = start();
  for (const [id, hour] of [
    ['kards', 9],
    ['mtga', 18],
    ['snap', 4],
    ['shadowverse', 5],
    ['hearthstone', 1],
    ['master-duel', 3],
    ['pokemon-pocket', 15]
  ]) {
    const at = `2026-09-14T${String(hour).padStart(2, '0')}:00:00+09:00`;
    app.setTime(new Date(new Date(at).getTime() - 1).toISOString());
    const before = app.run(`dailyPeriod('${id}')`);
    app.advance(1);
    assert.equal(app.run(`dailyPeriod('${id}')`), before + 1, id);
  }
  for (const [id, at] of [
    ['mtga', '2026-09-13T18:00:00+09:00'],
    ['snap', '2026-09-16T04:00:00+09:00'],
    ['might-magic', '2026-09-15T01:00:00+09:00'],
    ['shadowverse', '2026-09-14T05:00:00+09:00'],
    ['hearthstone', '2026-09-14T01:00:00+09:00'],
    ['duel-links', '2026-09-14T03:00:00+09:00']
  ]) {
    app.setTime(new Date(new Date(at).getTime() - 1).toISOString());
    const before = app.run(`weeklyPeriod('${id}')`);
    app.advance(1);
    assert.equal(app.run(`weeklyPeriod('${id}')`), before + 7, id);
  }
  assert.ok(Number.isInteger(app.run("dailyPeriod('might-magic')")));
  assert.equal(app.run("dailyPeriod('duel-links')"), null);
  for (const id of ['kards', 'master-duel', 'pokemon-pocket'])
    assert.equal(app.run(`weeklyPeriod('${id}')`), null);
});

test('main overview exposes nine games, with independent registration and reset', () => {
  const app = start();
  app.run("state.activeGame='overview';renderAll()");
  assert.equal(app.document.querySelectorAll('.overview-card').length, 9);
  app.run("award('mtga','example',{gold:750});save()");
  const before = app.run('JSON.stringify(state.games.mtga)');
  app.run("resetGame('kards');renderAll()");
  assert.equal(app.run('state.games.kards.profile.registeredAt'), null);
  assert.equal(app.run('JSON.stringify(state.games.mtga)'), before);
  assert.equal(app.document.querySelectorAll('.overview-card').length, 8);
  assert.equal(app.document.querySelector('[data-game-name="kards"]'), null);
});
test('unregistered games are hidden until created; overview shows an empty state with none registered', () => {
  const a = start();
  a.run(
    "for(const [id] of GAMES)state.games[id].profile.registeredAt=null;state.activeGame='overview';renderAll()"
  );
  assert.equal(a.document.querySelectorAll('.overview-card').length, 0);
  assert.ok(a.document.querySelector('.overview-empty'));
  assert.equal(a.document.querySelectorAll('#gameSwitcher .game-tab[data-game]').length, 1);
  assert.ok(a.document.querySelector('#newGameTab'));
});

// 'overview' ("메인") also carries data-game and must never take part in drag reordering.
function sidebarGameIds(app) {
  return app.document
    .querySelectorAll('#gameSwitcher .game-tab[data-game]')
    .map(el => el.getAttribute('data-game'))
    .filter(id => id !== 'overview');
}
test('sidebar tabs render in GAMES order until the user drags one', () => {
  const a = start();
  a.run("state.activeGame='overview';renderAll()");
  assert.deepEqual(sidebarGameIds(a), JSON.parse(a.run('JSON.stringify(GAMES.map(([id]) => id))')));
});
test('moveGameOrder reorders the sidebar and persists across a reload', () => {
  const a = start();
  a.run("moveGameOrder('snap','kards');state.activeGame='overview';renderAll()");
  const ids = sidebarGameIds(a);
  assert.equal(ids.indexOf('snap'), ids.indexOf('kards') - 1);
  const reloaded = start(a.saved());
  reloaded.run("state.activeGame='overview';renderAll()");
  assert.deepEqual(sidebarGameIds(reloaded), ids);
});
test('moveGameOrder with a null target moves the game to the end', () => {
  const a = start();
  a.run("moveGameOrder('kards',null);state.activeGame='overview';renderAll()");
  assert.equal(sidebarGameIds(a).at(-1), 'kards');
});
test('a game absent from a partial gameOrder keeps its natural GAMES position', () => {
  const a = start();
  a.run("state.gameOrder=['snap'];state.activeGame='overview';renderAll()");
  const ids = sidebarGameIds(a);
  assert.equal(ids[0], 'snap');
  assert.deepEqual(
    ids.slice(1),
    JSON.parse(a.run("JSON.stringify(GAMES.map(([id]) => id).filter(id => id !== 'snap'))"))
  );
});

// todaySchedule/realtimeRefreshList (game-config.js), 2026-09-27: 메인 화면 "오늘의 시간표" +
// "실시간 갱신 목록". Pure aggregators, tested directly rather than through the DOM.
function setRules(a, gameId, rules, resetSchedule = { dailyTime: '09:00', weeklyDay: 0 }) {
  a.run(`
    state.games['${gameId}'].resetSchedule = ${JSON.stringify(resetSchedule)};
    state.games['${gameId}'].ruleCatalog = validateCatalog(${JSON.stringify(rules)});
    state.games['${gameId}'].ruleProgress = {};
  `);
}
function setHeld(a, gameId, ruleId, held) {
  a.run(
    `(ruleProgress(state.games['${gameId}'], catalogRules(state.games['${gameId}']).find(r => r.id === '${ruleId}')).held = ${held})`
  );
}
function schedule(a) {
  return JSON.parse(a.run('JSON.stringify(todaySchedule())'));
}
function realtime(a) {
  return JSON.parse(a.run('JSON.stringify(realtimeRefreshList())'));
}

test('todaySchedule groups multiple games/rules that reset at the exact same instant', () => {
  const a = start();
  a.setTime('2026-09-27T00:00:00+09:00');
  setRules(a, 'kards', [
    { id: 'd', name: '일일 퀘스트', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }
  ]);
  setRules(a, 'mtga', [
    { id: 'd', name: '데일리', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }
  ]);
  setHeld(a, 'kards', 'd', 1);
  setHeld(a, 'mtga', 'd', 1);
  const sched = schedule(a);
  assert.equal(sched.length, 1, 'both reset at 09:00 - one bucket, not two');
  const names = sched[0].games.map(x => x.name).sort();
  assert.deepEqual(names, ['KARDS', '매직 더 게더링 아레나']);
  assert.deepEqual(sched[0].games.find(x => x.name === 'KARDS').items, ['일일 퀘스트']);
});

test('todaySchedule drops a rule once cleared (held 0) and a game once its alarm is muted', () => {
  const a = start();
  a.setTime('2026-09-27T00:00:00+09:00');
  setRules(a, 'kards', [
    { id: 'd', name: '일일 퀘스트', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }
  ]);
  setHeld(a, 'kards', 'd', 0);
  assert.equal(schedule(a).length, 0, 'cleared - nothing left to show');
  setHeld(a, 'kards', 'd', 1);
  assert.equal(schedule(a).length, 1, 'has remaining work again');
  a.run('state.games.kards.profile.mutedUntil = Date.now() + 3600000');
  assert.equal(schedule(a).length, 0, "muted for today - hidden even though it's not cleared");
});

test('todaySchedule only includes a weekly rule on its actual weekday', () => {
  const a = start();
  a.setTime('2026-09-27T00:00:00+09:00'); // a Sunday (weekday 0)
  setRules(
    a,
    'kards',
    [{ id: 'w', name: '주간 상자', format: 'weekly', kind: 'slot', refillCount: 1, maxHeld: 1 }],
    { dailyTime: '09:00', weeklyDay: 3 }
  );
  setHeld(a, 'kards', 'w', 1);
  assert.equal(schedule(a).length, 0, "today (Sunday) isn't the rule's Wednesday");
  a.run('state.games.kards.resetSchedule.weeklyDay = 0');
  assert.equal(schedule(a).length, 1, 'today matches now');
});

test('a coarse fixed-anchor interval rule (Snap-like) stays in the fixed schedule at each occurrence', () => {
  const a = start();
  a.setTime('2026-09-27T00:00:00+09:00');
  setRules(a, 'snap', [
    {
      id: 'm',
      name: '일반 임무',
      format: 'interval',
      kind: 'slot',
      refillCount: 2,
      maxHeld: 6,
      anchorTime: '04:00',
      intervalMinutes: 480
    }
  ]);
  setHeld(a, 'snap', 'm', 2);
  const sched = schedule(a);
  assert.equal(sched.length, 3, '04:00/12:00/20:00 - three occurrences today');
  assert.equal(realtime(a).length, 0);
});

test('a fast fixed-anchor interval rule goes to the realtime list, not the fixed schedule', () => {
  const a = start();
  a.setTime('2026-09-27T00:00:00+09:00');
  setRules(a, 'duel-links', [
    {
      id: 'd',
      name: '일반 듀얼리스트',
      format: 'interval',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 10,
      anchorTime: '00:00',
      intervalMinutes: 30
    }
  ]);
  setHeld(a, 'duel-links', 'd', 5);
  assert.equal(
    schedule(a).length,
    0,
    'under FIXED_SCHEDULE_MIN_MINUTES - excluded from the fixed schedule'
  );
  const rt = realtime(a);
  assert.equal(rt.length, 1);
  assert.equal(rt[0].ruleName, '일반 듀얼리스트');
});

test('refillOnUse always goes to the realtime list, even with a long interval', () => {
  const a = start();
  a.setTime('2026-09-27T00:00:00+09:00');
  setRules(a, 'pokemon-pocket', [
    {
      id: 'p',
      name: '무료 팩',
      format: 'interval',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 2,
      intervalMinutes: 720,
      refillOnUse: true
    }
  ]);
  // fresh refillOnUse rule starts full (see catalog-engine.js) - deplete it once so it has
  // an anchor and remaining work.
  a.run("catalogAction('pokemon-pocket','p','complete')");
  assert.equal(
    schedule(a).length,
    0,
    'no shared anchor exists for refillOnUse rules regardless of interval length'
  );
  const rt = realtime(a);
  assert.equal(rt.length, 1);
  assert.equal(rt[0].ruleName, '무료 팩');
});

test('realtimeRefreshList excludes a slot rule that is already back at maxHeld', () => {
  const a = start();
  a.setTime('2026-09-27T00:00:00+09:00');
  setRules(a, 'duel-links', [
    {
      id: 'd',
      name: '일반 듀얼리스트',
      format: 'interval',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 10,
      anchorTime: '00:00',
      intervalMinutes: 30
    }
  ]);
  setHeld(a, 'duel-links', 'd', 10);
  assert.equal(realtime(a).length, 0, 'already full - nothing to count down to');
});

test('Might 01:00 and login04:40 periods change at exact millisecond', () => {
  const a = start();
  for (const [hour, minute] of [
    [1, 0],
    [4, 40]
  ]) {
    const at = `2026-09-11T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
    a.setTime(new Date(Date.parse(at) - 1).toISOString());
    const old = a.run(`periodAt(${hour},${minute})`);
    a.advance(1);
    assert.equal(a.run(`periodAt(${hour},${minute})`), old + 1);
  }
});
