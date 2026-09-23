// Stage L1 (2026-09-19, tracker redesign): removed the dead KARDS-specific preset/adapter
// chain (CHESTS, defaultKardsRules, kardsRules, catalogAdapter and the old single-arg
// rulePeriod/ruleScheduleText/catalogRules/ruleProgress they backed) - catalog-engine.js's
// versions of those functions load after this file and had already fully shadowed them at
// runtime (see TODO_TRACKER_REDESIGN.md §10). newCatalogRule, missionRewards,
// syncKardsRules, ruleClaimLimit and completeCatalogRule had no remaining callers at all
// and are gone too. See REGRESSION_TEST_COVERAGE.md's 2026-09-19 재후속 section.
function validateRuleCatalog(rules) {
  return validateCatalog(rules);
}
function isCustomGame(id) {
  return !!state.customGames?.some(x => x[0] === id);
}
// state.gameOrder is a user-customized sidebar tab order (absent until the user first
// drags a tab). Stable sort keeps GAMES' hardcoded order for any id not yet in it, so
// new/never-dragged games simply take their natural GAMES position.
function orderedGameIds(ids) {
  const rank = new Map((state.gameOrder || []).map((id, i) => [id, i]));
  return [...ids].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
}
// Moves `id` to just before `beforeId` (or to the end if beforeId is null/absent) and
// persists the FULL resulting order over every known game - from this point on
// state.gameOrder is authoritative, not a sparse override.
function moveGameOrder(id, beforeId) {
  const ids = orderedGameIds(GAMES.map(([gid]) => gid)).filter(x => x !== id);
  const at = beforeId ? ids.indexOf(beforeId) : -1;
  ids.splice(at < 0 ? ids.length : at, 0, id);
  state.gameOrder = ids;
  save();
}
function syncCatalog(g, now = new Date()) {
  return syncUniversalCatalog(g, now);
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
      r.revision = !before
        ? 1
        : ruleRevisionKey(before) === ruleRevisionKey(r)
          ? (before.revision ?? 1)
          : (before.revision ?? 1) + 1;
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
