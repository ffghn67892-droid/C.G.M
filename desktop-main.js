const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
  shell,
  Notification,
  powerMonitor,
  dialog
} = require('electron');
const path = require('path');
const fs = require('fs');
let mainWindow,
  tray,
  keepInTray = false,
  quitting = false,
  lastBeep = 0;
function trusted(event) {
  return (
    event.sender === mainWindow?.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame
  );
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    show: !app.commandLine.hasSwitch('qa-hidden'),
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#171918',
    title: 'DECKROOM | 카드 게임 매니저',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.on('close', event => {
    if (keepInTray && !quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  const icon = nativeImage
    .createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
    )
    .resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('DECKROOM');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '열기', click: () => mainWindow.show() },
      {
        label: '완전 종료',
        click: () => {
          quitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on('double-click', () => mainWindow.show());
  ipcMain.on('set-tray', (event, value) => {
    if (trusted(event)) keepInTray = value === true;
  });
  ipcMain.on('open-snap-shop', event => {
    if (trusted(event)) shell.openExternal('https://shop.marvelsnap.com/ko-KR');
  });
  ipcMain.on('game-alarm', (event, name) => {
    if (!trusted(event) || typeof name !== 'string' || Date.now() - lastBeep < 29000) return;
    lastBeep = Date.now();
    shell.beep();
    if (Notification.isSupported())
      new Notification({
        title: 'DECKROOM',
        body: `${name.slice(0, 80)} · 알림 확인 필요`,
        silent: true
      }).show();
  });
  ipcMain.handle('save-text-file', async (event, suggestedName, content) => {
    if (!trusted(event)) return { error: '허용되지 않은 내보내기 요청입니다.' };
    if (
      typeof suggestedName !== 'string' ||
      suggestedName.length > 200 ||
      !/^[^<>:"/\\|?*\x00-\x1f]+\.json$/i.test(suggestedName) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(suggestedName) ||
      typeof content !== 'string'
    )
      return { error: '내보내기 파일 이름이나 내용을 확인하세요.' };
    try {
      JSON.parse(content);
    } catch {
      return { error: '내보내기 데이터가 올바른 JSON 형식이 아닙니다.' };
    }
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: suggestedName,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { saved: true };
    } catch {
      return { error: '파일을 저장하지 못했습니다. 저장 위치와 권한을 확인하세요.' };
    }
  });
  powerMonitor.on('resume', () => mainWindow?.webContents.send('resume-sync'));
  app.on('activate', () => mainWindow?.show());
});
app.on('before-quit', () => {
  quitting = true;
});
app.on('window-all-closed', () => app.quit());
