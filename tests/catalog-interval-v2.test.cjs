const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./harness.cjs');

// Stage D (2026-09-22): format:'interval' (매 N시간마다 갱신), requested directly by the user
// so Pokemon Pocket's "무료 팩"/"챌린지 파워", Duel Links' "일반 듀얼리스트" and Snap's real
// 3x/day mission refresh can be modeled exactly instead of approximated or excluded. The
// interval length is intervalMinutes (not hours) specifically so a 30-minute recharge like
// Duel Links' duelists is an exact integer, not a fraction of an hour. See catalog-presets.js's
// header comment and catalog-engine.js's intervalPeriodAt/rulePeriod.

function seed(a, rules, resetSchedule = { dailyTime: '09:00', weeklyDay: 3 }) {
  a.run(`
    const g = state.games.kards;
    g.resetSchedule = ${JSON.stringify(resetSchedule)};
    g.ruleCatalog = validateCatalog(${JSON.stringify(rules)});
    state.activeGame = 'kards';
    renderAll();
  `);
}

test('interval format rejects malformed anchor/interval and accepts well-formed values', () => {
  const a = start();
  const rule = (anchorTime, intervalMinutes) => [
    {
      id: 'i',
      name: '간격',
      format: 'interval',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 2,
      anchorTime,
      intervalMinutes
    }
  ];
  assert.throws(() => a.run(`validateCatalog(${JSON.stringify(rule('04:00', 0))})`));
  assert.throws(() => a.run(`validateCatalog(${JSON.stringify(rule('25:00', 480))})`));
  assert.throws(() => a.run(`validateCatalog(${JSON.stringify(rule('04:00', 10081))})`));
  assert.doesNotThrow(() => a.run(`validateCatalog(${JSON.stringify(rule('04:00', 480))})`));
  assert.doesNotThrow(
    () => a.run(`validateCatalog(${JSON.stringify(rule('00:00', 30))})`),
    'a 30-minute interval (e.g. Duel Links duelists) is valid'
  );
});

test('interval slot refills refillCount every intervalMinutes, clamped to maxHeld', () => {
  const a = start();
  a.setTime('2026-09-10T04:00:00+09:00');
  seed(a, [
    {
      id: 'm',
      name: '임무',
      format: 'interval',
      kind: 'slot',
      refillCount: 2,
      maxHeld: 6,
      anchorTime: '04:00',
      intervalMinutes: 480
    }
  ]);
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    2,
    'fresh grant equals refillCount'
  );
  assert.equal(a.run("catalogAction('kards','m','complete')"), true);
  assert.equal(a.run("catalogAction('kards','m','complete')"), true);
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    0
  );
  a.advance(8 * 3600000); // exactly one interval later (04:00 -> 12:00)
  a.run('syncGame("kards")');
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    2
  );
  a.advance(24 * 3600000); // three more intervals' worth (12:00 -> next day 12:00)
  a.run('syncGame("kards")');
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    6,
    'clamped to maxHeld even though 2 + 3*refillCount(2) would exceed it'
  );
});

test('a 30-minute interval slot (Duel Links duelists) refills on exact half-hour boundaries', () => {
  const a = start();
  a.setTime('2026-09-10T00:00:00+09:00');
  seed(a, [
    {
      id: 'd',
      name: '듀얼리스트',
      format: 'interval',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 10,
      anchorTime: '00:00',
      intervalMinutes: 30
    }
  ]);
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    1,
    'fresh grant equals refillCount'
  );
  assert.equal(a.run("catalogAction('kards','d','complete')"), true);
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    0
  );
  a.advance(29 * 60000);
  a.run('syncGame("kards")');
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    0,
    'one minute short of the boundary: no refill yet'
  );
  a.advance(60000); // now exactly 30 minutes since the anchor
  a.run('syncGame("kards")');
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    1
  );
  a.advance(5 * 30 * 60000); // five more half-hour boundaries
  a.run('syncGame("kards")');
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    6,
    '1 + 5 refills, still well under the 10 cap'
  );
});

