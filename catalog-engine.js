// Track 1 (engine/data). Contract consumed by Track 2's catalog-view.js/catalog-editor.js
// is locked in TODO_TRACKER_REDESIGN.md §10 — keep this file's public shapes in sync with it.
const CATALOG_KINDS = { slot: '슬롯형', gauge: '게이지형' };
const CATALOG_FORMATS = { daily: '일일', weekly: '주간', fixed: '지정 기간' };

// Every game is a tracker/catalog game now — no more legacy per-game screens to fall
// back to. Kept as a function (not inlined at call sites) since manager.js/alerts.js/
// refresh-scheduler.js/catalog-presets.js (outside Track 1's file list) still call it.
function catalogEnabled() {
  return true;
}

function dateOnlyMs(dateStr) {
  return Date.parse(dateStr.length === 10 ? dateStr + 'T00:00:00+09:00' : dateStr);
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
  const isoDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s));
  for (const r of rules) {
    if (!validId(r.id) || ids.has(r.id)) throw Error('규칙 ID가 중복되거나 올바르지 않습니다.');
    ids.add(r.id);
    if (!r.name?.trim()) throw Error('항목 이름을 입력하세요.');
    if (!CATALOG_FORMATS[r.format]) throw Error('포맷을 확인하세요(일일/주간/지정 기간).');
    if (!CATALOG_KINDS[r.kind]) throw Error('형태를 확인하세요(슬롯형/게이지형).');
    if (r.resetOverride != null) {
      if (typeof r.resetOverride !== 'object' || !time(r.resetOverride.time))
        throw Error('리셋 시각 재지정을 확인하세요.');
      if (r.format === 'weekly' && !num(r.resetOverride.weekday, 0, 6))
        throw Error('리셋 요일 재지정을 확인하세요.');
    }
    if (r.format === 'fixed') {
      if (!isoDate(r.startDate) || !isoDate(r.endDate) || Date.parse(r.startDate) >= Date.parse(r.endDate))
        throw Error('지정 기간의 시작·종료일을 확인하세요.');
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

// Returns an opaque, monotonically increasing "period index" for daily/weekly rules
// (KST day-boundary math via periodAt, defined in game-config.js). Fixed-format rules
// have no recurring period and always return null.
function rulePeriod(g, r, now = new Date()) {
  if (r.format === 'fixed') return null;
  const sched = ruleResetSchedule(g, r),
    [h, m] = sched.time.split(':').map(Number),
    day = periodAt(h, m, now);
  return r.format === 'daily' ? day : day - ((((day + 4 - sched.weekday) % 7) + 7) % 7);
}

function ruleScheduleText(g, r) {
  if (r.format === 'fixed') return `지정 기간 ${r.startDate} ~ ${r.endDate}`;
  const sched = ruleResetSchedule(g, r);
  return r.format === 'daily'
    ? `매일 ${sched.time} KST`
    : `${['일', '월', '화', '수', '목', '금', '토'][sched.weekday]}요일 ${sched.time} KST`;
}

function ruleStarted(r, now = Date.now()) {
  return r.format !== 'fixed' || !r.startDate || dateOnlyMs(r.startDate) <= now;
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
      p.ended = dateOnlyMs(r.endDate) <= now.getTime();
      continue;
    }
    const period = rulePeriod(g, r, now),
      fresh = p.period === undefined,
      elapsed = fresh ? 1 : Math.max(0, Math.floor((period - p.period) / (r.format === 'weekly' ? 7 : 1)));
    if (fresh || elapsed) {
      if (r.kind === 'slot') p.held = Math.min(r.maxHeld, p.held + elapsed * r.refillCount);
      else {
        p.value = r.min;
        p.achievedMilestones = [];
      }
      p.period = period;
    }
  }
  if (g.pass && g.pass.endDate && now.getTime() >= dateOnlyMs(g.pass.endDate)) g.pass.active = false;
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
      if (entry.kind === 'slot') p.held = Math.max(0, Math.min(r.maxHeld, p.held + entry.delta));
      else p.value = Math.max(r.min, Math.min(r.max, p.value - entry.delta));
      return true;
    }
    const r = catalogRules(g).find(x => x.id === ruleId);
    if (!r) return false;
    const p = ruleProgress(g, r);
    if (!ruleStarted(r)) return false;
    if (action === 'complete') {
      if (r.kind !== 'slot' || p.held <= 0) return false;
      p.held -= 1;
      pushActionHistory(g, { ruleId, kind: 'slot', delta: 1, at: Date.now() });
      return true;
    }
    if (action === 'increment') {
      if (r.kind !== 'gauge' || p.value >= r.max) return false;
      p.value += 1;
      p.achievedMilestones ||= [];
      for (const m of r.milestones || [])
        if (p.value >= m && !p.achievedMilestones.includes(m)) p.achievedMilestones.push(m);
      pushActionHistory(g, { ruleId, kind: 'gauge', delta: 1, at: Date.now() });
      return true;
    }
    if (action === 'manual-add') {
      if (r.kind !== 'slot' || p.held >= r.maxHeld) return false;
      p.held += 1;
      return true;
    }
    if (action === 'manual-remove') {
      if (r.kind !== 'slot' || p.held <= 0) return false;
      p.held -= 1;
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

// count = number of rules with real remaining work (foldTarget never affects this,
// only the true slot/gauge completion state does — Stage K2's principle, carried over).
function universalStatus(g) {
  let count = 0,
    urgent = false;
  for (const r of catalogRules(g)) {
    const p = ruleProgress(g, r);
    if (r.format === 'fixed' && p.ended) continue;
    const remaining = r.kind === 'slot' ? p.held > 0 : p.value < r.max;
    if (!remaining) continue;
    count++;
    if (r.kind === 'slot' && p.held >= r.maxHeld) urgent = true;
  }
  return { color: urgent ? 'urgent' : count ? 'pending' : 'done', label: count ? '!' : '✓', count };
}
