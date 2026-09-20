const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const viewSource = fs.readFileSync(path.join(__dirname, '../catalog-view.js'), 'utf8');
const editorSource = fs.readFileSync(path.join(__dirname, '../catalog-editor.js'), 'utf8');
const { start } = require('./harness.cjs');
const escapeHtml = value =>
  String(value).replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c]
  );

// Track 2 contract tests: engine doubles deliberately do not claim migration/revision coverage.
function renderer() {
  const controls = new Map(),
    messages = [];
  let dialogClosed = false;
  const game = {
    resetSchedule: { dailyTime: '09:00', weeklyDay: 3 },
    pass: null,
    profile: { alerts: { reset: true, full: false }, spending: [] },
    ruleCatalog: [],
    ruleProgress: {}
  };
  const host = {
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: selector => control(selector)
  };
  function control(selector) {
    if (!controls.has(selector))
      controls.set(selector, {
        value: '',
        checked: false,
        disabled: false,
        textContent: '',
        addEventListener(type, fn) {
          this[type] = fn;
        },
        focus() {}
      });
    return controls.get(selector);
  }
  const context = vm.createContext({
    structuredClone,
    Blob,
    URL,
    setTimeout,
    window: {},
    state: { games: { test: game } },
    escapeHtml,
    $: selector => (selector === '#questList' ? host : control(selector)),
    document: { querySelectorAll: () => [] },
    openDialog() {},
    closeDialog() {
      dialogClosed = true;
    },
    catalogRules: g => g.ruleCatalog,
    ruleProgress: (g, r) => g.ruleProgress[r.id],
    clearQuestSummary() {},
    renderAll() {},
    field: () => '',
    spendingText: () => '',
    toast: m => messages.push(m),
    runCatalogAction(id, fn) {
      const before = structuredClone(context.state.games[id]);
      try {
        return fn(context.state.games[id]);
      } catch (error) {
        context.state.games[id] = before;
        throw error;
      }
    }
  });
  vm.runInContext(viewSource, context);
  vm.runInContext(editorSource, context);
  return {
    context,
    control,
    host,
    messages,
    get closed() {
      return dialogClosed;
    }
  };
}

test('Electron export preserves the engine envelope without mutating live state', async () => {
  const a = renderer(),
    envelope = { schemaVersion: 3, exportedAt: '2026-09-20', games: { 사용자: { held: 2 } } };
  const before = JSON.stringify(a.context.state);
  let calls = 0;
  a.context.serializeStateForExport = () => structuredClone(envelope);
  a.context.window.deckroom = {
    async saveTextFile(name, content) {
      calls++;
      assert.match(name, /^deckroom-export-\d{4}-\d{2}-\d{2}\.json$/);
      assert.deepEqual(JSON.parse(content), envelope);
      return { saved: true };
    }
  };
  assert.match(await a.context.exportTrackerData(), /저장했습니다/);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(a.context.state), before);
});

test('export button reports cancel/failure and can be retried without closing settings', async () => {
  const a = renderer();
  a.context.serializeStateForExport = () => ({ schemaVersion: 3, games: {} });
  a.context.openUniversalSettings('test');
  const button = a.control('#exportTrackerData'),
    status = a.control('#trackerExportStatus');
  for (const [result, message] of [
    [{ canceled: true }, /취소/],
    [{ error: '디스크 오류' }, /디스크 오류/],
    [{ saved: true }, /저장했습니다/]
  ]) {
    a.context.window.deckroom = { saveTextFile: async () => result };
    await button.click({ currentTarget: button });
    assert.match(status.textContent, message);
    assert.equal(button.disabled, false);
    assert.equal(a.closed, false);
  }
  a.context.serializeStateForExport = () => {
    throw Error('직렬화 실패');
  };
  await button.click({ currentTarget: button });
  assert.match(status.textContent, /직렬화 실패/);
  assert.equal(button.disabled, false);
});

test('browser export downloads a JSON Blob and releases its URL after dispatch', async () => {
  const a = renderer();
  let blob,
    release,
    clicked = 0,
    removed = 0;
  const envelope = { schemaVersion: 3, games: { test: { name: '한글' } } };
  a.context.serializeStateForExport = () => envelope;
  const link = {
    click() {
      clicked++;
    },
    remove() {
      removed++;
    }
  };
  a.context.document = { createElement: () => link, body: { appendChild() {} } };
  a.context.URL = {
    createObjectURL(value) {
      blob = value;
      return 'blob:test';
    },
    revokeObjectURL(url) {
      assert.equal(url, 'blob:test');
    }
  };
  a.context.setTimeout = fn => {
    release = fn;
  };
  assert.match(await a.context.exportTrackerData(), /다운로드를 요청/);
  assert.deepEqual(JSON.parse(await blob.text()), envelope);
  assert.equal(clicked, 1);
  assert.equal(removed, 1);
  assert.equal(link.href, 'blob:test');
  assert.match(link.download, /\.json$/);
  release();
});

function settingsInputs(a, time = '10:00', day = '4') {
  a.context.openUniversalSettings('test');
  a.control('#trackerResetTime').value = time;
  a.control('#trackerResetWeekday').value = day;
  a.control('#trackerPassActive').checked = false;
  a.control('#resetAlert').checked = false;
  a.control('#fullAlert').checked = true;
}

