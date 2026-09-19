const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./harness.cjs');

// Stage L1 (2026-09-19, tracker redesign): every other test in this file asserted the
// retired reward/quest/goal/resource/pass/counter schema (presets, chest tiers, links,
// initialReceived, totals()) or the old single-arg rulePeriod/schedule.kind shape and no
// longer applies - see TODO_TRACKER_REDESIGN.md and REGRESSION_TEST_COVERAGE.md. These
// two are generic scheduler infrastructure, unrelated to rule schema, and still pass.

test("regression: changed reset boundary rebuilds deadline once", () => {
  const a = start();
  a.run('globalThis.rebuilds=0;const originalDeadline=rebuildRefreshDeadline;rebuildRefreshDeadline=function(...args){rebuilds++;return originalDeadline(...args)}');
  a.nextDay();
  a.run('synchronizeScheduledGames()');
  assert.equal(a.run('rebuilds'), 1);
});

test('F: due refresh waits for an open editor and resumes after close or clock rollback', () => {
  const a = start();
  a.select('mtga');
  a.run("openCatalogEditor('mtga')");
  const content = a.document.querySelector('#questList').innerHTML;
  a.nextDay();
  a.run('refreshAllGames()');
  assert.equal(a.document.querySelector('#questList').innerHTML, content);
  assert.equal(a.run('refreshViewPending'), true);
  a.run('closeDialog();refreshAllGames()');
  assert.equal(a.run('refreshViewPending'), false);
  a.setTime('2026-09-10T20:00:00+09:00');
  a.run('refreshAllGames()');
  assert.ok(a.run('nextRefreshAt>Date.now()'));
});
