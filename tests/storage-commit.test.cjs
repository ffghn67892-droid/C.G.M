const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./harness.cjs');

test('KARDS 보상 저장 실패는 진행도와 원장을 되돌리고 재시도할 수 있다', () => {
  const app = start();
  const savedBefore = app.saved();
  app.run(`globalThis.originalWrite = localStorage.setItem;
    localStorage.setItem = (key, value) => {
      if (key === 'deckroom-quests') throw Error('TEST_WRITE_FAILURE');
      return originalWrite(key, value);
    };`);

  app.click('[data-kards-complete="50"]');

  assert.equal(app.run('data().kards.missions[0].done'), false);
  assert.equal(app.run("totals('kards').gold || 0"), 0);
  assert.equal(app.saved(), savedBefore);

  app.run('localStorage.setItem = originalWrite');
  app.click('[data-kards-complete="50"]');

  assert.equal(app.run('data().kards.missions[0].done'), true);
  assert.equal(app.run("totals('kards').gold || 0"), 50);
  assert.notEqual(app.saved(), savedBefore);
  assert.equal(app.run("award('kards', 'quest/' + data().kards.missions[0].id, { gold: 50 })"), false);
  assert.equal(app.run("totals('kards').gold || 0"), 50);
});
