const test = require('node:test');
const assert = require('node:assert/strict');
const {start,styles} = require('./harness.cjs');

test('MTGA completion chooses either reward, retains rows and blocks duplicate rewards', () => {
  const app = start(); app.select('mtga');
  assert.equal(app.rows().length, 3);
  assert.equal(app.document.querySelectorAll('.queued-row .check').length, 0);
  app.click('.queued-check');
  assert.equal(app.document.querySelector('#dailyRewardModal').hidden, false);
  app.click('#dailyRewardCancel');
  assert.equal(app.run('data().mtga.dailyQueue.missions.filter(m => m.done).length'), 0);
  for (const gold of [500, 750]) {
    app.click('.queued-check:not(:disabled)'); app.click(`[data-daily-gold="${gold}"]`);
  }
  assert.equal(app.rows().length, 3);
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 2);
  assert.equal(app.run('data().mtga.rewardTotals.gold'), 1250);
  app.click('.queued-check:disabled');
  app.click('[data-daily-gold="750"]');
  assert.equal(app.run('data().mtga.rewardTotals.gold'), 1250);
  const reopened = start(app.saved());
  assert.equal(reopened.document.querySelectorAll('.queued-row.done').length, 2);
  assert.match(reopened.document.querySelector('#questList').textContent, /750 GOLD/);
  reopened.nextDay(); reopened.run('refreshActiveQuests()');
  assert.equal(reopened.rows().length, 2); // One unfinished plus one new.
  assert.equal(reopened.document.querySelectorAll('.queued-row.done').length, 0);
  assert.equal(reopened.run('data().mtga.rewardTotals.gold'), 1250);
});

