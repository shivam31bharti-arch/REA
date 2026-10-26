const editor = document.getElementById('editor');
const wordCountEl = document.getElementById('word-count');
const charCountEl = document.getElementById('char-count');
const fileStatusEl = document.getElementById('file-status');
const formatButtons = document.querySelectorAll('.fmt');

const state = { filePath: null, dirty: false };

function fileName() {
  return state.filePath ? state.filePath.split(/[\\/]/).pop() : 'Untitled';
}

function refreshTitle() {
  const marker = state.dirty ? '• ' : '';
  document.title = `${marker}${fileName()} — OpenPage`;
  fileStatusEl.textContent = state.dirty ? `${fileName()} (unsaved)` : fileName();
}

function updateCounts() {
  const text = editor.innerText;
  const words = (text.trim().match(/\S+/g) || []).length;
  const chars = text.replace(/\n/g, '').length;
  wordCountEl.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  charCountEl.textContent = `${chars} ${chars === 1 ? 'character' : 'characters'}`;
}

function markDirty() {
  if (!state.dirty) {
    state.dirty = true;
    refreshTitle();
  }
  updateCounts();
}

function updateFormatState() {
  for (const button of formatButtons) {
    button.classList.toggle('active', document.queryCommandState(button.dataset.command));
  }
}

function applyFormat(command) {
  editor.focus();
  document.execCommand(command);
  updateFormatState();
  markDirty();
}

function sanitize(root) {
  for (const el of root.querySelectorAll('script, iframe, object, embed, link, meta, style')) {
    el.remove();
  }
  for (const el of root.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
  }
}

function serializeDocument() {
  const title = fileName().replace(/\.html?$/i, '');
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>' + title.replace(/[<&]/g, '') + '</title></head>',
    '<body>',
    editor.innerHTML,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function confirmDiscard() {
  return !state.dirty || window.confirm('Discard unsaved changes?');
}

function newDocument() {
  if (!confirmDiscard()) return;
  editor.innerHTML = '';
  state.filePath = null;
  state.dirty = false;
  refreshTitle();
  updateCounts();
  editor.focus();
}

async function openDocument() {
  if (!confirmDiscard()) return;
  const result = await window.openpage.openDocument();
  if (!result) return;
  const parsed = new DOMParser().parseFromString(result.html, 'text/html');
  sanitize(parsed.body);
  editor.innerHTML = parsed.body.innerHTML;
  state.filePath = result.filePath;
  state.dirty = false;
  refreshTitle();
  updateCounts();
}

async function saveDocument() {
  const result = await window.openpage.saveDocument({
    html: serializeDocument(),
    filePath: state.filePath,
  });
  if (!result) return;
  state.filePath = result.filePath;
  state.dirty = false;
  refreshTitle();
}

document.getElementById('btn-new').addEventListener('click', newDocument);
document.getElementById('btn-open').addEventListener('click', openDocument);
document.getElementById('btn-save').addEventListener('click', saveDocument);

for (const button of formatButtons) {
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => applyFormat(button.dataset.command));
}

editor.addEventListener('input', markDirty);
document.addEventListener('selectionchange', updateFormatState);

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'n') {
    event.preventDefault();
    newDocument();
  } else if (key === 'o') {
    event.preventDefault();
    openDocument();
  } else if (key === 's') {
    event.preventDefault();
    saveDocument();
  }
});

refreshTitle();
updateCounts();
editor.focus();
