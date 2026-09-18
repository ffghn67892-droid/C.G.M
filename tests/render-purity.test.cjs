const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./harness.cjs');

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
