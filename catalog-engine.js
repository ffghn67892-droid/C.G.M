// Track 1 (engine/data). Contract consumed by Track 2's catalog-view.js/catalog-editor.js
// is locked in TODO_TRACKER_REDESIGN.md §10 — keep this file's public shapes in sync with it.
const CATALOG_KINDS = { slot: '슬롯형', gauge: '게이지형' };
const CATALOG_FORMATS = {
  daily: '일일',
  weekly: '주간',
  fixed: '지정 기간',
  interval: '시간 간격'
};

// Every game is a tracker/catalog game now — no more legacy per-game screens to fall
// back to. Kept as a function (not inlined at call sites) since manager.js/alerts.js/
// refresh-scheduler.js/catalog-presets.js (outside Track 1's file list) still call it.
function catalogEnabled() {
  return true;
}

function dateOnlyMs(dateStr) {
  return Date.parse(dateStr.length === 10 ? dateStr + 'T00:00:00+09:00' : dateStr);
}

// A fixed-period rule's end moment is never assumed (e.g. "always midnight") - the user
// types the exact KST time themselves (endDate + endTime), so there is no ambiguity
// between "ends at the start of endDate" and "ends at the end of endDate".
function endMomentMs(r) {
  return Date.parse(`${r.endDate}T${r.endTime}:00+09:00`);
}

function validateCatalog(rules) {
  if (!Array.isArray(rules) || rules.length > 100) throw Error('규칙은 0~100개로 설정하세요.');
  const ids = new Set(),
    validId = id =>
      typeof id === 'string' &&
      /^[\w-]+$/.test(id) &&
      !['__proto__', 'constructor', 'prototype'].includes(id);
  const num = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
  const time = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const isoDate = s =>
    typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s));
  for (const r of rules) {
    if (!validId(r.id) || ids.has(r.id)) throw Error('규칙 ID가 중복되거나 올바르지 않습니다.');
    ids.add(r.id);
    if (!r.name?.trim()) throw Error('항목 이름을 입력하세요.');
    if (!CATALOG_FORMATS[r.format])
      throw Error('포맷을 확인하세요(일일/주간/지정 기간/시간 간격).');
    if (!CATALOG_KINDS[r.kind]) throw Error('형태를 확인하세요(슬롯형/게이지형).');
    if (r.resetOverride != null) {
      if (typeof r.resetOverride !== 'object' || !time(r.resetOverride.time))
        throw Error('리셋 시각 재지정을 확인하세요.');
      if (r.format === 'weekly' && !num(r.resetOverride.weekday, 0, 6))
        throw Error('리셋 요일 재지정을 확인하세요.');
    }
    if (r.format === 'fixed') {
      if (
        !isoDate(r.startDate) ||
        !isoDate(r.endDate) ||
        !time(r.endTime) ||
        endMomentMs(r) <= dateOnlyMs(r.startDate)
      )
        throw Error('지정 기간의 시작일·종료일·종료 시각을 확인하세요.');
    }
    if (r.format === 'interval') {
      if (!time(r.anchorTime) || !num(r.intervalMinutes, 1, 10080))
        throw Error('기준 시각과 갱신 간격(1분~7일)을 확인하세요.');
    }
    if (r.kind === 'slot') {
      if (!num(r.refillCount, 1, 100) || !num(r.maxHeld, 1, 1000) || r.refillCount > r.maxHeld)
        throw Error('갱신 수와 최대 보유 수를 확인하세요.');
    } else {
      if (!num(r.min, 0, 999999) || !num(r.max, 1, 1000000) || r.max <= r.min)
        throw Error('게이지 범위를 확인하세요.');
      if (
        r.milestones !== undefined &&
        (!Array.isArray(r.milestones) ||
          r.milestones.length > 50 ||
          r.milestones.some(x => !num(x, r.min, r.max)) ||
          new Set(r.milestones).size !== r.milestones.length)
      )
        throw Error('마일스톤 값을 확인하세요.');
    }
  }
  return rules;
}

