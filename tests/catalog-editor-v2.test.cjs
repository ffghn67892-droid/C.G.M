const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(
  require('node:path').join(__dirname, '../catalog-editor.js'),
  'utf8'
);
function app() {
  const controls = new Map();
  const context = vm.createContext({
    crypto: webcrypto,
    structuredClone,
    state: { games: { test: { ruleCatalog: [], ruleProgress: {} } } },
    escapeHtml: value => String(value),
    openDialog() {
      controls.clear();
    },
    $: selector => {
      if (!controls.has(selector))
        controls.set(selector, {
          value: '',
          addEventListener(type, callback) {
            this[type] = callback;
          }
        });
      return controls.get(selector);
    },
    catalogRules: g => g.ruleCatalog,
    ruleProgress: (g, r) => g.ruleProgress[r.id],
    runCatalogAction: (id, fn) => fn(context.state.games[id]),
    renderAll() {}
  });
  vm.runInContext(source, context);
  return { run: code => vm.runInContext(code, context), controls, context };
}
test('new slot and gauge definitions contain only tracker fields', () => {
  const a = app();
  for (const kind of ['slot', 'gauge']) {
    const rule = a.run(`validateTrackerRule(newUniversalRule('${kind}'))`);
    assert.equal(rule.kind, kind);
    assert.equal(rule.format, 'daily');
    assert.equal(rule.resetOverride, null);
    assert.equal('rewards' in rule, false);
    assert.equal('initialCount' in rule, false);
  }
});
test('fixed dates, integer limits and milestone bounds are validated before saving', () => {
  const a = app();
  a.run(
    "var r = newUniversalRule(); r.format = 'fixed'; r.startDate = '2026-09-01'; r.endDate = '2026-09-30'; r.endTime = '00:00'"
  );
  assert.doesNotThrow(() => a.run('validateTrackerRule(r)'));
  for (const changes of [
    "r.endDate = '2026-02-30'",
    "r.endDate = '2026-08-01'",
    "r.endDate = '2026-09-30'; r.endTime = '25:00'",
    "r.endDate = '2026-09-30'; r.endTime = '00:00'; r.maxHeld = 1.5"
  ]) {
    a.run(changes);
    assert.throws(() => a.run('validateTrackerRule(r)'));
  }
  a.run("r = newUniversalRule('gauge'); r.min = 2; r.max = 5; r.milestones = [3, 5]");
  assert.doesNotThrow(() => a.run('validateTrackerRule(r)'));
  a.run('r.milestones = [6]');
  assert.throws(() => a.run('validateTrackerRule(r)'));
});
test('personal targets change achievement settings without changing actual progress', () => {
  const a = app();
  a.run(
    "var r = newUniversalRule('gauge'); state.games.test.ruleCatalog=[r]; state.games.test.ruleProgress[r.id]={value:3, foldTarget:null}; openRuleDetails('test',r.id)"
  );
  a.context.$('#detailFoldTarget').value = '4';
  a.controls.get('#saveFoldTarget').click();
  assert.equal(a.run('state.games.test.ruleProgress[r.id].foldTarget'), 4);
  assert.equal(a.run('state.games.test.ruleProgress[r.id].value'), 3);
  a.context.$('#detailFoldTarget').value = '20';
  a.controls.get('#saveFoldTarget').click();
  assert.equal(a.run('state.games.test.ruleProgress[r.id].foldTarget'), 4);
  assert.match(a.controls.get('#detailError').textContent, /개인 목표/);
});
test('slot detail controls delegate manual changes to the engine', () => {
  const a = app(),
    calls = [];
  a.context.catalogAction = (...args) => calls.push(args);
  a.run(
    "var r = newUniversalRule(); state.games.test.ruleCatalog=[r]; state.games.test.ruleProgress[r.id]={held:1}; openRuleDetails('test',r.id)"
  );
  a.controls.get('#detailManualAdd').click();
  a.controls.get('#detailManualRemove').click();
  assert.equal(calls[0][2], 'manual-add');
  assert.equal(calls[1][2], 'manual-remove');
  assert.equal(a.run('state.games.test.ruleProgress[r.id].held'), 1);
});
// Small DOM adapter: exercise the editor's real event handlers and rerenders.
function wizard() {
  const { DOMParser } = require('@xmldom/xmldom');
  const host = {
    set innerHTML(html) {
      const document = new DOMParser({
        errorHandler: {
          warning() {},
          error() {},
          fatalError(message) {
            throw Error(message);
          }
        }
      }).parseFromString(
        `<main>${html.replace(/\b(checked|selected)(?=[\s>])/g, '$1="$1"')}</main>`,
        'text/html'
      );
      this.nodes = Array.from(document.getElementsByTagName('*')).map(node => ({
        node,
        dataset: { editRule: node.getAttribute('data-edit-rule') },
        value:
          node.tagName === 'select'
            ? (
                Array.from(node.getElementsByTagName('option')).find(option =>
                  option.hasAttribute('selected')
                ) || node.getElementsByTagName('option')[0]
              ).getAttribute('value')
            : node.getAttribute('value'),
        checked: node.hasAttribute('checked'),
        addEventListener(type, handler) {
          this[type] = handler;
        }
      }));
    },
    querySelectorAll(selector) {
      return this.nodes.filter(({ node }) => {
        if (selector.startsWith('#')) return node.getAttribute('id') === selector.slice(1);
        const match = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
        return (
          match &&
          node.hasAttribute(match[1]) &&
          (match[2] === undefined || node.getAttribute(match[1]) === match[2])
        );
      });
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  };
  const a = app();
  a.context.document = { createElement: () => host };
  a.context.mount = { appendChild() {} };
  a.run('var read = mountUniversalEditor([], mount)');
  return {
    read: () => a.run('read()'),
    click: selector => {
      const node = host.querySelector(selector);
      assert.ok(node, selector);
      node.click();
    },
    field: (key, value, change = false) => {
      const node = host.querySelector(`[data-rule-field="${key}"]`);
      assert.ok(node, key);
      node.value = value;
      if (change) node.change();
    },
    host
  };
}
test('wizard preserves entered values across steps and switches slot to fixed gauge cleanly', () => {
  const w = wizard();
  w.click('#addTrackerRule');
  w.field('name', '이벤트 승리');
  w.click('#wizardNext');
  w.field('format', 'fixed', true);
  w.field('startDate', '2026-09-01');
  w.field('endDate', '2026-09-30');
  w.click('#wizardNext');
  w.field('kind', 'gauge', true);
  w.click('#wizardNext');
  w.field('min', '2');
  w.field('max', '15');
  w.field('milestones', '10, 4, 10');
  w.click('#wizardPrev');
  w.click('#wizardNext');
  assert.equal(w.host.querySelector('[data-rule-field="max"]').value, '15');
  w.click('#wizardNext');
  const [rule] = w.read();
  assert.equal(rule.name, '이벤트 승리');
  assert.equal(rule.startDate, '2026-09-01');
  assert.equal(rule.endDate, '2026-09-30');
  assert.equal(rule.kind, 'gauge');
  assert.equal('maxHeld' in rule, false);
  assert.deepEqual(Array.from(rule.milestones), [4, 10]);
  w.click('#wizardPrev');
  w.field('max', '1');
  assert.throws(w.read, /목표값/);
});
test('wizard reset override is opt-in and stores weekly time and weekday', () => {
  const w = wizard();
  w.click('#addTrackerRule');
  w.field('name', '주간');
  w.click('#wizardNext');
  w.field('format', 'weekly', true);
  w.click('#wizardNext');
  w.click('#wizardNext');
  assert.equal(w.read()[0].resetOverride, null);
  const checkbox = w.host.querySelector('[data-rule-field="override"]');
  checkbox.checked = true;
  checkbox.change();
  w.field('resetTime', '18:30');
  w.field('weekday', '6');
  w.field('refillCount', '2');
  w.click('#wizardNext');
  const [rule] = w.read();
  assert.equal(rule.refillCount, 2);
  assert.equal(rule.resetOverride.time, '18:30');
  assert.equal(rule.resetOverride.weekday, 6);
});
