import { ChevronDown, ListFilter } from 'lucide-react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cellKey, colName, normalize, type Point, type Rect } from './engine/address';
import { isError, type CellValue } from './engine/values';
import { colWidth, hasContent, MIN_COL_WIDTH, type Cell, type FilterSpec, type Sheet } from './model';

export const ROW_H = 30;
export const HEAD_H = 30;
export const HEAD_W = 52;

export interface Selection {
  anchor: Point;
  focus: Point;
}

export interface EditState {
  row: number;
  col: number;
  value: string;
  caret: number;
  /** "enter" began by typing over the cell, so arrow keys finish the edit; "edit" moves the caret. */
  mode: 'enter' | 'edit';
  origin: 'cell' | 'line';
  /** Bumped whenever the caret must be placed from outside the input. */
  sync: number;
  /** The reference most recently inserted by clicking cells, replaced by the next click. */
  point: { start: number; end: number } | null;
}

export type DragMode = 'select' | 'point' | 'none';

export interface GridGeometry {
  x: (col: number) => number;
  y: (row: number) => number;
  width: (col: number) => number;
  cellAt: (x: number, y: number) => Point;
  bodyWidth: number;
  bodyHeight: number;
}

export interface GridHandle {
  focus: () => void;
  reveal: (point: Point) => void;
  element: () => HTMLDivElement | null;
  pageRows: () => number;
  /** The visible part of the cell area, in pixels, and how far it is scrolled. */
  viewport: () => { width: number; height: number; top: number; left: number };
}

