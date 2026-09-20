const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function desktop(options = {}) {
  const handlers = new Map();
  const dialogs = [];
  const writes = [];
  let window;
  const electron = {
    app: {
      whenReady: () => Promise.resolve(),
      commandLine: { hasSwitch: () => true },
      on() {},
      quit() {}
    },
    BrowserWindow: class {
      constructor() {
        window = this;
        this.webContents = { mainFrame: {}, setWindowOpenHandler() {}, on() {} };
      }
      loadFile() {}
      on() {}
    },
    Menu: { setApplicationMenu() {}, buildFromTemplate: value => value },
    Tray: class {
      setToolTip() {}
      setContextMenu() {}
      on() {}
    },
    nativeImage: { createFromDataURL: () => ({ resize: () => ({}) }) },
    ipcMain: { on() {}, handle: (channel, callback) => handlers.set(channel, callback) },
    powerMonitor: { on() {} },
    dialog: {
      async showSaveDialog(parent, settings) {
        dialogs.push({ parent, settings });
        if (options.dialogError) throw new Error('native dialog failed');
        return options.result || { canceled: false, filePath: 'C:\\exports\\backup.json' };
      }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../desktop-main.js'), 'utf8'), {
    __dirname: path.resolve(__dirname, '..'),
    require(name) {
      if (name === 'electron') return electron;
      if (name === 'path') return path;
      if (name === 'fs')
        return {
          writeFileSync(...args) {
            if (options.writeError) throw new Error('EACCES');
            writes.push(args);
          }
        };
      throw new Error(`Unexpected module: ${name}`);
    }
  });
  await Promise.resolve();
  return {
    call: handlers.get('save-text-file'),
    event: { sender: window.webContents, senderFrame: window.webContents.mainFrame },
    window,
    dialogs,
    writes
  };
}

test('trusted main frame exports exact JSON through the selected path', async () => {
  const h = await desktop();
  const content = JSON.stringify({ schemaVersion: 3, games: { 한글: {} } }, null, 2);
  assert.equal((await h.call(h.event, 'deckroom-export-2026-09-20.json', content)).saved, true);
  assert.equal(h.dialogs[0].parent, h.window);
  assert.equal(h.dialogs[0].settings.defaultPath, 'deckroom-export-2026-09-20.json');
  assert.equal(h.dialogs[0].settings.filters[0].extensions[0], 'json');
  assert.deepEqual(h.writes, [['C:\\exports\\backup.json', content, 'utf8']]);
});

test('untrusted renderer and same-renderer child frame cannot open save dialog', async () => {
  const h = await desktop();
  for (const event of [
    { sender: {}, senderFrame: h.event.senderFrame },
    { sender: h.event.sender, senderFrame: {} }
  ]) {
    assert.match((await h.call(event, 'backup.json', '{}')).error, /허용되지/);
  }
  assert.equal(h.dialogs.length, 0);
  assert.equal(h.writes.length, 0);
});

test('invalid filename, non-string content and malformed JSON are rejected before dialog', async () => {
  const h = await desktop();
  for (const [name, content] of [
    [null, '{}'],
    ['', '{}'],
    ['../backup.json', '{}'],
    ['C:\\backup.json', '{}'],
    ['backup.txt', '{}'],
    ['con.json', '{}'],
    ['backup\u0000.json', '{}'],
    ['x'.repeat(201) + '.json', '{}'],
    ['backup.json', {}],
    ['backup.json', '{broken']
  ]) {
    assert.equal(typeof (await h.call(h.event, name, content)).error, 'string');
  }
  assert.equal(h.dialogs.length, 0);
  assert.equal(h.writes.length, 0);
});

test('save cancellation or missing selected path performs no write', async () => {
  for (const result of [{ canceled: true }, { canceled: false }]) {
    const h = await desktop({ result });
    assert.equal((await h.call(h.event, 'backup.json', '{}')).canceled, true);
    assert.equal(h.writes.length, 0);
  }
});

test('dialog and write failures return a Korean error without exposing internal details', async () => {
  for (const options of [{ dialogError: true }, { writeError: true }]) {
    const h = await desktop(options);
    const result = await h.call(h.event, 'backup.json', '{}');
    assert.match(result.error, /파일을 저장하지 못했습니다/);
    assert.equal(result.saved, undefined);
    assert.equal(h.writes.length, 0);
  }
});

test('preload exposes a frozen saveTextFile API forwarding invoke result', async () => {
  let api;
  const invokes = [];
  const result = { canceled: true };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), {
    require: () => ({
      contextBridge: {
        exposeInMainWorld(name, value) {
          assert.equal(name, 'deckroom');
          api = value;
        }
      },
      ipcRenderer: {
        invoke(...args) {
          invokes.push(args);
          return Promise.resolve(result);
        }
      }
    })
  });
  assert.equal(Object.isFrozen(api), true);
  assert.equal(await api.saveTextFile('backup.json', '{"games":{}}'), result);
  assert.deepEqual(invokes, [['save-text-file', 'backup.json', '{"games":{}}']]);
});
