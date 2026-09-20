const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./harness.cjs');

// Stage A (2026-09-20, PROJECT_DEVELOPMENT_PLAN.md §7): rule revision/periodKey-gated
// undo, ended-rule action gating, updateResetSchedule's revision judgment, the KARDS
// resetOverride fix, serializeStateForExport, and the legacy catalog-v1 conversion
// pipeline. See CLAUDE_GPT_DEVELOPMENT_DISCUSSION.md §6-8 for the agreed contract.

function seed(a, rules, resetSchedule = { dailyTime: '09:00', weeklyDay: 3 }) {
  a.run(`
    const g = state.games.kards;
    g.resetSchedule = ${JSON.stringify(resetSchedule)};
    g.ruleCatalog = validateCatalog(${JSON.stringify(rules)});
    state.activeGame = 'kards';
    renderAll();
  `);
}

test("revision increases only when a rule's value-relevant fields actually change", () => {
  const a = start();
  seed(a, [{ id: 's', name: '슬롯', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }]);
  a.run(
    "updateCatalog('kards', [{ id: 's', name: '슬롯', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }])"
  );
  assert.equal(a.run("catalogRules(state.games.kards).find(r=>r.id==='s').revision"), 1);
  a.run(
    "updateCatalog('kards', [{ id: 's', name: '새 이름', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }])"
  );
  assert.equal(
    a.run("catalogRules(state.games.kards).find(r=>r.id==='s').revision"),
    1,
    'name-only change does not bump revision'
  );
  a.run(
    "updateCatalog('kards', [{ id: 's', name: '새 이름', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 5 }])"
  );
  assert.equal(
    a.run("catalogRules(state.games.kards).find(r=>r.id==='s').revision"),
    2,
    'maxHeld change bumps revision'
  );
});

test('undo does not reapply a completion from a period that has already reset', () => {
  const a = start();
  seed(a, [{ id: 's', name: '슬롯', format: 'daily', kind: 'slot', refillCount: 3, maxHeld: 3 }]);
  assert.equal(a.run("catalogAction('kards','s','complete')"), true);
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    2
  );
  a.nextDay(1);
  assert.equal(a.run("catalogAction('kards','s','undo')"), true, 'pops the stale entry');
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    3,
    "yesterday's completion is not reapplied on top of today's fresh refill"
  );
});

test('undo does not reapply a completion made under a since-changed rule revision', () => {
  const a = start();
  seed(a, [{ id: 's', name: '슬롯', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }]);
  assert.equal(a.run("catalogAction('kards','s','complete')"), true);
  a.run(
    "updateCatalog('kards', [{ id: 's', name: '슬롯', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 5 }])"
  );
  const heldAfterEdit = a.run(
    'ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'
  );
  assert.equal(a.run("catalogAction('kards','s','undo')"), true);
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    heldAfterEdit,
    'a stale-revision entry is dropped, not applied'
  );
});

test("manual-add/remove invalidate that rule's own undo history but leave other rules alone", () => {
  const a = start();
  seed(a, [
    { id: 'a', name: 'A', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 },
    { id: 'b', name: 'B', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }
  ]);
  assert.equal(a.run("catalogAction('kards','a','complete')"), true);
  assert.equal(a.run("catalogAction('kards','b','complete')"), true);
  assert.equal(a.run("catalogAction('kards','a','manual-add')"), true);
  assert.equal(a.run('state.games.kards.actionHistory.length'), 1);
  assert.equal(a.run('state.games.kards.actionHistory[0].ruleId'), 'b');
});

test('a fixed-period rule that has ended can no longer be completed or undone', () => {
  const a = start();
  seed(a, [
    {
      id: 'evt',
      name: '이벤트',
      format: 'fixed',
      kind: 'slot',
      refillCount: 1,
      maxHeld: 3,
      startDate: '2026-09-01',
      endDate: '2026-09-11',
      endTime: '00:00'
    }
  ]);
  // Fixed-format slots have no auto-reset to grant supply from (PROJECT_DEVELOPMENT_PLAN.md
  // §3.5: "지정 기간 슬롯은 자동 리셋이 없으므로 기존 수동 추가 경로를 사용한다") - manually
  // add the one item this event grants before completing it.
  assert.equal(a.run("catalogAction('kards','evt','manual-add')"), true);
  assert.equal(a.run("catalogAction('kards','evt','complete')"), true);
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    0
  );
  a.setTime('2026-09-12T00:00:00+09:00');
  a.run('syncGame("kards")');
  assert.equal(a.run("catalogAction('kards','evt','complete')"), false, 'blocked once ended');
  assert.equal(a.run("catalogAction('kards','evt','undo')"), true, 'pops the entry');
  assert.equal(
    a.run('ruleProgress(state.games.kards, catalogRules(state.games.kards)[0]).held'),
    0,
    'undo does not revive a completion on an ended rule'
  );
});

