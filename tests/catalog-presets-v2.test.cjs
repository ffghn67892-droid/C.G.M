const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./harness.cjs');

// Stage L3 (2026-09-20): structural-only presets reintroduced for the 9 built-in games,
// mined from the old fixed tabs' schedules and slot/gauge-shaped counts (no reward
// content - see catalog-presets.js's header comment for exactly what could and couldn't
// carry over from the old per-game reward system).

test('every preset produces a valid rule catalog with a sensible reset schedule', () => {
  const a = start();
  for (const id of [
    'kards',
    'mtga',
    'hearthstone',
    'might-magic',
    'shadowverse',
    'master-duel',
    'duel-links',
    'snap',
    'pokemon-pocket'
  ]) {
    const rules = a.run(`JSON.stringify(presetTrackerRules('${id}'))`);
    assert.doesNotThrow(() => a.run(`validateCatalog(${rules})`), id);
    assert.ok(JSON.parse(rules).length > 0, `${id} has at least one preset rule`);
    const reset = JSON.parse(a.run(`JSON.stringify(presetTrackerReset('${id}'))`));
    assert.ok(/^([01]\d|2[0-3]):[0-5]\d$/.test(reset.time), `${id} reset time`);
    assert.ok(
      Number.isInteger(reset.weekday) && reset.weekday >= 0 && reset.weekday <= 6,
      `${id} weekday`
    );
  }
});

test('MTGA preset matches the design doc example: daily slot 1/3 plus daily/weekly 0-15 gauges, reset 18:00 Sunday', () => {
  const a = start();
  const reset = JSON.parse(a.run("JSON.stringify(presetTrackerReset('mtga'))"));
  assert.deepEqual(reset, { time: '18:00', weekday: 0 });
  const rules = JSON.parse(a.run("JSON.stringify(presetTrackerRules('mtga'))"));
  assert.deepEqual(
    rules.map(r => [r.format, r.kind]),
    [
      ['daily', 'slot'],
      ['daily', 'gauge'],
      ['weekly', 'gauge']
    ]
  );
  assert.equal(rules[0].maxHeld, 3);
  assert.equal(rules[1].max, 15);
  assert.equal(rules[2].max, 15);
});

test('creating a game from the mtga preset reuses the built-in id and seeds the real rules', () => {
  const a = start();
  a.run('resetGame("mtga")'); // harness.start() pre-registers all 9 built-ins; undo that here
  a.run(
    "createCustomGame('매직 더 게더링 아레나', presetTrackerRules('mtga'), 'mtga', { reset: presetTrackerReset('mtga'), pass: null })"
  );
  assert.equal(a.run('state.games.mtga.resetSchedule.dailyTime'), '18:00');
  assert.equal(a.run('state.games.mtga.resetSchedule.weeklyDay'), 0);
  assert.equal(a.run('catalogRules(state.games.mtga).length'), 3);
  assert.equal(a.run("catalogAction('mtga','daily','complete')"), true);
});

test('a preset id that is already registered cannot be reused', () => {
  const a = start();
  a.run('resetGame("kards")');
  a.run(
    "createCustomGame('KARDS', presetTrackerRules('kards'), 'kards', { reset: presetTrackerReset('kards'), pass: null })"
  );
  assert.throws(() =>
    a.run(
      "createCustomGame('KARDS 2', presetTrackerRules('kards'), 'kards', { reset: presetTrackerReset('kards'), pass: null })"
    )
  );
});

test('setup wizard step 1 offers presets for unregistered built-in games only', () => {
  const a = start();
  a.run('for (const [id] of GAMES) resetGame(id);'); // harness.start() pre-registers all 9
  a.run('state.games.mtga.profile.registeredAt = new Date().toISOString();');
  a.run('openCustomSetup()');
  const values = a.document
    .querySelectorAll('#customGamePreset option')
    .map(node => node.getAttribute('value'));
  assert.ok(values.includes('kards'), 'kards is offered');
  assert.ok(values.includes(''), 'empty/blank preset is still offered');
  assert.ok(!values.includes('mtga'), 'already-registered mtga is not offered');
});

test('picking a preset carries through to the created game after the full wizard flow', () => {
  const a = start();
  a.run('resetGame("mtga")');
  a.run('openCustomSetup()');
  a.document.querySelector('#customGameName').value = '매직 더 게더링 아레나';
  a.document.querySelector('#customGamePreset').value = 'mtga';
  a.click('#customSetupNext');
  a.click('#customSetupNext');
  a.click('#skipGamePass');
  assert.equal(a.run('catalogRules(state.games.mtga).length'), 3);
  assert.equal(a.run('state.games.mtga.resetSchedule.dailyTime'), '18:00');
});
