// Only the visible countdown ticks every second. Rules run at their next boundary.
let nextRefreshAt = 0,
  lastRefreshClock = 0,
  refreshViewPending = false;
const scheduledAlertInputs = new WeakMap();
function alertScheduleInput(g) {
  return [
    g.profile.alerts.reset,
    g.profile.alerts.full,
    g.profile.mutedUntil,
    ...catalogRules(g).map(
      r =>
        r.id +
        ':' +
        (r.format === 'fixed' ? (ruleProgress(g, r).ended ? 'ended' : 'active') : rulePeriod(g, r))
    )
  ].join('|');
}
// Fixed-format rules have no recurring boundary; their only future event is the end date.
function nextRuleBoundary(g, r, now = new Date()) {
  if (r.format === 'fixed') return endMomentMs(r);
  const sched = ruleResetSchedule(g, r),
    period = rulePeriod(g, r, now),
    [h, m] = sched.time.split(':').map(Number);
  return (period + (r.format === 'weekly' ? 7 : 1)) * DAY_MS + (h - 9) * HOUR_MS + m * 60000;
}
function rebuildRefreshDeadline(now = new Date()) {
  const at = now.getTime();
  let next = (periodAt(0, 0, now) + 1) * DAY_MS - 9 * HOUR_MS;
  const consider = value => {
    if (Number.isFinite(value) && value > at) next = Math.min(next, value);
  };
  for (const [id] of GAMES) {
    const g = state.games[id];
    if (!g?.profile?.registeredAt) continue;
    if (scheduledAlertInputs.get(g) !== alertScheduleInput(g)) next = at;
    if (g.pass?.active && g.pass.endDate && dateOnlyMs(g.pass.endDate) <= at) next = at;
    consider(g.profile.mutedUntil);
    if (g.pass?.endDate) consider(dateOnlyMs(g.pass.endDate));
    for (const r of catalogRules(g)) {
      const p = ruleProgress(g, r);
      if (r.format !== 'fixed' && (p.period === undefined || rulePeriod(g, r, now) > p.period))
        next = at;
      consider(nextRuleBoundary(g, r, now));
      if (r.format === 'fixed') consider(dateOnlyMs(r.startDate));
    }
  }
  nextRefreshAt = next;
  lastRefreshClock = at;
}
function synchronizeScheduledGames(force = false) {
  const now = Date.now(),
    uninitialized = GAMES.some(
      ([id]) => state.games[id]?.profile?.registeredAt && !catalogEnabled(id)
    );
  const boundaryReached = now >= nextRefreshAt || now < lastRefreshClock;
  if (!force && !uninitialized && now >= lastRefreshClock && now < nextRefreshAt) {
    lastRefreshClock = now;
    return false;
  }
  const before = JSON.stringify(state.games);
  try {
    for (const [id] of GAMES) {
      syncGame(id);
      updateAlerts(id);
      const g = state.games[id];
      if (g.profile.registeredAt && catalogEnabled(id))
        scheduledAlertInputs.set(g, alertScheduleInput(g));
    }
    const changed = before !== JSON.stringify(state.games);
    if (changed) save({ deferRefreshDeadline: true });
    rebuildRefreshDeadline();
    return changed || boundaryReached;
  } catch (error) {
    nextRefreshAt = 0;
    throw error;
  }
}
