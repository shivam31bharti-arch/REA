const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openpage', {
  openDocument: () => ipcRenderer.invoke('document:open'),
  saveDocument: (payload) => ipcRenderer.invoke('document:save', payload),
});
