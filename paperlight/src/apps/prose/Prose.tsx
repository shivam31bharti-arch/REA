import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bridge } from '../../lib/bridge';
import { useRegisterCommands, matchesShortcut, type Command } from '../../lib/commands';
import { DOCX_FILTERS, type ProseDoc } from '../../lib/documents';
import { documentToDocx } from '../../lib/docx-export';
import { fileBase, stripExtension } from '../../lib/format';
import { removeDraft, saveDraft } from '../../lib/library';
import { useShell } from '../../shell/ShellContext';
import { buildBlocks } from '../../editor/blocks';
import { BubbleToolbar } from '../../editor/BubbleToolbar';
import { CommandBar, type Alignment, type FormatState, type Stamp } from './CommandBar';
import { createExtensions } from '../../editor/createExtensions';
import { FindBar } from '../../editor/FindBar';
import { imageEditorProps, pickAndInsertImage } from '../../editor/images';
import { LinkPopover } from '../../editor/LinkPopover';
import { Outline } from './Outline';
import { computeOutline } from './outlineModel';
import { StatusBar } from './StatusBar';
import { currentStyle, PARAGRAPH_STYLES } from '../../editor/styles';
import '../../editor/doc.css';
import '../../editor/editor.css';
import '../../ui/bars.css';
import './prose.css';

const PAGE_HEIGHT = 1123;
const ZOOM_STEPS = [0.75, 0.9, 1, 1.1, 1.25, 1.5];

