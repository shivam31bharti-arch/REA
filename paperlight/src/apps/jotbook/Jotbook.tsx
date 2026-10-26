import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { HardDrive } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { matchesShortcut, useRegisterCommands, type Command } from '../../lib/commands';
import { buildBlocks } from '../../editor/blocks';
import { BubbleToolbar } from '../../editor/BubbleToolbar';
import { FindBar } from '../../editor/FindBar';
import { pickAndInsertImage } from '../../editor/images';
import { LinkPopover } from '../../editor/LinkPopover';
import { useShell } from '../../shell/ShellContext';
import { ConfirmDialog, PromptDialog } from '../../ui/Dialog';
import { JotBar, type SaveStamp } from './JotBar';
import { NoteEditor } from './NoteEditor';
import { PageStrip } from './PageStrip';
import { SearchPanel } from './SearchPanel';
import { useLibrary } from './useLibrary';
import '../../editor/doc.css';
import '../../editor/editor.css';
import '../../ui/bars.css';
import '../../ui/strip.css';
import './jotbook.css';

type DialogState =
  | { kind: 'new-notebook' }
  | { kind: 'rename-notebook' }
  | { kind: 'delete-notebook' }
  | { kind: 'new-section' }
  | { kind: 'rename-section' }
  | { kind: 'delete-section' }
  | { kind: 'delete-page'; pageId: string };

