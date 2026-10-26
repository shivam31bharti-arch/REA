const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const DOCUMENT_FILTERS = [{ name: 'OpenPage documents', extensions: ['html', 'htm'] }];

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 560,
    minHeight: 400,
    title: 'OpenPage',
    backgroundColor: '#e9ecef',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('document:open', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open document',
    filters: DOCUMENT_FILTERS,
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  const html = await fs.readFile(filePaths[0], 'utf8');
  return { filePath: filePaths[0], html };
});

ipcMain.handle('document:save', async (event, { html, filePath }) => {
  let target = filePath;
  if (!target) {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      title: 'Save document',
      defaultPath: 'Untitled.html',
      filters: DOCUMENT_FILTERS,
    });
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
  }
  await fs.writeFile(target, html, 'utf8');
  return { filePath: target };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
