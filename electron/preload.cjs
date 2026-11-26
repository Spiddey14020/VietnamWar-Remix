const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopUpdater', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('updater:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onStatus: (listener) => {
    if (typeof listener !== 'function') {
      return () => {};
    }
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('updater:status', handler);
    return () => {
      ipcRenderer.removeListener('updater:status', handler);
    };
  },
});
