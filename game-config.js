const CHESTS = [
  { gold: 30, '일반 와일드카드': 1 },
  { gold: 80, '일반 와일드카드': 2, '무작위 일반 골드 카드': 2 },
  { gold: 150, '한정 와일드카드': 3, '무작위 한정 골드 카드': 2 },
  {
    gold: 250,
    '특수 와일드카드': 1,
    '한정 와일드카드': 1,
    '무작위 특수 골드 카드': 1,
    '무작위 등급 미상 골드 카드': 2
  },
  {
    gold: 350,
    '정예 와일드카드': 1,
    '특수 와일드카드': 1,
    '한정 와일드카드': 1,
    '무작위 특수 골드 카드': 2
  }
];
function defaultKardsRules() {
  const schedule = { kind: 'daily', time: '09:00', days: 1, weekday: 3, anchor: '2026-01-01' };
  return [
    {
      id: 'daily',
      type: 'quest',
      label: '일일 퀘스트',
      source: 'builtin',
      schedule,
      spawnCount: 1,
      capacity: 3,
      passExtra: 1,
      rewards: [
        { id: 'gold50', label: '50 GOLD', resources: { gold: 50 } },
        { id: 'gold60', label: '60 GOLD', resources: { gold: 60 } }
      ],
      quests: [{ id: 'daily', label: '일일 퀘스트', rewardIds: ['gold50', 'gold60'] }]
    },
    {
      id: 'free',
      type: 'claim',
      label: '일일 무료 카드',
      source: 'builtin',
      schedule: { ...schedule },
      spawnCount: 1,
      capacity: 1,
      passExtra: 1,
      rewards: [{ id: 'card', label: '카드 1장', resources: { cards: 1 } }],
      quests: []
    },
    {
      id: 'chest',
      type: 'claim',
      label: '주간 보상 상자',
      source: 'builtin',
      schedule: { ...schedule, kind: 'weekly' },
      spawnCount: 1,
      capacity: 1,
      passExtra: 0,
      rewards: CHESTS.map((resources, i) => ({
        id: `tier${i + 1}`,
        label: `티어 ${i + 1}`,
        resources: { ...resources }
      })),
      quests: []
    }
  ];
}
function validateRuleCatalog(rules) {
  return validateCatalog(rules);
}
function kardsRules(g = state.games.kards) {
  g.ruleCatalog ||= defaultKardsRules();
  g.catalogVersion = 1;
  const r = g.ruleCatalog.find(r => r.id === 'chest');
  if (r && !r.view) {
    r.view = 'select';
    r.controls = { select: 'chestTier', claim: 'claimChest' };
  }
  return g.ruleCatalog;
}
function rulePeriod(rule, now = new Date()) {
  return catalogPeriod(rule, now);
}
function ruleInterval(rule) {
  return rule.schedule.kind === 'weekly'
    ? 7
    : rule.schedule.kind === 'intervalDays'
      ? rule.schedule.days
      : 1;
}
function ruleScheduleText(r) {
  return catalogScheduleText(r);
}
function isCustomGame(id) {
  return !!state.customGames?.some(x => x[0] === id);
}
function catalogRules(g) {
  return g.ruleCatalog || [];
}
function newCatalogRule(type = 'quest') {
  const reward = { id: 'reward-' + crypto.randomUUID(), label: '보상', resources: { gold: 50 } };
  return {
    id: 'rule-' + crypto.randomUUID(),
    type,
    label: type === 'quest' ? '새 퀘스트' : '새 정기 보상',
    source: 'user',
    schedule: { kind: 'daily', time: '09:00', days: 1, weekday: 1, anchor: '2026-01-01' },
    spawnCount: 1,
    capacity: type === 'quest' ? 3 : 1,
    passExtra: 0,
    rewards: [reward],
    quests:
      type === 'quest'
        ? [{ id: 'item-' + crypto.randomUUID(), label: '퀘스트', rewardIds: [reward.id] }]
        : []
  };
}
function catalogAdapter(g) {
  if (g !== state.games.kards)
    return {
      state: r => {
        g.ruleProgress ||= {};
        return (g.ruleProgress[r.id] ||= { missions: [], completed: [] });
      },
      bonus: () => !!g.profile.pass.active,
      key: (r, m, p, n) => (m ? `rule/${r.id}/quest/${m.id}` : `rule/${r.id}/${p}/${n}`)
    };
  const o = ensureKardsData(g);
  return {
    state: r => {
      if (r.id === 'daily') return o;
      g.ruleProgress ||= {};
      const p = (g.ruleProgress[r.id] ||= { missions: [], completed: [] });
      if (r.id === 'free') {
        p.period = o.freeCardPeriod;
        p.claimed = o.freeCardsClaimed || 0;
      }
      if (r.id === 'chest')
        p.claimed = Math.max(p.claimed || 0, g.ledger[`chest/${rulePeriod(r)}`] ? 1 : 0);
      return p;
    },
    flush: (r, p) => {
      if (r.id === 'free') {
        o.freeCardPeriod = p.period;
        o.freeCardsClaimed = p.claimed || 0;
      }
    },
    bonus: () => !!o.passActive,
    setBonus: active => {
      o.passActive = active;
    },
    key: (r, m, p, n) =>
      m
        ? r.id === 'daily'
          ? `quest/${m.id}`
          : `rule/${r.id}/quest/${m.id}`
        : r.id === 'free'
          ? `free/${p}/${n}`
          : r.id === 'chest'
            ? `chest/${p}${n ? '/' + n : ''}`
            : `rule/${r.id}/${p}/${n}`
  };
}
function ruleProgress(g, r) {
  return catalogAdapter(g).state(r);
}
function missionRewards(r, m) {
  return m.rewardChoices || r.rewards;
}
function syncCatalog(g, now = new Date()) {
  return syncUniversalCatalog(g, now);
}
function syncKardsRules(g, now = new Date()) {
  kardsRules(g);
  syncCatalog(g, now);
  return g.kards;
}
function ruleClaimLimit(g, r) {
  return r.spawnCount + (catalogAdapter(g).bonus() ? r.passExtra : 0);
}
function runCatalogAction(gameId, change) {
  const previous = structuredClone(state.games[gameId]);
  try {
    const result = change(state.games[gameId]);
    if (result === false) {
      state.games[gameId] = previous;
      return false;
    }
    save();
    return result;
  } catch (error) {
    state.games[gameId] = previous;
    throw error;
  }
}
function completeCatalogRule(gameId, ruleId, missionId, rewardId, expectedPeriod) {
  return catalogAction(gameId, ruleId, 'complete', {
    mission: missionId,
    reward: rewardId,
    period: expectedPeriod
  });
}
// Edits a game's rule list in place: re-clamps every surviving rule's progress to its
// (possibly changed) capacity/range, and drops progress + undo history for removed rules.
// Kind changes are rejected outright (the wizard adds a new rule instead).
function updateCatalog(gameId, rules) {
  validateRuleCatalog(rules);
  return runCatalogAction(gameId, g => {
    syncCatalog(g);
    const old = catalogRules(g);
    g.ruleCatalog = structuredClone(rules);
    g.ruleProgress ||= {};
    for (const r of g.ruleCatalog) {
      const before = old.find(x => x.id === r.id);
      if (before && before.kind !== r.kind)
        throw Error('기존 규칙의 형태는 바꿀 수 없습니다. 새 규칙을 추가하세요.');
      const p = ruleProgress(g, r);
      if (r.kind === 'slot') p.held = Math.min(p.held, r.maxHeld);
      else p.value = Math.min(Math.max(p.value, r.min), r.max);
    }
    const kept = new Set(g.ruleCatalog.map(r => r.id));
    for (const id of Object.keys(g.ruleProgress)) if (!kept.has(id)) delete g.ruleProgress[id];
    g.actionHistory = (g.actionHistory || []).filter(entry => kept.has(entry.ruleId));
    syncCatalog(g);
    return true;
  });
}
const DICE_END = '2026-09-21T12:59:00+09:00';
const DICE_FIFTY = [
  1, 3, 4, 5, 6, 7, 8, 9, 12, 14, 16, 18, 22, 24, 26, 28, 32, 34, 36, 38, 42, 44, 46, 48
];
const DICE_HUNDRED = [2, 10, 20, 30, 40, 50];
const SHOP_ITEMS = [
  [
    'WCS 개최 기념 세트 2026',
    3000,
    'WCS2026 스페셜 콜렉션 20팩 · UR 2장 확정 · 다른 일러스트 블랙 매지션/블랙 매지션 걸 액세서리'
  ],
  ['야미 컬렉션 세트', 2400, '이상하고 맛있는 친구들 10팩 · UR 1장 확정 · 야미 액세서리'],
  ['사이버 드래곤 컬렉션 세트', 2500, '백은의 기계룡 20팩 · UR 2장 확정 · 사이버 드래곤 액세서리'],
  ['타락천사 컬렉션 세트', 1800, '체인지 포 디자이어 10팩 · UR 1장 확정 · 타락천사 액세서리'],
  ['섀도르 컬렉션 세트', 1600, '주박의 영사 10팩 · UR 1장 확정 · 섀도르 액세서리'],
  [
    '1억 DL 기념 엘리멘틀 히어로 세트',
    3000,
    '히어로 비긴즈 20팩 · UR 2장 확정 · 네오스 디럭스 메이트/액세서리'
  ],
  ['유령토끼 세트', 750, '마스터 팩 10팩 · SR 이상 1장 확정 · 유령토끼 1장'],
  ['저택 와라시 세트', 750, '마스터 팩 10팩 · SR 이상 1장 확정 · 저택 와라시 1장']
];
function periodAt(hour, minute = 0, now = new Date()) {
  return Math.floor((now.getTime() + (9 - hour) * HOUR_MS - minute * 60000) / DAY_MS);
}
function snapSlot(now = new Date()) {
  return Math.floor((now.getTime() + 5 * HOUR_MS) / (8 * HOUR_MS));
}
