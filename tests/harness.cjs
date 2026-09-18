const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
// DOM adapter for event/render integration tests; this does not test browser layout.
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const root = path.join(__dirname, '..');
const source = ['schedules.js','game-data.js','app.js','reward-ledger.js','pass-data.js','game-config.js','setup.js','overview.js','alerts.js','catalog-engine.js','catalog-presets.js','catalog-view.js','catalog-editor.js','refresh-scheduler.js','legacy-migrations.js','manager.js'].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const listeners = new WeakMap();
function parse(markup) {
  return new DOMParser({ errorHandler: { warning() {}, error(message) { throw Error(message); }, fatalError(message) { throw Error(message); } } })
    .parseFromString(markup.replace(/\b(hidden|disabled|selected|checked)(?=[\s>])/g, '$1="$1"'), 'text/html');
}
const sample = parse('<html><body></body></html>');
const elementProto = Object.getPrototypeOf(sample.documentElement);
const documentProto = Object.getPrototypeOf(sample);
function matches(node, selector) {
  if (!node || node.nodeType !== 1) return false;
  const not = /:not\(([^)]+)\)/.exec(selector);
  if (not && matches(node, not[1])) return false;
  selector = selector.replace(/:not\([^)]+\)/g, '');
  if (selector.includes(':disabled') && !node.hasAttribute('disabled')) return false;
  selector = selector.replace(':disabled', '');
  for (const [, name, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (!node.hasAttribute(name) || (value !== undefined && node.getAttribute(name) !== value)) return false;
  }
  selector = selector.replace(/\[[^\]]+\]/g, '');
  const id = /#([\w-]+)/.exec(selector);
  if (id && node.getAttribute('id') !== id[1]) return false;
  const classes = (node.getAttribute('class') || '').split(/\s+/);
  if ([...selector.matchAll(/\.([\w-]+)/g)].some((match) => !classes.includes(match[1]))) return false;
  const tag = /^[\w-]+/.exec(selector);
  return !tag || node.tagName === tag[0];
}
function queryAll(selector) {
  const parts = selector.split(/\s+/);
  return [...Array.from(this.getElementsByTagName('*'))].filter((node) => {
    if (!matches(node, parts[parts.length - 1])) return false;
    let parent = node.parentNode;
    for (let index = parts.length - 2; index >= 0; index -= 1) {
      while (parent && !matches(parent, parts[index])) parent = parent.parentNode;
      if (!parent) return false;
      parent = parent.parentNode;
    }
    return true;
  });
}
function addEventListener(type, callback) {
  if (!listeners.has(this)) listeners.set(this, {});
  const events = listeners.get(this);
  (events[type] ||= []).push(callback);
}
for (const proto of [elementProto, documentProto]) {
  proto.querySelectorAll = queryAll;
  proto.querySelector = function (selector) { return this.querySelectorAll(selector)[0] || null; };
  proto.addEventListener = addEventListener;
}
elementProto.closest = function (selector) { let node = this; while (node && !matches(node, selector)) node = node.parentNode; return node; };
elementProto.focus = function () { this.ownerDocument.activeElement = this; };
elementProto.click = function () { if (!this.hasAttribute('disabled')) for (const callback of listeners.get(this)?.click || []) callback({ target: this }); };
Object.defineProperties(elementProto, {
  id:{get(){return this.getAttribute('id')||'';},set(v){this.setAttribute('id',v);}},
  className:{get(){return this.getAttribute('class')||'';},set(v){this.setAttribute('class',v);}},
  checked: {get(){return this.hasAttribute('checked');},set(v){if(v)this.setAttribute('checked','checked');else this.removeAttribute('checked');}},
  value: {get(){if(this.tagName==='select'){const options=Array.from(this.getElementsByTagName('option'));return (options.find(o=>o.hasAttribute('selected'))||options[0])?.getAttribute('value')||'';}return this.getAttribute('value')||'';},set(v){if(this.tagName==='select')Array.from(this.getElementsByTagName('option')).forEach(o=>{if(o.getAttribute('value')===String(v))o.setAttribute('selected','selected');else o.removeAttribute('selected');});else this.setAttribute('value',String(v));}},
  innerHTML: {
    get() { return Array.from(this.childNodes).map((node) => new XMLSerializer().serializeToString(node)).join(''); },
    set(value) {
      while (this.firstChild) this.removeChild(this.firstChild);
      const fragment = parse(`<div>${value}</div>`).documentElement;
      for (const child of Array.from(fragment.childNodes)) this.appendChild(this.ownerDocument.importNode(child, true));
    }
  },
  hidden: { get() { return this.hasAttribute('hidden'); }, set(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); } },
  dataset: { get() { return new Proxy({}, { get: (_, key) => this.getAttribute('data-' + key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())) }); } },
  classList: { get() {
    const toggle = (name, force) => { const classes = new Set((this.getAttribute('class') || '').split(/\s+/).filter(Boolean)); const on = force ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); this.setAttribute('class', [...classes].join(' ')); };
    return { toggle, add: (name) => toggle(name, true), remove: (name) => toggle(name, false) };
  } }
});
function start(saved = null) {
  let now = new Date('2026-09-10T23:59:00+09:00').getTime();
  let stored = saved; const storage=new Map(saved?[['deckroom-quests',saved]]:[]);
  const document = parse(html);
  const context = vm.createContext({
    document, window: { addEventListener() {} }, crypto: webcrypto, structuredClone,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    localStorage: { getItem: key => storage.get(key)||null, setItem: (key,value) => {storage.set(key,value);if(key==='deckroom-quests')stored=value;},removeItem:key=>storage.delete(key) },
    setInterval() {}, setTimeout() {}, clearTimeout() {}
  });
  vm.runInContext(source, context);
  if(!saved)vm.runInContext("for(const [id]of GAMES){state.games[id].profile.registeredAt=new Date().toISOString();}state.activeGame='kards';renderAll();",context);
  return {
    document, run: (code) => vm.runInContext(code, context), saved: () => stored,
    nextDay(days = 1) { now += days * 86400000; },
    setTime(iso) { now = new Date(iso).getTime(); },
    advance(milliseconds) { now += milliseconds; },
    select(id) { document.querySelector(`[data-game="${id}"]`).click(); },
    click(selector) { const node = document.querySelector(selector); assert.ok(node, selector); node.click(); },
    rows() { return document.querySelectorAll('.queued-row'); }
  };
}


module.exports={start,styles};
