(() => {
  const panel = document.getElementById('find-panel');
  const findInput = document.getElementById('find-input');
  const replaceInput = document.getElementById('replace-input');
  const matchCase = document.getElementById('find-match-case');
  const status = document.getElementById('find-status');
  const page = document.getElementById('editor');

  let cursor = -1;

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function findMatches() {
    const query = findInput.value;
    if (!query) return [];
    const pattern = new RegExp(escapeRegExp(query), matchCase.checked ? 'g' : 'gi');
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (const match of node.nodeValue.matchAll(pattern)) {
        matches.push({ node, start: match.index, end: match.index + match[0].length });
      }
    }
    return matches;
  }

  function showStatus(count, index) {
    if (!findInput.value) status.textContent = '';
    else if (count === 0) status.textContent = 'No matches';
    else if (index >= 0) status.textContent = `${index + 1} of ${count}`;
    else status.textContent = `${count} ${count === 1 ? 'match' : 'matches'}`;
  }

  function selectMatch(match) {
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.end);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    match.node.parentElement.scrollIntoView({ block: 'nearest' });
  }

  function isSelected(match) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    return range.startContainer === match.node && range.startOffset === match.start
      && range.endContainer === match.node && range.endOffset === match.end;
  }

  function goTo(matches, index) {
    cursor = index;
    selectMatch(matches[index]);
    showStatus(matches.length, index);
  }

  function findNext(step) {
    const matches = findMatches();
    if (matches.length === 0) {
      cursor = -1;
      showStatus(0, -1);
      return;
    }
    const index = cursor < 0 || cursor >= matches.length
      ? (step > 0 ? 0 : matches.length - 1)
      : (cursor + step + matches.length) % matches.length;
    goTo(matches, index);
  }

  function firstMatchFrom(matches, node, offset) {
    const index = matches.findIndex((match) => (match.node === node
      ? match.start >= offset
      : Boolean(node.compareDocumentPosition(match.node) & Node.DOCUMENT_POSITION_FOLLOWING)));
    return index === -1 ? 0 : index;
  }

  function replaceText(match) {
    const text = match.node.nodeValue;
    match.node.nodeValue = text.slice(0, match.start) + replaceInput.value + text.slice(match.end);
  }

  function notifyEdited() {
    page.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function replaceCurrent() {
    const current = findMatches()[cursor];
    if (!current || !isSelected(current)) {
      findNext(1);
      return;
    }
    replaceText(current);
    notifyEdited();
    const matches = findMatches();
    if (matches.length === 0) {
      cursor = -1;
      showStatus(0, -1);
      return;
    }
    goTo(matches, firstMatchFrom(matches, current.node, current.start + replaceInput.value.length));
  }

  function replaceAll() {
    const matches = findMatches();
    if (matches.length === 0) {
      showStatus(0, -1);
      return;
    }
    for (const match of [...matches].reverse()) replaceText(match);
    notifyEdited();
    cursor = -1;
    status.textContent = `Replaced ${matches.length}`;
  }

  function openPanel(focusReplace) {
    panel.hidden = false;
    const selected = window.getSelection().toString();
    if (selected && !selected.includes('\n')) findInput.value = selected;
    const target = focusReplace ? replaceInput : findInput;
    target.focus();
    target.select();
    cursor = -1;
    showStatus(findMatches().length, -1);
  }

  function closePanel() {
    panel.hidden = true;
    page.focus();
  }

  function resetSearch() {
    cursor = -1;
    showStatus(findMatches().length, -1);
  }

  findInput.addEventListener('input', resetSearch);
  matchCase.addEventListener('change', resetSearch);
  findInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      findNext(event.shiftKey ? -1 : 1);
    }
  });
  replaceInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      replaceCurrent();
    }
  });

  document.getElementById('find-prev').addEventListener('click', () => findNext(-1));
  document.getElementById('find-next').addEventListener('click', () => findNext(1));
  document.getElementById('replace-one').addEventListener('click', replaceCurrent);
  document.getElementById('replace-all').addEventListener('click', replaceAll);
  document.getElementById('find-close').addEventListener('click', closePanel);
  document.getElementById('btn-find').addEventListener('click', () => openPanel(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      closePanel();
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'f' || key === 'h') {
      event.preventDefault();
      openPanel(key === 'h');
    }
  });
})();
