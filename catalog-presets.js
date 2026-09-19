// Stage L1 (2026-09-19, tracker redesign): every game is now a tracker game created
// through the same empty-catalog wizard (setup.js) - there is no more "preset" content
// to seed. This file used to generate reward-bearing rule catalogs for the 9 built-in
// games and migrate old per-game saves into them; that entire chain (presetCatalog,
// importCatalogGame, and the presetSchedule/presetRule/presetQuest/presetGoal/presetPass
// builders it used) is gone, since it only ever fired for the retired reward schema. See
// TODO_TRACKER_REDESIGN.md and REGRESSION_TEST_COVERAGE.md's 2026-09-19 재후속 section.
//
// CATALOG_PRESETS is kept (list only, no generator behind it) because setup.js's
// createCustomGame() still uses it to decide whether an existing built-in id may be
// reused for a not-yet-registered game.
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
function syncGame(id, now = new Date()) {
  const g = state.games[id];
  if (!g?.profile?.registeredAt) return;
  syncCatalog(g, now);
}