interface GridProps {
  sheet: Sheet;
  rows: number;
  cols: number;
  hidden: Set<number>;
  text: (row: number, col: number) => string;
  value: (row: number, col: number) => CellValue;
  selection: Selection;
  edit: EditState | null;
  editorRef: React.RefObject<HTMLInputElement | null>;
  refHighlights: { rect: Rect; color: string }[];
  clipRect: Rect | null;
  filter: FilterSpec | null;
  filterActive: Set<number>;
  label: string;
  dark: boolean;
  onPointerStart: (point: Point, modifiers: { shift: boolean }) => DragMode;
  onPointerExtend: (point: Point, mode: DragMode) => void;
  onPointerEnd: (mode: DragMode) => void;
  onHeaderSelect: (kind: 'col' | 'row' | 'all', index: number, shift: boolean) => void;
  onEditCell: (point: Point) => void;
  onFill: (source: Rect, target: Rect) => void;
  onResizeColumn: (col: number, width: number) => void;
  onAutoFitColumn: (col: number) => void;
  onFilterButton: (col: number, anchor: DOMRect) => void;
  onContextMenu: (target: { kind: 'cell'; point: Point } | { kind: 'col' | 'row'; index: number }, x: number, y: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onEditorChange: (value: string, caret: number) => void;
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onEditorCaret: (caret: number) => void;
  onGrow: (axis: 'row' | 'col') => void;
  suggestions?: ReactNode;
  overlay?: (geometry: GridGeometry) => ReactNode;
}

let measureContext: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

function measure(text: string, bold: boolean) {
  const key = `${bold ? 'b' : 'r'}${text}`;
  let width = widthCache.get(key);
  if (width === undefined) {
    measureContext ??= document.createElement('canvas').getContext('2d');
    if (!measureContext) return text.length * 8;
    measureContext.font = `${bold ? 700 : 400} 14px Geist, "Segoe UI Variable", system-ui, sans-serif`;
    width = measureContext.measureText(text).width;
    if (widthCache.size > 20000) widthCache.clear();
    widthCache.set(key, width);
  }
  return width;
}

export function measureCellText(text: string, bold: boolean) {
  return measure(text, bold);
}

function lowerBound(edges: number[], value: number) {
  let lo = 0;
  let hi = edges.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (edges[mid] <= value) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

interface RowProps {
  row: number;
  top: number;
  startCol: number;
  endCol: number;
  cols: number;
  cells: Record<string, Cell>;
  edges: number[];
  text: (row: number, col: number) => string;
  value: (row: number, col: number) => CellValue;
  filterHeader: boolean;
  filterLeft: number;
  filterRight: number;
  filterActive: Set<number>;
  onFilterButton: (col: number, anchor: DOMRect) => void;
  dark: boolean;
}

const PADDING = 8;

/** The palette's text colours, lifted so they stay readable on the dark page. */
const DARK_TEXT: Record<string, string> = { '#2448D8': '#7D97FF', '#C2311A': '#F26B54', '#0B7A6C': '#3FBFA9', '#595959': '#A6A6A6' };

export function textColor(style: Cell['s'], dark: boolean) {
  if (style?.fill) return style.color ?? '#111111';
  if (!style?.color) return undefined;
  return dark ? (DARK_TEXT[style.color.toUpperCase()] ?? style.color) : style.color;
}

const GridRow = memo(function GridRow(props: RowProps) {
  const { row, top, startCol, endCol, cells, edges, text, value } = props;
  const out: ReactNode[] = [];
  // Text may spill in from columns left of the visible area.
  const from = Math.max(0, startCol - 6);
  for (let col = from; col <= endCol; col += 1) {
    const cell = cells[cellKey(row, col)];
    const filterButton = props.filterHeader && col >= props.filterLeft && col <= props.filterRight;
    if (!cell && !filterButton) continue;
    const content = hasContent(cell);
    const style = cell?.s;
    const shown = content ? text(row, col) : '';
    const computed = content ? value(row, col) : null;
    const numeric = typeof computed === 'number';
    const align = style?.align ?? (numeric ? 'right' : typeof computed === 'boolean' || isError(computed) ? 'center' : 'left');
    const x = edges[col];
    let width = edges[col + 1] - x;
    let display = shown;
    let spill = false;
    if (content && shown) {
      const needed = measure(shown, !!style?.bold) + PADDING * 2;
      if (needed > width) {
        if (numeric) {
          display = '#'.repeat(Math.max(1, Math.floor((width - PADDING * 2) / 8)));
        } else if (align === 'left') {
          let next = col + 1;
          while (next < props.cols && width < needed && !hasContent(cells[cellKey(row, next)])) {
            width = edges[next + 1] - x;
            next += 1;
          }
          spill = next > col + 1;
        }
      }
    }
    if (col < startCol - 0 && !spill) continue;
    const classes = ['pl-cell'];
    if (spill) classes.push('is-spill');
    if (style?.fill) classes.push('has-fill');
    out.push(
      <div
        key={col}
        className={classes.join(' ')}
        data-align={align}
        style={{
          left: x,
          top,
          width,
          fontWeight: style?.bold ? 700 : undefined,
          fontStyle: style?.italic ? 'italic' : undefined,
          textDecoration: style?.underline ? 'underline' : undefined,
          color: textColor(style, props.dark),
          background: style?.fill,
          paddingRight: filterButton ? 28 : undefined,
        }}
      >
        {display}
        {filterButton && (
          <button
            type="button"
            className="pl-filter-btn"
            data-active={props.filterActive.has(col) || undefined}
            aria-label={`Filter column ${colName(col)}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => props.onFilterButton(col, event.currentTarget.getBoundingClientRect())}
          >
            {props.filterActive.has(col) ? <ListFilter aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
        )}
      </div>,
    );
  }
  return <>{out}</>;
});

export const Grid = forwardRef<GridHandle, GridProps>(function Grid(props, ref) {
  const { sheet, rows, cols, hidden, selection } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, left: 0, width: 1200, height: 800 });
  const [resizing, setResizing] = useState<{ col: number; width: number } | null>(null);
  const [fillPreview, setFillPreview] = useState<Rect | null>(null);
  const dragRef = useRef<{ mode: DragMode | 'fill'; pointer: { x: number; y: number }; timer: number | null } | null>(null);

  const edges = useMemo(() => {
    const list = new Array<number>(cols + 1);
    list[0] = 0;
    for (let col = 0; col < cols; col += 1) {
      const width = resizing && resizing.col === col ? resizing.width : colWidth(sheet, col);
      list[col + 1] = list[col] + width;
    }
    return list;
  }, [cols, resizing, sheet]);

  const displayRows = useMemo(() => {
    const list: number[] = [];
    for (let row = 0; row < rows; row += 1) if (!hidden.has(row)) list.push(row);
    return list;
  }, [hidden, rows]);

  const rowIndex = useMemo(() => {
    const index = new Int32Array(rows + 1).fill(-1);
    displayRows.forEach((row, i) => {
      index[row] = i;
    });
    return index;
  }, [displayRows, rows]);

  const bodyWidth = edges[cols];
  const bodyHeight = displayRows.length * ROW_H;

  /** Top of a row, or of the next visible row when it is hidden by a filter. */
  const rowY = useCallback(
    (row: number) => {
      if (row >= rows) return bodyHeight;
      let r = row;
      while (r < rows && rowIndex[r] === -1) r += 1;
      return r >= rows ? bodyHeight : rowIndex[r] * ROW_H;
    },
    [bodyHeight, rowIndex, rows],
  );

  const cellAt = useCallback(
    (x: number, y: number): Point => {
      const i = Math.min(Math.max(Math.floor(y / ROW_H), 0), displayRows.length - 1);
      const col = Math.min(Math.max(lowerBound(edges, Math.max(0, x)), 0), cols - 1);
      return { row: displayRows[i] ?? 0, col };
    },
    [cols, displayRows, edges],
  );

  const geometry = useMemo<GridGeometry>(
    () => ({
      x: (col) => edges[Math.min(col, cols)],
      y: rowY,
      width: (col) => edges[col + 1] - edges[col],
      cellAt,
      bodyWidth,
      bodyHeight,
    }),
    [bodyHeight, bodyWidth, cellAt, cols, edges, rowY],
  );

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setView({ top: element.scrollTop, left: element.scrollLeft, width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const frame = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (!element) return;
      setView({ top: element.scrollTop, left: element.scrollLeft, width: element.clientWidth, height: element.clientHeight });
      if (element.scrollTop + element.clientHeight > element.scrollHeight - ROW_H * 30) props.onGrow('row');
      if (element.scrollLeft + element.clientWidth > element.scrollWidth - 400) props.onGrow('col');
    });
  };

  const reveal = useCallback(
    (point: Point) => {
      const element = scrollRef.current;
      if (!element) return;
      const x = edges[Math.min(point.col, cols)];
      const w = edges[Math.min(point.col + 1, cols)] - x;
      const y = rowY(point.row);
      const viewW = element.clientWidth - HEAD_W;
      const viewH = element.clientHeight - HEAD_H;
      let { scrollLeft, scrollTop } = element;
      if (x < scrollLeft) scrollLeft = x;
      else if (x + w > scrollLeft + viewW) scrollLeft = Math.min(x, x + w - viewW);
      if (y < scrollTop) scrollTop = y;
      else if (y + ROW_H > scrollTop + viewH) scrollTop = y + ROW_H - viewH;
      if (scrollLeft !== element.scrollLeft || scrollTop !== element.scrollTop) element.scrollTo({ left: scrollLeft, top: scrollTop });
    },
    [cols, edges, rowY],
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => rootRef.current?.focus({ preventScroll: true }),
      reveal,
      element: () => rootRef.current,
      pageRows: () => Math.max(1, Math.floor(((scrollRef.current?.clientHeight ?? 600) - HEAD_H) / ROW_H) - 1),
      viewport: () => ({
        width: (scrollRef.current?.clientWidth ?? 900) - HEAD_W,
        height: (scrollRef.current?.clientHeight ?? 600) - HEAD_H,
        top: scrollRef.current?.scrollTop ?? 0,
        left: scrollRef.current?.scrollLeft ?? 0,
      }),
    }),
    [reveal],
  );

  useEffect(() => {
    reveal(selection.focus);
  }, [reveal, selection.focus]);

  // Visible window, with a margin so short scrolls don't show blank strips.
  const bodyTop = view.top;
  const firstIndex = Math.max(0, Math.floor(bodyTop / ROW_H) - 4);
  const lastIndex = Math.min(displayRows.length - 1, Math.ceil((bodyTop + view.height) / ROW_H) + 4);
  const startCol = Math.max(0, lowerBound(edges, view.left) - 1);
  const endCol = Math.min(cols - 1, lowerBound(edges, view.left + view.width) + 1);
  const startQ = Math.max(0, Math.floor(startCol / 4) * 4);
  const endQ = Math.min(cols - 1, Math.ceil((endCol + 1) / 4) * 4);

  const pointFromEvent = (clientX: number, clientY: number) => {
    const body = bodyRef.current!.getBoundingClientRect();
    return cellAt(clientX - body.left, clientY - body.top);
  };

  const selRect = normalize(selection.anchor, selection.focus);
  const rectBox = (rect: Rect) => {
    const x = edges[Math.min(rect.left, cols)];
    const y = rowY(rect.top);
    return { left: x, top: y, width: edges[Math.min(rect.right + 1, cols)] - x, height: rowY(rect.bottom + 1) - y };
  };

  const stopDrag = () => {
    const drag = dragRef.current;
    if (drag?.timer) window.clearInterval(drag.timer);
    dragRef.current = null;
  };

  /** Scrolls while a drag is held past the edge of the grid, and keeps extending. */
  const autoScroll = () => {
    const drag = dragRef.current;
    const element = scrollRef.current;
    if (!drag || !element) return;
    const box = element.getBoundingClientRect();
    const { x, y } = drag.pointer;
    const dx = x < box.left + HEAD_W ? -24 : x > box.right ? 24 : 0;
    const dy = y < box.top + HEAD_H ? -ROW_H : y > box.bottom ? ROW_H : 0;
    if (dx || dy) element.scrollBy(dx, dy);
    extendTo(x, y);
  };

  const extendTo = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointFromEvent(clientX, clientY);
    if (drag.mode === 'fill') {
      const below = point.row > selRect.bottom ? point.row - selRect.bottom : point.row < selRect.top ? selRect.top - point.row : 0;
      const beside = point.col > selRect.right ? point.col - selRect.right : point.col < selRect.left ? selRect.left - point.col : 0;
      if (below === 0 && beside === 0) setFillPreview(null);
      else if (below >= beside) {
        setFillPreview(point.row > selRect.bottom ? { ...selRect, bottom: point.row } : { ...selRect, top: point.row });
      } else {
        setFillPreview(point.col > selRect.right ? { ...selRect, right: point.col } : { ...selRect, left: point.col });
      }
      return;
    }
    props.onPointerExtend(point, drag.mode);
  };

  const onBodyPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.pl-chart, .pl-cell-editor, .pl-suggest')) return;
    const point = pointFromEvent(event.clientX, event.clientY);
    if (event.detail === 2) {
      event.preventDefault();
      props.onEditCell(point);
      return;
    }
    const mode = props.onPointerStart(point, { shift: event.shiftKey });
    if (mode === 'point') event.preventDefault();
    else rootRef.current?.focus({ preventScroll: true });
    if (mode === 'none') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { mode, pointer: { x: event.clientX, y: event.clientY }, timer: window.setInterval(autoScroll, 60) };
  };

  const onFillPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { mode: 'fill', pointer: { x: event.clientX, y: event.clientY }, timer: window.setInterval(autoScroll, 60) };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.pointer = { x: event.clientX, y: event.clientY };
    extendTo(event.clientX, event.clientY);
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    const mode = drag.mode;
    if (mode === 'fill') {
      if (fillPreview) props.onFill(selRect, fillPreview);
      setFillPreview(null);
    } else props.onPointerEnd(mode);
    stopDrag();
    // While pointing at cells for a formula, the caret stays in the formula.
    if (mode !== 'point') rootRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => () => stopDrag(), []);

  const startResize = (event: React.PointerEvent, col: number) => {
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = colWidth(sheet, col);
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    let latest = startWidth;
    const move = (e: PointerEvent) => {
      latest = Math.max(MIN_COL_WIDTH, Math.round(startWidth + e.clientX - startX));
      setResizing({ col, width: latest });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      setResizing(null);
      if (latest !== startWidth) props.onResizeColumn(col, latest);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  const headerPointer = (kind: 'col' | 'row') => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const body = bodyRef.current!.getBoundingClientRect();
    const point = cellAt(event.clientX - body.left, event.clientY - body.top);
    rootRef.current?.focus({ preventScroll: true });
    props.onHeaderSelect(kind, kind === 'col' ? point.col : point.row, event.shiftKey);
  };

  // A filter can hide the active cell's row; then there is nothing to outline.
  const anchorHidden = selection.anchor.row < rows && rowIndex[selection.anchor.row] === -1;
  const selectedCols = selRect.top === 0 && selRect.bottom >= rows - 1;
  const selectedRows = selRect.left === 0 && selRect.right >= cols - 1;
  const single = selRect.top === selRect.bottom && selRect.left === selRect.right;
  const box = rectBox(selRect);
  const active = rectBox({ top: selection.anchor.row, left: selection.anchor.col, bottom: selection.anchor.row, right: selection.anchor.col });
  const edit = props.edit;
  const editorBox = edit ? rectBox({ top: edit.row, left: edit.col, bottom: edit.row, right: edit.col }) : null;
  const editorWidth = edit && editorBox ? Math.min(Math.max(editorBox.width, measure(edit.value, false) + 28), 560) : 0;

  const visibleRows = displayRows.slice(firstIndex, lastIndex + 1);
  const filter = props.filter;

  return (
    <div
      ref={rootRef}
      className="pl-grid"
      tabIndex={0}
      role="grid"
      aria-label={props.label}
      aria-rowcount={rows}
      aria-colcount={cols}
      onKeyDown={props.onKeyDown}
      style={{ '--head-w': `${HEAD_W}px`, '--head-h': `${HEAD_H}px` } as React.CSSProperties}
    >
      <div className="pl-grid-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="pl-grid-content" style={{ gridTemplateColumns: `${HEAD_W}px ${bodyWidth}px`, gridTemplateRows: `${HEAD_H}px ${bodyHeight}px` }}>
          <div
            className="pl-grid-corner"
            role="button"
            aria-label="Select all cells"
            onPointerDown={() => {
              rootRef.current?.focus({ preventScroll: true });
              props.onHeaderSelect('all', 0, false);
            }}
          />
          <div className="pl-grid-cols" style={{ width: bodyWidth }} onPointerDown={headerPointer('col')}>
            {Array.from({ length: endCol - startCol + 1 }, (_, i) => {
              const col = startCol + i;
              const on = col >= selRect.left && col <= selRect.right;
              return (
                <div
                  key={col}
                  className="pl-colhead"
                  data-on={on || undefined}
                  data-full={(on && selectedCols) || undefined}
                  style={{ left: edges[col], width: edges[col + 1] - edges[col] }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    props.onContextMenu({ kind: 'col', index: col }, event.clientX, event.clientY);
                  }}
                >
                  {colName(col)}
                  <span
                    className="pl-col-resize"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize column ${colName(col)}`}
                    onPointerDown={(event) => startResize(event, col)}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      props.onAutoFitColumn(col);
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="pl-grid-rows" style={{ height: bodyHeight }} onPointerDown={headerPointer('row')}>
            {visibleRows.map((row, i) => {
              const on = row >= selRect.top && row <= selRect.bottom;
              return (
                <div
                  key={row}
                  className="pl-rowhead"
                  data-on={on || undefined}
                  data-full={(on && selectedRows) || undefined}
                  style={{ top: (firstIndex + i) * ROW_H }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    props.onContextMenu({ kind: 'row', index: row }, event.clientX, event.clientY);
                  }}
                >
                  {row + 1}
                </div>
              );
            })}
          </div>
          <div
            className="pl-grid-body"
            ref={bodyRef}
            style={{ width: bodyWidth, height: bodyHeight }}
            onPointerDown={onBodyPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(event) => {
              if ((event.target as HTMLElement).closest('.pl-chart')) return;
              event.preventDefault();
              props.onContextMenu({ kind: 'cell', point: pointFromEvent(event.clientX, event.clientY) }, event.clientX, event.clientY);
            }}
          >
            <div className="pl-gridlines" style={{ top: firstIndex * ROW_H, height: (lastIndex - firstIndex + 1) * ROW_H }}>
              {Array.from({ length: endCol - startCol + 1 }, (_, i) => (
                <span key={startCol + i} style={{ left: edges[startCol + i + 1] - 1 }} />
              ))}
            </div>
            {visibleRows.map((row, i) => (
              <GridRow
                key={row}
                row={row}
                top={(firstIndex + i) * ROW_H}
                startCol={startQ}
                endCol={endQ}
                cols={cols}
                cells={sheet.cells}
                edges={edges}
                text={props.text}
                value={props.value}
                filterHeader={!!filter && filter.header === row}
                filterLeft={filter?.left ?? -1}
                filterRight={filter?.right ?? -1}
                filterActive={props.filterActive}
                onFilterButton={props.onFilterButton}
                dark={props.dark}
              />
            ))}

            {props.clipRect && (
              <svg className="pl-clip-marquee" style={rectBox(props.clipRect)} aria-hidden="true">
                <rect x="1" y="1" />
              </svg>
            )}

            {props.refHighlights.map((highlight, i) => (
              <div key={i} className="pl-ref-box" style={{ ...rectBox(highlight.rect), '--ref': highlight.color } as React.CSSProperties} />
            ))}

            {!single && (
              <div
                className="pl-sel-fill"
                style={{
                  ...box,
                  clipPath: `path(evenodd, 'M0 0 H${box.width} V${box.height} H0 Z M${active.left - box.left} ${active.top - box.top} h${active.width} v${active.height} h${-active.width} Z')`,
                }}
              />
            )}
            {!(single && anchorHidden) && <div className="pl-sel-box" style={single ? active : box} />}
            {fillPreview && <div className="pl-fill-preview" style={rectBox(fillPreview)} />}
            {!edit && !anchorHidden && (
              <div
                className="pl-fill-handle"
                style={{ left: box.left + box.width - 5, top: box.top + box.height - 5 }}
                onPointerDown={onFillPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                aria-hidden="true"
              />
            )}

            {props.overlay?.(geometry)}

            {edit && editorBox && edit.origin === 'cell' && (
              <div className="pl-cell-editor" style={{ left: editorBox.left, top: editorBox.top, width: editorWidth }}>
                <CellInput
                  inputRef={props.editorRef}
                  edit={edit}
                  onChange={props.onEditorChange}
                  onKeyDown={props.onEditorKeyDown}
                  onCaret={props.onEditorCaret}
                />
                {props.suggestions}
              </div>
            )}
            {edit && editorBox && edit.origin === 'line' && (
              <div className="pl-cell-mirror" style={{ left: editorBox.left, top: editorBox.top, width: editorWidth }}>
                {edit.value}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

interface CellInputProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  edit: EditState;
  onChange: (value: string, caret: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onCaret: (caret: number) => void;
  className?: string;
  ariaLabel?: string;
}

/** The text field used for editing, in the cell and in the formula line. */
export function CellInput({ inputRef, edit, onChange, onKeyDown, onCaret, className = 'pl-cell-input', ariaLabel = 'Cell contents' }: CellInputProps) {
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (document.activeElement !== input) input.focus({ preventScroll: true });
    input.setSelectionRange(edit.caret, edit.caret);
    // The caret is placed only when `sync` changes; typing moves it natively.
  }, [edit.sync]);

  return (
    <input
      ref={inputRef}
      className={className}
      value={edit.value}
      spellCheck={false}
      autoComplete="off"
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
      onKeyDown={onKeyDown}
      onSelect={(event) => onCaret(event.currentTarget.selectionStart ?? 0)}
    />
  );
}
