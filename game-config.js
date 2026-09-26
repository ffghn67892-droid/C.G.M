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

// Today's schedule (overview.js): interval rules faster than this have no meaningful
// shared clock time to list - they go through realtimeRefreshList() instead.
const FIXED_SCHEDULE_MIN_MINUTES = 60;

function kstTodayBounds(now = new Date()) {
  const start = periodAt(0, 0, now) * DAY_MS - 9 * HOUR_MS; // KST 00:00 of "today", in UTC ms
  return [start, start + DAY_MS];
}
function kstWeekday(now = new Date()) {
  return (((periodAt(0, 0, now) + 4) % 7) + 7) % 7; // 0=일..6=토 - same +4 epoch-weekday offset rulePeriod uses
}
// All of today's (KST) reset instants for a recurring rule, ascending. [] for 'fixed', for
// refillOnUse interval rules (no shared clock - see catalog-engine.js), and for 'weekly'
// rules whose weekday isn't today.
function ruleOccurrencesToday(g, r, now = new Date()) {
  const [dayStart, dayEnd] = kstTodayBounds(now);
  if (r.format === 'fixed') return [];
  if (r.format === 'interval') {
    if (r.refillOnUse) return [];
    const ms = r.intervalMinutes * 60000;
    const [h, m] = r.anchorTime.split(':').map(Number);
    const offset = m * 60000 - (9 - h) * HOUR_MS; // same reference frame as intervalPeriodAt
    const out = [];
    for (let k = Math.ceil((dayStart - offset) / ms); ; k++) {
      const t = k * ms + offset;
      if (t >= dayEnd) break;
      if (t >= dayStart) out.push(t);
    }
    return out;
  }
  const sched = ruleResetSchedule(g, r);
  if (r.format === 'weekly' && sched.weekday !== kstWeekday(now)) return [];
  const [h, m] = sched.time.split(':').map(Number);
  return [dayStart + h * HOUR_MS + m * 60000];
}
// Next fixed-anchor occurrence strictly after `now` (only meaningful for non-refillOnUse
// interval rules - the realtime list uses refillAnchorAt directly for refillOnUse ones).
function nextIntervalOccurrence(r, now = new Date()) {
  const ms = r.intervalMinutes * 60000;
  const [h, m] = r.anchorTime.split(':').map(Number);
  const offset = m * 60000 - (9 - h) * HOUR_MS;
  const k = Math.floor((now.getTime() - offset) / ms) + 1;
  return k * ms + offset;
}
// A rule belongs in the fixed schedule only if it has an actual shared wall-clock reset
// time: daily/weekly, or a fixed-anchor interval at/above FIXED_SCHEDULE_MIN_MINUTES.
// refillOnUse rules never qualify, regardless of intervalMinutes - there is no shared
// anchor, only a per-depletion chain (catalog-engine.js's settleRefillAnchor).
function isFixedScheduleRule(r) {
  if (r.format === 'fixed') return false;
  if (r.format !== 'interval') return true; // daily/weekly
  return !r.refillOnUse && r.intervalMinutes >= FIXED_SCHEDULE_MIN_MINUTES;
}
// Today's fixed-time schedule across every registered, non-muted game, grouped by KST
// clock instant, ascending. A rule drops out once ruleRemaining() is false (catalog-engine.js).
function todaySchedule(now = new Date()) {
  const byTime = new Map();
  for (const [id, name] of GAMES) {
    const g = state.games[id];
    if (!g?.profile?.registeredAt || g.profile.mutedUntil > now.getTime()) continue;
    for (const r of catalogRules(g)) {
      if (!isFixedScheduleRule(r) || !ruleRemaining(g, r)) continue;
      for (const ms of ruleOccurrencesToday(g, r, now)) {
        const bucket = byTime.get(ms) || new Map();
        (bucket.get(id) || bucket.set(id, { name, items: [] }).get(id)).items.push(r.name);
        byTime.set(ms, bucket);
      }
    }
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ms, bucket]) => ({ ms, games: [...bucket.values()] }));
}
// Everything NOT in the fixed schedule (sub-hour fixed-anchor intervals, and all
// refillOnUse rules) as a live "next refill" list, ascending by next-refill time. Drops a
// rule once it has no remaining work, or a slot rule that's already at maxHeld (nothing
// left to count down to - the game's own card already shows the full count persistently).
function realtimeRefreshList(now = new Date()) {
  const out = [];
  for (const [id, name] of GAMES) {
    const g = state.games[id];
    if (!g?.profile?.registeredAt || g.profile.mutedUntil > now.getTime()) continue;
    for (const r of catalogRules(g)) {
      if (r.format !== 'interval' || isFixedScheduleRule(r) || !ruleRemaining(g, r)) continue;
      const p = ruleProgress(g, r);
      if (r.kind === 'slot' && p.held >= r.maxHeld) continue;
      const nextAt = r.refillOnUse
        ? p.refillAnchorAt == null
          ? null
          : p.refillAnchorAt + r.intervalMinutes * 60000
        : nextIntervalOccurrence(r, now);
      if (nextAt == null) continue;
      out.push({ gameId: id, gameName: name, ruleId: r.id, ruleName: r.name, nextAt });
    }
  }
  return out.sort((a, b) => a.nextAt - b.nextAt);
}
function snapSlot(now = new Date()) {
  return Math.floor((now.getTime() + 5 * HOUR_MS) / (8 * HOUR_MS));
}
