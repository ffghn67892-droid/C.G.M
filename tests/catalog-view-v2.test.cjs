const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DOMParser } = require('@xmldom/xmldom');

// View contract tests only: the mutable engine double below is not validation
// of persistence, resets, clamping, migration, or the real Track 1 engine.
function start(rules, progress, pass = { active: false }) {
  const game = { rules, ruleProgress: progress, actionHistory: [], pass };
  const calls = [],
    messages = [];
  let focused,
    navRenders = 0,
    fail;
  const host = {
    set innerHTML(html) {
      this.html = html;
      this.document = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html');
      this.buttons = Array.from(this.document.getElementsByTagName('button')).map(node => ({
        node,
        dataset: {
          catalogAction: node.getAttribute('data-catalog-action'),
          ruleId: node.getAttribute('data-rule-id')
        },
        addEventListener(type, callback) {
          this[type] = callback;
        },
        focus() {
          focused = this;
        }
      }));
    },
    querySelectorAll() {
      return this.buttons;
    }
  };
  const context = vm.createContext({
    state: { games: { game } },
    $: () => host,
    escapeHtml: value =>
      String(value).replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      ),
    catalogRules: g => g.rules,
    ruleProgress: (g, r) => g.ruleProgress[r.id],
    clearQuestSummary() {},
    renderNavigation() {
      navRenders++;
    },
    toast(message) {
      messages.push(message);
    },
    renderAll() {
      context.renderUniversalGame('game');
    },
    catalogAction(gameId, ruleId, action) {
      calls.push({ gameId, ruleId, action });
      if (fail) throw Error(fail);
      if (action === 'undo') {
        const last = game.actionHistory.pop();
        game.ruleProgress[last.ruleId][last.kind === 'slot' ? 'held' : 'value'] -= last.delta;
      } else if (action === 'delete-rule') game.rules = game.rules.filter(r => r.id !== ruleId);
      else if (action === 'bump-pass-level') game.pass.level++;
      else {
        const rule = game.rules.find(r => r.id === ruleId);
        const delta = action === 'complete' ? -1 : 1;
        game.ruleProgress[ruleId][rule.kind === 'slot' ? 'held' : 'value'] += delta;
        game.actionHistory.push({ ruleId, kind: rule.kind, delta, at: Date.now() });
      }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'catalog-view.js'), 'utf8'), context);
  context.renderUniversalGame('game');
  return {
    game,
    host,
    calls,
    messages,
    get focused() {
      return focused;
    },
    get navRenders() {
      return navRenders;
    },
    failWith(message) {
      fail = message;
    },
    text() {
      return host.document.documentElement.textContent;
    },
    card(id) {
      return Array.from(host.document.getElementsByTagName('*')).find(
        n => n.getAttribute('data-card') === id
      );
    },
    click(action, ruleId) {
      const button = host.buttons.find(
        b =>
          b.dataset.catalogAction === action &&
          (ruleId === undefined || b.dataset.ruleId === ruleId)
      );
      assert.ok(button, `Missing ${action} button for ${ruleId}`);
      assert.equal(button.node.hasAttribute('disabled'), false);
      button.click();
    }
  };
}
const slot = (id = 'slot') => ({ id, name: id, kind: 'slot', format: 'daily', maxHeld: 3 });
const gauge = (id = 'gauge') => ({
  id,
  name: id,
  kind: 'gauge',
  format: 'weekly',
  min: 0,
  max: 3,
  milestones: [1, 2]
});

test('view contract: card clicks immediately change counts and completed cards disappear', () => {
  const a = start([slot(), gauge()], { slot: { held: 2 }, gauge: { value: 2 } });
  a.click('complete', 'slot');
  assert.equal(a.game.ruleProgress.slot.held, 1);
  assert.match(a.card('slot').textContent, /남은 수1/);
  a.click('complete', 'slot');
  assert.equal(a.card('slot'), undefined);
  a.click('increment', 'gauge');
  assert.equal(a.game.ruleProgress.gauge.value, 3);
  assert.equal(a.card('gauge'), undefined);
  assert.match(a.text(), /남은 할 일이 없습니다/);
  assert.deepEqual(
    a.calls.map(c => c.action),
    ['complete', 'complete', 'increment']
  );
  assert.ok(a.calls.every(c => c.gameId === 'game'));
  assert.equal(a.focused.dataset.catalogAction, 'undo');
});

