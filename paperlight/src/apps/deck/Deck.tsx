import type { Editor } from '@tiptap/core';
import { HardDrive } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readAsDataUrl, pickImageDataUrl } from '../../editor/images';
import { bridge } from '../../lib/bridge';
import { matchesShortcut, useRegisterCommands, type Command } from '../../lib/commands';
import { fileBase } from '../../lib/format';
import { useShell } from '../../shell/ShellContext';
import { ConfirmDialog, PromptDialog } from '../../ui/Dialog';
import { Canvas } from './Canvas';
import { DeckBar } from './DeckBar';
import { DeckPrint } from './DeckPrint';
import {
  duplicateSlide,
  formatSeconds,
  layoutElements,
  LAYOUTS,
  moveItem,
  newId,
  newSlide,
  SLIDE_H,
  SLIDE_W,
  THEMES,
  themeOf,
  totalSeconds,
  type Deck as DeckModel,
  type LayoutId,
  type ShapeKind,
  type Slide,
  type SlideElement,
  type TextElement,
} from './model';
import { NotesPanel } from './NotesPanel';
import { Presenter } from './Presenter';
import { Sorter } from './Sorter';
import { DECK_TEMPLATES } from './templates';
import { Timeline } from './Timeline';
import { useDecks, type SaveState } from './useDecks';
import '../../editor/doc.css';
import '../../ui/bars.css';
import './deck.css';

const PPTX_FILTERS = [{ name: 'PowerPoint presentation (.pptx)', extensions: ['pptx'] }];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 800, height: image.naturalHeight || 600 });
    image.onerror = () => resolve({ width: 800, height: 600 });
    image.src = src;
  });
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Deck: loads the decks on this computer and edits the open one. */
export function Deck({ open }: { open?: string | null }) {
  const shell = useShell();
  const onError = useCallback((message: string) => shell.toast(message, 'error'), [shell]);
  const library = useDecks(onError, open);

  if (!library.decks || !library.current) {
    return (
      <div className="pl-deck pl-deck--loading">
        <p>Opening your decks…</p>
      </div>
    );
  }
  return (
    <DeckEditor
      key={library.current.id}
      deck={library.current}
      decks={library.decks}
      save={library.save}
      onUpdate={library.update}
      onCreate={library.create}
      onOpenDeck={library.open}
      onRemove={library.remove}
    />
  );
}

