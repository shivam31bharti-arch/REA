import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  ClipboardPaste,
  Copy,
  Eraser,
  HardDrive,
  Scissors,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bridge } from '../../lib/bridge';
import { matchesShortcut, useRegisterCommands, type Command } from '../../lib/commands';
import { folderOf, stripExtension } from '../../lib/format';
import { useShell } from '../../shell/ShellContext';
import { ContextMenu } from '../../ui/ContextMenu';
import { ConfirmDialog, PromptDialog } from '../../ui/Dialog';
import type { MenuEntry } from '../../ui/Menu';
import { CellsBar, type CellsStamp } from './CellsBar';
import { ChartFrame } from './ChartFrame';
import { chartData, chartPicture } from './charts';
import { cellKey, cellName, colName, MAX_COLS, MAX_ROWS, normalize, parseRange, rectName, type Point, type Rect } from './engine/address';
import { compare } from './engine/coerce';
import { Calc } from './engine/evaluate';
import { editText, formatValue, parseInput } from './engine/format';
import { FormulaError, normalizeFormula, parseFormula, tokenize, translateFormula } from './engine/parser';
import type { CellValue } from './engine/values';
import { FilterMenu } from './FilterMenu';
import {
  CSV_FILTERS,
  removeCellsDraft,
  saveCellsDraft,
  writeCsv,
  writeXlsx,
  XLSX_FILTERS,
  xlsxName,
  type CellsDoc,
} from './files';
import { FormulaLine } from './FormulaLine';
import { Grid, measureCellText, ROW_H, type DragMode, type EditState, type GridGeometry, type GridHandle, type Selection } from './Grid';
import {
  calcSource,
  changeStructure,
  clearCells,
  colWidth,
  copyBlock,
  currentRegion,
  deleteSheet,
  duplicateSheet,
  fillCells,
  filterBottom,
  hasContent,
  hiddenRows,
  jumpTarget,
  looksLikeHeader,
  moveSheet,
  newId,
  newSheet,
  pasteBlock,
  renameSheet,
  replaceSheet,
  setCells,
  sheetExtent,
  sortableRows,
  sortRows,
  styleCells,
  textToRows,
  uniqueSheetName,
  validSheetName,
  type Align,
  type Cell,
  type CellStyle,
  type CellUpdate,
  type ChartKind,
  type Clip,
  type Workbook,
} from './model';
import { SheetStrip } from './SheetStrip';
import { acceptSuggestion, SuggestList, suggestFor } from './suggest';
import '../../ui/bars.css';
import '../../ui/strip.css';
import './cells.css';

interface CellsProps {
  doc: CellsDoc;
  onNewWorkbook: () => void;
  onOpenWorkbook: () => void;
}

type DialogState = { kind: 'rename-sheet'; index: number } | { kind: 'delete-sheet'; index: number } | { kind: 'rename-chart'; id: string };