test('MTGA keeps daily quests, daily win rewards and weekly wins in one top row', () => {
  const app = start(); app.select('mtga');
  assert.equal(app.document.querySelectorAll('.mtga-top-grid .mtga-card').length, 3);
  assert.equal(app.document.querySelectorAll('.mtga-daily-card').length, 1);
  assert.equal(app.document.querySelectorAll('.mtga-daily-win-card').length, 1);
  assert.equal(app.document.querySelectorAll('.reward-table').length, 0);
  assert.equal(app.document.querySelectorAll('.mtga-daily-win-card .mtga-reward-list').length, 1);
  assert.equal(app.document.querySelectorAll('.mtga-daily-win-card .win-add').length, 1);
  assert.equal(app.document.querySelectorAll('.mission-refresh').length, 0);
  assert.match(app.document.querySelector('.mtga-daily-card').textContent, /일일 퀘스트/);
  assert.doesNotMatch(app.document.querySelector('.mtga-daily-card').textContent, /일일 퀘스트가 갱신되었습니다/);
  assert.equal(app.document.querySelector('#questSummary').hidden, false);
  assert.match(app.document.querySelector('#questSummary').textContent, /누적 획득 골드/);
  assert.match(app.document.querySelectorAll('.mtga-top-grid .mtga-card')[2].textContent, /누적 0 XP/);
  assert.match(styles, /\.mtga-daily-card \{ grid-column: auto; \}/);
  assert.match(styles, /\.mtga-top-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  assert.match(styles, /\.mtga-daily-card > \.queued-daily \{ display: flex; flex-direction: column; height: 100%;/);
  assert.doesNotMatch(app.document.querySelector('.mtga-daily-card').textContent, /최대 3개|500 또는 750/);
  assert.doesNotMatch(app.document.querySelector('.mtga-daily-win-card').textContent, /이전 · 현재 · 다음/);
  assert.doesNotMatch(app.document.querySelectorAll('.mtga-top-grid .mtga-card')[2].textContent, /최대 15승/);
  assert.match(app.document.querySelector('.guide-card').textContent, /500골드 일일 퀘스트는 교체 권장/);
});

test('MTGA daily win bonus always shows three rewards and only lights completed wins', () => {
  const app = start(); app.select('mtga');
  const displayedWins = () => app.document.querySelectorAll('.mtga-daily-win-card .mtga-reward-row span').map((node) => node.textContent);
  const claimedWins = () => app.document.querySelectorAll('.mtga-daily-win-card .mtga-reward-row.claimed span').map((node) => node.textContent);
  assert.deepEqual(displayedWins(), ['1승', '2승', '3승']);
  assert.deepEqual(claimedWins(), []);
  app.click('.win-add');
  assert.equal(app.run('data().mtga.rewardTotals.gold'), 250);
  assert.match(app.document.querySelector('#questSummary').textContent, /250 GOLD/);
  assert.match(app.document.querySelector('.mtga-weekly-xp').textContent, /누적 275 XP/);
  assert.deepEqual(displayedWins(), ['1승', '2승', '3승']);
  assert.deepEqual(claimedWins(), ['1승']);
  app.click('.win-add');
  assert.deepEqual(displayedWins(), ['1승', '2승', '3승']);
  assert.deepEqual(claimedWins(), ['1승', '2승']);
  app.click('.win-add');
  assert.deepEqual(displayedWins(), ['2승', '3승', '4승']);
  assert.deepEqual(claimedWins(), ['2승', '3승']);
});

test('all three completions remain today and become only one new quest tomorrow', () => {
  const app = start(); app.select('mtga');
  for (let i = 0; i < 3; i += 1) { app.click('.queued-check:not(:disabled)'); app.click('[data-daily-gold="500"]'); }
  app.run('refreshActiveQuests()');
  assert.equal(app.rows().length, 3);
  assert.equal(app.document.querySelectorAll('.queued-check:disabled').length, 3);
  app.nextDay(); app.run('refreshActiveQuests()');
  assert.equal(app.rows().length, 1);
  app.nextDay(5); app.run('refreshActiveQuests()');
  assert.equal(app.rows().length, 3);
  assert.equal(app.run('new Set(data().mtga.dailyQueue.missions.map(m => m.id)).size'), 3);
});

test('midnight during reward selection cancels stale completion', () => {
  const app = start(); app.select('mtga'); app.click('.queued-check');
  app.nextDay(); app.click('[data-daily-gold="750"]');
  assert.equal(app.run('data().mtga.rewardTotals.gold'), 0);
  assert.equal(app.document.querySelector('#dailyRewardModal').hidden, true);
  assert.equal(app.rows().length, 3);
});

test('retained rows expire at Hearthstone KST 01:00, including after an offline restart', () => {
  const app = start(); app.select('hearthstone'); app.click('.queued-check');
  app.setTime('2026-09-11T00:59:00+09:00');
  app.advance(59999); app.run('refreshActiveQuests()');
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 1);
  app.advance(1); app.run('refreshActiveQuests()');
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 0);
  assert.equal(app.rows().length, 1);
  const offline = JSON.parse(app.saved());
  offline.games.hearthstone.dailyQueue.resetPeriod -= 4;
  offline.games.hearthstone.dailyQueue.missions[0].done = true;
  const restarted = start(JSON.stringify(offline));
  assert.equal(restarted.rows().length, 3);
  assert.equal(restarted.document.querySelectorAll('.queued-row.done').length, 0);
});

test('legacy MTGA storage keeps reward and wins when unifying the daily UI', () => {
  const initial = start(); initial.select('mtga');
  const stored = JSON.parse(initial.saved());
  const old = stored.games.mtga.mtga;
  old.dailyQuest = false; old.questReward = 750; old.dailyWins = 4; old.weeklyWins = 9;
  delete old.rewardTotals; delete old.dailyQueue.unifiedDailyView;
  delete old.dailyQueue.completed;
  const restored = start(JSON.stringify(stored));
  assert.equal(restored.rows().length, 3);
  assert.equal(restored.document.querySelectorAll('.queued-row.done').length, 1);
  assert.equal(restored.run('data().mtga.dailyWins'), 4);
  assert.equal(restored.run('data().mtga.weeklyWins'), 9);
  assert.match(restored.document.querySelector('.queued-row.done').textContent, /750 GOLD/);
});

for (const id of ['hearthstone']) test(`${id}: completion persists and clears at rollover`, () => {
  const app = start(); app.select(id);
  assert.equal(app.rows().length, 1);
  app.click('.queued-check');
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 1);
  app.select('kards'); app.select(id);
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 1);
  app.nextDay(); app.run('refreshActiveQuests()');
  assert.equal(app.rows().length, 1);
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 0);
});

