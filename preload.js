const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'deckroom',
  Object.freeze({
    openShop: () => ipcRenderer.send('open-snap-shop'),
    setTray: value => ipcRenderer.send('set-tray', value === true),
    alarm: name => ipcRenderer.send('game-alarm', String(name).slice(0, 80)),
    saveTextFile: (suggestedName, content) =>
      ipcRenderer.invoke('save-text-file', suggestedName, content),
    onResume: callback => {
      ipcRenderer.on('resume-sync', () => callback());
    }
  })
);
