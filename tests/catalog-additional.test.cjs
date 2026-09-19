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
  assert.equal(app.run("Object.keys(data().ledger).filter(key => key.startsWith('weekly/')).length"), 0);
  assert.equal(app.run("totals('snap').credits || 0"), 0);
});

test('main reset button asks for confirmation and cancellation preserves every game', () => {
  const a = start(); a.run("award('mtga','example',{gold:750});state.activeGame='overview';renderAll()");
  const before = a.run('JSON.stringify(state)');
  a.click('#resetAllGames'); assert.ok(a.document.querySelector('#confirmAllGamesReset'));
  assert.equal(a.run('JSON.stringify(state)'), before);
  a.click('#closeManagerDialog'); assert.equal(a.run('JSON.stringify(state)'), before);
});

test('confirmed all-game reset clears rewards, progress, alerts and backups across restart', () => {
  const a = start(); a.run("for(const [id] of GAMES){award(id,'example',{gold:100});state.games[id].profile.pendingAlerts=['test'];state.games[id].profile.spending.push({amount:100,currency:'KRW'});}localStorage.setItem('deckroom-backup-v1',JSON.stringify(state));localStorage.setItem('deckroom-corrupt-backup','old');state.tray=true;state.activeGame='overview';renderAll()");
  a.click('#resetAllGames'); a.click('#confirmAllGamesReset');
  assert.equal(a.run("GAMES.every(([id])=>JSON.stringify(state.games[id])===JSON.stringify(freshGame()))"), true);
  assert.equal(a.run('state.tray'), true);
  assert.equal(a.run("localStorage.getItem('deckroom-backup-v1')"), null);
  assert.equal(a.run("localStorage.getItem('deckroom-corrupt-backup')"), null);
  assert.equal(a.document.querySelectorAll('.overview-card').length, 0);
  const reopened = start(a.saved());
  assert.equal(reopened.document.querySelectorAll('.overview-card').length, 0);
  assert.equal(reopened.run('Object.values(state.games).some(g=>g.profile.pendingAlerts?.length)'), false);
});

test('all supplied daily and weekly boundaries are KST, including Sunday and Monday', () => {
  const app = start();
  for (const [id, hour] of [['kards', 9], ['mtga', 18], ['snap', 4], ['shadowverse', 5], ['hearthstone', 1], ['master-duel', 3], ['pokemon-pocket', 15]]) {
    const at = `2026-09-14T${String(hour).padStart(2, '0')}:00:00+09:00`;
    app.setTime(new Date(new Date(at).getTime() - 1).toISOString());
    const before = app.run(`dailyPeriod('${id}')`);
    app.advance(1);
    assert.equal(app.run(`dailyPeriod('${id}')`), before + 1, id);
  }
  for (const [id, at] of [['mtga', '2026-09-13T18:00:00+09:00'], ['snap', '2026-09-16T04:00:00+09:00'], ['might-magic', '2026-09-15T01:00:00+09:00'], ['shadowverse', '2026-09-14T05:00:00+09:00'], ['hearthstone', '2026-09-14T01:00:00+09:00'], ['duel-links', '2026-09-14T03:00:00+09:00']]) {
    app.setTime(new Date(new Date(at).getTime() - 1).toISOString());
    const before = app.run(`weeklyPeriod('${id}')`);
    app.advance(1);
    assert.equal(app.run(`weeklyPeriod('${id}')`), before + 7, id);
  }
  assert.ok(Number.isInteger(app.run("dailyPeriod('might-magic')")));
  assert.equal(app.run("dailyPeriod('duel-links')"), null);
  for (const id of ['kards', 'master-duel', 'pokemon-pocket']) assert.equal(app.run(`weeklyPeriod('${id}')`), null);
});

test('main overview exposes nine games, with independent registration and reset', () => { const app = start(); app.run("state.activeGame='overview';renderAll()"); assert.equal(app.document.querySelectorAll('.overview-card').length, 9); app.run("award('mtga','example',{gold:750});save()"); const before = app.run("JSON.stringify(state.games.mtga)"); app.run("resetGame('kards');renderAll()"); assert.equal(app.run("state.games.kards.profile.registeredAt"), null); assert.equal(app.run("JSON.stringify(state.games.mtga)"), before); assert.equal(app.document.querySelectorAll('.overview-card').length, 8); assert.equal(app.document.querySelector('[data-game-name="kards"]'), null); });
test('unregistered games are hidden until created; overview shows an empty state with none registered', () => { const a = start(); a.run("for(const [id] of GAMES)state.games[id].profile.registeredAt=null;state.activeGame='overview';renderAll()"); assert.equal(a.document.querySelectorAll('.overview-card').length, 0); assert.ok(a.document.querySelector('.overview-empty')); assert.equal(a.document.querySelectorAll('#gameSwitcher .game-tab[data-game]').length, 1); assert.ok(a.document.querySelector('#newGameTab')); });

test('Might 01:00 and login04:40 periods change at exact millisecond', () => { const a = start(); for (const [hour, minute] of [[1, 0], [4, 40]]) { const at = `2026-09-11T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`; a.setTime(new Date(Date.parse(at) - 1).toISOString()); const old = a.run(`periodAt(${hour},${minute})`); a.advance(1); assert.equal(a.run(`periodAt(${hour},${minute})`), old + 1); } });