interface ProseProps {
  doc: ProseDoc;
  onNewDocument: () => void;
  onOpenDocument: () => void;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Compares documents while ignoring the empty paragraph the editor appends after lists and tables. */
function sameContent(a: ProseMirrorNode, b: ProseMirrorNode) {
  const blocks = (doc: ProseMirrorNode) => {
    const nodes: ProseMirrorNode[] = [];
    doc.forEach((node) => nodes.push(node));
    while (nodes.length > 0 && nodes[nodes.length - 1].type.name === 'paragraph' && nodes[nodes.length - 1].content.size === 0) {
      nodes.pop();
    }
    return nodes;
  };
  const left = blocks(a);
  const right = blocks(b);
  return left.length === right.length && left.every((node, index) => node.eq(right[index]));
}

export function Prose({ doc, onNewDocument, onOpenDocument }: ProseProps) {
  const shell = useShell();
  const insertImageRef = useRef<() => void>(() => {});
  const blocks = useMemo(() => buildBlocks({ insertImage: () => insertImageRef.current() }), []);
  const extensions = useMemo(
    () => createExtensions({ blocks, placeholder: 'Write, or type / to add a heading, list, table or image', focusMode: true }),
    [blocks],
  );

  const editor = useEditor({
    extensions,
    content: doc.html,
    autofocus: 'start',
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'pl-doc', spellcheck: 'true', 'aria-label': 'Document', 'aria-multiline': 'true' },
      ...imageEditorProps,
    },
  });

  const [title, setTitle] = useState(doc.title);
  const [filePath, setFilePath] = useState(doc.filePath);
  const [stamp, setStamp] = useState<Stamp>(
    doc.dirty ? { kind: 'unsaved' } : doc.filePath ? { kind: 'saved', at: null } : { kind: 'new' },
  );
  const [focusMode, setFocusMode] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(() => window.innerWidth >= 1180);
  const [zoom, setZoom] = useState(1);
  const [find, setFind] = useState<{ mode: 'find' | 'replace'; token: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);

  const pageRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(doc.dirty);
  const titleRef = useRef(title);
  const filePathRef = useRef(filePath);
  titleRef.current = title;
  filePathRef.current = filePath;
  /** The content as last saved (or as opened); edits are measured against it. */
  const baselineRef = useRef<ProseMirrorNode>(editor.state.doc);
  const baselineTitleRef = useRef(doc.title);
  /** False while the content exists only as a draft, so no edit can make it clean. */
  const persistedRef = useRef(!doc.dirty);
  const cleanStampRef = useRef<Stamp>(doc.filePath ? { kind: 'saved', at: null } : { kind: 'new' });

  const format = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const align = (['center', 'right', 'justify'] as const).find((value) => current.isActive({ textAlign: value }));
      const counter = current.storage.characterCount as { words: () => number; characters: () => number };
      return {
        format: {
          bold: current.isActive('bold'),
          italic: current.isActive('italic'),
          underline: current.isActive('underline'),
          bullet: current.isActive('bulletList'),
          ordered: current.isActive('orderedList'),
          task: current.isActive('taskList'),
          style: currentStyle(current),
          align: (align ?? 'left') as Alignment,
        } satisfies FormatState,
        words: counter.words(),
        characters: counter.characters(),
        outline: computeOutline(current),
      };
    },
  });

  const persistDraft = useCallback(() => {
    saveDraft({
      id: doc.draftId,
      title: titleRef.current,
      html: editor.getHTML(),
      filePath: filePathRef.current,
      updatedAt: Date.now(),
    });
  }, [doc.draftId, editor]);

  const refreshDirty = useCallback(() => {
    const dirty =
      !persistedRef.current ||
      titleRef.current !== baselineTitleRef.current ||
      !sameContent(editor.state.doc, baselineRef.current);
    dirtyRef.current = dirty;
    setStamp((current) => (current.kind === 'saving' ? current : dirty ? { kind: 'unsaved' } : cleanStampRef.current));
    return dirty;
  }, [editor]);

  useEffect(() => {
    let timer: number | undefined;
    const onUpdate = () => {
      window.clearTimeout(timer);
      if (refreshDirty()) timer = window.setTimeout(persistDraft, 700);
      else removeDraft(doc.draftId);
    };
    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
      window.clearTimeout(timer);
    };
  }, [doc.draftId, editor, persistDraft, refreshDirty]);

  useEffect(() => {
    editor.commands.setFocusMode(focusMode);
  }, [editor, focusMode]);

  const unsaved = stamp.kind === 'unsaved' || (stamp.kind === 'exported' && stamp.unsaved);
  useEffect(() => {
    document.title = `${unsaved ? '• ' : ''}${title || 'Untitled'} — Prose`;
  }, [title, unsaved]);

  useEffect(() => () => void (document.title = 'Paperlight'), []);

  const changeTitle = (next: string) => {
    setTitle(next);
    titleRef.current = next;
    if (refreshDirty()) persistDraft();
  };

  const save = useCallback(
    async (saveAs: boolean) => {
      const previous = stamp;
      setStamp({ kind: 'saving' });
      try {
        const data = await documentToDocx(editor.getJSON(), titleRef.current);
        const result = await bridge.saveFile({
          filePath: saveAs ? null : filePathRef.current,
          defaultName: `${fileBase(titleRef.current)}.docx`,
          filters: DOCX_FILTERS,
          data,
        });
        if (!result) {
          setStamp(dirtyRef.current ? { kind: 'unsaved' } : previous);
          return;
        }
        setFilePath(result.path);
        filePathRef.current = result.path;
        if (result.path) void bridge.addRecent({ path: result.path, name: result.name, app: 'prose', openedAt: Date.now() });
        if (titleRef.current === 'Untitled') {
          titleRef.current = stripExtension(result.name);
          setTitle(titleRef.current);
        }
        baselineRef.current = editor.state.doc;
        baselineTitleRef.current = titleRef.current;
        persistedRef.current = true;
        dirtyRef.current = false;
        removeDraft(doc.draftId);
        cleanStampRef.current = { kind: 'saved', at: new Date() };
        setStamp(cleanStampRef.current);
      } catch (error) {
        setStamp({ kind: 'error' });
        shell.toast(`Couldn't save the document: ${errorMessage(error)}`, 'error');
      }
    },
    [doc.draftId, editor, shell, stamp],
  );

  const exportPdf = useCallback(async () => {
    try {
      const result = await bridge.exportPdf({ defaultName: `${fileBase(titleRef.current)}.pdf` });
      if (!result) return;
      const exported: Stamp = { kind: 'exported', at: new Date(), unsaved: dirtyRef.current };
      if (!dirtyRef.current) cleanStampRef.current = exported;
      setStamp(exported);
      if (result.path) shell.toast(`PDF exported to ${result.path}`);
    } catch (error) {
      shell.toast(`Couldn't export the PDF: ${errorMessage(error)}`, 'error');
    }
  }, [shell]);

  insertImageRef.current = async () => {
    try {
      await pickAndInsertImage(editor);
    } catch (error) {
      shell.toast(`Couldn't insert the image: ${errorMessage(error)}`, 'error');
    }
  };

  const openFind = useCallback((mode: 'find' | 'replace') => {
    setFind((current) => ({ mode: current?.mode === 'replace' ? 'replace' : mode, token: (current?.token ?? 0) + 1 }));
  }, []);

  const zoomBy = useCallback((direction: 1 | -1) => {
    setZoom((current) => {
      const index = ZOOM_STEPS.indexOf(current);
      return ZOOM_STEPS[Math.min(Math.max(index + direction, 0), ZOOM_STEPS.length - 1)];
    });
  }, []);

  const toggleFocus = useCallback(() => {
    setFocusMode((value) => !value);
    editor.commands.focus();
  }, [editor]);

  useEffect(() => {
    const element = pageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setPages(Math.max(1, Math.ceil(element.offsetHeight / PAGE_HEIGHT))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => {
      const element = pageRef.current;
      if (!element) return;
      try {
        const caret = editor.view.coordsAtPos(editor.state.selection.head);
        const top = (caret.top - element.getBoundingClientRect().top) / zoom;
        setPage(Math.max(1, Math.floor(top / PAGE_HEIGHT) + 1));
      } catch {
        // Selection is not rendered yet.
      }
    };
    editor.on('selectionUpdate', update);
    editor.on('update', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('update', update);
    };
  }, [editor, zoom]);

  useEffect(() => {
    const shortcuts: [string, () => void][] = [
      ['ctrl+s', () => void save(false)],
      ['ctrl+shift+s', () => void save(true)],
      ['ctrl+p', () => void exportPdf()],
      ['ctrl+o', onOpenDocument],
      ['ctrl+n', onNewDocument],
      ['ctrl+f', () => openFind('find')],
      ['ctrl+h', () => openFind('replace')],
      ['ctrl+shift+f', toggleFocus],
      ['ctrl+=', () => zoomBy(1)],
      ['ctrl+-', () => zoomBy(-1)],
      ['ctrl+0', () => setZoom(1)],
    ];
    const onKeyDown = (event: KeyboardEvent) => {
      const hit = shortcuts.find(([shortcut]) => matchesShortcut(event, shortcut));
      if (!hit) return;
      event.preventDefault();
      hit[1]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exportPdf, onNewDocument, onOpenDocument, openFind, save, toggleFocus, zoomBy]);

  const commands = useMemo<Command[]>(() => {
    const chain = () => editor.chain().focus();
    const list: Command[] = [
      { id: 'prose-save', title: 'Save', group: 'File', shortcut: 'Ctrl S', keywords: 'docx write', run: () => void save(false) },
      { id: 'prose-save-as', title: 'Save as…', group: 'File', shortcut: 'Ctrl Shift S', keywords: 'docx copy', run: () => void save(true) },
      { id: 'prose-pdf', title: 'Export PDF', group: 'File', shortcut: 'Ctrl P', keywords: 'print', run: () => void exportPdf() },
      { id: 'prose-open', title: 'Open…', group: 'File', shortcut: 'Ctrl O', keywords: 'docx file', run: onOpenDocument },
      { id: 'prose-new', title: 'New document', group: 'File', shortcut: 'Ctrl N', keywords: 'blank', run: onNewDocument },
      { id: 'prose-undo', title: 'Undo', group: 'Edit', shortcut: 'Ctrl Z', run: () => chain().undo().run() },
      { id: 'prose-redo', title: 'Redo', group: 'Edit', shortcut: 'Ctrl Y', run: () => chain().redo().run() },
      { id: 'prose-find', title: 'Find', group: 'Edit', shortcut: 'Ctrl F', keywords: 'search', run: () => openFind('find') },
      { id: 'prose-replace', title: 'Find and replace', group: 'Edit', shortcut: 'Ctrl H', keywords: 'search swap', run: () => openFind('replace') },
      { id: 'prose-bold', title: 'Bold', group: 'Format', shortcut: 'Ctrl B', run: () => chain().toggleBold().run() },
      { id: 'prose-italic', title: 'Italic', group: 'Format', shortcut: 'Ctrl I', run: () => chain().toggleItalic().run() },
      { id: 'prose-underline', title: 'Underline', group: 'Format', shortcut: 'Ctrl U', run: () => chain().toggleUnderline().run() },
      { id: 'prose-strike', title: 'Strikethrough', group: 'Format', run: () => chain().toggleStrike().run() },
      { id: 'prose-highlight', title: 'Highlight', group: 'Format', keywords: 'marker yellow', run: () => chain().toggleHighlight().run() },
      { id: 'prose-clear', title: 'Clear formatting', group: 'Format', run: () => chain().unsetAllMarks().clearNodes().run() },
      ...PARAGRAPH_STYLES.map((style) => ({
        id: `prose-style-${style.id}`,
        title: style.label,
        group: 'Format',
        keywords: 'style paragraph',
        run: () => style.apply(editor),
      })),
      ...(['left', 'center', 'right', 'justify'] as const).map((align) => ({
        id: `prose-align-${align}`,
        title: align === 'justify' ? 'Justify text' : `Align ${align}`,
        group: 'Format',
        keywords: 'alignment',
        run: () => chain().setTextAlign(align).run(),
      })),
      ...blocks
        .filter((block) => !['text', 'h1', 'h2', 'h3'].includes(block.id))
        .map((block) => ({
          id: `prose-insert-${block.id}`,
          title: `Insert ${block.title.toLowerCase()}`,
          group: 'Insert',
          keywords: block.keywords,
          run: () => block.run(editor),
        })),
      { id: 'prose-link', title: 'Insert link', group: 'Insert', keywords: 'url web', run: () => setLinkOpen(true) },
      { id: 'prose-focus', title: focusMode ? 'Leave focus mode' : 'Focus mode', group: 'View', shortcut: 'Ctrl Shift F', keywords: 'distraction', run: toggleFocus },
      { id: 'prose-outline', title: outlineOpen ? 'Hide outline' : 'Show outline', group: 'View', keywords: 'sidebar headings', run: () => setOutlineOpen((value) => !value) },
      { id: 'prose-zoom-in', title: 'Zoom in', group: 'View', shortcut: 'Ctrl =', run: () => zoomBy(1) },
      { id: 'prose-zoom-out', title: 'Zoom out', group: 'View', shortcut: 'Ctrl -', run: () => zoomBy(-1) },
      { id: 'prose-zoom-reset', title: 'Actual size', group: 'View', shortcut: 'Ctrl 0', run: () => setZoom(1) },
    ];
    return list;
  }, [blocks, editor, exportPdf, focusMode, onNewDocument, onOpenDocument, openFind, outlineOpen, save, toggleFocus, zoomBy]);

  useRegisterCommands('prose', commands);

  return (
    <div className="pl-prose" data-focus={focusMode ? 'on' : 'off'} data-outline={outlineOpen ? 'on' : 'off'}>
      <CommandBar
        editor={editor}
        format={format.format}
        title={title}
        onTitleChange={changeTitle}
        stamp={stamp}
        blocks={blocks}
        onSave={() => void save(false)}
        onSaveAs={() => void save(true)}
        onExportPdf={() => void exportPdf()}
        onOpen={onOpenDocument}
        onNew={onNewDocument}
        onInsertLink={() => setLinkOpen(true)}
        onOpenPalette={shell.openPalette}
      />
      <div className="pl-prose-body">
        {outlineOpen && <Outline editor={editor} entries={format.outline} />}
        <div className="pl-canvas-wrap">
          {find && (
            <FindBar
              editor={editor}
              mode={find.mode}
              focusToken={find.token}
              onClose={() => setFind(null)}
              onReplacedAll={(count) => shell.toast(`Replaced ${count} ${count === 1 ? 'match' : 'matches'}`)}
            />
          )}
          <div className="pl-canvas">
          <div className="pl-canvas-inner">
            <div className="pl-zoom-frame" style={{ zoom }}>
              <div className="pl-page" ref={pageRef}>
                {Array.from({ length: pages - 1 }, (_, index) => (
                  <div key={index} className="pl-page-guide" style={{ top: (index + 1) * PAGE_HEIGHT }} aria-hidden="true">
                    <span>{index + 2}</span>
                  </div>
                ))}
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
      <StatusBar
        words={format.words}
        characters={format.characters}
        page={Math.min(page, pages)}
        pages={pages}
        zoom={zoom}
        focusMode={focusMode}
        outlineOpen={outlineOpen}
        onToggleFocus={toggleFocus}
        onToggleOutline={() => setOutlineOpen((value) => !value)}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onZoomReset={() => setZoom(1)}
      />
      <BubbleToolbar editor={editor} onEditLink={() => setLinkOpen(true)} />
      {linkOpen && <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}
