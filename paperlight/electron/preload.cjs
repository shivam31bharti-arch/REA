const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('paperlight', {
  isElectron: true,
  openFile: (options) => ipcRenderer.invoke('file:open', options),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  saveFile: (options) => ipcRenderer.invoke('file:save', options),
  exportPdf: (options) => ipcRenderer.invoke('file:export-pdf', options),
  listRecent: () => ipcRenderer.invoke('recent:list'),
  addRecent: (entry) => ipcRenderer.invoke('recent:add', entry),
  setTheme: (theme) => ipcRenderer.invoke('window:theme', theme),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});
