const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.PAPERLIGHT_DEV_URL || null;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const APP_ORIGIN = 'paperlight://app';
const RECENT_LIMIT = 12;

const TITLE_BAR = {
  light: { color: '#FFFFFF', symbolColor: '#111111' },
  dark: { color: '#121212', symbolColor: '#EDEDED' },
};

// Matches the installer's appId, so the Start menu entry and the taskbar treat the window as one app.
if (process.platform === 'win32') app.setAppUserModelId('app.paperlight.suite');

protocol.registerSchemesAsPrivileged([
  { scheme: 'paperlight', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Only files the user picked in a dialog (or that are already in the recent list)
// may be read or overwritten by the renderer.
const grantedPaths = new Set();
let recentFiles = [];

function recentStorePath() {
  return path.join(app.getPath('userData'), 'recent.json');
}

async function loadRecent() {
  try {
    const parsed = JSON.parse(await fs.readFile(recentStorePath(), 'utf8'));
    recentFiles = Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.path === 'string') : [];
  } catch {
    recentFiles = [];
  }
  for (const entry of recentFiles) grantedPaths.add(entry.path);
}

async function storeRecent() {
  await fs.mkdir(path.dirname(recentStorePath()), { recursive: true });
  await fs.writeFile(recentStorePath(), JSON.stringify(recentFiles, null, 2), 'utf8');
}

function isTrustedSender(event) {
  const url = event.senderFrame?.url ?? '';
  return DEV_URL ? url.startsWith(new URL(DEV_URL).origin) : url.startsWith(APP_ORIGIN);
}

function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error(`Rejected ${channel}: untrusted sender`);
    return listener(event, ...args);
  });
}

async function readGranted(filePath) {
  const data = await fs.readFile(filePath);
  return { path: filePath, name: path.basename(filePath), data: new Uint8Array(data) };
}

function windowFor(event) {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined;
}

handle('file:open', async (event, { title, filters }) => {
  const result = await dialog.showOpenDialog(windowFor(event), { title, filters, properties: ['openFile'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  grantedPaths.add(filePath);
  return readGranted(filePath);
});

handle('file:read', async (_event, filePath) => {
  if (!grantedPaths.has(filePath)) throw new Error('This file was not opened through Paperlight.');
  return readGranted(filePath);
});

handle('file:save', async (event, { filePath, defaultName, filters, data }) => {
  let target = filePath && grantedPaths.has(filePath) ? filePath : null;
  if (!target) {
    const result = await dialog.showSaveDialog(windowFor(event), { defaultPath: defaultName, filters });
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
  }
  await fs.writeFile(target, data);
  grantedPaths.add(target);
  return { path: target, name: path.basename(target) };
});

handle('file:export-pdf', async (event, { defaultName }) => {
  const result = await dialog.showSaveDialog(windowFor(event), {
    defaultPath: defaultName,
    filters: [{ name: 'PDF document', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const pdf = await event.sender.printToPDF({ printBackground: true, preferCSSPageSize: true });
  await fs.writeFile(result.filePath, pdf);
  return { path: result.filePath, name: path.basename(result.filePath) };
});

handle('recent:list', () => recentFiles);

handle('recent:add', async (_event, entry) => {
  if (!entry || !grantedPaths.has(entry.path)) return recentFiles;
  recentFiles = [
    { path: entry.path, name: String(entry.name), app: String(entry.app), openedAt: Date.now() },
    ...recentFiles.filter((existing) => existing.path !== entry.path),
  ].slice(0, RECENT_LIMIT);
  await storeRecent();
  return recentFiles;
});

handle('window:theme', (event, theme) => {
  const win = windowFor(event);
  if (win && TITLE_BAR[theme]) {
    win.setTitleBarOverlay({ ...TITLE_BAR[theme], height: 56 });
    win.setBackgroundColor(TITLE_BAR[theme].color);
  }
});

handle('shell:open-external', async (_event, url) => {
  if (/^https?:\/\//i.test(url)) await shell.openExternal(url);
});

function attachContextMenu(win) {
  win.webContents.on('context-menu', (_event, params) => {
    const contents = win.webContents;
    const items = [];
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 6)) {
        items.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) });
      }
      if (params.dictionarySuggestions.length === 0) items.push({ label: 'No spelling suggestions', enabled: false });
      items.push({
        label: 'Add to dictionary',
        click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      items.push({ type: 'separator' });
    }
    if (params.isEditable) {
      items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' });
    } else if (params.selectionText) {
      items.push({ role: 'copy' });
    }
    if (items.length > 0) Menu.buildFromTemplate(items).popup({ window: win });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'Paperlight',
    backgroundColor: TITLE_BAR.light.color,
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...TITLE_BAR.light, height: 56 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(DEV_URL ?? APP_ORIGIN)) event.preventDefault();
  });
  attachContextMenu(win);

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadURL(`${APP_ORIGIN}/index.html`);
}

app.whenReady().then(async () => {
  protocol.handle('paperlight', (request) => {
    const { pathname } = new URL(request.url);
    const target = path.normalize(path.join(DIST_DIR, decodeURIComponent(pathname)));
    if (!target.startsWith(DIST_DIR + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(target).toString());
  });
  Menu.setApplicationMenu(null);
  await loadRecent();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