test('KARDS retains completed reward and preserves the two-quest pass exception', () => {
  const app = start();
  assert.equal(app.document.querySelectorAll('.kards-free-card').length, 1);
  app.click('.kards-free-card');
  assert.equal(app.run('data().kards.rewardTotals.cards'), 1);
  app.click('[data-kards-complete="60"]');
  assert.equal(app.document.querySelectorAll('.kards-row.done').length, 1);
  assert.equal(app.run('data().kards.rewardTotals.gold'), 60);
  assert.equal(app.run("completeDailyQuest(data().kards, data().kards.missions[0].id, 50)"), false);
  assert.equal(app.run('data().kards.rewardTotals.gold'), 60);
  app.run('data().kards.passActive = true; data().profile.pass.active = true; renderKards()');
  assert.equal(app.document.querySelectorAll('.kards-free-card').length, 2);
  app.click('.kards-free-card:not(:disabled)');
  assert.equal(app.run('data().kards.rewardTotals.cards'), 2);
  app.nextDay(); app.run('refreshActiveQuests()');
  assert.equal(app.document.querySelectorAll('.kards-row').length, 2);
  assert.equal(app.document.querySelectorAll('.kards-row.done').length, 0);
  assert.equal(app.document.querySelectorAll('.kards-free-card:not(:disabled)').length, 2);
});

test('other game types keep their controls and all nine screens render', () => {
  const app = start();
  for (const id of app.run('GAMES.map(g => g[0])')) app.select(id);
  app.select('shadowverse');
  assert.equal(app.rows().length, 3);
  assert.equal(app.document.querySelectorAll('.queued-row .daily-complete').length, 3);
  app.click('.queued-check:not(:disabled)'); app.click('[data-shadowverse-reward="basic"]'); assert.equal(app.rows().length, 3);
  app.select('pokemon-pocket');
  assert.equal(app.document.querySelectorAll('.pokemon-daily-check').length, 7);
  assert.doesNotMatch(app.document.querySelector('#questList').textContent, /↻/);
});

test('Master Duel draws three distinct daily quests and pays 40 gems per completion', () => {
  const app = start(); app.setTime('2026-09-11T02:59:59+09:00'); app.select('master-duel');
  assert.equal(app.rows().length, 3);
  assert.equal(app.document.querySelectorAll('.master-duel-quest-select').length, 3);
  assert.equal(app.document.querySelectorAll('.segment').length, 0);
  assert.equal(app.run('new Set(data().masterDuel.dailyQueue.missions.map(m => m.label)).size'), 3);
  assert.equal(app.document.querySelectorAll('.quest-reward').length, 3);
  assert.match(app.document.querySelector('#questList').textContent, /40 젬/);
  app.click('.queued-check');
  assert.equal(app.run('data().masterDuel.rewardTotals.gems'), 40);
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 1);
  app.advance(1000); app.run('refreshActiveQuests()');
  assert.equal(app.rows().length, 5);
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 0);
  assert.equal(app.run('data().masterDuel.rewardTotals.gems'), 40);
  assert.match(app.document.querySelector('.master-duel-tip').textContent, /클리어하기 어려운 미션은 남겨두고/);
  app.nextDay(2); app.run('refreshActiveQuests()');
  assert.equal(app.rows().length, 9);
  assert.equal(app.run('new Set(data().masterDuel.dailyQueue.missions.map(m => m.label)).size'), 9);
  app.nextDay(5); app.run('refreshActiveQuests()');
  assert.equal(app.rows().length, 9);
});

