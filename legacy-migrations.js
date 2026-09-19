// Stage L1 (2026-09-19, tracker redesign): this file used to normalize the 9 built-in
// games' pre-catalog-engine save shapes (snap/might/mtga/kards/master-duel/duel-links/
// pokemon-pocket/shadowverse) so old localStorage saves could be migrated forward. Its
// entry point, syncLegacyGame(), was only ever called from the branch of
// catalog-presets.js's syncGame() that ran when catalogEnabled(id) was false - and
// catalogEnabled() now always returns true (every game is a tracker game), so that branch,
// and everything this file did, was unreachable dead code even before this cleanup.
//
// The tracker redesign's own decision on old saves (TODO_TRACKER_REDESIGN.md §2.3-5) is a
// schema *conversion*, not a reward-preserving migration - so the old rationale for
// keeping these helpers ("do not remove based on UI reachability alone", written when
// this file still bridged real save data) no longer applies. See
// REGRESSION_TEST_COVERAGE.md's 2026-09-19 재후속 section for what was checked before
// deleting this file's contents.
