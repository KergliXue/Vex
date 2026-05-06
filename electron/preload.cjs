const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),
  moveWindow: (pos) => ipcRenderer.send('move-window', pos),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  readSoul: () => ipcRenderer.invoke('read-soul'),
  writeLog: (content) => ipcRenderer.invoke('write-log', content),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  openSoulFile: () => ipcRenderer.invoke('open-soul-file'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  onScreenshotAnalysis: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('trigger-screenshot-analysis', subscription);
    return () => ipcRenderer.removeListener('trigger-screenshot-analysis', subscription);
  },
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options)
});
