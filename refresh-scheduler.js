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
    ...catalogRules(g).map(r => r.id + ':' + rulePeriod(r)),
    ...catalogRules(g)
      .filter(r => r.type === 'resource')
      .map(r => {
        const p = ruleProgress(g, r);
        return p.value >= r.capacity ? r.id + '/' + p.clock : '';
      })
  ].join('|');
}
function nextRuleBoundary(rule, now = new Date()) {
  const s = rule.schedule,
    period = rulePeriod(rule, now);
  if (s.kind === 'once') return Infinity;
  if (s.kind === 'monthly') {
    const month = period + 1;
    return Date.UTC(Math.floor(month / 12), month % 12, 1) - 9 * HOUR_MS;
  }
  if (s.kind === 'slots') {
    const times = [...s.times].sort(),
      next = period + 1,
      day = Math.floor(next / times.length),
      [h, m] = times[next % times.length].split(':').map(Number);
    return day * DAY_MS + (h - 9) * HOUR_MS + m * 60000;
  }
  const [h, m] = s.time.split(':').map(Number);
  return (period + ruleInterval(rule)) * DAY_MS + (h - 9) * HOUR_MS + m * 60000;
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
    if (!catalogEnabled(id)) {
      next = at;
      continue;
    }
    if (scheduledAlertInputs.get(g) !== alertScheduleInput(g)) next = at;
    if (g.profile.pass.active && Date.parse(g.profile.pass.end) <= at) next = at;
    consider(g.profile.mutedUntil);
    consider(Date.parse(g.profile.pass.end));
    for (const r of catalogRules(g)) {
      const p = ruleProgress(g, r),
        previous = p.period ?? p.resetPeriod;
      if (r.type !== 'resource' && (previous === undefined || rulePeriod(r, now) > previous))
        next = at;
      consider(nextRuleBoundary(r, now));
      consider(Date.parse(r.start));
      consider(Date.parse(r.end));
      if (r.type === 'resource') {
        const p = ruleProgress(g, r);
        if (p.value < r.capacity) next = Math.min(next, p.clock + r.intervalMinutes * 60000);
      }
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
