// Retained solely to normalize pre-catalog saves (plus the KARDS storage adapter).
// Do not remove these helpers based on UI reachability alone.
function ensureSnapCreditData(current) {
  if (!current.rewards) current.rewards = { credits: 0, seasonXp: 0 };
  if (!Number.isFinite(current.rewards.credits)) current.rewards.credits = 0;
  if (!Number.isFinite(current.rewards.weeklyCredits)) current.rewards.weeklyCredits = 0;
  if (!Array.isArray(current.weeklyCreditClaims)) current.weeklyCreditClaims = [];
}

function ensureMightData(current, now=new Date()) {
    if (!current.might) current.might = { passActive: false, passLevel: 9, passXp: 511, passXpMax: 1600, dailyRemaining: true, weeklyRemaining: true, heroesDailyRemaining: true, loginDay: 1, loginClaimed: false, weekDone: MIGHT_WEEKS.map(() => []) };
    if (!current.might.weekDone) current.might.weekDone = MIGHT_WEEKS.map(() => []);
    const queue = syncDailyQueue(current.might,'dailyQueue',1,false,now);
    if (!queue.unifiedDailyView) {
      const first = queue.missions[0];
      if (first) {
        first.label = '랭킹전 모드 2번 플레이';
        first.rewardText = '600 XP';
        if (current.might.dailyRemaining === false) completeDailyQuest(queue, first.id);
      }
      queue.unifiedDailyView = true;
    }
    return current.might;
  }

function ensureMtgaData(current, now=new Date()) {
  if (!current.mtga) current.mtga = { dailyQuest: true, dailyWins: 0, weeklyWins: 0, questReward: 0, goldLedgerVersion: 1 };
  if (!current.mtga.rewardTotals) current.mtga.rewardTotals = { gold: 0 };
  if (!Number.isFinite(current.mtga.rewardTotals.gold)) current.mtga.rewardTotals.gold = 0;
  if (current.mtga.goldLedgerVersion !== 1) {
    current.mtga.rewardTotals.gold += mtgaWinGoldThrough(current.mtga.dailyWins || 0);
    current.mtga.goldLedgerVersion = 1;
  }
  if (!current.mtga.dailyQueueExpanded) {
    const queue = syncDailyQueue(current.mtga, 'dailyQueue',1,false,now);
    while (queue.missions.length < 3) queue.missions.push({ id: `mtga-${crypto.randomUUID()}`, label: '일일 퀘스트' });
    current.mtga.dailyQueueExpanded = true;
  }
  const queue = syncDailyQueue(current.mtga,'dailyQueue',1,false,now);
  queue.missions.forEach((mission) => { if (mission.label === '일일 퀘스트가 갱신되었습니다.') mission.label = '일일 퀘스트'; });
  if (!queue.unifiedDailyView) {
    if (current.mtga.dailyQuest === false && queue.missions[0]) {
      const reward = [500, 750].includes(current.mtga.questReward) ? current.mtga.questReward : undefined;
      completeDailyQuest(queue, queue.missions[0].id, reward);
    }
    queue.unifiedDailyView = true;
  }
  return current.mtga;
}

function ensureKardsData(current) {
  if (!current.kards) current.kards = { passActive: false, generalDate: '', missions: [], completed: [], rewardTotals: { gold: 0 } };
  if (!current.kards.rewardTotals) current.kards.rewardTotals = { gold: 0 };
  if (!Number.isFinite(current.kards.rewardTotals.cards)) current.kards.rewardTotals.cards = 0;
  return current.kards;
}

function ensureMasterDuelData(current) {
  if (!current.masterDuel) current.masterDuel = { rewardTotals: { gems: 0 }, questSeed: 0 };
  if (!current.masterDuel.rewardTotals) current.masterDuel.rewardTotals = { gems: 0 };
  if (!Number.isFinite(current.masterDuel.rewardTotals.gems)) current.masterDuel.rewardTotals.gems = 0;
  if (!Number.isFinite(current.masterDuel.questSeed)) current.masterDuel.questSeed = 0;
  return current.masterDuel;
}

function ensureDuelLinksData(current) {
  if (!current.duelLinks) current.duelLinks = { normalDuelists: 10, replenishmentStartedAt: null, weeklyDone: [], rewardTotals: { gems: 0, rJewels: 0, blueGateKeys: 0, gold: 0 } };
  if (!Array.isArray(current.duelLinks.weeklyDone)) current.duelLinks.weeklyDone = [];
  if (!current.duelLinks.rewardTotals) current.duelLinks.rewardTotals = {};
  for (const key of ['gems', 'rJewels', 'blueGateKeys', 'gold']) if (!Number.isFinite(current.duelLinks.rewardTotals[key])) current.duelLinks.rewardTotals[key] = 0;
  return current.duelLinks;
}