test('updateResetSchedule bumps revision only for rules whose effective schedule actually changed', () => {
  const a = start();
  seed(
    a,
    [
      { id: 'd', name: '일일', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 },
      { id: 'w', name: '주간', format: 'weekly', kind: 'slot', refillCount: 1, maxHeld: 3 },
      {
        id: 'o',
        name: '개별지정',
        format: 'daily',
        kind: 'slot',
        refillCount: 1,
        maxHeld: 3,
        resetOverride: { time: '20:00' }
      }
    ],
    { dailyTime: '09:00', weeklyDay: 3 }
  );
  a.run("updateResetSchedule('kards', { dailyTime: '09:00', weeklyDay: 5 })"); // weekday-only
  assert.equal(a.run("(catalogRules(state.games.kards).find(r=>r.id==='d').revision ?? 1)"), 1);
  assert.equal(a.run("(catalogRules(state.games.kards).find(r=>r.id==='w').revision ?? 1)"), 2);
  assert.equal(a.run("(catalogRules(state.games.kards).find(r=>r.id==='o').revision ?? 1)"), 1);
  a.run("updateResetSchedule('kards', { dailyTime: '10:00', weeklyDay: 5 })"); // time-only
  assert.equal(a.run("(catalogRules(state.games.kards).find(r=>r.id==='d').revision ?? 1)"), 2);
  assert.equal(a.run("(catalogRules(state.games.kards).find(r=>r.id==='w').revision ?? 1)"), 3);
  a.run("updateResetSchedule('kards', { dailyTime: '10:00', weeklyDay: 5 })"); // resave, unchanged
  assert.equal(a.run("(catalogRules(state.games.kards).find(r=>r.id==='d').revision ?? 1)"), 2);
  assert.equal(a.run("(catalogRules(state.games.kards).find(r=>r.id==='w').revision ?? 1)"), 3);
});

test('updateResetSchedule rejects malformed input before touching state', () => {
  const a = start();
  seed(a, [{ id: 'w', name: '주간', format: 'weekly', kind: 'slot', refillCount: 1, maxHeld: 3 }]);
  assert.throws(() => a.run("updateResetSchedule('kards', { dailyTime: '25:00', weeklyDay: 3 })"));
  assert.throws(() => a.run("updateResetSchedule('kards', { dailyTime: '09:00', weeklyDay: 9 })"));
});

test('updateResetSchedule leaves the previous schedule and revisions in place when the save fails', () => {
  const a = start();
  seed(a, [{ id: 'w', name: '주간', format: 'weekly', kind: 'slot', refillCount: 1, maxHeld: 3 }], {
    dailyTime: '09:00',
    weeklyDay: 3
  });
  a.run("save = () => { throw Error('저장 실패'); }");
  assert.throws(
    () => a.run("updateResetSchedule('kards', { dailyTime: '10:00', weeklyDay: 5 })"),
    /저장 실패/
  );
  assert.equal(
    a.run('JSON.stringify(state.games.kards.resetSchedule)'),
    JSON.stringify({ dailyTime: '09:00', weeklyDay: 3 })
  );
  assert.equal(a.run('(catalogRules(state.games.kards)[0].revision ?? 1)'), 1);
});

test('serializeStateForExport round-trips the full games object', () => {
  const a = start();
  seed(a, [{ id: 's', name: '슬롯', format: 'daily', kind: 'slot', refillCount: 1, maxHeld: 3 }]);
  a.run("catalogAction('kards','s','complete')");
  const exported = JSON.parse(a.run('JSON.stringify(serializeStateForExport())'));
  assert.equal(exported.schemaVersion, 2);
  assert.ok(exported.exportedAt);
  assert.deepEqual(
    exported.games.kards.ruleCatalog,
    JSON.parse(a.run('JSON.stringify(catalogRules(state.games.kards))'))
  );
  assert.equal(exported.games.kards.ruleProgress.s.held, 0);
});

test('KARDS weekly chest preset overrides to Wednesday 09:00 regardless of the game default', () => {
  const a = start();
  const rules = JSON.parse(a.run("JSON.stringify(presetTrackerRules('kards'))"));
  const chest = rules.find(r => r.id === 'chest');
  assert.deepEqual(chest.resetOverride, { weekday: 3, time: '09:00' });
});