interface DeckEditorProps {
  deck: DeckModel;
  decks: DeckModel[];
  save: SaveState;
  onUpdate: (deck: DeckModel) => void;
  onCreate: (template: string) => Promise<DeckModel>;
  onOpenDeck: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

type DialogState = { kind: 'rename' } | { kind: 'delete' };

function DeckEditor({ deck, decks, save, onUpdate, onCreate, onOpenDeck, onRemove }: DeckEditorProps) {
  const shell = useShell();
  const theme = themeOf(deck.theme);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, deck.slides.length - 1);
  const slide = deck.slides[current];
  const [selection, setSelection] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sorterOpen, setSorterOpen] = useState(false);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [printing, setPrinting] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const clipboard = useRef<SlideElement[]>([]);

  // History of whole decks; typing into one text box counts as one step.
  const history = useRef<{ past: DeckModel[]; future: DeckModel[]; lastKey: string | null }>({ past: [], future: [], lastKey: null });
  const commit = useCallback(
    (next: DeckModel, coalesce?: string) => {
      const h = history.current;
      if (!coalesce || coalesce !== h.lastKey) h.past = [...h.past.slice(-99), deckRef.current];
      h.future = [];
      h.lastKey = coalesce ?? null;
      deckRef.current = next;
      onUpdate(next);
    },
    [onUpdate],
  );
  const undo = useCallback(() => {
    const h = history.current;
    const previous = h.past.pop();
    if (!previous) return;
    h.future = [deckRef.current, ...h.future];
    h.lastKey = null;
    deckRef.current = previous;
    onUpdate(previous);
  }, [onUpdate]);
  const redo = useCallback(() => {
    const h = history.current;
    const [next, ...rest] = h.future;
    if (!next) return;
    h.past = [...h.past, deckRef.current];
    h.future = rest;
    h.lastKey = null;
    deckRef.current = next;
    onUpdate(next);
  }, [onUpdate]);

  const updateSlide = useCallback(
    (fn: (slide: Slide) => Slide, coalesce?: string) => {
      const book = deckRef.current;
      const i = Math.min(index, book.slides.length - 1);
      const slides = book.slides.slice();
      slides[i] = fn(slides[i]);
      commit({ ...book, slides }, coalesce);
    },
    [commit, index],
  );

  const setElements = useCallback((elements: SlideElement[], coalesce?: string) => updateSlide((s) => ({ ...s, elements }), coalesce), [updateSlide]);

  const focusCanvas = useCallback(() => requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true })), []);

  /** Bar changes to the selection; the keyboard goes back to the slide afterwards. */
  const patchSelected = useCallback(
    (patch: (element: SlideElement) => SlideElement) => {
      updateSlide((s) => ({ ...s, elements: s.elements.map((element) => (selection.includes(element.id) ? patch(element) : element)) }));
      focusCanvas();
    },
    [focusCanvas, selection, updateSlide],
  );

  const goToSlide = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(next, deckRef.current.slides.length - 1)));
    setSelection([]);
    setFocusId(null);
  }, []);

  useEffect(() => {
    document.title = `${deck.title || 'Untitled deck'} — Deck`;
  }, [deck.title]);
  useEffect(() => () => void (document.title = 'Paperlight'), []);

  // ----- Slides -----

  const addSlide = useCallback(
    (layout: LayoutId = 'content') => {
      const book = deckRef.current;
      const at = Math.min(index, book.slides.length - 1) + 1;
      const slides = book.slides.slice();
      slides.splice(at, 0, newSlide(layout, { number: String(at + 1).padStart(2, '0') }));
      commit({ ...book, slides });
      goToSlide(at);
    },
    [commit, goToSlide, index],
  );

  const changeLayout = useCallback(
    (layout: LayoutId) => {
      updateSlide((s) => {
        const texts = s.elements.filter((element): element is TextElement => element.kind === 'text' && !!element.placeholder);
        const titles = texts.filter((element) => element.placeholder === 'title' || element.placeholder === 'statement').map((element) => element.html);
        const bodies = texts.filter((element) => element.placeholder !== 'title' && element.placeholder !== 'statement' && element.placeholder !== 'number').map((element) => element.html);
        const keep = s.elements.filter((element) => !(element.kind === 'text' && element.placeholder) && !(element.kind === 'image' && !element.src));
        const at = deckRef.current.slides.findIndex((entry) => entry.id === s.id);
        const fresh = layoutElements(layout, { number: String(at + 1).padStart(2, '0') }).map((element) => {
          if (element.kind !== 'text') return element;
          if (element.placeholder === 'title' || element.placeholder === 'statement') return { ...element, html: titles.shift() ?? '' };
          if (element.placeholder === 'number') return element;
          return { ...element, html: bodies.shift() ?? '' };
        });
        return { ...s, layout, elements: [...fresh, ...keep] };
      });
      setSelection([]);
    },
    [updateSlide],
  );

  const moveSlide = useCallback(
    (from: number, to: number) => {
      const book = deckRef.current;
      commit({ ...book, slides: moveItem(book.slides, from, to) });
      setIndex(Math.max(0, Math.min(to, book.slides.length - 1)));
    },
    [commit],
  );

  const duplicate = useCallback(
    (at: number) => {
      const book = deckRef.current;
      const slides = book.slides.slice();
      slides.splice(at + 1, 0, duplicateSlide(book.slides[at]));
      commit({ ...book, slides });
      goToSlide(at + 1);
    },
    [commit, goToSlide],
  );

  const deleteSlide = useCallback(
    (at: number) => {
      const book = deckRef.current;
      if (book.slides.length === 1) {
        commit({ ...book, slides: [newSlide('title', {}, 30)] });
        goToSlide(0);
        return;
      }
      commit({ ...book, slides: book.slides.filter((_, i) => i !== at) });
      goToSlide(Math.min(at, book.slides.length - 2));
      shell.toast('Slide deleted. Ctrl Z brings it back.');
    },
    [commit, goToSlide, shell],
  );

  // ----- Elements -----

  const addElement = useCallback(
    (element: SlideElement) => {
      updateSlide((s) => ({ ...s, elements: [...s.elements, element] }));
      setSelection([element.id]);
      if (element.kind === 'text') setFocusId(element.id);
      else focusCanvas();
    },
    [focusCanvas, updateSlide],
  );

  const addText = useCallback(() => {
    addElement({ id: newId(), kind: 'text', x: 240, y: 300, w: 800, h: 80, html: '', size: 36, weight: 400, align: 'left', color: 'text' });
  }, [addElement]);

  const addShape = useCallback(
    (shape: ShapeKind) => {
      const flat = shape === 'line' || shape === 'arrow';
      const w = flat ? 400 : shape === 'ellipse' ? 240 : 320;
      const h = flat ? 8 : shape === 'ellipse' ? 240 : 200;
      addElement({ id: newId(), kind: 'shape', shape, x: (SLIDE_W - w) / 2, y: (SLIDE_H - h) / 2, w, h, fill: flat ? null : 'accent', stroke: flat ? 'text' : null, strokeWidth: flat ? 6 : 4 });
    },
    [addElement],
  );

  const placeImage = useCallback(
    async (src: string, at?: { x: number; y: number }) => {
      const target = deckRef.current.slides[Math.min(index, deckRef.current.slides.length - 1)].elements.find(
        (element) => element.kind === 'image' && !element.src && (selection.includes(element.id) || !at),
      );
      if (target) {
        updateSlide((s) => ({ ...s, elements: s.elements.map((element) => (element.id === target.id ? { ...element, src } : element)) }));
        setSelection([target.id]);
        focusCanvas();
        return;
      }
      const { width, height } = await imageSize(src);
      const scale = Math.min(720 / width, 480 / height, 1);
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const x = at ? Math.max(0, Math.min(at.x - w / 2, SLIDE_W - w)) : (SLIDE_W - w) / 2;
      const y = at ? Math.max(0, Math.min(at.y - h / 2, SLIDE_H - h)) : (SLIDE_H - h) / 2;
      addElement({ id: newId(), kind: 'image', x: Math.round(x), y: Math.round(y), w, h, src, fit: 'cover' });
    },
    [addElement, focusCanvas, index, selection, updateSlide],
  );

  const pickImage = useCallback(
    async (replaceId?: string) => {
      try {
        const picked = await pickImageDataUrl();
        if (!picked) return;
        if (replaceId) {
          updateSlide((s) => ({ ...s, elements: s.elements.map((element) => (element.id === replaceId && element.kind === 'image' ? { ...element, src: picked.src } : element)) }));
          focusCanvas();
        } else await placeImage(picked.src);
      } catch (error) {
        shell.toast(`Couldn't add the picture: ${errorMessage(error)}`, 'error');
      }
    },
    [focusCanvas, placeImage, shell, updateSlide],
  );

  const deleteSelection = useCallback(() => {
    if (selection.length === 0) return;
    updateSlide((s) => ({ ...s, elements: s.elements.filter((element) => !selection.includes(element.id)) }));
    setSelection([]);
    focusCanvas();
  }, [focusCanvas, selection, updateSlide]);

  const duplicateSelection = useCallback(() => {
    const copies = slide.elements.filter((element) => selection.includes(element.id)).map((element) => ({ ...element, id: newId(), x: element.x + 24, y: element.y + 24 }));
    if (copies.length === 0) return;
    updateSlide((s) => ({ ...s, elements: [...s.elements, ...copies] }));
    setSelection(copies.map((element) => element.id));
  }, [selection, slide.elements, updateSlide]);

  const arrange = useCallback(
    (where: 'front' | 'back') => {
      updateSlide((s) => {
        const chosen = s.elements.filter((element) => selection.includes(element.id));
        const rest = s.elements.filter((element) => !selection.includes(element.id));
        return { ...s, elements: where === 'front' ? [...rest, ...chosen] : [...chosen, ...rest] };
      });
      focusCanvas();
    },
    [focusCanvas, selection, updateSlide],
  );

  // ----- Files -----

  const exportPptx = useCallback(async () => {
    try {
      const { deckToPptx } = await import('./pptx');
      const data = await deckToPptx(deckRef.current);
      const result = await bridge.saveFile({ filePath: null, defaultName: `${fileBase(deckRef.current.title)}.pptx`, filters: PPTX_FILTERS, data });
      if (result?.path) shell.toast(`Exported to ${result.path}`);
    } catch (error) {
      shell.toast(`Couldn't export the presentation: ${errorMessage(error)}`, 'error');
    }
  }, [shell]);

  const exportPdf = useCallback(async () => {
    setSelection([]);
    setPrinting(true);
    document.documentElement.classList.add('pl-printing-deck');
    // Added last so it outranks the A4 page Prose prints on.
    const pageRule = document.createElement('style');
    pageRule.textContent = `@page { size: ${SLIDE_W}px ${SLIDE_H}px; margin: 0; }`;
    document.head.append(pageRule);
    try {
      await nextFrame();
      await nextFrame();
      await Promise.all([...document.querySelectorAll<HTMLImageElement>('.pl-deck-print img')].map((image) => image.decode().catch(() => undefined)));
      const result = await bridge.exportPdf({ defaultName: `${fileBase(deckRef.current.title)}.pdf` });
      if (result?.path) shell.toast(`PDF exported to ${result.path}`);
    } catch (error) {
      shell.toast(`Couldn't export the PDF: ${errorMessage(error)}`, 'error');
    } finally {
      pageRule.remove();
      document.documentElement.classList.remove('pl-printing-deck');
      setPrinting(false);
    }
  }, [shell]);

  const present = useCallback((from: number) => {
    setSelection([]);
    setSorterOpen(false);
    setPresenting(from);
  }, []);

  // ----- Keyboard -----

  const onCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('.ProseMirror')) {
        if (event.key === 'Escape') {
          event.preventDefault();
          editor?.commands.blur();
          canvasRef.current?.focus({ preventScroll: true });
        }
        return;
      }
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key;
      const nudge = event.shiftKey ? 10 : 1;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0], ArrowUp: [0, -nudge], ArrowDown: [0, nudge] };
      if (arrows[key] && selection.length > 0) {
        event.preventDefault();
        const [dx, dy] = arrows[key];
        updateSlide((s) => ({ ...s, elements: s.elements.map((element) => (selection.includes(element.id) ? { ...element, x: element.x + dx, y: element.y + dy } : element)) }), `nudge:${selection.join()}`);
        return;
      }
      if (selection.length === 0 && (key === 'ArrowDown' || key === 'ArrowRight' || key === 'PageDown')) {
        event.preventDefault();
        goToSlide(current + 1);
        return;
      }
      if (selection.length === 0 && (key === 'ArrowUp' || key === 'ArrowLeft' || key === 'PageUp')) {
        event.preventDefault();
        goToSlide(current - 1);
        return;
      }
      if (key === 'Delete' || key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      } else if (key === 'Escape') {
        setSelection([]);
      } else if (ctrl && key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelection();
      } else if (ctrl && key.toLowerCase() === 'c' && selection.length > 0) {
        event.preventDefault();
        clipboard.current = slide.elements.filter((element) => selection.includes(element.id));
      } else if (ctrl && key.toLowerCase() === 'x' && selection.length > 0) {
        event.preventDefault();
        clipboard.current = slide.elements.filter((element) => selection.includes(element.id));
        deleteSelection();
      } else if (ctrl && key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection(slide.elements.map((element) => element.id));
      } else if (ctrl && key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (ctrl && (key.toLowerCase() === 'y' || (key.toLowerCase() === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
      } else if ((key === 'Enter' || key === 'F2') && selection.length === 1 && slide.elements.find((element) => element.id === selection[0])?.kind === 'text') {
        event.preventDefault();
        editor?.commands.focus('end');
      } else if (!ctrl && !event.altKey && key.length === 1 && selection.length === 1 && editor) {
        event.preventDefault();
        editor.chain().focus('end').insertContent(key).run();
      }
    },
    [current, deleteSelection, duplicateSelection, editor, goToSlide, redo, selection, slide.elements, undo, updateSlide],
  );

  // Pictures and copied objects pasted onto the canvas.
  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      if (document.activeElement !== canvasRef.current) return;
      const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'));
      if (files.length > 0) {
        event.preventDefault();
        for (const file of files) await placeImage(await readAsDataUrl(file));
        return;
      }
      if (clipboard.current.length > 0) {
        event.preventDefault();
        const copies = clipboard.current.map((element) => ({ ...element, id: newId(), x: element.x + 24, y: element.y + 24 }));
        clipboard.current = copies;
        updateSlide((s) => ({ ...s, elements: [...s.elements, ...copies] }));
        setSelection(copies.map((element) => element.id));
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [placeImage, updateSlide]);

  useEffect(() => {
    const shortcuts: [string, () => void][] = [
      ['ctrl+m', () => addSlide('content')],
      ['f5', () => present(0)],
      ['shift+f5', () => present(current)],
    ];
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialog || presenting !== null) return;
      const hit = shortcuts.find(([shortcut]) => matchesShortcut(event, shortcut));
      if (!hit) return;
      event.preventDefault();
      hit[1]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addSlide, current, dialog, present, presenting]);

  // ----- Palette -----

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'deck-present', title: 'Present from the start', group: 'Deck', shortcut: 'F5', keywords: 'slideshow full screen', run: () => present(0) },
      { id: 'deck-present-here', title: 'Present from this slide', group: 'Deck', shortcut: 'Shift F5', keywords: 'slideshow', run: () => present(current) },
      { id: 'deck-new-slide', title: 'New slide', group: 'Deck', shortcut: 'Ctrl M', keywords: 'add', run: () => addSlide('content') },
      { id: 'deck-duplicate-slide', title: 'Duplicate this slide', group: 'Deck', keywords: 'copy', run: () => duplicate(current) },
      { id: 'deck-delete-slide', title: 'Delete this slide', group: 'Deck', keywords: 'remove', run: () => deleteSlide(current) },
      { id: 'deck-sorter', title: sorterOpen ? 'Close the sorter' : 'Open the slide sorter', group: 'Deck', keywords: 'all slides reorder grid', run: () => setSorterOpen((value) => !value) },
      { id: 'deck-export-pptx', title: 'Export as PowerPoint (.pptx)', group: 'File', keywords: 'save pptx', run: () => void exportPptx() },
      { id: 'deck-export-pdf', title: 'Export as PDF', group: 'File', keywords: 'print save', run: () => void exportPdf() },
      { id: 'deck-rename', title: 'Rename this deck', group: 'File', run: () => setDialog({ kind: 'rename' }) },
      { id: 'deck-text', title: 'Add a text box', group: 'Insert', run: addText },
      { id: 'deck-picture', title: 'Add a picture', group: 'Insert', keywords: 'image photo', run: () => void pickImage() },
      { id: 'deck-undo', title: 'Undo', group: 'Edit', shortcut: 'Ctrl Z', run: undo },
      { id: 'deck-redo', title: 'Redo', group: 'Edit', shortcut: 'Ctrl Y', run: redo },
    ];
    for (const layout of LAYOUTS) list.push({ id: `deck-layout-${layout.id}`, title: `Layout: ${layout.name}`, group: 'Slide', keywords: 'layout', run: () => changeLayout(layout.id) });
    for (const entry of THEMES) list.push({ id: `deck-theme-${entry.id}`, title: `Theme: ${entry.name}`, group: 'Deck', keywords: 'colours look', run: () => commit({ ...deckRef.current, theme: entry.id }) });
    for (const template of DECK_TEMPLATES) list.push({ id: `deck-new-${template.id}`, title: `New deck: ${template.name}`, group: 'File', keywords: 'template', run: () => void onCreate(template.id) });
    deck.slides.forEach((entry, i) => list.push({ id: `deck-go-${entry.id}`, title: `Go to slide ${i + 1}`, group: 'Slides', run: () => goToSlide(i) }));
    return list;
  }, [addSlide, addText, changeLayout, commit, current, deck.slides, deleteSlide, duplicate, exportPdf, exportPptx, goToSlide, onCreate, pickImage, present, redo, sorterOpen, undo]);

  useRegisterCommands('deck', commands);

  const selected = slide.elements.filter((element) => selection.includes(element.id));
  const total = totalSeconds(deck);

  return (
    <div className="pl-deck">
      <DeckBar
        decks={decks}
        deck={deck}
        theme={theme}
        save={save}
        selection={selected}
        editor={editor}
        sorterOpen={sorterOpen}
        onOpenDeck={(id) => void onOpenDeck(id)}
        onNewDeck={(template) => void onCreate(template)}
        onRenameDeck={() => setDialog({ kind: 'rename' })}
        onDeleteDeck={() => setDialog({ kind: 'delete' })}
        onNewSlide={addSlide}
        onLayout={changeLayout}
        onTheme={(id) => commit({ ...deckRef.current, theme: id })}
        onAddText={addText}
        onAddShape={addShape}
        onAddImage={() => void pickImage()}
        onToggleSorter={() => setSorterOpen((value) => !value)}
        onTextSize={(size) => patchSelected((element) => (element.kind === 'text' ? { ...element, size, h: Math.max(element.h, Math.round(size * 1.4)) } : element))}
        onTextAlign={(align) => patchSelected((element) => (element.kind === 'text' ? { ...element, align } : element))}
        onTextColor={(color) => patchSelected((element) => (element.kind === 'text' ? { ...element, color } : element))}
        onFill={(fill) => patchSelected((element) => (element.kind === 'shape' ? { ...element, fill } : element))}
        onStroke={(stroke) => patchSelected((element) => (element.kind === 'shape' ? { ...element, stroke } : element))}
        onReplaceImage={() => selected[0] && void pickImage(selected[0].id)}
        onFit={(fit) => patchSelected((element) => (element.kind === 'image' ? { ...element, fit } : element))}
        onArrange={arrange}
        onDuplicate={duplicateSelection}
        onDelete={deleteSelection}
        onDeselect={() => {
          setSelection([]);
          focusCanvas();
        }}
        onExport={(kind) => void (kind === 'pptx' ? exportPptx() : exportPdf())}
        onPresent={() => present(current)}
        onOpenPalette={shell.openPalette}
      />

      <div className="pl-deck-main">
        <div className="pl-deck-work">
          <Canvas
            canvasRef={canvasRef}
            slide={slide}
            theme={theme}
            index={current}
            count={deck.slides.length}
            deckTitle={deck.title}
            selection={selection}
            focusId={focusId}
            onSelect={(ids) => {
              setSelection(ids);
              setFocusId(null);
            }}
            onChange={setElements}
            onEditorReady={setEditor}
            onAddImage={(src, at) => void placeImage(src, at)}
            onReplaceImage={(id) => void pickImage(id)}
            onKeyDown={onCanvasKeyDown}
          />
          <NotesPanel
            slide={slide}
            onNotes={(notes) => updateSlide((s) => ({ ...s, notes }), `notes:${slide.id}`)}
            onSeconds={(seconds) => updateSlide((s) => ({ ...s, seconds }))}
          />
        </div>
        <Timeline
          slides={deck.slides}
          current={current}
          total={total}
          onSelect={goToSlide}
          onMove={moveSlide}
          onAdd={() => addSlide('content')}
          onDuplicate={duplicate}
          onDelete={deleteSlide}
        />
        {sorterOpen && (
          <Sorter
            deck={deck}
            theme={theme}
            current={current}
            onSelect={(i) => setIndex(i)}
            onOpen={(i) => {
              goToSlide(i);
              setSorterOpen(false);
              focusCanvas();
            }}
            onMove={moveSlide}
            onDelete={deleteSlide}
            onClose={() => {
              setSorterOpen(false);
              focusCanvas();
            }}
          />
        )}
      </div>

      <footer className="pl-statusbar">
        <span className="pl-status-fig">
          Slide {current + 1} of {deck.slides.length}
        </span>
        <span className="pl-status-fig">
          {formatSeconds(slide.seconds)} of {formatSeconds(total)} planned
        </span>
        <span className="pl-status-fig">Theme: {theme.name}</span>
        <div className="pl-status-end">
          <span className="pl-status-local">
            <HardDrive aria-hidden="true" />
            Stored on this computer
          </span>
        </div>
      </footer>

      {presenting !== null && (
        <Presenter
          deck={deck}
          theme={theme}
          start={presenting}
          onClose={(last) => {
            setPresenting(null);
            goToSlide(last);
            focusCanvas();
          }}
        />
      )}
      {printing && <DeckPrint deck={deck} theme={theme} />}

      {dialog?.kind === 'rename' && (
        <PromptDialog
          title="Rename deck"
          label="Name"
          initialValue={deck.title}
          confirmLabel="Rename"
          onCancel={() => setDialog(null)}
          onConfirm={(title) => {
            setDialog(null);
            commit({ ...deckRef.current, title });
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete “${deck.title || 'Untitled deck'}”?`}
          message={`This removes the deck and its ${deck.slides.length} ${deck.slides.length === 1 ? 'slide' : 'slides'} from this computer. It can't be undone.`}
          confirmLabel="Delete deck"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            void onRemove(deck.id);
          }}
        />
      )}
    </div>
  );
}