test('Duel Links replenishes standard duelists and awards fixed weekly missions', () => {
  const app = start(); app.select('duel-links');
  assert.match(app.document.querySelector('.duel-links-duelists').textContent, /10/);
  app.click('.duel-links-start');
  assert.match(app.document.querySelector('.duel-links-duelists').textContent, /0/);
  app.advance(30 * 60 * 1000); app.run('refreshActiveQuests()');
  assert.match(app.document.querySelector('.duel-links-duelists').textContent, /1/);
  app.advance(270 * 60 * 1000); app.run('refreshActiveQuests()');
  assert.match(app.document.querySelector('.duel-links-duelists').textContent, /10/);
  assert.equal(app.document.querySelectorAll('.duel-links-weekly-row').length, 7);
  for (let index = 1; index < 7; index += 1) app.click(`[data-weekly-index="${index}"]`);
  app.click('[data-weekly-index="0"]');
  assert.equal(app.run('data().duelLinks.rewardTotals.gems'), 30);
  assert.equal(app.run('data().duelLinks.rewardTotals.rJewels'), 10);
  assert.equal(app.run('data().duelLinks.rewardTotals.blueGateKeys'), 0);
  assert.equal(app.run('data().duelLinks.rewardTotals.gold'), 5000);
  assert.equal(app.run('data().duelLinks.weeklyDone.length'), 7);
  app.setTime('2026-09-14T02:59:59+09:00'); app.run('refreshActiveQuests()');
  app.advance(1000); app.run('refreshActiveQuests()');
  assert.equal(app.run('data().duelLinks.weeklyDone.length'), 0);
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

test('MTGA 18:00 removes completed quests, resets daily wins, and Sunday resets weekly wins only once', () => {
  const app = start(); app.setTime('2026-09-13T17:59:59+09:00'); app.select('mtga');
  app.click('.win-add'); app.click('.queued-check'); app.click('[data-daily-gold="750"]');
  assert.equal(app.run('data().mtga.dailyWins'), 1);
  app.advance(999); app.run('refreshActiveQuests()');
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 1);
  app.advance(1); app.run('refreshActiveQuests()');
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 0);
  assert.equal(app.run('data().mtga.dailyWins'), 0);
  assert.equal(app.run('data().mtga.weeklyWins'), 0);
  assert.equal(app.run('data().mtga.rewardTotals.gold'), 1000);
  app.click('.win-add'); app.run('refreshActiveQuests()');
  assert.equal(app.run('data().mtga.weeklyWins'), 1);
  app.nextDay(); app.run('refreshActiveQuests()');
  assert.equal(app.run('data().mtga.dailyWins'), 0);
  assert.equal(app.run('data().mtga.weeklyWins'), 1);
});

test('Pokemon daily missions clear at 15:00 and Shadowverse gets three at 05:00', () => {
  const app = start(); app.setTime('2026-09-11T14:59:59+09:00'); app.select('pokemon-pocket');
  app.click('.pokemon-daily-check'); app.advance(1000); app.run('refreshActiveQuests()');
  assert.equal(app.run('data().pokemonPocket.dailyDone.length'), 0);
  app.setTime('2026-09-12T04:59:59+09:00'); app.select('shadowverse');
  for (let i = 0; i < 3; i++) { app.click('.queued-check:not(:disabled)'); app.click('[data-shadowverse-reward="basic"]'); }
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 3);
  app.advance(1000); app.run('refreshActiveQuests()');
  assert.equal(app.rows().length, 3);
});

test('Pokemon Pocket recovers pack and challenge resources and pays daily rewards after three missions', () => {
  const app = start(); app.select('pokemon-pocket');
  assert.equal(app.run('data().pokemonPocket.freePacks'), 2);
  assert.equal(app.run('data().pokemonPocket.getChallengePoints'), 5);
  app.click('[data-pocket-action="pack"]'); app.click('[data-pocket-action="pack"]');
  assert.equal(app.run('data().pokemonPocket.freePacks'), 0);
  assert.equal(app.run('data().pokemonPocket.rewardTotals.freePackOpens'), 2);
  app.advance(12 * 60 * 60 * 1000); app.run('refreshActiveQuests()');
  assert.equal(app.run('data().pokemonPocket.freePacks'), 1);
  app.click('[data-pocket-action="challenge"]');
  assert.equal(app.run('data().pokemonPocket.getChallengePoints'), 4);
  app.advance(12 * 60 * 60 * 1000); app.run('refreshActiveQuests()');
  assert.equal(app.run('data().pokemonPocket.getChallengePoints'), 5);
  for (let index = 0; index < 3; index += 1) app.click(`[data-pokemon-index="${index}"]`);
  assert.equal(app.run('data().pokemonPocket.rewardTotals.challengeHourglasses'), 2);
  assert.equal(app.run('data().pokemonPocket.rewardTotals.packHourglasses'), 3);
  assert.equal(app.run('data().pokemonPocket.dailyRewardClaimed'), true);
});

