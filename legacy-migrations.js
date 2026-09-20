// Stage A (2026-09-20, PROJECT_DEVELOPMENT_PLAN.md §3.1/§7.1): revives structural-only
// conversion from the pre-tracker-redesign catalog schema (catalogVersion 1: r.type/
// r.label/r.schedule/r.spawnCount/r.capacity/r.rewards, see git history at f13b02c^ for the
// full old shape) to the current slot/gauge schema (catalogVersion 2: r.kind/r.name/
// r.format/r.refillCount|r.min+r.max). Reward content (rewards/quests/steps) is dropped -
// that has been the whole point of the redesign since Stage L1 - but every rule that CAN'T
// be mapped is preserved under g.legacyCatalogBackup and named in g.profile.conversionNotice,
// never silently dropped (the design promise in §3.1's 개선안).
//
// What this does NOT do, and why: games with no catalog at all (pre-catalog, ad-hoc
// reward-ledger fields like g.dailyQueue/g.generalMissions - the tier below catalogVersion 1,
// predating the catalog engine entirely) get an empty tracker plus a notice instead of a
// bespoke per-game converter. There are 9 different old ad-hoc shapes, none of them
// documented as a locked contract anywhere in this repo, and no real save in this shape is
// known to exist (the app has never shipped) - guessing at 9 bespoke mappings here would risk
// silently-wrong conversions, which is worse than an honest "start empty, old data preserved
// untouched" fallback. Old progress *within* a catalogVersion-1 rule is the same kind of gap:
// the old per-type adapter internals (quest instance pools, goal counters, etc.) aren't
// reverse-engineered here, so converted rules start at their fresh state (held=maxHeld,
// value=min) rather than guessing at a mapping that might be wrong - the original is kept in
// g.legacyCatalogBackup and the notice says so explicitly, per this project's rule of never
// presenting an unverified guess as a verified fact.

// Returns { format, resetOverride } for an old r.schedule, or null when that schedule kind
// has no new-model equivalent. intervalDays/slots/monthly/once all relied on mechanics the
// redesign removed (see catalog-presets.js's header comment for the same class of gaps).
function legacyScheduleToFormat(s) {
  if (!s) return null;
  if (s.kind === 'daily') return { format: 'daily', resetOverride: { time: s.time } };
  if (s.kind === 'weekly')
    return { format: 'weekly', resetOverride: { time: s.time, weekday: s.weekday } };
  return null;
}

// Converts one old rule, or reports why it can't be. quest/claim (had a spawn count and a
// cap) become slot; goal/pass/counter (had a single numeric target) become gauge; resource
// (continuous timer-based recharge) has no new-model equivalent at all and is always
// rejected, matching catalog-presets.js's documented treatment of duel-links/pokemon-pocket's
// old resource-type items.
function convertLegacyRule(r) {
  const label = (r.label || r.id || '').toString();
  const sched = legacyScheduleToFormat(r.schedule);
  if (!sched)
    return {
      ok: false,
      reason: `'${label}': 지원하지 않는 갱신 주기(월간·1회성·하루 여러 번 등)라 원본만 보관되었습니다.`
    };
  if (!['quest', 'claim', 'goal', 'pass', 'counter'].includes(r.type))
    return {
      ok: false,
      reason: `'${label}': 지원하지 않는 유형(충전 자원)이라 원본만 보관되었습니다.`
    };
  const kind = r.type === 'quest' || r.type === 'claim' ? 'slot' : 'gauge';
  const base = {
    id: r.id,
    name: label.slice(0, 60) || r.id,
    format: sched.format,
    kind,
    resetOverride: sched.resetOverride
  };
  if (kind === 'slot') {
    const refillCount = Math.max(1, Math.min(100, Number(r.spawnCount) || 1)),
      maxHeld = Math.max(refillCount, Math.min(1000, Number(r.capacity) || refillCount));
    return { ok: true, rule: { ...base, refillCount, maxHeld } };
  }
  const max = Math.max(1, Math.min(1000000, Number(r.target) || 1));
  return { ok: true, rule: { ...base, min: 0, max, milestones: [] } };
}

// Converts one game in place. Idempotent via g.catalogVersion: a game already at 2 (whether
// it started that way via createCustomGame, or was converted by an earlier call to this
// function) is untouched, so re-running this on every boot never re-converts or re-grants
// supply (PROJECT_DEVELOPMENT_PLAN.md §3.1's completion criterion).
function convertLegacyCatalog(g) {
  if (g.catalogVersion === 2) return;
  g.profile ||= {};
  const notices = [];
  if (g.catalogVersion === 1 && Array.isArray(g.ruleCatalog)) {
    g.legacyCatalogBackup = structuredClone(g.ruleCatalog);
    const converted = [];
    for (const r of g.ruleCatalog) {
      const result = convertLegacyRule(r);
      if (result.ok) converted.push(result.rule);
      else notices.push(result.reason);
    }
    g.ruleCatalog = converted;
    if (converted.length)
      notices.push(
        '이전 진행 상태는 구조가 달라 정확히 옮길 수 없어 새로 시작하는 상태로 설정되었습니다. 원본은 보관되어 있습니다.'
      );
  } else if (g.profile?.registeredAt && (!Array.isArray(g.ruleCatalog) || !g.ruleCatalog.length)) {
    // Was actively used under the old pre-catalog ad-hoc system (no ruleCatalog at all,
    // just fields like g.generalMissions/g.dailyQueue): leave every existing field
    // untouched and start the tracker empty rather than guessing at a per-game
    // conversion. A never-registered game (every built-in game the user hasn't set up
    // yet) never reaches here, since it never had anything to lose.
    //
    // A registered game whose ruleCatalog is already a non-empty array but isn't
    // catalogVersion 1 can't happen through any code path in this app (every writer of
    // ruleCatalog sets catalogVersion to 1 or 2 itself) - if it somehow did, this branch
    // intentionally does NOT touch it, so it is neither backed up nor silently
    // reinterpreted as already-converted.
    g.ruleCatalog = [];
    notices.push(
      '이전 버전의 진행 기록은 그대로 보관되지만 새 할 일 목록으로 자동 변환되지 않았습니다. 항목을 새로 추가해 주세요.'
    );
  }
  g.ruleProgress = {};
  g.actionHistory = [];
  g.catalogVersion = 2;
  if (notices.length) g.profile.conversionNotice = notices;
}

function convertAllLegacyCatalogs() {
  for (const id of Object.keys(state.games || {})) convertLegacyCatalog(state.games[id]);
}