// g.ruleCatalog is the array of rule definitions (validated by validateCatalog above).
function catalogRules(g) {
  return g.ruleCatalog || [];
}

// g.ruleProgress[ruleId] holds mutable per-rule progress; no per-game adapter indirection anymore.
function ruleProgress(g, r) {
  g.ruleProgress ||= {};
  const p = (g.ruleProgress[r.id] ||= {});
  if (r.kind === 'slot' && p.held === undefined) p.held = 0;
  if (r.kind === 'gauge' && p.value === undefined) p.value = r.min;
  return p;
}

function ruleResetSchedule(g, r) {
  if (r.resetOverride) return r.resetOverride;
  return r.format === 'weekly'
    ? { weekday: g.resetSchedule.weeklyDay, time: g.resetSchedule.dailyTime }
    : { time: g.resetSchedule.dailyTime };
}

// r.format:'interval' rules never inherit g.resetSchedule - anchorTime/intervalMinutes are
// self-contained on the rule, generalizing periodAt's day-boundary math (game-config.js)
// to any cadence. Minutes (not hours) so sub-hour recharges - e.g. Duel Links' real 30-
// minute duelist recovery - are exact integers rather than a fraction of an hour (e.g.
// Snap's real 04:00/12:00/20:00 KST reset is anchorTime:'04:00', intervalMinutes:480).
// Divides consecutive boundaries by 1 like daily, so the elapsed-period math in
// syncUniversalCatalog below needs no changes to support it.
function intervalPeriodAt(r, now = new Date()) {
  const [h, m] = r.anchorTime.split(':').map(Number);
  return Math.floor((now.getTime() + (9 - h) * HOUR_MS - m * 60000) / (r.intervalMinutes * 60000));
}

// Returns an opaque, monotonically increasing "period index" for daily/weekly/interval
// rules (KST day-boundary math via periodAt, defined in game-config.js). Fixed-format
// rules have no recurring period and always return null.
function rulePeriod(g, r, now = new Date()) {
  if (r.format === 'fixed') return null;
  if (r.format === 'interval') return intervalPeriodAt(r, now);
  const sched = ruleResetSchedule(g, r),
    [h, m] = sched.time.split(':').map(Number),
    day = periodAt(h, m, now);
  return r.format === 'daily' ? day : day - ((((day + 4 - sched.weekday) % 7) + 7) % 7);
}

// e.g. 480 -> '8시간', 30 -> '30분', 90 -> '1시간 30분'.
function intervalLengthText(minutes) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  if (!h) return `${m}분`;
  if (!m) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function ruleScheduleText(g, r) {
  if (r.format === 'fixed') return `지정 기간 ${r.startDate} ~ ${r.endDate} ${r.endTime} KST`;
  if (r.format === 'interval')
    return `${r.anchorTime} 기준 매 ${intervalLengthText(r.intervalMinutes)}마다 KST`;
  const sched = ruleResetSchedule(g, r);
  return r.format === 'daily'
    ? `매일 ${sched.time} KST`
    : `${['일', '월', '화', '수', '목', '금', '토'][sched.weekday]}요일 ${sched.time} KST`;
}

function ruleStarted(r, now = Date.now()) {
  return r.format !== 'fixed' || !r.startDate || dateOnlyMs(r.startDate) <= now;
}

// A rule's "value signature" for revision bumps (PROJECT_DEVELOPMENT_PLAN.md §7.2): only
// fields that change what the rule actually does count. Name, array order and foldTarget
// (a ruleProgress field, never part of r) never bump this.
function ruleRevisionKey(r) {
  return JSON.stringify([
    r.format,
    r.refillCount,
    r.maxHeld,
    r.min,
    r.max,
    r.milestones,
    r.startDate,
    r.endDate,
    r.endTime,
    r.resetOverride,
    r.anchorTime,
    r.intervalMinutes
  ]);
}