test('legacy time migration preserves completed queues and win totals until the next new boundary', () => {
  const initial = start(); initial.select('mtga'); initial.click('.win-add');
  initial.click('.queued-check'); initial.click('[data-daily-gold="500"]');
  const stored = JSON.parse(initial.saved()); const mtga = stored.games.mtga.mtga;
  delete mtga.dailyWinPeriod; delete mtga.weeklyWinPeriod;
  delete mtga.dailyQueue.resetPeriod; delete mtga.dailyQueue.resetSchedule;
  mtga.dailyQueue.date = '2026-9-10';
  const app = start(JSON.stringify(stored));
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 1);
  assert.equal(app.run('data().mtga.dailyWins'), 1);
  app.setTime('2026-09-11T17:59:59+09:00'); app.run('refreshActiveQuests()');
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 1);
  app.advance(1000); app.run('refreshActiveQuests()');
  assert.equal(app.document.querySelectorAll('.queued-row.done').length, 0);
  assert.equal(app.run('data().mtga.dailyWins'), 0);
});

test('Shadowverse records each of the four reward pairs and preserves totals on reload', () => {
  for (const [tier, rupies, redEther] of [['basic', 70, 50], ['intermediate', 100, 70], ['advanced', 150, 80], ['highest', 200, 100]]) {
    const app = start(); app.select('shadowverse'); app.click('.queued-check');
    assert.equal(app.document.querySelector('#shadowverseRewardModal').hidden, false);
    assert.equal(app.document.querySelectorAll('[data-shadowverse-reward]').length, 4);
    app.click(`[data-shadowverse-reward="${tier}"]`);
    assert.equal(app.rows().length, 3);
    assert.equal(app.run('data().shadowverse.rewardTotals.rupies'), rupies);
    assert.equal(app.run('data().shadowverse.rewardTotals.redEther'), redEther);
    assert.equal(app.run('data().shadowverse.lastReward.id'), tier);
    app.click(`[data-shadowverse-reward="${tier}"]`);
    assert.equal(app.run('data().shadowverse.rewardTotals.rupies'), rupies);
    const reopened = start(app.saved());
    assert.equal(reopened.rows().length, 3);
    assert.match(reopened.document.querySelector('.shadowverse-reward-summary').textContent, new RegExp(`${rupies} 루피`));
    reopened.nextDay(); reopened.run('refreshActiveQuests()');
    assert.equal(reopened.rows().length, 3);
    assert.equal(reopened.run('data().shadowverse.rewardTotals.redEther'), redEther);
  }
});

test('Shadowverse cancel leaves quest untouched, rewards add together, and stale 05:00 selection is rejected', () => {
  const app = start(); app.select('shadowverse');
  app.click('.queued-check'); app.click('#shadowverseRewardCancel');
  assert.equal(app.rows().length, 3);
  assert.equal(app.run('data().shadowverse.rewardTotals.rupies'), 0);
  for (const tier of ['basic', 'highest']) { app.click('.queued-check:not(:disabled)'); app.click(`[data-shadowverse-reward="${tier}"]`); }
  assert.equal(app.run('data().shadowverse.rewardTotals.rupies'), 270);
  assert.equal(app.run('data().shadowverse.rewardTotals.redEther'), 150);
  app.setTime('2026-09-11T04:59:59+09:00'); app.click('.queued-check:not(:disabled)');
  app.advance(1000); app.click('[data-shadowverse-reward="advanced"]');
  assert.equal(app.rows().length, 3);
  assert.equal(app.run('data().shadowverse.rewardTotals.rupies'), 270);
  assert.equal(app.document.querySelector('#shadowverseRewardModal').hidden, true);
});

test('park dailies award only one key each, persist and refresh at KST 05:00', () => {
  const app = start(); app.select('shadowverse');
  assert.equal(app.document.querySelectorAll('.park-daily-row').length, 2);
  app.click('[data-park-daily="enter"]'); app.click('[data-park-daily="table"]');
  app.click('[data-park-daily="enter"]');
  assert.equal(app.run('data().shadowverse.rewardTotals.keys'), 2);
  assert.equal(app.run('data().shadowverse.park.points'), 0);
  assert.equal(app.run('data().shadowverse.park.weeklyDone.length'), 0);
  const reopened = start(app.saved());
  assert.equal(reopened.document.querySelectorAll('.park-daily-row.done').length, 2);
  reopened.setTime('2026-09-11T04:59:59.999+09:00'); reopened.run('refreshActiveQuests()');
  assert.equal(reopened.document.querySelectorAll('.park-daily-row.done').length, 2);
  reopened.advance(1); reopened.run('refreshActiveQuests()');
  assert.equal(reopened.document.querySelectorAll('.park-daily-row.done').length, 0);
  reopened.click('[data-park-daily="enter"]');
  assert.equal(reopened.run('data().shadowverse.rewardTotals.keys'), 3);
  assert.equal(reopened.run('data().shadowverse.park.points'), 0);
});