function ensurePokemonPocketData(current, now = new Date()) {
  if (!current.pokemonPocket) current.pokemonPocket = { freePacks: 2, getChallengePoints: 5, lastPackRecoveryAt: now.getTime(), lastChallengeRecoveryAt: now.getTime(), dailyDone: Array.isArray(current.pokemonDone) ? current.pokemonDone : [], dailyRewardClaimed: false, rewardTotals: { challengeHourglasses: 0, packHourglasses: 0, freePackOpens: 0 } };
  const pocket = current.pokemonPocket;
  if (!Array.isArray(pocket.dailyDone)) pocket.dailyDone = [];
  if (!pocket.rewardTotals) pocket.rewardTotals = {};
  for (const key of ['challengeHourglasses', 'packHourglasses', 'freePackOpens']) if (!Number.isFinite(pocket.rewardTotals[key])) pocket.rewardTotals[key] = 0;
  if (!Number.isFinite(pocket.freePacks)) pocket.freePacks = 2;
  if (!Number.isFinite(pocket.getChallengePoints)) pocket.getChallengePoints = 5;
  if (!Number.isFinite(pocket.lastPackRecoveryAt)) pocket.lastPackRecoveryAt = now.getTime();
  if (!Number.isFinite(pocket.lastChallengeRecoveryAt)) pocket.lastChallengeRecoveryAt = now.getTime();
  return pocket;
}

function syncPokemonPocket(current, now = new Date()) {
  const pocket = ensurePokemonPocketData(current, now);
  const recover = (countKey, timestampKey, maximum) => {
    if (pocket[countKey] >= maximum) { pocket[countKey] = maximum; return; }
    const slots = Math.floor((now.getTime() - pocket[timestampKey]) / TWELVE_HOURS);
    if (slots > 0) {
      pocket[countKey] = Math.min(maximum, pocket[countKey] + slots);
      pocket[timestampKey] += slots * TWELVE_HOURS;
      if (pocket[countKey] === maximum) pocket[timestampKey] = now.getTime();
    }
  };
  recover('freePacks', 'lastPackRecoveryAt', 2);
  recover('getChallengePoints', 'lastChallengeRecoveryAt', 5);
  const period = dailyPeriod('pokemon-pocket', now);
  if (pocket.dailyPeriod === undefined) pocket.dailyPeriod = period;
  else if (period > pocket.dailyPeriod) { pocket.dailyDone = []; pocket.dailyRewardClaimed = false; pocket.dailyPeriod = period; }
  if (!pocket.dailyRewardClaimed && pocket.dailyDone.length >= 3) {
    pocket.dailyRewardClaimed = true;
    award('pokemon-pocket',`daily/${period}`,{challengeHourglasses:2,packHourglasses:3},'일일 미션');
  }
  return pocket;
}

function syncDuelLinks(current, now = new Date()) {
  const duelLinks = ensureDuelLinksData(current);
  const period = weeklyPeriod('duel-links', now);
  if (duelLinks.weeklyPeriod === undefined) duelLinks.weeklyPeriod = period;
  else if (period > duelLinks.weeklyPeriod) { duelLinks.weeklyDone = []; duelLinks.weeklyPeriod = period; }
  if (duelLinks.replenishmentStartedAt !== null) {
    const elapsed = Math.max(0, now.getTime() - duelLinks.replenishmentStartedAt);
    const recovered=Math.floor(elapsed / (30*60*1000)); duelLinks.normalDuelists=Math.min(10,duelLinks.normalDuelists+recovered); duelLinks.replenishmentStartedAt += recovered*30*60*1000;
    if (duelLinks.normalDuelists === 10) duelLinks.replenishmentStartedAt = null;
  }
  return duelLinks;
}

function nextMasterDuelQuest(masterDuel, used) {
  const available = MASTER_DUEL_QUESTS.filter((label) => !used.has(label));
  if (!available.length) return null;
  const label = available[masterDuel.questSeed % available.length];
  masterDuel.questSeed += 1;
  used.add(label);
  return label;
}

function normalizeMasterDuelQuestLabels(masterDuel, queue) {
  const used = new Set();
  queue.missions.forEach((mission) => {
    if (MASTER_DUEL_QUESTS.includes(mission.label) && !used.has(mission.label)) used.add(mission.label);
    else mission.label = '';
  });
  queue.missions.forEach((mission) => { if (!mission.label) mission.label = nextMasterDuelQuest(masterDuel, used) || MASTER_DUEL_QUESTS[0]; });
  return used;
}