test('interval rules render readable schedule text in hours, minutes, or both', () => {
  const a = start();
  seed(a, [
    {
      id: 'm',
      name: '임무',
      format: 'interval',
      kind: 'slot',
      refillCount: 2,
      maxHeld: 6,
      anchorTime: '04:00',
      intervalMinutes: 480
    },
    {
      id: 'd',
      name: '듀얼리스트',
      format: 'interval',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 10,
      anchorTime: '00:00',
      intervalMinutes: 30
    },
    {
      id: 'x',
      name: '혼합',
      format: 'interval',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 4,
      anchorTime: '00:00',
      intervalMinutes: 90
    }
  ]);
  assert.equal(
    a.run('ruleScheduleText(state.games.kards, catalogRules(state.games.kards)[0])'),
    '04:00 기준 매 8시간마다 KST'
  );
  assert.equal(
    a.run('ruleScheduleText(state.games.kards, catalogRules(state.games.kards)[1])'),
    '00:00 기준 매 30분마다 KST'
  );
  assert.equal(
    a.run('ruleScheduleText(state.games.kards, catalogRules(state.games.kards)[2])'),
    '00:00 기준 매 1시간 30분마다 KST'
  );
});

test("revision bumps when an interval rule's anchorTime or intervalMinutes changes, not on unrelated edits", () => {
  const a = start();
  const rule = (name, anchorTime) => [
    {
      id: 'm',
      name,
      format: 'interval',
      kind: 'slot',
      refillCount: 2,
      maxHeld: 6,
      anchorTime,
      intervalMinutes: 480
    }
  ];
  seed(a, rule('임무', '04:00'));
  a.run(`updateCatalog('kards', ${JSON.stringify(rule('임무', '04:00'))})`);
  assert.equal(a.run('catalogRules(state.games.kards)[0].revision'), 1);
  a.run(`updateCatalog('kards', ${JSON.stringify(rule('임무2', '04:00'))})`);
  assert.equal(
    a.run('catalogRules(state.games.kards)[0].revision'),
    1,
    'name-only change does not bump revision'
  );
  a.run(`updateCatalog('kards', ${JSON.stringify(rule('임무2', '12:00'))})`);
  assert.equal(
    a.run('catalogRules(state.games.kards)[0].revision'),
    2,
    'anchorTime change bumps revision'
  );
});

test("updateResetSchedule never touches an interval-format rule's revision", () => {
  const a = start();
  seed(a, [
    {
      id: 'm',
      name: '임무',
      format: 'interval',
      kind: 'slot',
      refillCount: 2,
      maxHeld: 6,
      anchorTime: '04:00',
      intervalMinutes: 480
    }
  ]);
  a.run("updateResetSchedule('kards', { dailyTime: '10:00', weeklyDay: 5 })");
  assert.equal(a.run('(catalogRules(state.games.kards)[0].revision ?? 1)'), 1);
});

test('Snap, Pokemon Pocket and Duel Links presets use interval format for real sub-daily/rolling caps', () => {
  const a = start();
  const snap = JSON.parse(a.run("JSON.stringify(presetTrackerRules('snap'))"));
  const missions = snap.find(r => r.id === 'missions');
  assert.equal(missions.format, 'interval');
  assert.equal(missions.anchorTime, '04:00');
  assert.equal(missions.intervalMinutes, 480);
  assert.equal(missions.refillCount, 2);
  assert.equal(missions.maxHeld, 6);

  const pocket = JSON.parse(a.run("JSON.stringify(presetTrackerRules('pokemon-pocket'))"));
  const pack = pocket.find(r => r.id === 'free-pack'),
    power = pocket.find(r => r.id === 'challenge-power');
  assert.deepEqual([pack.format, pack.intervalMinutes, pack.maxHeld], ['interval', 720, 2]);
  assert.deepEqual([power.format, power.intervalMinutes, power.maxHeld], ['interval', 720, 5]);

  const duelLinks = JSON.parse(a.run("JSON.stringify(presetTrackerRules('duel-links'))"));
  const duelists = duelLinks.find(r => r.id === 'duelists');
  assert.deepEqual(
    [duelists.format, duelists.intervalMinutes, duelists.refillCount, duelists.maxHeld],
    ['interval', 30, 1, 10]
  );
});