function editedLabel(timestamp: number) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return date.toDateString() === new Date().toDateString()
    ? `Edited ${time}`
    : `Edited ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

function NoteStatus({ editor, position, edited }: { editor: Editor; position: string; edited: string }) {
  const counts = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      // A page switch destroys the editor before this component learns about it.
      const counter = current.isDestroyed
        ? undefined
        : (current.storage.characterCount as { words: () => number; characters: () => number } | undefined);
      return { words: counter?.words() ?? 0, characters: counter?.characters() ?? 0 };
    },
  });
  return (
    <>
      <span className="pl-status-fig">{counts.words.toLocaleString()} words</span>
      <span className="pl-status-fig">{counts.characters.toLocaleString()} characters</span>
      <span className="pl-status-fig">{position}</span>
      <span className="pl-status-fig">{edited}</span>
    </>
  );
}

export function Jotbook({ startNewPage = false }: { startNewPage?: boolean }) {
  const shell = useShell();
  const { view, actions } = useLibrary(useCallback((message: string) => shell.toast(message, 'error'), [shell]));
  const [bound, setBound] = useState<{ editor: Editor; pageId: string } | null>(null);
  const onReady = useCallback((next: Editor | null, pageId: string) => {
    setBound((current) => (next ? { editor: next, pageId } : current?.pageId === pageId ? null : current));
  }, []);
  const [stamp, setStamp] = useState<SaveStamp>({ kind: 'saved', at: null });
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState<{ pageId: string; query: string } | null>(null);
  const [freshPageId, setFreshPageId] = useState<string | null>(null);
  const [find, setFind] = useState<{ mode: 'find' | 'replace'; token: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const page = view?.page ?? null;
  const pageId = page?.id ?? null;
  /** The editor, only once it belongs to the page on screen. */
  const editor = bound && bound.pageId === pageId ? bound.editor : null;
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;
  const blocks = useMemo(
    () =>
      buildBlocks({
        insertImage: () => {
          const current = editorRef.current;
          if (current) {
            pickAndInsertImage(current).catch((error: unknown) =>
              shell.toast(`Couldn't insert the image: ${error instanceof Error ? error.message : String(error)}`, 'error'),
            );
          }
        },
      }),
    [shell],
  );

  const newPage = useCallback(() => {
    if (!view?.section) return;
    setSearching(false);
    const id = actions.createPage(view.section.id);
    setFreshPageId(id);
  }, [actions, view?.section]);

  // Opened with New page from the Dashboard: start the page once the library is ready.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startNewPage || startedRef.current || !view?.section) return;
    startedRef.current = true;
    newPage();
  }, [startNewPage, view?.section, newPage]);

  const openSearch = useCallback(() => setSearching(true), []);

  const onPending = useCallback(() => setStamp({ kind: 'saving' }), []);
  const onSave = useCallback(
    (id: string, patch: Parameters<typeof actions.updatePage>[1]) => {
      actions.updatePage(id, patch);
      setStamp({ kind: 'saved', at: new Date() });
    },
    [actions],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const pageUpdatedAt = page?.updatedAt ?? null;
  const pageUpdatedAtRef = useRef(pageUpdatedAt);
  pageUpdatedAtRef.current = pageUpdatedAt;

  useEffect(() => {
    setFind(null);
    setLinkOpen(false);
    canvasRef.current?.scrollTo({ top: 0 });
    // The stamp always carries a time: the page's last save until the next one.
    const updatedAt = pageUpdatedAtRef.current;
    if (updatedAt) setStamp({ kind: 'saved', at: new Date(updatedAt) });
  }, [pageId]);

  useEffect(() => {
    const shortcuts: [string, () => void][] = [
      ['ctrl+n', newPage],
      ['ctrl+shift+n', () => setDialog({ kind: 'new-section' })],
      ['ctrl+f', openSearch],
      ['ctrl+h', () => editorRef.current && setFind((current) => ({ mode: 'replace', token: (current?.token ?? 0) + 1 }))],
    ];
    const onKeyDown = (event: KeyboardEvent) => {
      const hit = shortcuts.find(([shortcut]) => matchesShortcut(event, shortcut));
      if (!hit || dialog) return;
      event.preventDefault();
      hit[1]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, newPage, openSearch]);

  const commands = useMemo<Command[]>(() => {
    if (!view?.notebook || !view.section) return [];
    const list: Command[] = [
      { id: 'jot-new-page', title: 'New page', group: 'Jotbook', shortcut: 'Ctrl N', keywords: 'note add', run: newPage },
      { id: 'jot-new-section', title: 'New section', group: 'Jotbook', shortcut: 'Ctrl Shift N', keywords: 'tab group', run: () => setDialog({ kind: 'new-section' }) },
      { id: 'jot-new-notebook', title: 'New notebook', group: 'Jotbook', keywords: 'create', run: () => setDialog({ kind: 'new-notebook' }) },
      { id: 'jot-search', title: 'Search notes', group: 'Jotbook', shortcut: 'Ctrl F', keywords: 'find all notebooks', run: openSearch },
      { id: 'jot-find', title: 'Find and replace in page', group: 'Jotbook', shortcut: 'Ctrl H', keywords: 'replace', run: () => setFind({ mode: 'replace', token: Date.now() }) },
      { id: 'jot-rename-section', title: 'Rename section', group: 'Jotbook', run: () => setDialog({ kind: 'rename-section' }) },
      { id: 'jot-rename-notebook', title: 'Rename notebook', group: 'Jotbook', run: () => setDialog({ kind: 'rename-notebook' }) },
    ];
    if (pageId) {
      list.push(
        { id: 'jot-duplicate', title: 'Duplicate page', group: 'Jotbook', keywords: 'copy', run: () => actions.duplicatePage(pageId) },
        { id: 'jot-delete-page', title: 'Delete page', group: 'Jotbook', keywords: 'remove', run: () => setDialog({ kind: 'delete-page', pageId }) },
      );
    }
    list.push(
      { id: 'jot-delete-section', title: 'Delete section', group: 'Jotbook', keywords: 'remove', run: () => setDialog({ kind: 'delete-section' }) },
      { id: 'jot-delete-notebook', title: 'Delete notebook', group: 'Jotbook', keywords: 'remove', run: () => setDialog({ kind: 'delete-notebook' }) },
    );
    for (const section of view.library.sections) {
      const notebook = view.library.notebooks.find((entry) => entry.id === section.notebookId);
      list.push({
        id: `jot-go-${section.id}`,
        title: `Go to ${notebook?.name ?? 'Notebook'} / ${section.name}`,
        group: 'Sections',
        keywords: 'open switch',
        run: () => actions.selectSection(section.id),
      });
    }
    return list;
  }, [actions, newPage, openSearch, pageId, view]);

  useRegisterCommands('jotbook', commands);

  if (!view) {
    return (
      <div className="pl-jot pl-jot--loading">
        <p>Opening your notebooks…</p>
      </div>
    );
  }

  const { notebook, section, pages } = view;
  if (!notebook || !section) return null;

  const pageCounts = new Map<string, number>();
  for (const entry of view.library.pages) pageCounts.set(entry.sectionId, (pageCounts.get(entry.sectionId) ?? 0) + 1);
  const pageIndex = page ? pages.findIndex((entry) => entry.id === page.id) : -1;

  const closeDialog = () => setDialog(null);
  const pageForDialog = dialog?.kind === 'delete-page' ? view.library.pages.find((entry) => entry.id === dialog.pageId) : null;
  const sectionPageCount = pageCounts.get(section.id) ?? 0;
  const notebookPageCount = view.sections.reduce((total, entry) => total + (pageCounts.get(entry.id) ?? 0), 0);

  return (
    <div className="pl-jot">
      <JotBar
        editor={editor}
        notebooks={view.notebooks}
        notebook={notebook}
        sections={view.sections}
        section={section}
        pageCounts={pageCounts}
        blocks={blocks}
        stamp={stamp}
        onSelectNotebook={(id) => {
          setSearching(false);
          actions.selectNotebook(id);
        }}
        onSelectSection={(id) => {
          setSearching(false);
          actions.selectSection(id);
        }}
        onNewNotebook={() => setDialog({ kind: 'new-notebook' })}
        onRenameNotebook={() => setDialog({ kind: 'rename-notebook' })}
        onDeleteNotebook={() => setDialog({ kind: 'delete-notebook' })}
        onNewSection={() => setDialog({ kind: 'new-section' })}
        onRenameSection={() => setDialog({ kind: 'rename-section' })}
        onDeleteSection={() => setDialog({ kind: 'delete-section' })}
        onNewPage={newPage}
        onSearch={openSearch}
        onInsertLink={() => editor && setLinkOpen(true)}
      />

      <div className="pl-jot-body">
        {searching ? (
          <SearchPanel
            library={view.library}
            onClose={() => setSearching(false)}
            onOpen={(id, query) => {
              setSearching(false);
              setHighlight({ pageId: id, query });
              actions.selectPage(id);
            }}
          />
        ) : (
          <PageStrip
            section={section}
            pages={pages}
            currentPageId={page?.id ?? null}
            onSelect={actions.selectPage}
            onNewPage={newPage}
            onDuplicate={actions.duplicatePage}
            onDelete={(id) => setDialog({ kind: 'delete-page', pageId: id })}
          />
        )}

        <div className="pl-canvas-wrap">
          {find && editor && (
            <FindBar
              editor={editor}
              mode={find.mode}
              focusToken={find.token}
              onClose={() => setFind(null)}
              onReplacedAll={(count) => shell.toast(`Replaced ${count} ${count === 1 ? 'match' : 'matches'}`)}
            />
          )}
          <div className="pl-canvas" ref={canvasRef}>
            <div className="pl-jot-canvas-inner">
              {page ? (
                <NoteEditor
                  key={page.id}
                  page={page}
                  blocks={blocks}
                  highlight={highlight?.pageId === page.id ? highlight.query : null}
                  focusTitle={freshPageId === page.id}
                  onReady={onReady}
                  onPending={onPending}
                  onSave={onSave}
                />
              ) : (
                <div className="pl-note pl-note--empty">
                  <p className="pl-note-empty-title">Nothing open</p>
                  <p className="pl-note-meta">Pick a page on the left, or start a new one.</p>
                  <button type="button" className="pl-btn pl-btn--outline" onClick={newPage}>
                    New page
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="pl-statusbar">
        {editor && page ? (
          <NoteStatus
            key={page.id}
            editor={editor}
            position={`Page ${pageIndex + 1} of ${pages.length} in ${section.name}`}
            edited={editedLabel(page.updatedAt)}
          />
        ) : (
          <span className="pl-status-fig">{pages.length} pages in {section.name}</span>
        )}
        <div className="pl-status-end">
          <span className="pl-status-local">
            <HardDrive aria-hidden="true" />
            Stored on this computer
          </span>
        </div>
      </footer>

      {editor && <BubbleToolbar editor={editor} onEditLink={() => setLinkOpen(true)} />}
      {linkOpen && editor && <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />}

      {dialog?.kind === 'new-notebook' && (
        <PromptDialog
          title="New notebook"
          label="Name"
          confirmLabel="Create notebook"
          onCancel={closeDialog}
          onConfirm={(name) => {
            closeDialog();
            setSearching(false);
            setFreshPageId(actions.createNotebook(name));
          }}
        />
      )}
      {dialog?.kind === 'rename-notebook' && (
        <PromptDialog
          title="Rename notebook"
          label="Name"
          initialValue={notebook.name}
          confirmLabel="Rename"
          onCancel={closeDialog}
          onConfirm={(name) => {
            closeDialog();
            actions.renameNotebook(notebook.id, name);
          }}
        />
      )}
      {dialog?.kind === 'delete-notebook' && (
        <ConfirmDialog
          title={`Delete “${notebook.name}”?`}
          message={`This removes the notebook, its ${view.sections.length} ${view.sections.length === 1 ? 'section' : 'sections'} and ${notebookPageCount} ${notebookPageCount === 1 ? 'page' : 'pages'} from this computer. It can't be undone.`}
          confirmLabel="Delete notebook"
          onCancel={closeDialog}
          onConfirm={() => {
            closeDialog();
            actions.deleteNotebook(notebook.id);
          }}
        />
      )}
      {dialog?.kind === 'new-section' && (
        <PromptDialog
          title={`New section in ${notebook.name}`}
          label="Name"
          confirmLabel="Create section"
          onCancel={closeDialog}
          onConfirm={(name) => {
            closeDialog();
            setSearching(false);
            setFreshPageId(actions.createSection(notebook.id, name));
          }}
        />
      )}
      {dialog?.kind === 'rename-section' && (
        <PromptDialog
          title="Rename section"
          label="Name"
          initialValue={section.name}
          confirmLabel="Rename"
          onCancel={closeDialog}
          onConfirm={(name) => {
            closeDialog();
            actions.renameSection(section.id, name);
          }}
        />
      )}
      {dialog?.kind === 'delete-section' && (
        <ConfirmDialog
          title={`Delete “${section.name}”?`}
          message={`This removes the section and its ${sectionPageCount} ${sectionPageCount === 1 ? 'page' : 'pages'} from this computer. It can't be undone.`}
          confirmLabel="Delete section"
          onCancel={closeDialog}
          onConfirm={() => {
            closeDialog();
            actions.deleteSection(section.id);
          }}
        />
      )}
      {dialog?.kind === 'delete-page' && pageForDialog && (
        <ConfirmDialog
          title={`Delete “${pageForDialog.title.trim() || 'Untitled page'}”?`}
          message="This removes the page from this computer. It can't be undone."
          confirmLabel="Delete page"
          onCancel={closeDialog}
          onConfirm={() => {
            closeDialog();
            actions.deletePage(pageForDialog.id);
          }}
        />
      )}
    </div>
  );
}