test('settings delegate time, weekday and unchanged schedules with one engine commit', () => {
  for (const [time, day] of [
    ['10:00', '3'],
    ['09:00', '4'],
    ['09:00', '3']
  ]) {
    const a = renderer();
    let commits = 0;
    settingsInputs(a, time, day);
    a.context.runCatalogAction = () => {
      throw Error('unexpected second save');
    };
    a.context.updateResetSchedule = (id, schedule) => {
      commits++;
      assert.equal(id, 'test');
      assert.equal(schedule.dailyTime, time);
      assert.equal(schedule.weeklyDay, Number(day));
      assert.equal(a.context.state.games.test.profile.alerts.full, true);
      a.context.state.games.test.resetSchedule = structuredClone(schedule);
      return true;
    };
    a.control('#saveUniversalSettings').click();
    assert.equal(commits, 1);
    assert.equal(a.closed, true);
  }
});

test('engine schedule failure restores all settings and leaves the dialog open', () => {
  const a = renderer(),
    before = JSON.stringify(a.context.state);
  settingsInputs(a);
  a.context.updateResetSchedule = () => {
    a.context.state.games.test.resetSchedule.dailyTime = '10:00';
    throw Error('저장 실패');
  };
  a.control('#saveUniversalSettings').click();
  assert.equal(JSON.stringify(a.context.state), before);
  assert.equal(a.closed, false);
  assert.match(a.control('#trackerSettingsError').textContent, /저장 실패/);
});

test('conversion notice escapes data, preserves its source and stays dismissed after reload', () => {
  const a = renderer(),
    g = a.context.state.games.test;
  g.profile.conversionNotice = ['<img src=x onerror=alert(1)> 항목을 보관했습니다.'];
  a.context.renderUniversalGame('test');
  assert.match(a.host.innerHTML, /&lt;img/);
  assert.doesNotMatch(a.host.innerHTML, /<img/);
  a.control('[data-dismiss-conversion]').click();
  assert.doesNotMatch(a.host.innerHTML, /data-dismiss-conversion/);
  assert.equal(g.profile.conversionNotice.length, 1);
  const b = renderer();
  b.context.state = JSON.parse(JSON.stringify(a.context.state));
  b.context.renderUniversalGame('test');
  assert.doesNotMatch(b.host.innerHTML, /data-dismiss-conversion/);
  b.context.state.games.test.profile.conversionNotice.push('새 안내');
  b.context.renderUniversalGame('test');
  assert.match(b.host.innerHTML, /새 안내/);
});

test('conversion notice tolerates missing data and remains visible after failed dismissal', () => {
  const a = renderer();
  for (const value of [undefined, null, 'invalid', [], [null, 0, '']]) {
    a.context.state.games.test.profile.conversionNotice = value;
    assert.equal(a.context.trackerConversionNotice(a.context.state.games.test), '');
  }
  a.context.state.games.test.profile.conversionNotice = ['보관된 항목'];
  a.context.renderUniversalGame('test');
  a.context.runCatalogAction = () => {
    throw Error('저장 실패');
  };
  a.control('[data-dismiss-conversion]').click();
  assert.match(a.host.innerHTML, /data-dismiss-conversion/);
  assert.equal(a.messages.at(-1), '저장 실패');
});

test('real engine persists schedule, pass and alerts together before the normal render refresh', () => {
  const a = start();
  a.run(`
    state.games.kards.resetSchedule={dailyTime:'09:00',weeklyDay:3};save();
    var writes=[], originalWrite=localStorage.setItem;
    localStorage.setItem=(key,value)=>{if(key==='deckroom-quests')writes.push(value);originalWrite(key,value);};
    openUniversalSettings('kards');
    $('#trackerResetTime').value='10:00';$('#trackerResetWeekday').value='4';
    $('#trackerPassActive').checked=true;$('#trackerPassPurchase').value='2026-09-01';
    $('#trackerPassEnd').value='2026-10-01';$('#resetAlert').checked=true;$('#fullAlert').checked=false;
    $('#saveUniversalSettings').click();
  `);
  // renderAll may subsequently save synchronized periods. No intermediate write may
  // contain a new schedule with stale pass/alert settings (or the reverse).
  const writes = JSON.parse(a.run('JSON.stringify(writes)'));
  assert.ok(writes.length >= 1);
  for (const serialized of writes) {
    const saved = JSON.parse(serialized).games.kards;
    assert.deepEqual(saved.resetSchedule, { dailyTime: '10:00', weeklyDay: 4 });
    assert.equal(saved.pass.active, true);
    assert.equal(saved.profile.alerts.reset, true);
    assert.equal(saved.profile.alerts.full, false);
  }
});

test('real engine storage failure preserves saved and live settings after the UI delegates', () => {
  const a = start();
  a.run("state.games.kards.resetSchedule={dailyTime:'09:00',weeklyDay:3};save();");
  const before = a.saved(),
    live = a.run('JSON.stringify(state.games.kards)');
  a.run(`
    openUniversalSettings('kards');
    $('#trackerResetTime').value='11:00';$('#trackerResetWeekday').value='5';
    $('#trackerPassActive').checked=true;$('#trackerPassPurchase').value='2026-09-01';
    $('#trackerPassEnd').value='2026-10-01';
    localStorage.setItem=()=>{throw Error('storage unavailable');};
    $('#saveUniversalSettings').click();
  `);
  assert.equal(a.saved(), before);
  assert.equal(a.run('JSON.stringify(state.games.kards)'), live);
  assert.match(a.run("$('#trackerSettingsError').textContent"), /storage unavailable/);
});
