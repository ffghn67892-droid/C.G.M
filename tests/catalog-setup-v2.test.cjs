const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function start() {
  const c = vm.createContext({
    structuredClone,
    crypto: webcrypto,
    Date,
    state: { games: {}, customGames: [], activeGame: 'home' },
    GAMES: [],
    CATALOG_PRESETS: [],
    freshGame: () => ({ profile: {} }),
    isCustomGame: id => c.state.customGames.some(x => x[0] === id),
    validateRuleCatalog: rules => assert.ok(Array.isArray(rules)),
    syncUniversalCatalog: () => {},
    save: () => {},
    renderAll: () => {},
    escapeHtml: x =>
      String(x).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  });
  vm.runInContext(fs.readFileSync(require.resolve('../setup.js'), 'utf8'), c);
  const nodes = {};
  c.$ = key => nodes[key] || null;
  c.openDialog = (title, body) => {
    for (const key of Object.keys(nodes)) delete nodes[key];
    for (const match of body.matchAll(/<(input|select|button|p|div)[^>]*id="([^"]+)"[^>]*>/g)) {
      const tag = match[0];
      const el = {
        value: /value="([^"]*)"/.exec(tag)?.[1] || '',
        hidden: /\bhidden\b/.test(tag),
        textContent: '',
        handlers: {},
        addEventListener(type, fn) {
          this.handlers[type] = fn;
        }
      };
      if (match[1] === 'select') {
        const opts = body.slice(match.index + tag.length).split('</select>')[0];
        el.value =
          /<option value="([^"]+)" selected/.exec(opts)?.[1] ||
          /value="([^"]+)"/.exec(opts)?.[1] ||
          '';
      }
      nodes['#' + match[2]] = el;
    }
  };
  c.closeDialog = () => {};
  return {
    c,
    nodes,
    click: id => nodes['#' + id].handlers.click(),
    run: code => vm.runInContext(code, c)
  };
}
test('new setup saves reset defaults and optional pass metadata after sequential input', () => {
  const a = start();
  a.run('openCustomSetup()');
  a.nodes['#customGameName'].value = '테스트 게임';
  a.click('customSetupNext');
  a.nodes['#gameResetTime'].value = '18:30';
  a.nodes['#gameResetWeekday'].value = '0';
  a.click('customSetupNext');
  a.nodes['#gamePassActive'].value = 'yes';
  a.nodes['#gamePassActive'].handlers.change();
  assert.equal(a.nodes['#gamePassDates'].hidden, false);
  a.nodes['#gamePassPurchaseDate'].value = '2026-09-19';
  a.nodes['#gamePassEndDate'].value = '2026-10-19';
  a.click('createCustomGame');
  const g = a.c.state.games[a.c.state.activeGame];
  assert.equal(g.resetSchedule.dailyTime, '18:30');
  assert.equal(g.resetSchedule.weeklyDay, 0);
  assert.equal(g.pass.endDate, '2026-10-19');
  assert.equal(g.pass.level, 0);
  assert.equal(g.ruleCatalog.length, 0);
  assert.equal(g.catalogVersion, 2);
});
test('setup validates before save, retains drafts on back, and permits pass/date skipping', () => {
  const a = start();
  a.run('openCustomSetup()');
  a.click('customSetupNext');
  assert.ok(a.nodes['#customGameError'].textContent);
  a.nodes['#customGameName'].value = '예시';
  a.click('customSetupNext');
  a.nodes['#gameResetTime'].value = '25:00';
  a.click('customSetupNext');
  assert.ok(a.nodes['#customGameError'].textContent);
  a.nodes['#gameResetTime'].value = '04:30';
  a.click('customSetupNext');
  a.nodes['#gamePassActive'].value = 'yes';
  a.nodes['#gamePassPurchaseDate'].value = '2026-09-20';
  a.nodes['#gamePassEndDate'].value = '2026-09-01';
  a.click('createCustomGame');
  assert.equal(Object.keys(a.c.state.games).length, 0);
  assert.ok(a.nodes['#customGameError'].textContent);
  a.click('customSetupBack');
  assert.equal(a.nodes['#gameResetTime'].value, '04:30');
  a.click('customSetupNext');
  assert.equal(a.nodes['#gamePassPurchaseDate'].value, '2026-09-20');
  a.click('skipGamePass');
  assert.equal(a.c.state.games[a.c.state.activeGame].pass, null);
  const b = start();
  const id = b.run("createCustomGame('날짜 생략', [], null, {pass:{active:true}})");
  assert.equal(b.c.state.games[id].pass.purchaseDate, '');
  assert.equal(b.c.state.games[id].pass.active, true);
});
test('failed game save restores state and game navigation', () => {
  const a = start();
  a.c.save = () => {
    throw Error('저장 실패');
  };
  assert.throws(() => a.run("createCustomGame('실패', [])"), /저장 실패/);
  assert.equal(Object.keys(a.c.state.games).length, 0);
  assert.equal(a.c.GAMES.length, 0);
  assert.equal(a.c.state.activeGame, 'home');
});

test('failed existing custom setup preserves a shared navigation entry, then retries successfully', () => {
  const a = start();
  const entry = ['game-existing', '원래 이름', '◇', 'lime'];
  a.c.state.customGames.push(entry);
  a.c.GAMES.push(entry);
  a.c.state.games['game-existing'] = { profile: {}, ruleCatalog: [] };
  const before = structuredClone(a.c.state);
  a.c.save = () => {
    assert.equal(a.c.GAMES[0][1], '원래 이름');
    throw Error('저장 실패');
  };
  assert.throws(() => a.run("createCustomGame('새 이름', [], 'game-existing')"), /저장 실패/);
  assert.deepEqual(a.c.state, before);
  assert.equal(a.c.GAMES[0][1], '원래 이름');
  a.c.save = () => {};
  a.run("createCustomGame('새 이름', [], 'game-existing')");
  assert.equal(a.c.GAMES[0][1], '새 이름');
  assert.equal(a.c.state.customGames[0][1], '새 이름');
});
