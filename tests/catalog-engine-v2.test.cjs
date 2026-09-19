const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./harness.cjs');

// Track 1 (engine/data) tests for the "할 일 추적기" redesign. See TODO_TRACKER_REDESIGN.md
// for the full design and §10 for the exact contract Track 2's catalog-view.js consumes.
// These exercise catalog-engine.js through the real render pipeline (not mocked), since
// Track 2's already-written UI is part of what must keep working against this contract.

function seed(a, rules, resetSchedule = { dailyTime: '09:00', weeklyDay: 3 }) {
  a.run(`
    const g = state.games.kards;
    g.resetSchedule = ${JSON.stringify(resetSchedule)};
    g.ruleCatalog = validateCatalog(${JSON.stringify(rules)});
    state.activeGame = 'kards';
    renderAll();
  `);
}

test('slot rule refills by refillCount on sync, clamped to maxHeld, and complete decrements', () => {
  const a = start();
  seed(a, [{ id: 'daily', name: '일일 퀘스트', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }]);
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held"), 1);
  a.setTime('2026-09-11T10:00:00+09:00'); // exactly one 09:00 boundary past the seeded state
  a.run('syncGame("kards")');
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held"), 2);
  assert.equal(a.run("catalogAction('kards','daily','complete')"), true);
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held"), 1);
});

test('slot manual add/remove and auto-refill never exceed maxHeld', () => {
  const a = start();
  seed(a, [{ id: 's', name: '슬롯', format: 'daily', kind: 'slot', refillCount: 2, maxHeld: 2 }]);
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held"), 2);
  assert.equal(a.run("catalogAction('kards','s','manual-add')"), false);
  assert.equal(a.run("catalogAction('kards','s','complete')"), true);
  assert.equal(a.run("catalogAction('kards','s','manual-add')"), true);
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held"), 2);
  assert.equal(a.run("catalogAction('kards','s','manual-add')"), false);
});

test('gauge clamps to max, tracks milestones as sticky, and disappears only at true max (not personal target)', () => {
  const a = start();
  seed(a, [{ id: 'win', name: '승리', format: 'daily', kind: 'gauge', min: 0, max: 3, milestones: [2] }]);
  for (let i = 0; i < 5; i++) a.run("catalogAction('kards','win','increment')");
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).value"), 3, 'clamped to max');
  assert.deepEqual(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).achievedMilestones"), [2]);
  assert.equal(a.run("catalogAction('kards','win','set-fold-target',{value:1})"), true);
  assert.equal(a.run("universalStatus(state.games.kards).count"), 0, 'true max reached: not counted as remaining even though foldTarget is lower');
});

test('undo reverses exactly the last action, in order, and is a no-op when history is empty', () => {
  const a = start();
  seed(a, [
    { id: 's', name: '슬롯', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 5 },
    { id: 'g', name: '게이지', format: 'daily', kind: 'gauge', min: 0, max: 10, milestones: [] }
  ]);
  a.run("catalogAction('kards','s','complete')");
  a.run("catalogAction('kards','g','increment')");
  a.run("catalogAction('kards','g','increment')");
  assert.equal(a.run("catalogAction('kards','g','undo')"), true);
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[1]).value"), 1);
  assert.equal(a.run("catalogAction('kards','g','undo')"), true);
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[1]).value"), 0);
  assert.equal(a.run("catalogAction('kards','s','undo')"), true);
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held"), 1);
  assert.equal(a.run("catalogAction('kards','s','undo')"), false, 'history exhausted');
});

test('fixed-period rule marks ended after its endDate and can only be deleted once ended', () => {
  const a = start();
  seed(a, [
    { id: 'evt', name: '이벤트', format: 'fixed', kind: 'slot', refillCount: 1, maxHeld: 1, startDate: '2026-09-01', endDate: '2026-09-11' }
  ]);
  assert.equal(a.run("catalogAction('kards','evt','delete-rule')"), false, 'not ended yet');
  a.setTime('2026-09-12T00:00:00+09:00');
  a.run('syncGame("kards")');
  assert.equal(a.run("ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).ended"), true);
  assert.equal(a.run("catalogAction('kards','evt','delete-rule')"), true);
  assert.equal(a.run('catalogRules(state.games.kards).length'), 0);
});

test('fixed-period rule with a future startDate blocks actions until it starts', () => {
  const a = start();
  seed(a, [
    { id: 'evt', name: '이벤트', format: 'fixed', kind: 'slot', refillCount: 1, maxHeld: 1, startDate: '2099-01-01', endDate: '2099-02-01' }
  ]);
  assert.equal(a.run("catalogAction('kards','evt','complete')"), false);
});

test('universalStatus counts only true remaining work and flags urgent when a slot is at capacity', () => {
  const a = start();
  seed(a, [
    { id: 's1', name: 'A', format: 'daily', kind: 'slot', refillCount: 3, maxHeld: 3 },
    { id: 's2', name: 'B', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 5 }
  ]);
  const status = a.run('JSON.stringify(universalStatus(state.games.kards))');
  assert.deepEqual(JSON.parse(status), { color: 'urgent', label: '!', count: 2 });
  a.run("catalogAction('kards','s1','complete');catalogAction('kards','s1','complete');catalogAction('kards','s1','complete')");
  a.run("catalogAction('kards','s2','complete')");
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(universalStatus(state.games.kards))')), {
    color: 'done',
    label: '✓',
    count: 0
  });
});

test('validateCatalog rejects malformed rules and accepts the KARDS/MTGA example shapes', () => {
  const a = start();
  for (const bad of [
    [{ id: 'x', name: 'x', format: 'daily', kind: 'slot', refillCount: 5, maxHeld: 3 }],
    [{ id: 'x', name: '', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }],
    [{ id: 'x', name: 'x', format: 'daily', kind: 'gauge', min: 5, max: 5 }],
    [{ id: 'x', name: 'x', format: 'fixed', kind: 'slot', refillCount: 1, maxHeld: 1, startDate: '2026-09-11', endDate: '2026-09-01' }]
  ])
    assert.throws(() => a.run(`validateCatalog(${JSON.stringify(bad)})`));
  assert.doesNotThrow(() =>
    a.run(
      `validateCatalog(${JSON.stringify([
        { id: 'daily', name: '일일 퀘스트', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 },
        { id: 'free', name: '일일 무료 카드', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 1 },
        { id: 'chest', name: '주간 보상 상자', format: 'weekly', kind: 'slot', refillCount: 1, maxHeld: 1 },
        { id: 'win', name: '일일 승리 보너스', format: 'daily', kind: 'gauge', min: 0, max: 15, milestones: [4, 10] }
      ])})`
    )
  );
});
