// Stage L1 (2026-09-19, tracker redesign): every game used to be created through the same
// empty-catalog wizard (setup.js) - the old reward-bearing preset generator (presetCatalog,
// importCatalogGame, and the presetSchedule/presetRule/presetQuest/presetGoal/presetPass
// builders it used) was removed since it only ever fired for the retired reward schema.
// See TODO_TRACKER_REDESIGN.md and REGRESSION_TEST_COVERAGE.md's 2026-09-19 재후속 section.
//
// Stage L3 (2026-09-20): reintroduced presets as pure structure, no reward content. Every
// number below (refillCount/maxHeld/gauge range/milestones) and every reset hour/weekday
// is mined from what the old fixed tabs actually did (schedules.js's RESET_SCHEDULES, and
// the pre-cleanup catalog-presets.js recovered from git history at commit f13b02c^). What
// does NOT appear here is exactly what could not survive the new slot/gauge model:
// - Any rule whose count was *derived* from other rules via the retired `links` mechanic
//   (Duel Links' "모든 주간 미션 완료", Pokemon Pocket's "일일 달성 보상") is dropped -
//   without auto-linking it would just be a second counter the user has to click by hand.
// - Might & Magic's `MIGHT_WEEKS` one-time event track and Master Duel's dice-rally/shop
//   content used the old 'once' schedule tied to specific already-past dates - that's
//   one-off event data, not a reusable template, so it's left out entirely (the user can
//   add a 지정 기간 rule by hand for a real event with real dates).
// - Master Duel's monthly login cap (30/month) has no equivalent - there is no monthly
//   format - so its login item here is a plain daily slot with the cap dropped.
//
// Stage D (2026-09-22): `format:'interval'` (매 N시간마다 갱신, PROJECT_DEVELOPMENT_PLAN.md
// §5's "하루 여러 번 공급" case, requested directly by the user) lets three more old items
// come back as an *exact* structural match instead of an approximation or an exclusion:
// - Snap's daily items actually refresh 3x/day at 04:00/12:00/20:00 KST (the old 'slots'
//   schedule kind) - previously approximated as one daily refill sized for a full day's
//   yield; now `interval`+anchorTime:'04:00'+intervalMinutes:480 reproduces the real cadence.
// - Pokemon Pocket's "무료 팩"/"챌린지 파워" and Duel Links' "일반 듀얼리스트" were `resource`
//   type (continuous recharge up to a cap - packs/challenge power +1 every 12 hours per the
//   old alerts.js capacities of 2 and 5, duelists +1 every 30 minutes up to 10) - all three
//   are plain slots on an interval now (intervalMinutes 720/720/30). This trades an exact
//   per-player countdown for a plain rising count anchored to a fixed clock (the user only
//   sees how many of the cap they currently have, not exactly when the next one lands) -
//   the explicit tradeoff requested: simpler than a real timer, still answers "is it full".
const CATALOG_PRESETS = [
  'mtga',
  'hearthstone',
  'might-magic',
  'shadowverse',
  'master-duel',
  'snap',
  'duel-links',
  'pokemon-pocket'
];

function trackerSlotRule(id, name, format, refillCount, maxHeld, extra = {}) {
  return { id, name, format, kind: 'slot', refillCount, maxHeld, resetOverride: null, ...extra };
}
function trackerGaugeRule(id, name, format, max, milestones = [], extra = {}) {
  return {
    id,
    name,
    format,
    kind: 'gauge',
    min: 0,
    max,
    milestones,
    resetOverride: null,
    ...extra
  };
}

// The game-level {dailyTime, weeklyDay} every non-override rule in presetTrackerRules(id)
// assumes, mined from RESET_SCHEDULES. Games with no daily or no weekly reset at all
// (duel-links has no daily; kards/master-duel/pokemon-pocket have no generic weekly) get
// an unused placeholder, since g.resetSchedule always needs both fields but no rule below
// references the unused half.
function presetTrackerReset(id) {
  const s = RESET_SCHEDULES[id];
  const hour = s.daily ?? s.weekly?.hour ?? 0;
  return { time: String(hour).padStart(2, '0') + ':00', weekday: s.weekly?.day ?? 0 };
}