test('view contract: personal goal and achieved milestones stay visible below real maximum', () => {
  const a = start([gauge()], { gauge: { value: 0, foldTarget: 1, achievedMilestones: [] } });
  a.click('increment', 'gauge');
  assert.match(a.card('gauge').textContent, /개인 목표 1 달성/);
  assert.match(a.card('gauge').textContent, /1 달성/);
  a.click('increment', 'gauge');
  assert.match(a.card('gauge').textContent, /2 달성/);
  assert.equal(a.focused.dataset.catalogAction, 'increment');
});

test('view contract: completed ended rules remain until explicit deletion', () => {
  const a = start(
    [
      { ...slot(), format: 'fixed' },
      { ...gauge(), format: 'fixed' }
    ],
    { slot: { held: 0, ended: true }, gauge: { value: 3, ended: true } }
  );
  assert.match(a.card('slot').textContent, /종료됨/);
  assert.match(a.card('gauge').textContent, /종료됨/);
  assert.equal(
    a.host.buttons.some(b => ['complete', 'increment'].includes(b.dataset.catalogAction)),
    false
  );
  a.click('delete-rule', 'slot');
  assert.equal(a.card('slot'), undefined);
  assert.ok(a.card('gauge'));
  a.click('delete-rule', 'gauge');
  assert.equal(a.game.rules.length, 0);
});

test('view contract: undo restores hidden cards in reverse click order', () => {
  const a = start([slot(), gauge()], { slot: { held: 1 }, gauge: { value: 2 } });
  a.click('complete', 'slot');
  a.click('increment', 'gauge');
  assert.equal(a.card('slot'), undefined);
  assert.equal(a.card('gauge'), undefined);
  assert.deepEqual(
    Array.from(a.host.document.getElementsByTagName('li')).map(n => n.textContent),
    ['gauge · +1 (다음 실행취소)', 'slot · 완료']
  );
  a.click('undo', 'gauge');
  assert.equal(a.game.ruleProgress.gauge.value, 2);
  assert.ok(a.card('gauge'));
  assert.equal(a.card('slot'), undefined);
  a.click('undo', 'slot');
  assert.equal(a.game.ruleProgress.slot.held, 1);
  assert.ok(a.card('slot'));
  assert.equal(
    a.host.buttons.some(b => b.dataset.catalogAction === 'undo'),
    false
  );
});

test('view contract: action error is shown and current state is rendered again', () => {
  const a = start([slot()], { slot: { held: 1 } });
  a.failWith('저장 실패');
  a.click('complete', 'slot');
  assert.deepEqual(a.messages, ['저장 실패']);
  assert.equal(a.navRenders, 1);
  assert.match(a.card('slot').textContent, /남은 수1/);
  assert.equal(a.game.actionHistory.length, 0);
});

test('view contract: future fixed cards are disabled and purchased pass increments manually', () => {
  const a = start(
    [{ ...slot(), format: 'fixed', startDate: '2999-01-01' }],
    { slot: { held: 1 } },
    { active: true, level: 4 }
  );
  assert.equal(
    a.host.buttons.find(b => b.dataset.catalogAction === 'complete').node.hasAttribute('disabled'),
    true
  );
  assert.match(a.card('slot').textContent, /시작 전/);
  a.click('bump-pass-level', '');
  assert.equal(a.game.pass.level, 5);
  assert.match(
    a.host.buttons.find(b => b.dataset.catalogAction === 'bump-pass-level').node.textContent,
    /패스 레벨5/
  );
});