test('legacy catalog-v1 rules convert mappable structure and flag the rest, preserving the original', () => {
  const a = start();
  a.run(`
    const g = state.games.kards;
    g.catalogVersion = 1;
    g.ruleCatalog = [
      { id: 'q', type: 'quest', label: '일일 퀘스트', schedule: { kind: 'daily', time: '09:00' }, spawnCount: 1, capacity: 3, rewards: [] },
      { id: 'g1', type: 'goal', label: '주간 목표', schedule: { kind: 'weekly', time: '09:00', weekday: 3 }, target: 15, rewards: [] },
      { id: 'r1', type: 'resource', label: '충전 자원', schedule: { kind: 'daily', time: '09:00' }, spawnCount: 1, capacity: 10, rewards: [] },
      { id: 'm1', type: 'quest', label: '월간 퀘스트', schedule: { kind: 'monthly', time: '09:00' }, spawnCount: 1, capacity: 3, rewards: [] }
    ];
    convertLegacyCatalog(g);
  `);
  const rules = JSON.parse(a.run('JSON.stringify(catalogRules(state.games.kards))'));
  assert.equal(rules.length, 2);
  const q = rules.find(r => r.id === 'q');
  assert.equal(q.kind, 'slot');
  assert.equal(q.format, 'daily');
  assert.equal(q.refillCount, 1);
  assert.equal(q.maxHeld, 3);
  const g1 = rules.find(r => r.id === 'g1');
  assert.equal(g1.kind, 'gauge');
  assert.equal(g1.min, 0);
  assert.equal(g1.max, 15);
  assert.equal(a.run('state.games.kards.catalogVersion'), 2);
  assert.equal(a.run('state.games.kards.legacyCatalogBackup.length'), 4);
  const notices = a.run('state.games.kards.profile.conversionNotice');
  assert.equal(notices.length, 3);
  assert.ok(notices.some(n => n.includes('충전 자원')));
  assert.ok(notices.some(n => n.includes('월간 퀘스트')));
});

test('legacy conversion is idempotent - a second call never re-converts or re-grants supply', () => {
  const a = start();
  a.run(`
    const g = state.games.kards;
    g.catalogVersion = 1;
    g.ruleCatalog = [{ id: 'q', type: 'quest', label: 'Q', schedule: { kind: 'daily', time: '09:00' }, spawnCount: 1, capacity: 3, rewards: [] }];
    convertLegacyCatalog(g);
  `);
  const after1 = a.run('JSON.stringify(catalogRules(state.games.kards))');
  a.run('convertLegacyCatalog(state.games.kards)');
  const after2 = a.run('JSON.stringify(catalogRules(state.games.kards))');
  assert.equal(after1, after2);
});

test('a registered pre-catalog game keeps its old fields untouched and starts with an empty, flagged tracker', () => {
  const a = start();
  a.run(`
    const g = state.games.kards;
    delete g.catalogVersion;
    delete g.ruleCatalog;
    g.generalMissions = ['old-mission'];
    convertLegacyCatalog(g);
  `);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(state.games.kards.generalMissions)')), [
    'old-mission'
  ]);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(catalogRules(state.games.kards))')), []);
  assert.equal(a.run('state.games.kards.catalogVersion'), 2);
  assert.equal(a.run('state.games.kards.profile.conversionNotice').length, 1);
});

test('a never-registered built-in game is converted quietly with no notice', () => {
  const a = start();
  a.run(`
    const g = state.games.mtga;
    g.profile.registeredAt = null;
    delete g.catalogVersion;
    delete g.profile.conversionNotice;
    g.generalMissions = ['untouched'];
    convertLegacyCatalog(g);
  `);
  assert.equal(a.run('state.games.mtga.profile.conversionNotice'), undefined);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(state.games.mtga.generalMissions)')), [
    'untouched'
  ]);
  assert.equal(a.run('state.games.mtga.catalogVersion'), 2);
});

test("changing the KARDS preset never retroactively touches an already-created game's stored schedule", () => {
  const a = start();
  a.run(`
    const g = state.games.kards;
    g.catalogVersion = 2;
    g.resetSchedule = { dailyTime: '09:00', weeklyDay: 0 };
    g.ruleCatalog = [{ id: 'chest', name: '주간 보상 상자', format: 'weekly', kind: 'slot', refillCount: 1, maxHeld: 1 }];
  `);
  a.run('convertLegacyCatalog(state.games.kards)'); // no-op: catalogVersion already 2
  assert.equal(a.run('state.games.kards.resetSchedule.weeklyDay'), 0);
  assert.equal(
    a.run("catalogRules(state.games.kards).find(r=>r.id==='chest').resetOverride"),
    undefined
  );
});
