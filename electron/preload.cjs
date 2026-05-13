const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),
  moveWindow: (pos) => ipcRenderer.send('move-window', pos),
  resizeCompanionWindow: (size) => ipcRenderer.send('resize-companion-window', size),
  getWindowMetrics: () => ipcRenderer.invoke('get-window-metrics'),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  openChatWorkspace: () => ipcRenderer.invoke('open-chat-workspace'),
  openCompanionHome: () => ipcRenderer.invoke('open-companion-home'),
  showPetContextMenu: () => ipcRenderer.send('show-pet-context-menu'),
  readSoul: () => ipcRenderer.invoke('read-soul'),
  listRoles: () => ipcRenderer.invoke('list-roles'),
  getRoleDetail: (roleId) => ipcRenderer.invoke('get-role-detail', roleId),
  setActiveRole: (roleId) => ipcRenderer.invoke('set-active-role', roleId),
  saveRole: (payload) => ipcRenderer.invoke('save-role', payload),
  pickRoleImage: () => ipcRenderer.invoke('pick-role-image'),
  importRole: () => ipcRenderer.invoke('import-role'),
  exportRole: (roleId) => ipcRenderer.invoke('export-role', roleId),
  writeLog: (content) => ipcRenderer.invoke('write-log', content),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  openSoulFile: () => ipcRenderer.invoke('open-soul-file'),
  openRolesRoot: () => ipcRenderer.invoke('open-roles-root'),
  openRoleFolder: (roleId) => ipcRenderer.invoke('open-role-folder', roleId),
  openRoleSoulFile: (roleId) => ipcRenderer.invoke('open-role-soul-file', roleId),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  onScreenshotAnalysis: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('trigger-screenshot-analysis', subscription);
    return () => ipcRenderer.removeListener('trigger-screenshot-analysis', subscription);
  },
  onRolesUpdated: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('roles-updated', subscription);
    return () => ipcRenderer.removeListener('roles-updated', subscription);
  },
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options)
});