test('park weekly thresholds pay once, cap at 100 and clear all remaining weekly quests', () => {
  const app = start(); app.select('shadowverse');
  app.click('[data-park-weekly="battle-five"]'); // 40 crosses both 20 and 40.
  assert.equal(app.run('data().shadowverse.park.points'), 40);
  assert.equal(app.run('data().shadowverse.rewardTotals.keys'), 3);
  assert.equal(app.run('data().shadowverse.rewardTotals.redEther'), 200);
  app.click('[data-park-weekly="battle-five"]');
  assert.equal(app.run('data().shadowverse.park.points'), 40);
  app.click('[data-park-weekly="friend-battle"]'); // 70
  assert.equal(app.run('data().shadowverse.rewardTotals.keys'), 6);
  app.click('[data-park-weekly="enter-three"]'); // 90
  assert.equal(app.run('data().shadowverse.rewardTotals.rupies'), 250);
  app.click('[data-park-weekly="ace"]'); // 110 -> 100
  assert.equal(app.run('data().shadowverse.park.points'), 100);
  assert.equal(app.run('data().shadowverse.rewardTotals.keys'), 10);
  assert.equal(app.document.querySelectorAll('.park-weekly-row.done').length, 6);
  assert.equal(app.document.querySelectorAll('[data-park-weekly]:disabled').length, 6);
  assert.equal(app.document.querySelectorAll('.park-milestone.claimed').length, 5);
  app.click('[data-park-weekly="message"]');
  assert.equal(app.run('data().shadowverse.rewardTotals.keys'), 10);
  app.click('[data-park-daily="enter"]');
  assert.equal(app.run('data().shadowverse.rewardTotals.keys'), 11);
  assert.equal(app.run('data().shadowverse.park.points'), 100);
  const reopened = start(app.saved());
  assert.equal(reopened.document.querySelectorAll('[data-park-weekly]:disabled').length, 6);
  assert.equal(reopened.run('data().shadowverse.rewardTotals.keys'), 11);
});

test('park weekly state resets Monday 05:00, retains cumulative rewards and can award next week again', () => {
  const app = start(); app.select('shadowverse');
  app.click('[data-park-weekly="enter-three"]'); app.click('[data-park-daily="enter"]');
  app.setTime('2026-09-11T05:00:00+09:00'); app.run('refreshActiveQuests()');
  assert.equal(app.run('data().shadowverse.park.points'), 20);
  app.setTime('2026-09-14T04:59:59.999+09:00'); app.run('refreshActiveQuests()');
  app.click('[data-park-daily="enter"]');
  assert.equal(app.run('data().shadowverse.park.points'), 20);
  app.advance(1); app.run('refreshActiveQuests()');
  assert.equal(app.run('data().shadowverse.park.points'), 0);
  assert.equal(app.run('data().shadowverse.park.weeklyDone.length'), 0);
  assert.equal(app.run('data().shadowverse.park.dailyDone.length'), 0);
  assert.equal(app.run('data().shadowverse.park.claimedMilestones.length'), 0);
  assert.equal(app.run('data().shadowverse.rewardTotals.keys'), 5);
  app.click('[data-park-weekly="enter-three"]');
  assert.equal(app.run('data().shadowverse.rewardTotals.keys'), 8);
});

test('adding park data preserves legacy Shadowverse balances and daily quests', () => {
  const app = start(); app.select('shadowverse');
  app.click('.queued-check:not(:disabled)'); app.click('[data-shadowverse-reward="highest"]');
  const stored = JSON.parse(app.saved());
  delete stored.games.shadowverse.shadowverse.park;
  delete stored.games.shadowverse.shadowverse.rewardTotals.keys;
  const restored = start(JSON.stringify(stored));
  assert.equal(restored.rows().length, 3);
  assert.equal(restored.run('data().shadowverse.rewardTotals.rupies'), 200);
  assert.equal(restored.run('data().shadowverse.rewardTotals.redEther'), 100);
  assert.equal(restored.run('data().shadowverse.rewardTotals.keys'), 0);
  assert.equal(restored.run('data().shadowverse.park.points'), 0);
});

