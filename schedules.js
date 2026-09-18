// User-supplied reset schedule. KST is UTC+09:00 without daylight saving time.
const RESET_SCHEDULES = {
  kards: { daily: 9, weekly: null },
  mtga: { daily: 18, weekly: { day: 0, hour: 18 } },
  snap: { daily: 4, slots: [4, 12, 20], weekly: { day: 3, hour: 4 } },
  'might-magic': { daily: 1, weekly: { day: 2, hour: 1 } },
  shadowverse: { daily: 5, weekly: { day: 1, hour: 5 } },
  hearthstone: { daily: 1, weekly: { day: 1, hour: 1 } },
  'master-duel': { daily: 3, weekly: null },
  'duel-links': { daily: null, weekly: { day: 1, hour: 3 } },
  'pokemon-pocket': { daily: 15, weekly: null }
};
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
function dailyPeriod(gameId, now = new Date()) {
  const hour = RESET_SCHEDULES[gameId]?.daily;
  return hour == null ? null : Math.floor((now.getTime() + (9 - hour) * HOUR_MS) / DAY_MS);
}
function weeklyPeriod(gameId, now = new Date()) {
  const weekly = RESET_SCHEDULES[gameId]?.weekly;
  if (!weekly) return null;
  const day = Math.floor((now.getTime() + (9 - weekly.hour) * HOUR_MS) / DAY_MS);
  return day - ((day + 4 - weekly.day) % 7 + 7) % 7;
}
function kstDateKey(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * HOUR_MS);
  return `${kst.getUTCFullYear()}-${kst.getUTCMonth() + 1}-${kst.getUTCDate()}`;
}
// On migration, establish the current period without erasing existing progress.
function advancePeriod(owner, field, period, reset) {
  if (period == null) return;
  if (owner[field] === undefined) { owner[field] = period; return; }
  if (period > owner[field]) { reset(); owner[field] = period; }
}
function scheduleLabel(gameId) {
  const schedule = RESET_SCHEDULES[gameId];
  const time = (hour) => `${String(hour).padStart(2, '0')}:00`;
  const daily = schedule.dailyUnknown ? '일일 시각 미확인 · 수동 갱신' : schedule.slots ? schedule.slots.map(time).join(' / ') : schedule.daily == null ? '정규 일일 퀘스트 없음' : `매일 ${time(schedule.daily)}`;
  return `한국 시간(KST) · 일일 갱신 ${daily}`;
}
