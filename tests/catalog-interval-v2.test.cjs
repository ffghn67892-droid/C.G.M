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

  // 2026-09-27: these three recover on their own per-player timer starting from whenever
  // last consumed while full, not from a shared clock - Snap's is a genuine shared clock,
  // so `missions` keeps anchorTime and refillOnUse is absent from it.
  for (const r of [pack, power, duelists]) {
    assert.equal(r.refillOnUse, true);
    assert.equal(r.anchorTime, undefined);
  }
  assert.equal(missions.refillOnUse, undefined);
});

// refillOnUse (2026-09-27): "수치가 줄어든 순간 그 시점이 바로 갱신 시점입니다... 회복 간격은
// 고정이며 타이머 스타트만 수치가 줄어든 시점" - one chained timer anchored at the first drop
// from maxHeld, not one independent timer per click.
function seedOnUse(a, overrides = {}) {
  seed(a, [
    {
      id: 'r',
      name: '회복형',
      format: 'interval',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 2,
      intervalMinutes: 60,
      refillOnUse: true,
      ...overrides
    }
  ]);
}
function held(a) {
  return a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held');
}
function anchor(a) {
  return a.run(
    'ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).refillAnchorAt'
  );
}

test('a never-touched refillOnUse rule starts full, not at refillCount', () => {
  const a = start();
  seedOnUse(a);
  assert.equal(held(a), 2);
  assert.equal(anchor(a), null);
});

test('refillOnUse: exact user scenario - 12:00 and 12:05 clicks recover at 13:00 and 14:00, not 13:05', () => {
  const a = start();
  a.setTime('2026-09-10T12:00:00+09:00');
  seedOnUse(a);
  assert.equal(a.run("catalogAction('kards','r','complete')"), true);
  assert.equal(held(a), 1, '2/2 -> 1/2 at 12:00');
  const anchorAt12 = anchor(a);
  a.advance(5 * 60000); // 12:05
  assert.equal(a.run("catalogAction('kards','r','complete')"), true);
  assert.equal(held(a), 0, '1/2 -> 0/2 at 12:05');
  assert.equal(anchor(a), anchorAt12, 'the second click does not restart the chain');
  a.advance(55 * 60000); // 13:00
  a.run('syncGame("kards")');
  assert.equal(held(a), 1, 'one tick pays off the first click at 13:00, not 13:05');
  a.advance(60 * 60000); // 14:00
  a.run('syncGame("kards")');
  assert.equal(held(a), 2, 'the second tick pays off the second click at 14:00');
  assert.equal(anchor(a), null, 'fully recovered - chain stops until it drops again');
});

test('refillOnUse catches up multiple elapsed ticks at once after being closed a while', () => {
  const a = start();
  a.setTime('2026-09-10T12:00:00+09:00');
  seedOnUse(a, { maxHeld: 5, refillCount: 1 });
  a.run("catalogAction('kards','r','complete')");
  a.run("catalogAction('kards','r','complete')");
  a.run("catalogAction('kards','r','complete')");
  assert.equal(held(a), 2);
  a.advance(3.5 * 3600000); // 3 full ticks plus a partial one
  a.run('syncGame("kards")');
  assert.equal(held(a), 5, 'clamped to maxHeld even though 2 + 3 would only reach 5 exactly');
  assert.equal(anchor(a), null);
});

test('refillOnUse: undo right after the depleting click clears the anchor back to null', () => {
  const a = start();
  a.setTime('2026-09-10T12:00:00+09:00');
  seedOnUse(a);
  a.run("catalogAction('kards','r','complete')");
  assert.equal(held(a), 1);
  assert.notEqual(anchor(a), null);
  assert.equal(a.run("catalogAction('kards','r','undo')"), true);
  assert.equal(held(a), 2, 'restored to full');
  assert.equal(anchor(a), null, 'anchor cleared since we are back to full');
});

test('refillOnUse: undoing the second of two quick clicks leaves the still-running anchor untouched', () => {
  const a = start();
  a.setTime('2026-09-10T12:00:00+09:00');
  seedOnUse(a);
  a.run("catalogAction('kards','r','complete')");
  const anchorAfterFirst = anchor(a);
  a.advance(60000);
  a.run("catalogAction('kards','r','complete')");
  assert.equal(held(a), 0);
  assert.equal(a.run("catalogAction('kards','r','undo')"), true);
  assert.equal(held(a), 1, 'only the second click is undone');
  assert.equal(anchor(a), anchorAfterFirst, 'the original chain keeps running, untouched');
});

test('refillOnUse: undo is safely dropped once a tick has fired since the click (periodKey mismatch)', () => {
  const a = start();
  a.setTime('2026-09-10T12:00:00+09:00');
  seedOnUse(a);
  a.run("catalogAction('kards','r','complete')");
  assert.equal(held(a), 1);
  a.advance(60 * 60000); // exactly one interval later - the tick recovers it back to full
  assert.equal(
    a.run("catalogAction('kards','r','undo')"),
    true,
    'undo call succeeds but is a no-op'
  );
  assert.equal(held(a), 2, 'left at the recovered value, not decremented by the stale undo');
});

test('refillOnUse: manual-add reaching maxHeld clears the anchor too', () => {
  const a = start();
  a.setTime('2026-09-10T12:00:00+09:00');
  seedOnUse(a);
  a.run("catalogAction('kards','r','complete')");
  assert.notEqual(anchor(a), null);
  assert.equal(a.run("catalogAction('kards','r','manual-add')"), true);
  assert.equal(held(a), 2);
  assert.equal(anchor(a), null);
});

test('refillOnUse rules skip anchorTime validation but still require kind slot and a valid interval', () => {
  const a = start();
  const base = {
    id: 'r',
    name: '회복형',
    format: 'interval',
    kind: 'slot',
    refillCount: 1,
    maxHeld: 2,
    refillOnUse: true
  };
  assert.doesNotThrow(() =>
    a.run(`validateCatalog(${JSON.stringify([{ ...base, intervalMinutes: 60 }])})`)
  );
  assert.throws(
    () => a.run(`validateCatalog(${JSON.stringify([{ ...base, intervalMinutes: 0 }])})`),
    'still validates intervalMinutes'
  );
  assert.throws(
    () =>
      a.run(
        `validateCatalog(${JSON.stringify([{ ...base, kind: 'gauge', min: 0, max: 10, intervalMinutes: 60 }])})`
      ),
    'refillOnUse is slot-only'
  );
});