function presetTrackerRules(id) {
  if (id === 'kards')
    return [
      trackerSlotRule('daily', '일일 퀘스트', 'daily', 1, 3),
      trackerSlotRule('free', '일일 무료 카드', 'daily', 1, 1),
      trackerSlotRule('chest', '주간 보상 상자', 'weekly', 1, 1, {
        // PROJECT_DEVELOPMENT_PLAN.md §3.4/§7.2: RESET_SCHEDULES.kards.weekly is null (KARDS
        // has no generic weekly reset), so presetTrackerReset() falls back to weekday 0 -
        // contradicting this project's own worked example (TODO_TRACKER_REDESIGN.md §5.1),
        // which says Wednesday. Pinned here via override instead of changing
        // presetTrackerReset()'s fallback, so it affects only this rule, not every future
        // game whose RESET_SCHEDULES entry happens to lack a weekly slot.
        resetOverride: { weekday: 3, time: '09:00' }
      })
    ];
  if (id === 'mtga')
    return [
      trackerSlotRule('daily', '일일 퀘스트', 'daily', 1, 3),
      trackerGaugeRule('daily-win', '일일 승리 보너스', 'daily', 15),
      trackerGaugeRule('weekly-win', '주간 승리 보너스', 'weekly', 15)
    ];
  if (id === 'hearthstone')
    return [
      trackerSlotRule('daily', '일일 퀘스트', 'daily', 1, 3),
      trackerSlotRule('weekly', '주간 퀘스트', 'weekly', 3, 3),
      trackerSlotRule('brawl', '선술집 난투', 'weekly', 1, 1)
    ];
  if (id === 'might-magic')
    return [
      trackerSlotRule('daily', '일일 퀘스트', 'daily', 1, 3),
      trackerSlotRule('heroes', '히어로즈 일일', 'daily', 1, 1),
      trackerSlotRule('weekly', '주간 퀘스트', 'weekly', 3, 3),
      trackerSlotRule('login', '접속 보상', 'daily', 1, 1, { resetOverride: { time: '04:40' } })
    ];
  if (id === 'shadowverse')
    return [
      trackerSlotRule('daily', '일일 퀘스트', 'daily', 3, 3),
      trackerSlotRule('park-daily', '파크 일일', 'daily', 2, 2),
      trackerSlotRule('park-weekly', '파크 주간', 'weekly', 6, 6),
      trackerGaugeRule('park-points', '파크 주간 보상', 'weekly', 100, [20, 40, 60, 80, 100])
    ];
  if (id === 'master-duel')
    return [
      trackerSlotRule('daily', '일일 퀘스트', 'daily', 3, 9),
      trackerSlotRule('login', '로그인', 'daily', 1, 1)
    ];
  if (id === 'duel-links')
    return [
      trackerSlotRule('weekly', '주간 미션', 'weekly', 6, 6),
      trackerSlotRule('duelists', '일반 듀얼리스트', 'interval', 1, 10, {
        anchorTime: '00:00',
        intervalMinutes: 30
      })
    ];
  if (id === 'snap')
    return [
      trackerSlotRule('missions', '일반 임무', 'interval', 2, 6, {
        anchorTime: '04:00',
        intervalMinutes: 480
      }),
      trackerGaugeRule('weekly', '주간 도전', 'weekly', 25, [5, 10, 15, 20, 25]),
      trackerSlotRule('free-credit', '무료 크레딧', 'daily', 1, 1),
      trackerSlotRule('free-token', '무료 컬렉터 토큰', 'daily', 1, 1),
      trackerSlotRule('web', '웹 무료 크레딧', 'daily', 1, 1)
    ];
  if (id === 'pokemon-pocket')
    return [
      trackerSlotRule('daily', '일일 미션', 'daily', 7, 7),
      trackerSlotRule('free-pack', '무료 팩', 'interval', 1, 2, {
        anchorTime: '00:00',
        intervalMinutes: 720
      }),
      trackerSlotRule('challenge-power', '챌린지 파워', 'interval', 1, 5, {
        anchorTime: '00:00',
        intervalMinutes: 720
      })
    ];
  return [];
}

function syncGame(id, now = new Date()) {
  const g = state.games[id];
  if (!g?.profile?.registeredAt) return;
  syncCatalog(g, now);
}