function addMasterDuelQuests(masterDuel, queue, count, used = normalizeMasterDuelQuestLabels(masterDuel, queue)) {
  for (let index = 0; index < count && queue.missions.length < 9; index += 1) {
    const label = nextMasterDuelQuest(masterDuel, used);
    if (!label) break;
    queue.missions.push({ id: crypto.randomUUID(), label });
  }
}

function syncMasterDuelQuests(current, now=new Date()) {
  const masterDuel = ensureMasterDuelData(current);
  const queue = ensureDailyQueue(masterDuel, 'dailyQueue');
  const period = dailyPeriod('master-duel',now);
  if (queue.resetSchedule !== 'master-duel-v1') {
    queue.resetSchedule = 'master-duel-v1';
    queue.resetPeriod = period;
    queue.date = String(period);
    const used = normalizeMasterDuelQuestLabels(masterDuel, queue);
    if (!queue.missions.length) addMasterDuelQuests(masterDuel, queue, 3, used);
  } else if (period > queue.resetPeriod) {
    const elapsed = period - queue.resetPeriod;
    queue.missions = queue.missions.filter((mission) => !mission.done);
    queue.completed = [];
    queue.resetPeriod = period;
    queue.date = String(period);
    addMasterDuelQuests(masterDuel, queue, elapsed * 3);
  } else normalizeMasterDuelQuestLabels(masterDuel, queue);
  return { masterDuel, queue };
}

function syncKardsMissions(now=new Date()) { return syncKardsRules(data(),now); }

function ensureDailyQueue(current, key = 'dailyQueue') {
  if (!current[key]) current[key] = { date: '', missions: [], completed: [] };
  if (!Array.isArray(current[key].missions)) current[key].missions = [];
  if (!Array.isArray(current[key].completed)) current[key].completed = [];
  return current[key];
}

function syncRetainedDaily(queue, { dateField = 'date', count = 1, label = '일일 퀘스트', gameId = state.activeGame } = {}, now = new Date()) {
  const period = dailyPeriod(gameId, now);
  if (!Array.isArray(queue.missions)) queue.missions = [];
  if (!Array.isArray(queue.completed)) queue.completed = [];
  if (queue.resetSchedule !== 'kst-v1') {
    const existing = Boolean(queue[dateField]);
    queue.resetSchedule = 'kst-v1';
    queue.resetPeriod = period;
    queue[dateField] = period == null ? 'manual' : String(period);
    if (existing) return queue;
    for (let index = 0; index < count && queue.missions.length < 3; index += 1) queue.missions.push({ id: crypto.randomUUID(), label, done: false });
    return queue;
  }
  if (period == null || period <= queue.resetPeriod) return queue;
  const elapsed = period - queue.resetPeriod;
  queue.missions = queue.missions.filter((mission) => !mission.done);
  queue.completed = [];
  queue.resetPeriod = period;
  queue[dateField] = String(period);
  const additions = Math.min(3 - queue.missions.length, elapsed * count);
  for (let index = 0; index < additions; index += 1) queue.missions.push({ id: crypto.randomUUID(), label, done: false });
  return queue;
}

function completeDailyQuest(queue, id, rewardGold) {
  const mission = queue.missions.find((item) => item.id === id);
  if (!mission || mission.done) return false;
  mission.done = true;
  mission.completedDate = kstDateKey(new Date());
  if (rewardGold !== undefined) mission.rewardGold = rewardGold;
  queue.completed.push(id);
  if(state.games[state.activeGame]?.profile) activity(state.activeGame);
  return true;
}

function syncDailyQueue(current, key = 'dailyQueue', count = 1, simultaneous = false, now=new Date()) {
  if (!simultaneous) return syncRetainedDaily(ensureDailyQueue(current, key), { count },now);
  const queue = syncRetainedDaily(ensureDailyQueue(current, key), { count: 3 },now);
  return queue;
}

function ensureShadowverseData(current) {
  if (!current.shadowverse) current.shadowverse = {};
  if (!current.shadowverse.rewardTotals) current.shadowverse.rewardTotals = {};
  for (const key of ['rupies', 'redEther', 'keys']) {
    if (!Number.isFinite(current.shadowverse.rewardTotals[key])) current.shadowverse.rewardTotals[key] = 0;
  }
  return current.shadowverse;
}