// Period rollover: slot refills by refillCount per elapsed period (clamped to maxHeld,
// leftover held carries over — never reset to 0). Gauge resets to min and clears
// achievedMilestones each period (foldTarget is a standing preference and is never
// touched here). Fixed-format rules never reset; only their `ended` flag is (re)computed.
function syncUniversalCatalog(g, now = new Date()) {
  g.ruleProgress ||= {};
  for (const r of catalogRules(g)) {
    const p = ruleProgress(g, r);
    if (r.format === 'fixed') {
      p.ended = endMomentMs(r) <= now.getTime();
      continue;
    }
    const period = rulePeriod(g, r, now),
      fresh = p.period === undefined,
      elapsed = fresh
        ? 1
        : Math.max(0, Math.floor((period - p.period) / (r.format === 'weekly' ? 7 : 1)));
    if (fresh || elapsed) {
      if (r.kind === 'slot') p.held = Math.min(r.maxHeld, p.held + elapsed * r.refillCount);
      else {
        p.value = r.min;
        p.achievedMilestones = [];
      }
      p.period = period;
    }
  }
  if (g.pass && g.pass.endDate && now.getTime() >= dateOnlyMs(g.pass.endDate))
    g.pass.active = false;
  return g;
}

function pushActionHistory(g, entry) {
  g.actionHistory ||= [];
  g.actionHistory.push(entry);
  if (g.actionHistory.length > 20) g.actionHistory.shift();
}

// See TODO_TRACKER_REDESIGN.md §10 for the full action list and rationale.
function catalogAction(gameId, ruleId, action, payload = {}) {
  return runCatalogAction(gameId, g => {
    syncCatalog(g);
    if (action === 'bump-pass-level') {
      if (!g.pass) return false;
      g.pass.level = (g.pass.level || 0) + 1;
      return true;
    }
    if (action === 'undo') {
      const entry = (g.actionHistory || []).pop();
      if (!entry) return false;
      const r = catalogRules(g).find(x => x.id === entry.ruleId);
      if (!r) return true; // rule no longer exists; drop the stale history entry
      const p = ruleProgress(g, r);
      // Stale entry (rule ended, or its revision/period moved on since this click) is
      // dropped without touching progress - never guess which older entry to apply
      // instead (PROJECT_DEVELOPMENT_PLAN.md §7.2). Entries from before this contract
      // existed have no `revision`/`periodKey` and always fail this check, by design.
      if (r.format === 'fixed' && p.ended) return true;
      if (entry.revision !== (r.revision ?? 1) || entry.periodKey !== rulePeriod(g, r)) return true;
      if (entry.kind === 'slot') p.held = Math.max(0, Math.min(r.maxHeld, p.held + entry.delta));
      else p.value = Math.max(r.min, Math.min(r.max, p.value - entry.delta));
      return true;
    }
    const r = catalogRules(g).find(x => x.id === ruleId);
    if (!r) return false;
    const p = ruleProgress(g, r);
    if (!ruleStarted(r)) return false;
    const ended = r.format === 'fixed' && p.ended;
    if (action === 'complete') {
      if (r.kind !== 'slot' || p.held <= 0 || ended) return false;
      p.held -= 1;
      pushActionHistory(g, {
        ruleId,
        revision: r.revision ?? 1,
        periodKey: rulePeriod(g, r),
        kind: 'slot',
        delta: 1,
        at: Date.now()
      });
      return true;
    }
    if (action === 'increment') {
      if (r.kind !== 'gauge' || p.value >= r.max || ended) return false;
      p.value += 1;
      p.achievedMilestones ||= [];
      for (const m of r.milestones || [])
        if (p.value >= m && !p.achievedMilestones.includes(m)) p.achievedMilestones.push(m);
      pushActionHistory(g, {
        ruleId,
        revision: r.revision ?? 1,
        periodKey: rulePeriod(g, r),
        kind: 'gauge',
        delta: 1,
        at: Date.now()
      });
      return true;
    }
    // Manual add/remove don't go through actionHistory themselves (they're a "detail
    // settings" correction tool, not a click to undo), but they DO invalidate this
    // rule's prior undo entries - otherwise an old completion's delta could later
    // reapply on top of a count the user just fixed by hand (§7.2).
    if (action === 'manual-add') {
      if (r.kind !== 'slot' || p.held >= r.maxHeld) return false;
      p.held += 1;
      g.actionHistory = (g.actionHistory || []).filter(e => e.ruleId !== ruleId);
      return true;
    }
    if (action === 'manual-remove') {
      if (r.kind !== 'slot' || p.held <= 0) return false;
      p.held -= 1;
      g.actionHistory = (g.actionHistory || []).filter(e => e.ruleId !== ruleId);
      return true;
    }
    if (action === 'set-fold-target') {
      if (r.kind !== 'gauge') return false;
      if (payload.value == null) {
        delete p.foldTarget;
        return true;
      }
      if (!Number.isSafeInteger(payload.value) || payload.value < r.min || payload.value > r.max)
        return false;
      p.foldTarget = payload.value;
      return true;
    }
    if (action === 'delete-rule') {
      if (r.format !== 'fixed' || !p.ended) return false;
      g.ruleCatalog = g.ruleCatalog.filter(x => x.id !== ruleId);
      delete g.ruleProgress[ruleId];
      return true;
    }
    return false;
  });
}

