// Rewards are earned totals, never a wallet balance. Spending is kept separately.
const REWARD_NAMES = {
  gold: '골드',
  gems: '보석',
  credits: '크레딧',
  tokens: '컬렉터 토큰',
  seasonXp: '시즌 XP',
  xp: 'XP',
  cards: '카드',
  icr: 'ICR 카드',
  rupies: '루피',
  redEther: '레드에테르',
  keys: '보물 열쇠',
  rJewels: 'R 보옥',
  blueGateKeys: '파란 게이트 열쇠',
  challengeHourglasses: '챌린지 모래시계',
  packHourglasses: '팩 모래시계',
  freePackOpens: '무료 팩 개봉',
  packs: '카드팩',
  legacyTickets: '레거시 티켓'
};
function freshGame() {
  return {
    generalDate: '',
    generalMissions: [],
    completedMissions: [],
    refreshed: [],
    seasonQuests: [],
    weeklyCount: 0,
    rewards: { credits: 0, seasonXp: 0 },
    profile: {
      registeredAt: null,
      activityDays: [],
      spending: [],
      currencySpending: [],
      pass: { id: 'season-2026-09', active: false, level: 0, xp: 0, end: '' },
      alerts: { reset: false, full: false },
      ack: []
    },
    ledger: {}
  };
}
function rewardOwner(id) {
  const g = state.games[id];
  const key = {
    kards: 'kards',
    mtga: 'mtga',
    shadowverse: 'shadowverse',
    'master-duel': 'masterDuel',
    'duel-links': 'duelLinks',
    'pokemon-pocket': 'pokemonPocket',
    'might-magic': 'might'
  }[id];
  return key ? (g[key] ||= {}) : g;
}
const ledgerTotalsCache = new WeakMap();
function totals(id) {
  const ledger = state.games[id].ledger;
  if (!ledger) return {};
  let result = ledgerTotalsCache.get(ledger);
  if (!result) {
    result = {};
    for (const row of Object.values(ledger))
      for (const [key, value] of Object.entries(row.rewards))
        result[key] = (result[key] || 0) + value;
    ledgerTotalsCache.set(ledger, result);
  }
  // Callers receive their own object; restoring/replacing a ledger naturally invalidates its cache.
  return { ...result };
}
function activity(id, now = new Date()) {
  const p = state.games[id].profile;
  if (p?.registeredAt) {
    const day = kstDateKey(now);
    if (!p.activityDays.includes(day)) p.activityDays.push(day);
  }
}
function award(id, key, rewards, source = '퀘스트', initial = false) {
  const g = state.games[id];
  g.ledger ||= {};
  if (g.ledger[key]) return false;
  const clean = Object.fromEntries(
    Object.entries(rewards).filter(([, v]) => Number.isFinite(v) && v > 0)
  );
  g.ledger[key] = {
    id: `${id}/${key}`,
    source,
    rewards: clean,
    at: new Date().toISOString(),
    initial,
    version: 1
  };
  const cached = ledgerTotalsCache.get(g.ledger);
  if (cached)
    for (const [name, value] of Object.entries(clean)) cached[name] = (cached[name] || 0) + value;
  const owner = rewardOwner(id);
  owner.rewardTotals ||= {};
  for (const [name, value] of Object.entries(clean))
    owner.rewardTotals[name] = (owner.rewardTotals[name] || 0) + value;
  if (!initial) activity(id);
  return true;
}
function migrateStore() {
  if (state.version !== 2) migrateRewardLedgerStore();
  // Runs on every boot regardless of state.version, and is independently idempotent per
  // game via g.catalogVersion (see legacy-migrations.js) - the reward-ledger migration
  // above and the catalog schema conversion below are two separate version axes.
  convertAllLegacyCatalogs();
}
function migrateRewardLedgerStore() {
  localStorage.setItem('deckroom-backup-v1', JSON.stringify(state));
  for (const [id] of GAMES) {
    const g = (state.games[id] ||= freshGame());
    const previous = JSON.stringify(g);
    g.profile ||= freshGame().profile;
    // Existing progress is retained; no historical activity dates are fabricated.
    if (
      stored?.games?.[id] &&
      /rewardTotals|dailyQueue|weeklyDone|snapKstSchedule|generalDate\":\"[^\"]/.test(previous)
    )
      g.profile.registeredAt ||= new Date().toISOString();
    g.ledger ||= {};
    const owner = rewardOwner(id);
    const opening = { ...(owner.rewardTotals || {}) };
    const defaults =
      id === 'mtga'
        ? { dailyWins: 0, weeklyWins: 0 }
        : id === 'might-magic'
          ? {
              passActive: false,
              passLevel: 0,
              passXp: 0,
              passXpMax: 1600,
              dailyRemaining: true,
              weeklyRemaining: true,
              heroesDailyRemaining: true,
              loginDay: 1,
              loginClaimed: false,
              weekDone: MIGHT_WEEKS.map(() => [])
            }
          : id === 'kards'
            ? { passActive: false, generalDate: '', missions: [], completed: [] }
            : id === 'duel-links'
              ? { normalDuelists: 10, replenishmentStartedAt: null, weeklyDone: [] }
              : {};
    for (const [key, value] of Object.entries(defaults))
      if (owner[key] === undefined) owner[key] = value;
    if (id === 'snap') {
      opening.credits = (g.rewards?.credits || 0) + (g.rewards?.weeklyCredits || 0);
      opening.seasonXp = g.rewards?.seasonXp || 0;
    }
    if (id === 'mtga') {
      opening.gold =
        (opening.gold || 0) +
        (owner.goldLedgerVersion !== 1 ? mtgaWinGoldThrough(owner.dailyWins || 0) : 0);
      owner.goldLedgerVersion = 1;
      opening.xp =
        (owner.weeklyWins || 0) * 250 +
        mtgaDailyWinXp(owner.dailyWins || 0) +
        (owner.dailyQueue?.missions?.filter(x => x.done).length || 0) * 500;
    }
    if (owner.passActive !== undefined) g.profile.pass.active = owner.passActive;
    if (owner.passLevel !== undefined) {
      g.profile.pass.level = owner.passLevel;
      g.profile.pass.xp = owner.passXp || 0;
    }
    if (id === 'snap' && !g.weeklyCreditClaims)
      g.weeklyCreditClaims = WEEKLY_REWARDS.filter(r => g.weeklyCount >= r.count).map(r => r.count);
    owner.rewardTotals = {};
    award(id, 'opening-v1', opening, '이전 기록', true);
  }
  state.version = 2;
  state.activeGame = 'overview';
}
function resetGame(id) {
  state.games[id] = freshGame();
  const catalogBackup = localStorage.getItem('deckroom-backup-catalog');
  if (catalogBackup) {
    const old = JSON.parse(catalogBackup);
    if (old.games) delete old.games[id];
    localStorage.setItem('deckroom-backup-catalog', JSON.stringify(old));
  }
  const backup = localStorage.getItem('deckroom-backup-v1');
  if (backup) {
    try {
      const old = JSON.parse(backup);
      if (old.games) delete old.games[id];
      localStorage.setItem('deckroom-backup-v1', JSON.stringify(old));
    } catch {
      localStorage.removeItem('deckroom-backup-v1');
    }
  }
  save();
}
function resetAllGames() {
  const previousGames = state.games,
    previousTab = state.activeGame;
  state.games = Object.fromEntries(GAMES.map(([id]) => [id, freshGame()]));
  state.activeGame = 'overview';
  try {
    save();
  } catch (error) {
    state.games = previousGames;
    state.activeGame = previousTab;
    throw error;
  }
  localStorage.removeItem('deckroom-backup-v1');
  localStorage.removeItem('deckroom-corrupt-backup');
  localStorage.removeItem('deckroom-backup-catalog');
  closeDialog();
}
function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
function rewardText(rewards) {
  return (
    Object.entries(rewards)
      .filter(([, v]) => v)
      .map(([k, v]) => `${REWARD_NAMES[k] || k} ${v.toLocaleString()}`)
      .join(' · ') || '0'
  );
}