function syncGameProgress(id=state.activeGame, now=new Date()) {
  const current = state.games[id];
  if (id === MTGA_ID) {
    const mtga = ensureMtgaData(current,now);
    advancePeriod(mtga, 'dailyWinPeriod', dailyPeriod(id,now), () => { mtga.dailyWins = 0; });
    advancePeriod(mtga, 'weeklyWinPeriod', weeklyPeriod(id,now), () => { mtga.weeklyWins = 0; });
  } else if (id === SNAP_ID) {
    ensureSnapCreditData(current);
    advancePeriod(current, 'weeklyResetPeriod', weeklyPeriod(id,now), () => { current.weeklyCount = 0; current.weeklyCreditClaims = []; });
  } else if (id === MIGHT_ID) {
    const might = ensureMightData(current,now);
    advancePeriod(might, 'weeklyResetPeriod', weeklyPeriod(id,now), () => { might.weeklyRemaining = true; });
  } else if (id === 'shadowverse') {
    ensureParkData(ensureShadowverseData(current),now);
  }
}

function ensureParkData(shadowverse, now=new Date()) {
  if (!shadowverse.park) shadowverse.park = {};
  const park = shadowverse.park;
  for (const key of ['dailyDone', 'weeklyDone', 'claimedMilestones']) {
    if (!Array.isArray(park[key])) park[key] = [];
  }
  if (!Number.isFinite(park.points)) park.points = 0;
  park.points = Math.max(0, Math.min(100, park.points));
  advancePeriod(park, 'dailyPeriod', dailyPeriod('shadowverse',now), () => { park.dailyDone = []; });
  advancePeriod(park, 'weeklyPeriod', weeklyPeriod('shadowverse',now), () => {
    park.weeklyDone = []; park.points = 0; park.claimedMilestones = [];
  });
  return park;
}

function syncSnapMissions(now=new Date()){
 if(state.activeGame!==SNAP_ID)return;const g=data(),slot=snapSlot(now);g.generalMissions ||= [];g.completedMissions ||= [];
 if(g.snapSlot===undefined){g.snapSlot=slot;if(!g.generalMissions.length&&!g.generalDate)g.snapSlot=slot-1;g.generalMissions.forEach((m,i)=>{m.difficulty ||= i%2?'hard':'normal';});}
 if(slot>g.snapSlot){const count=Math.min(3,slot-g.snapSlot);for(let n=count-1;n>=0;n--)for(const difficulty of ['normal','hard'])if(g.generalMissions.length<6)g.generalMissions.push({id:`slot/${slot-n}/${difficulty}`,difficulty,label:difficulty==='normal'?'일반 임무':'어려움 임무'});g.snapSlot=slot;g.generalDate=String(dailyPeriod(SNAP_ID,now));}
}

function syncLegacyGame(id,now=new Date()) {
 const g=state.games[id];if(!g?.profile?.registeredAt)return;if(isCustomGame(id)){syncCatalog(g,now);return;}const previous=state.activeGame;state.activeGame=id;
 try {if(g.profile.pass.end&&Date.parse(g.profile.pass.end)<=now.getTime()){g.profile.pass.active=false;if(id==='kards'||id==='might-magic')rewardOwner(id).passActive=false;}syncGameProgress(id,now);
 if(id==='snap')syncSnapMissions(now);else if(id==='kards')syncKardsMissions(now);else if(id==='mtga')ensureMtgaData(g,now);else if(id==='might-magic')ensureMightData(g,now);else if(id==='master-duel')syncMasterDuelQuests(g,now);else if(id==='duel-links')syncDuelLinks(g,now);else if(id==='pokemon-pocket')syncPokemonPocket(g,now);else syncDailyQueue(g,'dailyQueue',id==='shadowverse'?3:1,id==='shadowverse',now);
 const o=rewardOwner(id);
 if(id==='might-magic'||id==='hearthstone'){o.weeklyDone ||= [];advancePeriod(o,'extraWeek',weeklyPeriod(id,now),()=>o.weeklyDone=[]);}
 if(id==='might-magic'){advancePeriod(o,'heroPeriod',dailyPeriod(id,now),()=>o.heroesDailyRemaining=true);advancePeriod(o,'loginPeriod',periodAt(4,40,now),()=>{o.loginClaimed=false;o.loginDay=o.loginDay%7+1;});}
 if(id==='master-duel'){const month=new Date(now.getTime()+9*HOUR_MS).toISOString().slice(0,7);if(o.loginMonth!==month){o.loginMonth=month;o.loginCount=0;}o.loginCount ||= 0;}
 if(g.profile.pass.end&&Date.parse(g.profile.pass.end)<=now.getTime()){g.profile.pass.active=false;if(id==='kards'||id==='might-magic')o.passActive=false;}
 }finally{state.activeGame=previous;}
}