// count = number of rules with real remaining work. Gauges: foldTarget (falling back
// to the true max when unset) counts as "done" here too, so the game badge agrees with
// the card's own checkmark state instead of staying "!" until a far-off true max is
// reached (2026-09-22, supersedes the old "foldTarget never affects this" rule). Weekly
// rules never count toward the badge at all: they're often gated by capped daily-refill
// progress the player can't force within the visible window, so flagging them
// urgent/pending would be structurally misleading - the cards still render normally,
// this only excludes them from the aggregate.
function universalStatus(g) {
  let count = 0,
    urgent = false;
  for (const r of catalogRules(g)) {
    if (r.format === 'weekly') continue;
    const p = ruleProgress(g, r);
    if (r.format === 'fixed' && p.ended) continue;
    const goal = r.kind === 'gauge' ? (p.foldTarget ?? r.max) : null;
    const remaining = r.kind === 'slot' ? p.held > 0 : p.value < goal;
    if (!remaining) continue;
    count++;
    if (r.kind === 'slot' && p.held >= r.maxHeld) urgent = true;
  }
  return { color: urgent ? 'urgent' : count ? 'pending' : 'done', label: count ? '!' : '✓', count };
}

// Track 2's game-settings screen calls this instead of assigning g.resetSchedule directly,
// so getting the revision-bump judgment right (PROJECT_DEVELOPMENT_PLAN.md §7.3) is never
// the UI's job. Only rules that actually inherit the changed half of the default (no
// resetOverride, not fixed-format, not interval-format - both are self-contained and
// never read g.resetSchedule) can have their effective schedule change at all.
function updateResetSchedule(gameId, { dailyTime, weeklyDay }) {
  const time = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!time(dailyTime) || !Number.isSafeInteger(weeklyDay) || weeklyDay < 0 || weeklyDay > 6)
    throw Error('리셋 시각과 요일을 확인하세요.');
  return runCatalogAction(gameId, g => {
    syncCatalog(g);
    const next = { dailyTime, weeklyDay };
    for (const r of catalogRules(g)) {
      if (r.format === 'fixed' || r.format === 'interval' || r.resetOverride) continue;
      const before = ruleResetSchedule(g, r),
        after = ruleResetSchedule({ resetSchedule: next }, r);
      if (JSON.stringify(before) !== JSON.stringify(after)) r.revision = (r.revision ?? 1) + 1;
    }
    g.resetSchedule = next;
    return true;
  });
}

// Full-fidelity export: every field of state.games round-trips through this, so a game's
// rules/progress/schedule/pass/history compare equal after export -> import -> restart
// (PROJECT_DEVELOPMENT_PLAN.md §3.7's completion criterion). Import UI itself is Stage C.
function serializeStateForExport(now = new Date()) {
  return {
    schemaVersion: state.version,
    exportedAt: now.toISOString(),
    games: structuredClone(state.games)
  };
}
