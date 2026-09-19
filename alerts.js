function fullEvents(id) {
  if (catalogEnabled(id)) {
    const g = state.games[id];
    return catalogRules(g)
      .filter(r => r.type === 'resource' && ruleProgress(g, r).value === r.capacity)
      .map(r => 'resource/' + r.id + '/' + ruleProgress(g, r).clock);
  }
  const o = rewardOwner(id);
  if (id === 'duel-links' && o.normalDuelists === 10) return [`duelists/${o.fullCycle || 0}`];
  if (id === 'pokemon-pocket')
    return [
      ['freePacks', 2, 'lastPackRecoveryAt'],
      ['getChallengePoints', 5, 'lastChallengeRecoveryAt']
    ]
      .filter(([k, max]) => o[k] === max)
      .map(([k, , time]) => `${k}/${o[time]}`);
  return [];
}
function acknowledge(id) {
  const p = state.games[id].profile;
  p.ack ||= [];
  for (const key of p.pendingAlerts || []) if (!p.ack.includes(key)) p.ack.push(key);
  p.pendingAlerts = [];
}
function updateAlerts(id) {
  const g = state.games[id],
    p = g.profile;
  if (!p.registeredAt) return;
  const day = dailyPeriod(id),
    week = weeklyPeriod(id),
    slot = id === 'snap' ? snapSlot() : day;
  const reset = `reset/${slot}/${week}`;
  p.pendingAlerts ||= [];
  p.ack ||= [];
  const push = key => {
    if (!p.ack.includes(key) && !p.pendingAlerts.includes(key)) p.pendingAlerts.push(key);
  };
  const resetKey =
    id === 'kards' || catalogEnabled(id)
      ? `reset/${catalogRules(g)
          .map(r => r.id + ':' + rulePeriod(g, r))
          .join('/')}`
      : reset;
  if (p.alerts.reset && p.lastAlertPeriod !== undefined && p.lastAlertPeriod !== resetKey)
    push(resetKey);
  p.lastAlertPeriod = resetKey;
  if (p.alerts.full) fullEvents(id).forEach(push);
  if (!p.alerts.reset) p.pendingAlerts = p.pendingAlerts.filter(x => !x.startsWith('reset/'));
  if (!p.alerts.full) p.pendingAlerts = p.pendingAlerts.filter(x => x.startsWith('reset/'));
  if (p.mutedUntil > Date.now()) acknowledge(id);
}
let lastAlarmSound = 0,
  alarmCursor = 0;
function playAlarm() {
  const pending = GAMES.filter(([id]) => state.games[id].profile.pendingAlerts?.length);
  if (!pending.length || Date.now() - lastAlarmSound < 30000) return;
  lastAlarmSound = Date.now();
  const [id, name] = pending[alarmCursor++ % pending.length];
  if (window.deckroom) window.deckroom.alarm(name);
  else {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) {
        const c = new Audio(),
          osc = c.createOscillator(),
          gain = c.createGain();
        gain.gain.value = 0.1;
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.25);
        osc.onended = () => c.close();
      }
    } catch {}
  }
  toast(`${name} · 알림 확인 필요`);
}
