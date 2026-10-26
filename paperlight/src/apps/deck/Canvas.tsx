import type { Editor } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readAsDataUrl } from '../../editor/images';
import { lineHeight, SlideView } from './SlideView';
import {
  COLUMN_EDGES,
  MARGIN,
  PLACEHOLDER_TEXT,
  SLIDE_H,
  SLIDE_W,
  type Slide,
  type SlideElement,
  type TextElement,
  textPaint,
  type Theme,
} from './model';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const SNAP = 10;
const MIN_SIZE = 24;

interface Guide {
  axis: 'x' | 'y';
  at: number;
}

interface CanvasProps {
  slide: Slide;
  theme: Theme;
  index: number;
  count: number;
  deckTitle: string;
  selection: string[];
  onSelect: (ids: string[]) => void;
  onChange: (elements: SlideElement[], coalesce?: string) => void;
  onEditorReady: (editor: Editor | null) => void;
  onAddImage: (src: string, at?: { x: number; y: number }) => void;
  onReplaceImage: (id: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** A text box that should take the caret as soon as it appears. */
  focusId: string | null;
}

interface Drag {
  kind: 'move' | Handle;
  startX: number;
  startY: number;
  boxes: Map<string, { x: number; y: number; w: number; h: number }>;
  moved: boolean;
  keepAspect: boolean;
}

function edgesOf(box: { x: number; y: number; w: number; h: number }) {
  return { x: [box.x, box.x + box.w / 2, box.x + box.w], y: [box.y, box.y + box.h / 2, box.y + box.h] };
}

/** Pulls a moving box onto the margins, the columns, the centre lines and other elements. */
function snapBox(others: SlideElement[], sides: { x: number[]; y: number[] }) {
  const targetsX = [MARGIN, SLIDE_W / 2, SLIDE_W - MARGIN, ...COLUMN_EDGES];
  const targetsY = [MARGIN, SLIDE_H / 2, SLIDE_H - MARGIN];
  for (const other of others) {
    const e = edgesOf(other);
    targetsX.push(...e.x);
    targetsY.push(...e.y);
  }
  const guides: Guide[] = [];
  let dx = 0;
  let dy = 0;
  let bestX = SNAP + 1;
  for (const side of sides.x) {
    for (const target of targetsX) {
      const d = target - side;
      if (Math.abs(d) < Math.abs(bestX)) {
        bestX = d;
      }
    }
  }
  if (Math.abs(bestX) <= SNAP) {
    dx = bestX;
    const snapped = sides.x.map((side) => side + dx);
    for (const target of targetsX) if (snapped.some((side) => Math.abs(side - target) < 0.5)) guides.push({ axis: 'x', at: target });
  }
  let bestY = SNAP + 1;
  for (const side of sides.y) {
    for (const target of targetsY) {
      const d = target - side;
      if (Math.abs(d) < Math.abs(bestY)) bestY = d;
    }
  }
  if (Math.abs(bestY) <= SNAP) {
    dy = bestY;
    const snapped = sides.y.map((side) => side + dy);
    for (const target of targetsY) if (snapped.some((side) => Math.abs(side - target) < 0.5)) guides.push({ axis: 'y', at: target });
  }
  return { dx, dy, guides };
}

interface TextBoxEditorProps {
  element: TextElement;
  theme: Theme;
  onHtml: (html: string) => void;
  onReady: (editor: Editor | null) => void;
  focusAt: { x: number; y: number } | null;
  autoFocus: boolean;
}

/** The rich-text editor that replaces a text box while it is selected. */
function TextBoxEditor({ element, theme, onHtml, onReady, focusAt, autoFocus }: TextBoxEditorProps) {
  const onHtmlRef = useRef(onHtml);
  onHtmlRef.current = onHtml;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false, code: false, link: false }),
      Placeholder.configure({ placeholder: element.placeholder ? PLACEHOLDER_TEXT[element.placeholder] : 'Add text' }),
    ],
    content: element.html,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { class: 'pl-slide-editor', spellcheck: 'true', 'aria-label': 'Text box' } },
    onUpdate: ({ editor: current }) => {
      const html = current.isEmpty ? '' : current.getHTML();
      onHtmlRef.current(html);
    },
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  useEffect(() => {
    if (autoFocus) editor.commands.focus('end');
  }, [autoFocus, editor]);

  // Undo and other outside changes reach the box while it isn't being typed in.
  useEffect(() => {
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (!editor.isFocused && current !== element.html) editor.commands.setContent(element.html, { emitUpdate: false });
  }, [editor, element.html]);

  useEffect(() => {
    if (!focusAt) return;
    const pos = editor.view.posAtCoords({ left: focusAt.x, top: focusAt.y });
    editor.chain().focus().setTextSelection(pos?.pos ?? editor.state.doc.content.size).run();
  }, [editor, focusAt]);

  return (
    <div
      className="pl-slide-text pl-slide-text--editing"
      style={{
        left: element.x,
        top: element.y,
        width: element.w,
        minHeight: element.h,
        fontSize: element.size,
        fontWeight: element.weight,
        lineHeight: lineHeight(element.size),
        textAlign: element.align,
        color: textPaint(element.color, theme),
        letterSpacing: element.size >= 40 ? '-0.03em' : undefined,
        ['--marker' as string]: theme.accent,
        ['--placeholder' as string]: theme.muted,
        caretColor: theme.text,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  const { slide, theme, selection } = props;
  const rootRef = props.canvasRef;
  const slideRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 500 });
  const [draft, setDraft] = useState<Map<string, { x: number; y: number; w: number; h: number }> | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [focusAt, setFocusAt] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, [rootRef]);

  useEffect(() => setFocusAt(null), [slide.id]);

  // Whole pixels, so the scaled slide meets its frame without a hairline gap.
  const width = Math.floor(Math.max(0.2, Math.min((size.width - 64) / SLIDE_W, (size.height - 48) / SLIDE_H)) * SLIDE_W);
  const scale = width / SLIDE_W;
  const selected = new Set(selection);
  const single = selection.length === 1 ? slide.elements.find((element) => element.id === selection[0]) : undefined;
  const editing = single?.kind === 'text' ? single : undefined;
  const boxOf = (element: SlideElement) => draft?.get(element.id) ?? element;

  const toSlide = (clientX: number, clientY: number) => {
    const rect = slideRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const startDrag = (event: React.PointerEvent, kind: Drag['kind'], ids: string[]) => {
    event.stopPropagation();
    event.preventDefault();
    const point = toSlide(event.clientX, event.clientY);
    const boxes = new Map(slide.elements.filter((element) => ids.includes(element.id)).map((element) => [element.id, { x: element.x, y: element.y, w: element.w, h: element.h }]));
    const image = ids.length === 1 && slide.elements.find((element) => element.id === ids[0])?.kind === 'image';
    dragRef.current = { kind, startX: point.x, startY: point.y, boxes, moved: false, keepAspect: !!image };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    rootRef.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toSlide(event.clientX, event.clientY);
    let dx = point.x - drag.startX;
    let dy = point.y - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    const others = slide.elements.filter((element) => !drag.boxes.has(element.id));
    const next = new Map<string, { x: number; y: number; w: number; h: number }>();
    if (drag.kind === 'move') {
      const all = [...drag.boxes.values()];
      const bounds = {
        x: Math.min(...all.map((b) => b.x)) + dx,
        y: Math.min(...all.map((b) => b.y)) + dy,
        w: Math.max(...all.map((b) => b.x + b.w)) - Math.min(...all.map((b) => b.x)),
        h: Math.max(...all.map((b) => b.y + b.h)) - Math.min(...all.map((b) => b.y)),
      };
      const snap = event.altKey ? { dx: 0, dy: 0, guides: [] } : snapBox(others, edgesOf(bounds));
      dx += snap.dx;
      dy += snap.dy;
      setGuides(snap.guides);
      for (const [id, box] of drag.boxes) next.set(id, { ...box, x: Math.round(box.x + dx), y: Math.round(box.y + dy) });
    } else {
      const [id, box] = [...drag.boxes][0];
      let { x, y, w, h } = box;
      const k = drag.kind;
      if (k.includes('e')) w = Math.max(MIN_SIZE, box.w + dx);
      if (k.includes('s')) h = Math.max(MIN_SIZE, box.h + dy);
      if (k.includes('w')) {
        w = Math.max(MIN_SIZE, box.w - dx);
        x = box.x + box.w - w;
      }
      if (k.includes('n')) {
        h = Math.max(MIN_SIZE, box.h - dy);
        y = box.y + box.h - h;
      }
      if ((drag.keepAspect || event.shiftKey) && k.length === 2) {
        const ratio = box.w / box.h;
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
        if (k.includes('w')) x = box.x + box.w - w;
        if (k.includes('n')) y = box.y + box.h - h;
      }
      const moving = { x: k.includes('w') ? [x] : k.includes('e') ? [x + w] : [], y: k.includes('n') ? [y] : k.includes('s') ? [y + h] : [] };
      const snap = event.altKey ? { dx: 0, dy: 0, guides: [] } : snapBox(others, moving);
      if (k.includes('e')) w += snap.dx;
      if (k.includes('w')) {
        x += snap.dx;
        w -= snap.dx;
      }
      if (k.includes('s')) h += snap.dy;
      if (k.includes('n')) {
        y += snap.dy;
        h -= snap.dy;
      }
      setGuides(snap.guides);
      next.set(id, { x: Math.round(x), y: Math.round(y), w: Math.round(Math.max(MIN_SIZE, w)), h: Math.round(Math.max(MIN_SIZE, h)) });
    }
    setDraft(next);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setGuides([]);
    if (!drag) return;
    if (drag.moved && draft) {
      props.onChange(slide.elements.map((element) => (draft.has(element.id) ? { ...element, ...draft.get(element.id)! } : element)));
    } else if (!drag.moved && drag.kind === 'move' && editing && drag.boxes.has(editing.id)) {
      // A click on a selected text box puts the caret where it landed.
      setFocusAt({ x: event.clientX, y: event.clientY });
    }
    setDraft(null);
  };

  const pressElement = (event: React.PointerEvent, element: SlideElement) => {
    if (event.button !== 0) return;
    let ids = selection;
    if (event.shiftKey) {
      ids = selected.has(element.id) ? selection.filter((id) => id !== element.id) : [...selection, element.id];
      props.onSelect(ids);
      return;
    }
    if (!selected.has(element.id)) {
      ids = [element.id];
      props.onSelect(ids);
    }
    startDrag(event, 'move', ids);
  };

  const onDrop = async (event: React.DragEvent) => {
    const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    const point = toSlide(event.clientX, event.clientY);
    for (const file of files) props.onAddImage(await readAsDataUrl(file), point);
  };

  const showGrid = draft !== null;

  return (
    <div
      ref={rootRef}
      className="pl-deck-canvas"
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      onPointerDown={(event) => {
        if (event.button === 0 && event.target === event.currentTarget) props.onSelect([]);
      }}
      onDragOver={(event) => {
        if ([...event.dataTransfer.items].some((item) => item.type.startsWith('image/'))) event.preventDefault();
      }}
      onDrop={(event) => void onDrop(event)}
      aria-label={`Slide ${props.index + 1} of ${props.count}`}
    >
      <div className="pl-deck-stage" style={{ width, height: Math.round(SLIDE_H * scale) }} onPointerDown={(event) => event.target === event.currentTarget && props.onSelect([])}>
        <SlideView
          slide={draft ? { ...slide, elements: slide.elements.map((element) => (draft.has(element.id) ? { ...element, ...draft.get(element.id)! } : element)) } : slide}
          theme={theme}
          index={props.index}
          count={props.count}
          deckTitle={props.deckTitle}
          width={width}
          placeholders
          hide={editing ? new Set([editing.id]) : undefined}
        />
        <div
          ref={slideRef}
          className="pl-deck-layer"
          style={{
            transform: `scale(${scale})`,
            ['--sel' as string]: theme.select,
            ['--guide' as string]: theme.guide,
            ['--hover' as string]: theme.muted,
            ['--handle-fill' as string]: theme.background,
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerDown={(event) => {
            if (event.button === 0 && event.target === event.currentTarget) props.onSelect([]);
          }}
        >
          {showGrid && (
            <div className="pl-deck-grid" aria-hidden="true">
              {COLUMN_EDGES.map((x, i) => (
                <span key={i} style={{ left: x }} />
              ))}
            </div>
          )}
          {editing && (
            <TextBoxEditor
              key={editing.id}
              element={{ ...editing, ...(draft?.get(editing.id) ?? {}) }}
              theme={theme}
              focusAt={focusAt}
              autoFocus={props.focusId === editing.id}
              onReady={props.onEditorReady}
              onHtml={(html) => props.onChange(slide.elements.map((element) => (element.id === editing.id ? { ...element, html } : element)), `text:${editing.id}`)}
            />
          )}
          {slide.elements.map((element) => {
            const box = boxOf(element);
            const isSelected = selected.has(element.id);
            const isEditing = editing?.id === element.id;
            return (
              <div
                key={element.id}
                className="pl-deck-hit"
                data-selected={isSelected || undefined}
                data-editing={isEditing || undefined}
                style={{ left: box.x, top: box.y, width: box.w, height: Math.max(box.h, 8), ['--inv' as string]: 1 / scale }}
                onPointerDown={(event) => (isEditing ? undefined : pressElement(event, element))}
                onDoubleClick={() => {
                  if (element.kind === 'image') props.onReplaceImage(element.id);
                }}
              >
                {isEditing &&
                  (['n', 'e', 's', 'w'] as const).map((side) => (
                    <span key={side} className={`pl-deck-grip pl-deck-grip--${side}`} onPointerDown={(event) => startDrag(event, 'move', [element.id])} />
                  ))}
              </div>
            );
          })}
          {single &&
            HANDLES.map((handle) => {
              const box = boxOf(single);
              const x = handle.includes('w') ? box.x : handle.includes('e') ? box.x + box.w : box.x + box.w / 2;
              const y = handle.includes('n') ? box.y : handle.includes('s') ? box.y + box.h : box.y + box.h / 2;
              return (
                <span
                  key={handle}
                  className={`pl-deck-handle pl-deck-handle--${handle}`}
                  style={{ left: x, top: y, ['--inv' as string]: 1 / scale }}
                  onPointerDown={(event) => startDrag(event, handle, [single.id])}
                />
              );
            })}
          {guides.map((guide, i) => (
            <span key={i} className={`pl-deck-guide pl-deck-guide--${guide.axis}`} style={guide.axis === 'x' ? { left: guide.at, ['--inv' as string]: 1 / scale } : { top: guide.at, ['--inv' as string]: 1 / scale }} />
          ))}
        </div>
      </div>
    </div>
  );
}