const REF_COLORS = {
  light: ['#2448D8', '#D63A22', '#0B7A6C', '#B7791F', '#7A4FD6'],
  dark: ['#7D97FF', '#F26B54', '#3FBFA9', '#F2C230', '#B39DFF'],
};
const ORIGIN: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } };
const POINTABLE = /[=(,;+\-*/^&<>:]\s*$/;
const COUNTING = /^(COUNT|COUNTA|COUNTIF|COUNTIFS|COUNTBLANK|ROWS|COLUMNS|ROW|COLUMN|LEN|MATCH|FIND|SEARCH)\(/i;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function useHistory(initial: Workbook) {
  const [state, setState] = useState({ present: initial, past: [] as Workbook[], future: [] as Workbook[] });
  const commit = useCallback((next: Workbook) => {
    setState((current) =>
      next === current.present ? current : { present: next, past: [...current.past.slice(-199), current.present], future: [] },
    );
  }, []);
  const undo = useCallback(() => {
    setState((current) =>
      current.past.length === 0
        ? current
        : { present: current.past[current.past.length - 1], past: current.past.slice(0, -1), future: [current.present, ...current.future] },
    );
  }, []);
  const redo = useCallback(() => {
    setState((current) =>
      current.future.length === 0
        ? current
        : { present: current.future[0], past: [...current.past, current.present], future: current.future.slice(1) },
    );
  }, []);
  return { workbook: state.present, commit, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

/** Repairs the most common slip, a missing closing bracket, the way spreadsheets do. */
function completeFormula(formula: string): { formula: string } | { problem: string } {
  const candidates = [formula, `${formula})`, `${formula}))`, `${formula})))`];
  let first: string | null = null;
  for (const candidate of candidates) {
    try {
      parseFormula(candidate);
      return { formula: candidate };
    } catch (error) {
      first ??= error instanceof FormulaError ? error.message : String(error);
    }
  }
  return { problem: first ?? 'This formula can’t be read.' };
}

export function Cells({ doc, onNewWorkbook, onOpenWorkbook }: CellsProps) {
  const shell = useShell();
  const history = useHistory(doc.workbook);
  const { workbook, commit } = history;
  const workbookRef = useRef(workbook);
  workbookRef.current = workbook;

  const [sheetIndex, setSheetIndex] = useState(0);
  const index = Math.min(sheetIndex, workbook.sheets.length - 1);
  const sheet = workbook.sheets[index];
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const selection = selections[sheet.id] ?? ORIGIN;
  const selRect = normalize(selection.anchor, selection.focus);
  const [edit, setEditState] = useState<EditState | null>(null);
  const editRef = useRef(edit);
  editRef.current = edit;
  const [clip, setClip] = useState<(Clip & { cut: boolean; sheetId: string }) | null>(null);
  const [grow, setGrow] = useState({ rows: 0, cols: 0 });
  const [filterMenu, setFilterMenu] = useState<{ col: number; anchor: DOMRect } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const pointStartRef = useRef<Point | null>(null);
  const pointCursorRef = useRef<Point | null>(null);

  const [title, setTitle] = useState(doc.title);
  const [filePath, setFilePath] = useState(doc.filePath);
  const [stampOverride, setStampOverride] = useState<CellsStamp | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const savedRef = useRef<{ workbook: Workbook; title: string; persisted: boolean }>({ workbook: doc.workbook, title: doc.title, persisted: !doc.dirty });
  const titleRef = useRef(title);
  titleRef.current = title;
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;

  const gridRef = useRef<GridHandle>(null);
  const cellEditorRef = useRef<HTMLInputElement>(null);
  const lineEditorRef = useRef<HTMLInputElement>(null);

  const calc = useMemo(() => new Calc(calcSource(workbook)), [workbook]);
  const value = useCallback((row: number, col: number) => calc.value(index, row, col), [calc, index]);
  const text = useCallback(
    (row: number, col: number) => {
      const cell = sheet.cells[cellKey(row, col)];
      return hasContent(cell) ? formatValue(calc.value(index, row, col), cell?.s?.format) : '';
    },
    [calc, index, sheet],
  );

  const extent = sheetExtent(sheet);
  const rows = Math.min(
    MAX_ROWS,
    Math.max(200, extent.rows + 100, selection.focus.row < MAX_ROWS - 1 ? selection.focus.row + 60 : 0, selection.anchor.row + 60) + grow.rows,
  );
  const cols = Math.min(MAX_COLS, Math.max(26, extent.cols + 6, selection.focus.col < MAX_COLS - 1 ? selection.focus.col + 8 : 0) + grow.cols);

  const hidden = useMemo(() => hiddenRows(sheet, text), [sheet, text]);
  const filterActive = useMemo(() => new Set(Object.keys(sheet.filter?.rules ?? {}).map(Number)), [sheet.filter]);

  // When a filter hides the active cell's row, the selection moves to the first row still showing.
  const anchorRow = selection.anchor.row;
  const anchorCol = selection.anchor.col;
  const filterHeader = sheet.filter?.header ?? null;
  useEffect(() => {
    if (filterHeader === null || !hidden.has(anchorRow)) return;
    let row = filterHeader + 1;
    while (hidden.has(row)) row += 1;
    const point = { row, col: anchorCol };
    setSelections((all) => ({ ...all, [sheet.id]: { anchor: point, focus: point } }));
  }, [anchorCol, anchorRow, filterHeader, hidden, sheet.id]);

  const dirty =
    !savedRef.current.persisted || workbook !== savedRef.current.workbook || title !== savedRef.current.title;
  const stamp: CellsStamp = stampOverride ?? (dirty ? { kind: 'unsaved' } : filePath ? { kind: 'saved', at: savedAt } : { kind: 'new' });

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${title || 'Untitled workbook'} — Cells`;
  }, [dirty, title]);
  useEffect(() => () => void (document.title = 'Paperlight'), []);

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    setStampOverride((current) => (current?.kind === 'error' ? null : current));
  }, [workbook]);

  // Leaving Cells (a new workbook, Home) keeps unsaved work as a draft straight away.
  useEffect(
    () => () => {
      if (dirtyRef.current) {
        saveCellsDraft({ id: doc.draftId, title: titleRef.current, workbook: workbookRef.current, filePath: filePathRef.current, updatedAt: Date.now() });
      }
    },
    [doc.draftId],
  );

  // Unsaved work is kept as a draft so closing the app loses nothing.
  useEffect(() => {
    if (!dirty) {
      removeCellsDraft(doc.draftId);
      return;
    }
    const timer = window.setTimeout(() => {
      saveCellsDraft({ id: doc.draftId, title: titleRef.current, workbook: workbookRef.current, filePath: filePathRef.current, updatedAt: Date.now() });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [dirty, doc.draftId, workbook, title]);

  const setSelection = useCallback(
    (next: Selection | ((current: Selection) => Selection)) => {
      setSelections((all) => {
        const id = workbookRef.current.sheets[Math.min(sheetIndex, workbookRef.current.sheets.length - 1)].id;
        const current = all[id] ?? ORIGIN;
        const value = typeof next === 'function' ? next(current) : next;
        return { ...all, [id]: value };
      });
    },
    [sheetIndex],
  );

  const updateSheet = useCallback(
    (fn: (current: typeof sheet) => typeof sheet) => {
      const book = workbookRef.current;
      const i = Math.min(sheetIndex, book.sheets.length - 1);
      const next = fn(book.sheets[i]);
      if (next !== book.sheets[i]) commit(replaceSheet(book, i, next));
    },
    [commit, sheetIndex],
  );

  const focusGrid = useCallback(() => {
    requestAnimationFrame(() => gridRef.current?.focus());
  }, []);

  /** Moves down/right to the next row a filter leaves visible. */
  const stepRow = useCallback(
    (row: number, delta: number) => {
      let next = row;
      let steps = Math.abs(delta);
      const dir = Math.sign(delta);
      while (steps > 0) {
        let candidate = next + dir;
        while (candidate >= 0 && candidate < MAX_ROWS && hidden.has(candidate)) candidate += dir;
        if (candidate < 0 || candidate >= MAX_ROWS) break;
        next = candidate;
        steps -= 1;
      }
      return next;
    },
    [hidden],
  );

  // ----- Editing -----

  const cellEditText = useCallback(
    (row: number, col: number) => {
      const cell = sheet.cells[cellKey(row, col)];
      if (!cell) return '';
      if (cell.f !== undefined) return `=${cell.f}`;
      return editText(cell.v ?? null, cell.s?.format);
    },
    [sheet],
  );

  const beginEdit = useCallback(
    (initial: string | null, mode: EditState['mode'], origin: EditState['origin'] = 'cell', caret?: number) => {
      const { row, col } = selection.anchor;
      const value = initial ?? cellEditText(row, col);
      setSelectedChart(null);
      setActiveSuggestion(0);
      pointCursorRef.current = null;
      setEditState({ row, col, value, caret: caret ?? value.length, mode, origin, sync: Date.now(), point: null });
    },
    [cellEditText, selection.anchor],
  );

  const inferFormat = useCallback(
    (formula: string): string | undefined => {
      if (COUNTING.test(formula)) return undefined;
      const ref = tokenize(formula).find((token) => token.type === 'ref' && token.sheet === null);
      if (!ref || ref.type !== 'ref' || ref.start.row === null || ref.start.col === null) return undefined;
      return sheet.cells[cellKey(ref.start.row, ref.start.col)]?.s?.format;
    },
    [sheet],
  );

  /** Turns typed text into a cell, keeping the cell's existing style. */
  const cellFromInput = useCallback(
    (raw: string, existing: Cell | undefined): Cell | null | { problem: string } => {
      const style = existing?.s;
      if (raw.startsWith('=') && raw.trim().length > 1) {
        const completed = completeFormula(normalizeFormula(raw.slice(1)));
        if ('problem' in completed) return completed;
        const format = style?.format ?? inferFormat(completed.formula);
        return { f: completed.formula, s: format && !style?.format ? { ...style, format } : style };
      }
      if (style?.format === '@') return raw === '' ? (style ? { s: style } : null) : { v: raw, s: style };
      const parsed = parseInput(raw);
      if (parsed.value === null) return style ? { s: style } : null;
      const s = parsed.format && (!style?.format || style.format === 'General') ? { ...style, format: parsed.format } : style;
      return s ? { v: parsed.value, s } : { v: parsed.value };
    },
    [inferFormat],
  );

  const commitEdit = useCallback(
    (move: [number, number] | null, options: { all?: boolean } = {}) => {
      const current = editRef.current;
      if (!current) return true;
      const book = workbookRef.current;
      const i = Math.min(sheetIndex, book.sheets.length - 1);
      const target = book.sheets[i];
      const existing = target.cells[cellKey(current.row, current.col)];
      const cell = cellFromInput(current.value, existing);
      if (cell && 'problem' in cell) {
        shell.toast(`There's a problem with this formula: ${cell.problem}`, 'error');
        return false;
      }
      const original = existing?.f !== undefined ? `=${existing.f}` : editText(existing?.v ?? null, existing?.s?.format);
      if (options.all && !(selRect.top === selRect.bottom && selRect.left === selRect.right)) {
        const area = { ...selRect, bottom: Math.min(selRect.bottom, current.row + 5000), right: Math.min(selRect.right, current.col + 200) };
        const updates: CellUpdate[] = [];
        for (let row = area.top; row <= area.bottom; row += 1) {
          for (let col = area.left; col <= area.right; col += 1) {
            const own = target.cells[cellKey(row, col)];
            const next = cellFromInput(current.value, own);
            if (next && 'problem' in next) continue;
            updates.push({ row, col, cell: next && next.f !== undefined ? { ...next, f: translateFormula(next.f, row - current.row, col - current.col) } : next });
          }
        }
        commit(replaceSheet(book, i, setCells(target, updates)));
      } else if (current.value !== original || (cell === null) !== !hasContent(existing)) {
        commit(replaceSheet(book, i, setCells(target, [{ row: current.row, col: current.col, cell }])));
      }
      setEditState(null);
      pointStartRef.current = null;
      pointCursorRef.current = null;
      if (move) {
        const [dr, dc] = move;
        const row = dr ? stepRow(current.row, dr) : current.row;
        const col = Math.min(Math.max(current.col + dc, 0), MAX_COLS - 1);
        setSelection({ anchor: { row, col }, focus: { row, col } });
      }
      focusGrid();
      return true;
    },
    [cellFromInput, commit, focusGrid, selRect, setSelection, sheetIndex, shell, stepRow],
  );

  const cancelEdit = useCallback(() => {
    setEditState(null);
    pointStartRef.current = null;
    focusGrid();
  }, [focusGrid]);

  const onEditorChange = useCallback((value: string, caret: number) => {
    setActiveSuggestion(0);
    setEditState((current) => (current ? { ...current, value, caret, point: null } : current));
    pointCursorRef.current = null;
  }, []);

  const onEditorCaret = useCallback((caret: number) => {
    setEditState((current) => (current && current.caret !== caret ? { ...current, caret } : current));
  }, []);

  const pointable = (current: EditState) =>
    current.value.startsWith('=') &&
    (POINTABLE.test(current.value.slice(0, current.caret)) || (current.point !== null && current.point.end === current.caret));

  /** Puts a reference into the formula being typed, replacing the one the last click inserted. */
  const insertReference = useCallback((a: Point, b: Point) => {
    setEditState((current) => {
      if (!current) return current;
      const ref = rectName(normalize(a, b));
      const start = current.point && current.point.end === current.caret ? current.point.start : current.caret;
      const end = current.point && current.point.end === current.caret ? current.point.end : current.caret;
      const value = current.value.slice(0, start) + ref + current.value.slice(end);
      const caret = start + ref.length;
      return { ...current, value, caret, sync: current.sync + 1, point: { start, end: caret } };
    });
  }, []);

  const suggest = useMemo(() => (edit ? suggestFor(edit.value, edit.caret) : null), [edit]);

  const acceptSuggest = useCallback(
    (name: string) => {
      setEditState((current) => {
        if (!current) return current;
        const state = suggestFor(current.value, current.caret);
        const item = state.items.find((entry) => entry.name === name);
        if (!item) return current;
        const next = acceptSuggestion(current.value, state, item);
        return { ...current, ...next, sync: current.sync + 1, point: null };
      });
      setActiveSuggestion(0);
    },
    [],
  );

  const onEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const current = editRef.current;
      if (!current) return;
      const items = suggest?.items ?? [];
      if (items.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveSuggestion((i) => (i + 1) % items.length);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveSuggestion((i) => (i - 1 + items.length) % items.length);
          return;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          acceptSuggest(items[Math.min(activeSuggestion, items.length - 1)].name);
          return;
        }
      }
      const arrows: Record<string, [number, number]> = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (event.key === 'Enter') {
        event.preventDefault();
        commitEdit(event.shiftKey ? [-1, 0] : [1, 0], { all: event.ctrlKey || event.metaKey });
      } else if (event.key === 'Tab') {
        event.preventDefault();
        commitEdit([0, event.shiftKey ? -1 : 1]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
      } else if (event.key === 'F2') {
        event.preventDefault();
        setEditState((state) => (state ? { ...state, mode: state.mode === 'enter' ? 'edit' : 'enter' } : state));
      } else if (arrows[event.key] && current.mode === 'enter' && current.origin === 'cell') {
        event.preventDefault();
        const [dr, dc] = arrows[event.key];
        if (pointable(current)) {
          const from = pointCursorRef.current ?? { row: current.row, col: current.col };
          const next = { row: Math.max(0, stepRow(from.row, dr)), col: Math.min(Math.max(from.col + dc, 0), MAX_COLS - 1) };
          pointCursorRef.current = next;
          insertReference(next, next);
        } else commitEdit([dr, dc]);
      }
    },
    [acceptSuggest, activeSuggestion, cancelEdit, commitEdit, insertReference, stepRow, suggest],
  );

  // ----- Selection and pointer -----

  const onPointerStart = useCallback(
    (point: Point, modifiers: { shift: boolean }): DragMode => {
      setSelectedChart(null);
      setContextMenu(null);
      const current = editRef.current;
      if (current) {
        if (pointable(current)) {
          pointStartRef.current = point;
          insertReference(point, point);
          return 'point';
        }
        if (!commitEdit(null)) return 'none';
      }
      if (modifiers.shift) setSelection((sel) => ({ anchor: sel.anchor, focus: point }));
      else setSelection({ anchor: point, focus: point });
      return 'select';
    },
    [commitEdit, insertReference, setSelection],
  );

  const onPointerExtend = useCallback(
    (point: Point, mode: DragMode) => {
      if (mode === 'point') {
        if (pointStartRef.current) insertReference(pointStartRef.current, point);
        return;
      }
      setSelection((sel) => (sel.focus.row === point.row && sel.focus.col === point.col ? sel : { anchor: sel.anchor, focus: point }));
    },
    [insertReference, setSelection],
  );

  const onHeaderSelect = useCallback(
    (kind: 'col' | 'row' | 'all', at: number, shift: boolean) => {
      if (editRef.current && !commitEdit(null)) return;
      setSelectedChart(null);
      if (kind === 'all') {
        setSelection({ anchor: { row: 0, col: 0 }, focus: { row: MAX_ROWS - 1, col: MAX_COLS - 1 } });
        return;
      }
      setSelection((sel) => {
        if (kind === 'col') {
          const from = shift ? sel.anchor.col : at;
          return { anchor: { row: 0, col: from }, focus: { row: MAX_ROWS - 1, col: at } };
        }
        const from = shift ? sel.anchor.row : at;
        return { anchor: { row: from, col: 0 }, focus: { row: at, col: MAX_COLS - 1 } };
      });
    },
    [commitEdit, setSelection],
  );

  /** The selection limited to cells that can hold content, for copying and summaries. */
  const usedRect = useCallback(
    (rect: Rect): Rect => ({
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom >= MAX_ROWS - 1 ? Math.max(rect.top, extent.rows - 1) : rect.bottom,
      right: rect.right >= MAX_COLS - 1 ? Math.max(rect.left, extent.cols - 1) : rect.right,
    }),
    [extent.cols, extent.rows],
  );

  // ----- Commands -----

  const activeStyle: CellStyle = sheet.cells[cellKey(selection.anchor.row, selection.anchor.col)]?.s ?? {};

  const applyStyle = useCallback(
    (patch: Partial<CellStyle>) => {
      updateSheet((current) => styleCells(current, selRect, patch));
      focusGrid();
    },
    [focusGrid, selRect, updateSheet],
  );

  const toggleStyle = useCallback(
    (key: 'bold' | 'italic' | 'underline') => applyStyle({ [key]: activeStyle[key] ? undefined : true }),
    [activeStyle, applyStyle],
  );

  const clearSelection = useCallback(() => {
    updateSheet((current) => clearCells(current, selRect, true));
  }, [selRect, updateSheet]);

  const move = useCallback(
    (dr: number, dc: number, extend: boolean, jump: boolean) => {
      setSelection((sel) => {
        const from = extend ? sel.focus : sel.anchor;
        let to: Point;
        if (jump) {
          // Jumps stop at the end of the data rather than the last of a million rows.
          to = jumpTarget(sheet, from, dr, dc, { row: Math.max(extent.rows - 1, from.row), col: Math.max(extent.cols - 1, from.col) });
        } else {
          to = { row: dr ? stepRow(from.row, dr) : from.row, col: Math.min(Math.max(from.col + dc, 0), MAX_COLS - 1) };
        }
        return extend ? { anchor: sel.anchor, focus: to } : { anchor: to, focus: to };
      });
    },
    [extent.cols, extent.rows, setSelection, sheet, stepRow],
  );

  const goTo = useCallback(
    (target: string) => {
      const rect = parseRange(target.trim());
      if (!rect) return false;
      setSelection({ anchor: { row: rect.top, col: rect.left }, focus: { row: rect.bottom, col: rect.right } });
      return true;
    },
    [setSelection],
  );

  const autoSum = useCallback(() => {
    const { row, col } = selection.anchor;
    let range: Rect | null = null;
    let r = row - 1;
    while (r >= 0 && typeof value(r, col) === 'number') r -= 1;
    if (r < row - 1) range = { top: r + 1, left: col, bottom: row - 1, right: col };
    else {
      let c = col - 1;
      while (c >= 0 && typeof value(row, c) === 'number') c -= 1;
      if (c < col - 1) range = { top: row, left: c + 1, bottom: row, right: col - 1 };
    }
    const formula = `=SUM(${range ? rectName(range) : ''})`;
    beginEdit(formula, 'edit', 'cell', range ? formula.length : formula.length - 1);
  }, [beginEdit, selection.anchor, value]);

  const structure = useCallback(
    (axis: 'row' | 'col', at: number, count: number) => {
      const book = workbookRef.current;
      commit(changeStructure(book, Math.min(sheetIndex, book.sheets.length - 1), axis, at, count));
      focusGrid();
    },
    [commit, focusGrid, sheetIndex],
  );

  const insertLines = useCallback(
    (what: 'row-above' | 'row-below' | 'col-left' | 'col-right') => {
      const used = usedRect(selRect);
      if (what === 'row-above') structure('row', used.top, Math.min(used.bottom - used.top + 1, 1000));
      else if (what === 'row-below') structure('row', used.bottom + 1, Math.min(used.bottom - used.top + 1, 1000));
      else if (what === 'col-left') structure('col', used.left, Math.min(used.right - used.left + 1, 100));
      else structure('col', used.right + 1, Math.min(used.right - used.left + 1, 100));
    },
    [selRect, structure, usedRect],
  );

  const deleteLines = useCallback(
    (what: 'rows' | 'cols') => {
      const used = usedRect(selRect);
      if (what === 'rows') structure('row', used.top, -(used.bottom - used.top + 1));
      else structure('col', used.left, -(used.right - used.left + 1));
      setSelection((sel) => ({ anchor: sel.anchor, focus: sel.anchor }));
    },
    [selRect, setSelection, structure, usedRect],
  );

  /** The block a sort, filter or chart works on: the selection, or the table around the active cell. */
  const tableRect = useCallback((): Rect | null => {
    const used = usedRect(selRect);
    if (used.bottom > used.top || used.right > used.left) return used;
    const region = currentRegion(sheet, selection.anchor.row, selection.anchor.col);
    if (region.top === region.bottom && region.left === region.right && !hasContent(sheet.cells[cellKey(region.top, region.left)])) return null;
    return region;
  }, [selRect, selection.anchor, sheet, usedRect]);

  const sort = useCallback(
    (descending: boolean, column?: number) => {
      let rect: Rect | null;
      let header: boolean;
      if (sheet.filter) {
        rect = { top: sheet.filter.header, left: sheet.filter.left, right: sheet.filter.right, bottom: filterBottom(sheet, sheet.filter) };
        header = true;
      } else {
        rect = tableRect();
        header = rect ? looksLikeHeader(sheet, rect, value) : false;
      }
      if (!rect || rect.bottom <= rect.top) {
        shell.toast('Select a cell inside a table to sort it.');
        return;
      }
      const target = sortableRows(sheet, rect, header);
      const col = column ?? Math.min(Math.max(selection.anchor.col, rect.left), rect.right);
      updateSheet((current) => sortRows(current, target, col, descending, value, compare));
      const name = header ? text(rect.top, col) : `column ${colName(col)}`;
      shell.toast(`Sorted by ${name || `column ${colName(col)}`}, ${descending ? 'Z to A' : 'A to Z'}`);
      focusGrid();
    },
    [focusGrid, selection.anchor.col, sheet, shell, tableRect, text, updateSheet, value],
  );

  const toggleFilter = useCallback(() => {
    if (sheet.filter) {
      updateSheet((current) => ({ ...current, filter: null }));
      setFilterMenu(null);
      focusGrid();
      return;
    }
    const rect = tableRect();
    if (!rect) {
      shell.toast('Select a cell inside a table to filter it.');
      return;
    }
    updateSheet((current) => ({ ...current, filter: { header: rect.top, left: rect.left, right: rect.right, rules: {} } }));
    focusGrid();
  }, [focusGrid, sheet.filter, shell, tableRect, updateSheet]);

  const insertChart = useCallback(
    (kind: ChartKind) => {
      const rect = tableRect();
      if (!rect) {
        shell.toast('Select the numbers you want to chart first.');
        return;
      }
      // Beside the whole table when it fits on screen, otherwise under it; never over the data.
      const table = currentRegion(sheet, rect.top, rect.left);
      const beside = Math.max(rect.right, table.right) + 1;
      let besideX = 0;
      for (let col = 0; col < beside; col += 1) besideX += colWidth(sheet, col);
      const view = gridRef.current?.viewport() ?? { width: Infinity, height: 600, top: 0, left: 0 };
      const fitsBeside = besideX + 520 + 12 <= view.width;
      const anchor = fitsBeside ? { row: rect.top, col: beside } : { row: table.bottom + 1, col: table.left };
      // Under the table, the chart takes the room left on screen so the table stays in view with it.
      let hiddenAbove = 0;
      for (const row of hidden) if (row < anchor.row) hiddenAbove += 1;
      const top = (anchor.row - hiddenAbove) * ROW_H;
      const height = fitsBeside ? 320 : Math.max(200, Math.min(320, Math.floor(view.top + view.height - top - 8)));
      const spec = { id: newId(), kind, title: '', range: rect, anchor, width: 520, height };
      const data = chartData(sheet, spec, value, text);
      if (data.series.length === 0) {
        shell.toast(`There are no numbers in ${rectName(rect)} to chart.`);
        return;
      }
      spec.title = data.series.length === 1 ? data.series[0].name.replace(/^Series 1$/, sheet.name) : sheet.name;
      updateSheet((current) => ({ ...current, charts: [...current.charts, spec] }));
      setSelectedChart(spec.id);
      // Scrolls only when the chart's top is off screen.
      requestAnimationFrame(() => gridRef.current?.reveal(anchor));
      focusGrid();
    },
    [focusGrid, hidden, sheet, shell, tableRect, text, updateSheet, value],
  );

  const updateChart = useCallback(
    (id: string, patch: Partial<(typeof sheet.charts)[number]>) => {
      updateSheet((current) => ({ ...current, charts: current.charts.map((chart) => (chart.id === id ? { ...chart, ...patch } : chart)) }));
    },
    [updateSheet],
  );

  const deleteChart = useCallback(
    (id: string) => {
      updateSheet((current) => ({ ...current, charts: current.charts.filter((chart) => chart.id !== id) }));
      setSelectedChart(null);
      focusGrid();
    },
    [focusGrid, updateSheet],
  );

  const fill = useCallback(
    (source: Rect, target: Rect) => {
      updateSheet((current) => fillCells(current, source, target));
      setSelection({ anchor: { row: target.top, col: target.left }, focus: { row: target.bottom, col: target.right } });
    },
    [setSelection, updateSheet],
  );

  const fillDirection = useCallback(
    (axis: 'down' | 'right') => {
      const used = usedRect(selRect);
      if (axis === 'down' && used.bottom > used.top) fill({ ...used, bottom: used.top }, used);
      if (axis === 'right' && used.right > used.left) fill({ ...used, right: used.left }, used);
    },
    [fill, selRect, usedRect],
  );

  const autoFit = useCallback(
    (col: number) => {
      let width = 48;
      const limit = Math.min(extent.rows, 3000);
      for (let row = 0; row < limit; row += 1) {
        const shown = text(row, col);
        if (shown) width = Math.max(width, measureCellText(shown, !!sheet.cells[cellKey(row, col)]?.s?.bold) + 20);
      }
      updateSheet((current) => ({ ...current, cols: { ...current.cols, [col]: Math.min(Math.ceil(width), 640) } }));
    },
    [extent.rows, sheet.cells, text, updateSheet],
  );

  // ----- Clipboard -----

  const pasteClip = useCallback(
    (source: Clip & { cut?: boolean; sheetId?: string }) => {
      const book = workbookRef.current;
      const i = Math.min(sheetIndex, book.sheets.length - 1);
      let next = book;
      const target = { ...selRect, bottom: Math.min(selRect.bottom, selRect.top + 10000), right: Math.min(selRect.right, selRect.left + 500) };
      if (source.cut && source.sheetId) {
        const from = book.sheets.findIndex((entry) => entry.id === source.sheetId);
        if (from !== -1) {
          const area = { top: source.origin.row, left: source.origin.col, bottom: source.origin.row + source.rows - 1, right: source.origin.col + source.cols - 1 };
          next = replaceSheet(next, from, clearCells(next.sheets[from], area, false));
        }
      }
      const pasted = pasteBlock(next.sheets[i], source, target);
      commit(replaceSheet(next, i, pasted.sheet));
      setSelection({ anchor: { row: pasted.area.top, col: pasted.area.left }, focus: { row: pasted.area.bottom, col: pasted.area.right } });
      if (source.cut) setClip(null);
    },
    [commit, selRect, setSelection, sheetIndex],
  );

  const pasteText = useCallback(
    (raw: string) => {
      const lines = textToRows(raw);
      const cells = lines.map((line) =>
        line.map((entry) => {
          const cell = cellFromInput(entry, undefined);
          return cell && !('problem' in cell) ? cell : entry ? { v: entry } : undefined;
        }),
      );
      pasteClip({ origin: selection.anchor, rows: cells.length, cols: Math.max(...cells.map((line) => line.length)), cells, text: raw });
    },
    [cellFromInput, pasteClip, selection.anchor],
  );

  const copySelection = useCallback(
    (cut: boolean) => {
      const block = copyBlock(sheet, usedRect(selRect), text);
      setClip({ ...block, cut, sheetId: sheet.id });
      return block.text;
    },
    [selRect, sheet, text, usedRect],
  );

  useEffect(() => {
    const focused = () => document.activeElement === gridRef.current?.element();
    const onCopy = (event: ClipboardEvent) => {
      if (!focused()) return;
      event.preventDefault();
      event.clipboardData?.setData('text/plain', copySelection(false));
    };
    const onCut = (event: ClipboardEvent) => {
      if (!focused()) return;
      event.preventDefault();
      event.clipboardData?.setData('text/plain', copySelection(true));
    };
    const onPaste = (event: ClipboardEvent) => {
      if (!focused()) return;
      event.preventDefault();
      const incoming = (event.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '');
      if (clip && clip.text === incoming) pasteClip(clip);
      else if (incoming) pasteText(incoming);
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [clip, copySelection, pasteClip, pasteText]);

  const pasteFromMenu = useCallback(async () => {
    try {
      const incoming = (await navigator.clipboard.readText()).replace(/\r\n?/g, '\n').replace(/\n$/, '');
      if (clip && clip.text === incoming) pasteClip(clip);
      else if (incoming) pasteText(incoming);
      else if (clip) pasteClip(clip);
    } catch {
      if (clip) pasteClip(clip);
      else shell.toast("Couldn't read the clipboard. Copy the cells again, then paste.", 'error');
    }
  }, [clip, pasteClip, pasteText, shell]);

  const copyFromMenu = useCallback(
    (cut: boolean) => {
      const content = copySelection(cut);
      void navigator.clipboard?.writeText(content).catch(() => undefined);
    },
    [copySelection],
  );

  // ----- Sheets -----

  const selectSheet = useCallback(
    (next: number) => {
      if (editRef.current && !commitEdit(null)) return;
      setSheetIndex(next);
      setFilterMenu(null);
      setSelectedChart(null);
      setGrow({ rows: 0, cols: 0 });
      focusGrid();
    },
    [commitEdit, focusGrid],
  );

  const addSheet = useCallback(() => {
    const book = workbookRef.current;
    const sheetNew = newSheet(uniqueSheetName(book, `Sheet ${book.sheets.length + 1}`));
    commit({ ...book, sheets: [...book.sheets, sheetNew] });
    setSheetIndex(book.sheets.length);
    focusGrid();
  }, [commit, focusGrid]);

  // ----- Files -----

  const save = useCallback(
    async (saveAs: boolean) => {
      if (editRef.current && !commitEdit(null)) return;
      setStampOverride({ kind: 'saving' });
      try {
        const book = workbookRef.current;
        const fresh = new Calc(calcSource(book));
        const pictures = new Map<string, string>();
        book.sheets.forEach((entry, i) => {
          const v = (row: number, col: number) => fresh.value(i, row, col);
          const t = (row: number, col: number) => {
            const cell = entry.cells[cellKey(row, col)];
            return hasContent(cell) ? formatValue(fresh.value(i, row, col), cell?.s?.format) : '';
          };
          for (const chart of entry.charts) pictures.set(chart.id, chartPicture(chart, chartData(entry, chart, v, t)));
        });
        const data = await writeXlsx(book, fresh, pictures);
        const result = await bridge.saveFile({
          filePath: saveAs ? null : filePathRef.current,
          defaultName: xlsxName(titleRef.current),
          filters: XLSX_FILTERS,
          data,
        });
        if (!result) {
          setStampOverride(null);
          return;
        }
        setFilePath(result.path);
        filePathRef.current = result.path;
        if (result.path) void bridge.addRecent({ path: result.path, name: result.name, app: 'cells', openedAt: Date.now() });
        let nextTitle = titleRef.current;
        if (/^Untitled/.test(nextTitle)) {
          nextTitle = stripExtension(result.name);
          setTitle(nextTitle);
        }
        savedRef.current = { workbook: book, title: nextTitle, persisted: true };
        removeCellsDraft(doc.draftId);
        setSavedAt(new Date());
        setStampOverride(null);
      } catch (error) {
        setStampOverride({ kind: 'error' });
        shell.toast(`Couldn't save the workbook: ${errorMessage(error)}`, 'error');
      }
    },
    [commitEdit, doc.draftId, shell],
  );

  const exportCsv = useCallback(async () => {
    try {
      const data = writeCsv(sheet, index, calc);
      const result = await bridge.saveFile({ filePath: null, defaultName: `${titleRef.current || 'Sheet'} - ${sheet.name}.csv`.replace(/[\\/:*?"<>|]+/g, '-'), filters: CSV_FILTERS, data });
      if (result?.path) shell.toast(`Exported ${sheet.name} to ${result.path}`);
    } catch (error) {
      shell.toast(`Couldn't export the CSV: ${errorMessage(error)}`, 'error');
    }
  }, [calc, index, sheet, shell]);

  // ----- Keyboard -----

  const onGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key;
      if (editRef.current) {
        // An edit is open but focus wandered to the grid: finish or return to it.
        if (key === 'Enter' || key === 'Tab') {
          event.preventDefault();
          commitEdit(key === 'Enter' ? [event.shiftKey ? -1 : 1, 0] : [0, event.shiftKey ? -1 : 1]);
        } else if (key === 'Escape') {
          event.preventDefault();
          cancelEdit();
        } else (editRef.current.origin === 'line' ? lineEditorRef : cellEditorRef).current?.focus();
        return;
      }
      const arrows: Record<string, [number, number]> = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (arrows[key]) {
        event.preventDefault();
        move(arrows[key][0], arrows[key][1], event.shiftKey, ctrl);
        return;
      }
      if (ctrl && !event.altKey) {
        const lower = key.toLowerCase();
        if (lower === 'a') {
          event.preventDefault();
          setSelection({ anchor: { row: 0, col: 0 }, focus: { row: MAX_ROWS - 1, col: MAX_COLS - 1 } });
        } else if (lower === 'b' || lower === 'i' || lower === 'u') {
          event.preventDefault();
          toggleStyle(lower === 'b' ? 'bold' : lower === 'i' ? 'italic' : 'underline');
        } else if (lower === 'z' && !event.shiftKey) {
          event.preventDefault();
          history.undo();
        } else if (lower === 'y' || (lower === 'z' && event.shiftKey)) {
          event.preventDefault();
          history.redo();
        } else if (lower === 'd') {
          event.preventDefault();
          fillDirection('down');
        } else if (lower === 'r') {
          event.preventDefault();
          fillDirection('right');
        } else if ((lower === 'c' || lower === 'x') && !event.shiftKey) {
          // The grid is not a text field, so the browser's own copy and paste can't be relied on.
          event.preventDefault();
          copyFromMenu(lower === 'x');
        } else if (lower === 'v' && !event.shiftKey) {
          event.preventDefault();
          void pasteFromMenu();
        } else if (lower === 'l' && event.shiftKey) {
          event.preventDefault();
          toggleFilter();
        } else if (key === 'Home') {
          event.preventDefault();
          setSelection({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } });
        } else if (key === 'End') {
          event.preventDefault();
          const end = { row: Math.max(0, extent.rows - 1), col: Math.max(0, extent.cols - 1) };
          setSelection({ anchor: end, focus: end });
        }
        return;
      }
      if (event.altKey && (key === '=' || key === '+')) {
        event.preventDefault();
        autoSum();
        return;
      }
      switch (key) {
        case 'Enter':
          event.preventDefault();
          move(event.shiftKey ? -1 : 1, 0, false, false);
          return;
        case 'Tab':
          event.preventDefault();
          move(0, event.shiftKey ? -1 : 1, false, false);
          return;
        case 'F2':
          event.preventDefault();
          beginEdit(null, 'edit');
          return;
        case 'Delete':
          event.preventDefault();
          if (selectedChart) deleteChart(selectedChart);
          else clearSelection();
          return;
        case 'Backspace':
          event.preventDefault();
          beginEdit('', 'enter');
          return;
        case 'Escape':
          setClip(null);
          setSelectedChart(null);
          return;
        case 'Home':
          event.preventDefault();
          setSelection((sel) => ({ anchor: { row: sel.anchor.row, col: 0 }, focus: { row: sel.anchor.row, col: 0 } }));
          return;
        case 'PageDown':
        case 'PageUp': {
          event.preventDefault();
          const page = gridRef.current?.pageRows() ?? 20;
          move(key === 'PageDown' ? page : -page, 0, event.shiftKey, false);
          return;
        }
        default:
          break;
      }
      if (!event.altKey && key.length === 1) {
        event.preventDefault();
        beginEdit(key, 'enter');
      }
    },
    [autoSum, beginEdit, cancelEdit, clearSelection, commitEdit, copyFromMenu, deleteChart, extent.cols, extent.rows, fillDirection, history, move, pasteFromMenu, selectedChart, setSelection, toggleFilter, toggleStyle],
  );

  useEffect(() => {
    const shortcuts: [string, () => void][] = [
      ['ctrl+s', () => void save(false)],
      ['ctrl+shift+s', () => void save(true)],
      ['ctrl+o', onOpenWorkbook],
      ['ctrl+n', onNewWorkbook],
    ];
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialog) return;
      const hit = shortcuts.find(([shortcut]) => matchesShortcut(event, shortcut));
      if (!hit) return;
      event.preventDefault();
      hit[1]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, onNewWorkbook, onOpenWorkbook, save]);

  // ----- Context menu -----

  const openContextMenu = useCallback(
    (target: { kind: 'cell'; point: Point } | { kind: 'col' | 'row'; index: number }, x: number, y: number) => {
      if (editRef.current && !commitEdit(null)) return;
      if (target.kind === 'cell' && !(target.point.row >= selRect.top && target.point.row <= selRect.bottom && target.point.col >= selRect.left && target.point.col <= selRect.right)) {
        setSelection({ anchor: target.point, focus: target.point });
      }
      if (target.kind === 'col' && !(target.index >= selRect.left && target.index <= selRect.right && selRect.bottom >= MAX_ROWS - 1)) {
        setSelection({ anchor: { row: 0, col: target.index }, focus: { row: MAX_ROWS - 1, col: target.index } });
      }
      if (target.kind === 'row' && !(target.index >= selRect.top && target.index <= selRect.bottom && selRect.right >= MAX_COLS - 1)) {
        setSelection({ anchor: { row: target.index, col: 0 }, focus: { row: target.index, col: MAX_COLS - 1 } });
      }
      const editing: MenuEntry[] = [
        { id: 'cut', label: 'Cut', icon: <Scissors />, shortcut: 'Ctrl X', onSelect: () => copyFromMenu(true) },
        { id: 'copy', label: 'Copy', icon: <Copy />, shortcut: 'Ctrl C', onSelect: () => copyFromMenu(false) },
        { id: 'paste', label: 'Paste', icon: <ClipboardPaste />, shortcut: 'Ctrl V', onSelect: () => void pasteFromMenu() },
        { separator: true, id: 'sep-1' },
      ];
      const rowsItems: MenuEntry[] = [
        { id: 'row-above', label: 'Insert row above', icon: <BetweenHorizontalStart />, onSelect: () => insertLines('row-above') },
        { id: 'row-below', label: 'Insert row below', icon: <BetweenHorizontalEnd />, onSelect: () => insertLines('row-below') },
        { id: 'delete-rows', label: 'Delete rows', icon: <Trash2 />, danger: true, onSelect: () => deleteLines('rows') },
      ];
      const colItems: MenuEntry[] = [
        { id: 'col-left', label: 'Insert column left', icon: <BetweenVerticalStart />, onSelect: () => insertLines('col-left') },
        { id: 'col-right', label: 'Insert column right', icon: <BetweenVerticalEnd />, onSelect: () => insertLines('col-right') },
        { id: 'delete-cols', label: 'Delete columns', icon: <Trash2 />, danger: true, onSelect: () => deleteLines('cols') },
      ];
      const items: MenuEntry[] =
        target.kind === 'row'
          ? [...editing, ...rowsItems]
          : target.kind === 'col'
            ? [...editing, ...colItems, { separator: true, id: 'sep-w' }, { id: 'fit', label: 'Fit column to contents', onSelect: () => autoFit(target.index) }]
            : [
                ...editing,
                ...rowsItems,
                { separator: true, id: 'sep-2' },
                ...colItems,
                { separator: true, id: 'sep-3' },
                { id: 'clear', label: 'Clear contents', icon: <Eraser />, shortcut: 'Delete', onSelect: clearSelection },
              ];
      setContextMenu({ x, y, items });
    },
    [autoFit, clearSelection, commitEdit, copyFromMenu, deleteLines, insertLines, pasteFromMenu, selRect, setSelection],
  );

  // ----- Palette commands -----

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'cells-save', title: 'Save', group: 'File', shortcut: 'Ctrl S', keywords: 'xlsx write', run: () => void save(false) },
      { id: 'cells-save-as', title: 'Save as…', group: 'File', shortcut: 'Ctrl Shift S', keywords: 'xlsx copy', run: () => void save(true) },
      { id: 'cells-csv', title: 'Export this sheet as CSV', group: 'File', keywords: 'comma values', run: () => void exportCsv() },
      { id: 'cells-open', title: 'Open workbook…', group: 'File', shortcut: 'Ctrl O', keywords: 'xlsx csv file', run: onOpenWorkbook },
      { id: 'cells-new', title: 'New workbook', group: 'File', shortcut: 'Ctrl N', keywords: 'blank spreadsheet', run: onNewWorkbook },
      { id: 'cells-undo', title: 'Undo', group: 'Edit', shortcut: 'Ctrl Z', run: history.undo },
      { id: 'cells-redo', title: 'Redo', group: 'Edit', shortcut: 'Ctrl Y', run: history.redo },
      { id: 'cells-sum', title: 'Sum the numbers above', group: 'Insert', shortcut: 'Alt =', keywords: 'autosum total', run: autoSum },
      { id: 'cells-function', title: 'Insert a function', group: 'Insert', keywords: 'formula =', run: () => beginEdit('=', 'edit') },
      { id: 'cells-row-above', title: 'Insert row above', group: 'Insert', run: () => insertLines('row-above') },
      { id: 'cells-row-below', title: 'Insert row below', group: 'Insert', run: () => insertLines('row-below') },
      { id: 'cells-col-left', title: 'Insert column to the left', group: 'Insert', run: () => insertLines('col-left') },
      { id: 'cells-col-right', title: 'Insert column to the right', group: 'Insert', run: () => insertLines('col-right') },
      { id: 'cells-delete-rows', title: 'Delete selected rows', group: 'Edit', keywords: 'remove', run: () => deleteLines('rows') },
      { id: 'cells-delete-cols', title: 'Delete selected columns', group: 'Edit', keywords: 'remove', run: () => deleteLines('cols') },
      { id: 'cells-clear', title: 'Clear contents', group: 'Edit', shortcut: 'Delete', keywords: 'erase empty', run: clearSelection },
      { id: 'cells-fill-down', title: 'Fill down', group: 'Edit', shortcut: 'Ctrl D', keywords: 'copy series', run: () => fillDirection('down') },
      { id: 'cells-fill-right', title: 'Fill right', group: 'Edit', shortcut: 'Ctrl R', keywords: 'copy series', run: () => fillDirection('right') },
      { id: 'cells-bold', title: 'Bold', group: 'Format', shortcut: 'Ctrl B', run: () => toggleStyle('bold') },
      { id: 'cells-italic', title: 'Italic', group: 'Format', shortcut: 'Ctrl I', run: () => toggleStyle('italic') },
      { id: 'cells-underline', title: 'Underline', group: 'Format', shortcut: 'Ctrl U', run: () => toggleStyle('underline') },
      ...(['left', 'center', 'right'] as const).map((align) => ({
        id: `cells-align-${align}`,
        title: `Align ${align}`,
        group: 'Format',
        keywords: 'alignment',
        run: () => applyStyle({ align }),
      })),
      { id: 'cells-sort-asc', title: 'Sort A to Z', group: 'Data', keywords: 'order ascending smallest', run: () => sort(false) },
      { id: 'cells-sort-desc', title: 'Sort Z to A', group: 'Data', keywords: 'order descending largest', run: () => sort(true) },
      { id: 'cells-filter', title: sheet.filter ? 'Remove filter' : 'Filter rows', group: 'Data', shortcut: 'Ctrl Shift L', keywords: 'hide show', run: toggleFilter },
      { id: 'cells-sheet-new', title: 'New sheet', group: 'Sheets', keywords: 'add tab', run: addSheet },
      { id: 'cells-sheet-rename', title: 'Rename this sheet', group: 'Sheets', run: () => setDialog({ kind: 'rename-sheet', index }) },
      { id: 'cells-sheet-duplicate', title: 'Duplicate this sheet', group: 'Sheets', keywords: 'copy', run: () => commit(duplicateSheet(workbookRef.current, index)) },
    ];
    if (workbook.sheets.length > 1) list.push({ id: 'cells-sheet-delete', title: 'Delete this sheet', group: 'Sheets', keywords: 'remove', run: () => setDialog({ kind: 'delete-sheet', index }) });
    for (const kind of ['column', 'bar', 'line', 'pie'] as ChartKind[]) {
      list.push({ id: `cells-chart-${kind}`, title: `Insert ${kind} chart`, group: 'Insert', keywords: 'graph plot', run: () => insertChart(kind) });
    }
    for (const [code, label] of [
      ['General', 'Automatic'],
      ['#,##0.00', 'Number'],
      ['$#,##0.00', 'Currency'],
      ['0%', 'Percent'],
      ['d mmm yyyy', 'Date'],
    ] as const) {
      list.push({ id: `cells-format-${label}`, title: `Format as ${label.toLowerCase()}`, group: 'Format', keywords: 'number format', run: () => applyStyle({ format: code === 'General' ? undefined : code }) });
    }
    workbook.sheets.forEach((entry, i) => {
      list.push({ id: `cells-go-${entry.id}`, title: `Go to sheet ${entry.name}`, group: 'Sheets', keywords: 'open switch', run: () => selectSheet(i) });
    });
    return list;
  }, [addSheet, applyStyle, autoSum, beginEdit, clearSelection, commit, deleteLines, exportCsv, fillDirection, history.redo, history.undo, index, insertChart, insertLines, onNewWorkbook, onOpenWorkbook, save, selectSheet, sheet.filter, sort, toggleFilter, toggleStyle, workbook.sheets]);

  useRegisterCommands('cells', commands);

  // ----- Derived view -----

  const refHighlights = useMemo(() => {
    if (!edit || !edit.value.startsWith('=')) return [];
    const out: { rect: Rect; color: string }[] = [];
    let n = 0;
    for (const token of tokenize(edit.value.slice(1))) {
      if (token.type !== 'ref') continue;
      if (token.sheet !== null && token.sheet.toLowerCase() !== sheet.name.toLowerCase()) continue;
      const end = token.end ?? token.start;
      const rect = {
        top: Math.min(token.start.row ?? 0, end.row ?? 0),
        left: Math.min(token.start.col ?? 0, end.col ?? 0),
        bottom: token.start.row === null || end.row === null ? MAX_ROWS - 1 : Math.max(token.start.row, end.row),
        right: token.start.col === null || end.col === null ? MAX_COLS - 1 : Math.max(token.start.col, end.col),
      };
      const palette = REF_COLORS[shell.theme.resolved];
      out.push({ rect, color: palette[n % palette.length] });
      n += 1;
    }
    return out;
  }, [edit, sheet.name, shell.theme.resolved]);

  const figures = useMemo(() => {
    const rect = usedRect(selRect);
    if (rect.top === rect.bottom && rect.left === rect.right) return null;
    let sum = 0;
    let numbers = 0;
    let filled = 0;
    let format: string | undefined;
    const limit = Math.min(rect.bottom, rect.top + 20000);
    for (let row = rect.top; row <= limit; row += 1) {
      if (hidden.has(row)) continue;
      for (let col = rect.left; col <= rect.right; col += 1) {
        const cell = sheet.cells[cellKey(row, col)];
        if (!hasContent(cell)) continue;
        filled += 1;
        const v: CellValue = calc.value(index, row, col);
        if (typeof v === 'number') {
          sum += v;
          numbers += 1;
          const own = cell?.s?.format;
          if (!format && own && !/[yd]/i.test(own.replace(/"[^"]*"/g, ''))) format = own;
        }
      }
    }
    if (filled === 0) return null;
    const shown = (n: number) => formatValue(Number(n.toPrecision(12)), format ?? (Number.isInteger(n) ? '#,##0' : '#,##0.##'));
    return { sum: numbers ? shown(sum) : null, average: numbers ? shown(sum / numbers) : null, count: filled };
  }, [calc, hidden, index, selRect, sheet.cells, usedRect]);

  const activeContent = (() => {
    const cell = sheet.cells[cellKey(selection.anchor.row, selection.anchor.col)];
    if (!cell) return '';
    return cell.f !== undefined ? `=${cell.f}` : editText(cell.v ?? null, cell.s?.format);
  })();

  const activeValue = text(selection.anchor.row, selection.anchor.col);
  const activeName = cellName(selection.anchor.row, selection.anchor.col);
  const addressLabel = selRect.top === selRect.bottom && selRect.left === selRect.right ? activeName : rectName(usedRect(selRect));
  const filterRows = sheet.filter ? filterBottom(sheet, sheet.filter) - sheet.filter.header : 0;

  const suggestions =
    suggest && (suggest.items.length > 0 || suggest.hint) ? (
      <SuggestList state={suggest} active={Math.min(activeSuggestion, Math.max(0, suggest.items.length - 1))} onPick={(item) => acceptSuggest(item.name)} />
    ) : null;

  const filterValues = useMemo(() => {
    if (!filterMenu || !sheet.filter) return [];
    const seen = new Set<string>();
    const last = filterBottom(sheet, sheet.filter);
    for (let row = sheet.filter.header + 1; row <= last; row += 1) seen.add(text(row, filterMenu.col));
    return [...seen].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, undefined, { numeric: true })));
  }, [filterMenu, sheet, text]);

  const theme = shell.theme.resolved;
  const overlay = (geometry: GridGeometry) =>
    sheet.charts.map((spec) => (
      <ChartFrame
        key={spec.id}
        spec={spec}
        data={chartData(sheet, spec, value, text)}
        left={geometry.x(spec.anchor.col)}
        top={geometry.y(spec.anchor.row)}
        theme={theme}
        selected={selectedChart === spec.id}
        onSelect={() => setSelectedChart(spec.id)}
        onMove={(left, top) => updateChart(spec.id, { anchor: geometry.cellAt(Math.max(0, left + 2), Math.max(0, top + 2)) })}
        onResize={(width, height) => updateChart(spec.id, { width, height })}
        onKind={(kind) => updateChart(spec.id, { kind })}
        onRename={() => setDialog({ kind: 'rename-chart', id: spec.id })}
        onSelectData={() => {
          setSelection({ anchor: { row: spec.range.top, col: spec.range.left }, focus: { row: spec.range.bottom, col: spec.range.right } });
          setSelectedChart(null);
          focusGrid();
        }}
        onDelete={() => deleteChart(spec.id)}
      />
    ));

  const closeDialog = () => {
    setDialog(null);
    focusGrid();
  };
  const dialogSheet = dialog && dialog.kind !== 'rename-chart' ? workbook.sheets[dialog.index] : null;
  const dialogChart = dialog?.kind === 'rename-chart' ? sheet.charts.find((chart) => chart.id === dialog.id) : null;

  return (
    <div className="pl-cells">
      <CellsBar
        title={title}
        onTitleChange={setTitle}
        onTitleDone={focusGrid}
        style={activeStyle}
        stamp={stamp}
        filterOn={!!sheet.filter}
        onFormat={(code) => applyStyle({ format: code === 'General' ? undefined : code })}
        onToggle={toggleStyle}
        onFill={(color) => applyStyle({ fill: color })}
        onTextColor={(color) => applyStyle({ color })}
        onAlign={(align: Align | undefined) => applyStyle({ align })}
        onSort={(descending) => sort(descending)}
        onFilter={toggleFilter}
        onChart={insertChart}
        onInsert={insertLines}
        onDelete={deleteLines}
        onAutoSum={autoSum}
        onNewSheet={addSheet}
        onSave={() => void save(false)}
        onSaveAs={() => void save(true)}
        onExportCsv={() => void exportCsv()}
        onOpen={onOpenWorkbook}
        onNew={onNewWorkbook}
        onOpenPalette={shell.openPalette}
      />

      <div className="pl-cells-body">
        <SheetStrip
          title={title || 'Untitled workbook'}
          sheets={workbook.sheets}
          current={index}
          onSelect={selectSheet}
          onNew={addSheet}
          onRename={(i) => setDialog({ kind: 'rename-sheet', index: i })}
          onDuplicate={(i) => {
            commit(duplicateSheet(workbookRef.current, i));
            setSheetIndex(i + 1);
          }}
          onMove={(from, to) => {
            commit(moveSheet(workbookRef.current, from, to));
            if (from === index) setSheetIndex(to);
          }}
          onDelete={(i) => setDialog({ kind: 'delete-sheet', index: i })}
        />

        <div className="pl-cells-work">
          <FormulaLine
            address={addressLabel}
            content={activeContent}
            edit={edit}
            inputRef={lineEditorRef}
            onBeginEdit={() => beginEdit(null, 'edit', 'line')}
            onChange={onEditorChange}
            onKeyDown={onEditorKeyDown}
            onCaret={onEditorCaret}
            onGo={goTo}
            onDone={focusGrid}
            suggestions={edit?.origin === 'line' ? suggestions : null}
          />
          <Grid
            ref={gridRef}
            sheet={sheet}
            rows={rows}
            cols={cols}
            hidden={hidden}
            text={text}
            value={value}
            selection={selection}
            edit={edit}
            editorRef={cellEditorRef}
            refHighlights={refHighlights}
            clipRect={clip && clip.sheetId === sheet.id ? { top: clip.origin.row, left: clip.origin.col, bottom: clip.origin.row + clip.rows - 1, right: clip.origin.col + clip.cols - 1 } : null}
            filter={sheet.filter}
            filterActive={filterActive}
            dark={theme === 'dark'}
            label={`${sheet.name}. Active cell ${activeName}${activeValue ? `, ${activeValue}` : ', empty'}`}
            onPointerStart={onPointerStart}
            onPointerExtend={onPointerExtend}
            onPointerEnd={() => (pointStartRef.current = null)}
            onHeaderSelect={onHeaderSelect}
            onEditCell={(point) => {
              setSelection({ anchor: point, focus: point });
              const cellText = cellEditText(point.row, point.col);
              setEditState({ row: point.row, col: point.col, value: cellText, caret: cellText.length, mode: 'edit', origin: 'cell', sync: Date.now(), point: null });
            }}
            onFill={fill}
            onResizeColumn={(col, width) => updateSheet((current) => ({ ...current, cols: { ...current.cols, [col]: width } }))}
            onAutoFitColumn={autoFit}
            onFilterButton={(col, anchor) => setFilterMenu({ col, anchor })}
            onContextMenu={openContextMenu}
            onKeyDown={onGridKeyDown}
            onEditorChange={onEditorChange}
            onEditorKeyDown={onEditorKeyDown}
            onEditorCaret={onEditorCaret}
            onGrow={(axis) => setGrow((current) => (axis === 'row' ? { ...current, rows: current.rows + 200 } : { ...current, cols: current.cols + 10 }))}
            suggestions={edit?.origin === 'cell' ? suggestions : null}
            overlay={overlay}
          />
        </div>
      </div>

      <footer className="pl-statusbar">
        <span className="pl-status-fig">
          {sheet.name} · sheet {index + 1} of {workbook.sheets.length}
        </span>
        {sheet.filter && hidden.size > 0 && (
          <span className="pl-status-fig pl-status-filter">
            Showing {filterRows - hidden.size} of {filterRows} rows
          </span>
        )}
        {figures && (
          <span className="pl-status-figures" aria-live="polite">
            {figures.sum !== null && (
              <span className="pl-status-fig">
                Sum <b>{figures.sum}</b>
              </span>
            )}
            {figures.average !== null && (
              <span className="pl-status-fig">
                Average <b>{figures.average}</b>
              </span>
            )}
            <span className="pl-status-fig">
              Count <b>{figures.count.toLocaleString()}</b>
            </span>
          </span>
        )}
        <div className="pl-status-end">
          <span className="pl-status-local" title={filePath ?? undefined}>
            <HardDrive aria-hidden="true" />
            {filePath ? folderOf(filePath) || 'On this computer' : dirty ? 'Draft kept on this computer' : 'Not saved to a file yet'}
          </span>
        </div>
      </footer>

      {filterMenu && sheet.filter && (
        <FilterMenu
          title={text(sheet.filter.header, filterMenu.col) || `Column ${colName(filterMenu.col)}`}
          anchor={filterMenu.anchor}
          values={filterValues}
          allowed={sheet.filter.rules[filterMenu.col] ?? null}
          onChange={(allowed) =>
            updateSheet((current) => {
              if (!current.filter) return current;
              const rules = { ...current.filter.rules };
              if (allowed === null) delete rules[filterMenu.col];
              else rules[filterMenu.col] = allowed;
              return { ...current, filter: { ...current.filter, rules } };
            })
          }
          onSort={(descending) => {
            sort(descending, filterMenu.col);
            setFilterMenu(null);
          }}
          onClose={() => {
            setFilterMenu(null);
            focusGrid();
          }}
        />
      )}

      {contextMenu && <ContextMenu label="Cell actions" x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}

      {dialog?.kind === 'rename-sheet' && dialogSheet && (
        <PromptDialog
          title="Rename sheet"
          label="Name"
          initialValue={dialogSheet.name}
          confirmLabel="Rename"
          validate={(name) => validSheetName(workbookRef.current, name, dialog.index)}
          onCancel={closeDialog}
          onConfirm={(name) => {
            commit(renameSheet(workbookRef.current, dialog.index, name));
            closeDialog();
          }}
        />
      )}
      {dialog?.kind === 'delete-sheet' && dialogSheet && (
        <ConfirmDialog
          title={`Delete “${dialogSheet.name}”?`}
          message="Formulas on other sheets that use it will show #REF!. You can undo this with Ctrl Z."
          confirmLabel="Delete sheet"
          onCancel={closeDialog}
          onConfirm={() => {
            commit(deleteSheet(workbookRef.current, dialog.index));
            if (index >= dialog.index && index > 0) setSheetIndex(index - 1);
            closeDialog();
          }}
        />
      )}
      {dialog?.kind === 'rename-chart' && dialogChart && (
        <PromptDialog
          title="Rename chart"
          label="Title"
          initialValue={dialogChart.title}
          confirmLabel="Rename"
          onCancel={closeDialog}
          onConfirm={(name) => {
            updateChart(dialogChart.id, { title: name });
            closeDialog();
          }}
        />
      )}
    </div>
  );
}

