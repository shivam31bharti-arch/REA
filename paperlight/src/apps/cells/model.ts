import { cellKey, parseKey, type Point, type Rect } from './engine/address.ts';
import type { CalcSource } from './engine/evaluate.ts';
import {
  adjustFormula,
  breakSheetInFormula,
  renameSheetInFormula,
  translateFormula,
  type StructureChange,
} from './engine/parser.ts';
import type { CellValue, Scalar } from './engine/values.ts';

export type Align = 'left' | 'center' | 'right';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: Align;
  /** Excel number format code, such as "#,##0.00". */
  format?: string;
  fill?: string;
  color?: string;
}

export interface Cell {
  v?: Scalar;
  /** Formula text without the leading "=". */
  f?: string;
  cached?: Scalar;
  s?: CellStyle;
}

export interface FilterSpec {
  header: number;
  left: number;
  right: number;
  /** Per column, the displayed values that stay visible. A missing column shows everything. */
  rules: Record<number, string[]>;
}

export type ChartKind = 'column' | 'bar' | 'line' | 'pie';

export interface ChartSpec {
  id: string;
  kind: ChartKind;
  title: string;
  range: Rect;
  anchor: Point;
  width: number;
  height: number;
}

export interface Sheet {
  id: string;
  name: string;
  cells: Record<string, Cell>;
  /** Column widths in pixels, by column index. */
  cols: Record<number, number>;
  filter: FilterSpec | null;
  charts: ChartSpec[];
}

export interface Workbook {
  sheets: Sheet[];
}

export const DEFAULT_COL_WIDTH = 104;
export const MIN_COL_WIDTH = 28;
const STYLE_CELL_LIMIT = 50_000;

export function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`;
}

export function newSheet(name: string): Sheet {
  return { id: newId(), name, cells: {}, cols: {}, filter: null, charts: [] };
}

export function blankWorkbook(): Workbook {
  return { sheets: [newSheet('Sheet 1')] };
}

export function hasContent(cell: Cell | undefined) {
  return !!cell && (cell.f !== undefined || (cell.v !== undefined && cell.v !== null && cell.v !== ''));
}

export function colWidth(sheet: Sheet, col: number) {
  return sheet.cols[col] ?? DEFAULT_COL_WIDTH;
}

const extentCache = new WeakMap<Record<string, Cell>, { rows: number; cols: number }>();
const formulaCache = new WeakMap<Record<string, Cell>, [number, number][]>();

/** One past the last row and column holding content. */
export function sheetExtent(sheet: Sheet) {
  let hit = extentCache.get(sheet.cells);
  if (!hit) {
    let rows = 0;
    let cols = 0;
    for (const [key, cell] of Object.entries(sheet.cells)) {
      if (!hasContent(cell)) continue;
      const { row, col } = parseKey(key);
      if (row + 1 > rows) rows = row + 1;
      if (col + 1 > cols) cols = col + 1;
    }
    hit = { rows, cols };
    extentCache.set(sheet.cells, hit);
  }
  return hit;
}

function formulaCells(sheet: Sheet) {
  let hit = formulaCache.get(sheet.cells);
  if (!hit) {
    hit = [];
    for (const [key, cell] of Object.entries(sheet.cells)) {
      if (cell.f === undefined) continue;
      const { row, col } = parseKey(key);
      hit.push([row, col]);
    }
    hit.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    formulaCache.set(sheet.cells, hit);
  }
  return hit;
}

export function calcSource(workbook: Workbook): CalcSource {
  const names = new Map(workbook.sheets.map((sheet, index) => [sheet.name.toLowerCase(), index]));
  return {
    sheetIndex: (name) => names.get(name.toLowerCase()) ?? -1,
    cell: (sheet, row, col) => workbook.sheets[sheet]?.cells[cellKey(row, col)],
    extent: (sheet) => sheetExtent(workbook.sheets[sheet]),
    formulaCells: (sheet) => formulaCells(workbook.sheets[sheet]),
  };
}

export function replaceSheet(workbook: Workbook, index: number, sheet: Sheet): Workbook {
  const sheets = workbook.sheets.slice();
  sheets[index] = sheet;
  return { ...workbook, sheets };
}

function isEmptyCell(cell: Cell) {
  return !hasContent(cell) && (!cell.s || Object.keys(cell.s).length === 0);
}

export interface CellUpdate {
  row: number;
  col: number;
  cell: Cell | null;
}

export function setCells(sheet: Sheet, updates: CellUpdate[]): Sheet {
  if (updates.length === 0) return sheet;
  const cells = { ...sheet.cells };
  for (const { row, col, cell } of updates) {
    const key = cellKey(row, col);
    if (!cell || isEmptyCell(cell)) delete cells[key];
    else cells[key] = cell;
  }
  return { ...sheet, cells };
}

function clampRect(sheet: Sheet, rect: Rect): Rect {
  const extent = sheetExtent(sheet);
  const width = rect.right - rect.left + 1;
  const maxRows = Math.max(1, Math.floor(STYLE_CELL_LIMIT / width));
  return { ...rect, bottom: Math.min(rect.bottom, Math.max(rect.top + maxRows - 1, extent.rows - 1)) };
}

/** Applies a style change to every cell in the block. Keys set to undefined are removed. */
export function styleCells(sheet: Sheet, rect: Rect, patch: Partial<CellStyle>): Sheet {
  const area = clampRect(sheet, rect);
  const updates: CellUpdate[] = [];
  for (let row = area.top; row <= area.bottom; row += 1) {
    for (let col = area.left; col <= area.right; col += 1) {
      const current = sheet.cells[cellKey(row, col)] ?? {};
      const style: CellStyle = { ...current.s };
      for (const [name, value] of Object.entries(patch) as [keyof CellStyle, CellStyle[keyof CellStyle]][]) {
        if (value === undefined || value === false) delete style[name];
        else (style as Record<string, unknown>)[name] = value;
      }
      const next: Cell = { ...current, s: Object.keys(style).length ? style : undefined };
      if (!next.s) delete next.s;
      updates.push({ row, col, cell: next });
    }
  }
  return setCells(sheet, updates);
}

export function clearCells(sheet: Sheet, rect: Rect, keepFormats: boolean): Sheet {
  const updates: CellUpdate[] = [];
  for (const key of Object.keys(sheet.cells)) {
    const { row, col } = parseKey(key);
    if (row < rect.top || row > rect.bottom || col < rect.left || col > rect.right) continue;
    const cell = sheet.cells[key];
    updates.push({ row, col, cell: keepFormats && cell.s ? { s: cell.s } : null });
  }
  return setCells(sheet, updates);
}

/** The block of filled cells around a cell, bounded by empty rows and columns. */
export function currentRegion(sheet: Sheet, row: number, col: number): Rect {
  const filled = (r: number, c: number) => r >= 0 && c >= 0 && hasContent(sheet.cells[cellKey(r, c)]);
  let rect: Rect = { top: row, left: col, bottom: row, right: col };
  for (let guard = 0; guard < 10_000; guard += 1) {
    let grew = false;
    const scanRow = (r: number) => {
      for (let c = rect.left - 1; c <= rect.right + 1; c += 1) if (filled(r, c)) return true;
      return false;
    };
    const scanCol = (c: number) => {
      for (let r = rect.top - 1; r <= rect.bottom + 1; r += 1) if (filled(r, c)) return true;
      return false;
    };
    if (rect.top > 0 && scanRow(rect.top - 1)) {
      rect = { ...rect, top: rect.top - 1 };
      grew = true;
    }
    if (scanRow(rect.bottom + 1)) {
      rect = { ...rect, bottom: rect.bottom + 1 };
      grew = true;
    }
    if (rect.left > 0 && scanCol(rect.left - 1)) {
      rect = { ...rect, left: rect.left - 1 };
      grew = true;
    }
    if (scanCol(rect.right + 1)) {
      rect = { ...rect, right: rect.right + 1 };
      grew = true;
    }
    if (!grew) break;
  }
  return rect;
}

/** Where Ctrl+arrow lands: the edge of the current run of filled or empty cells. */
export function jumpTarget(sheet: Sheet, from: Point, dRow: number, dCol: number, limit: Point): Point {
  const filled = (r: number, c: number) => hasContent(sheet.cells[cellKey(r, c)]);
  let { row, col } = from;
  const inside = (r: number, c: number) => r >= 0 && c >= 0 && r <= limit.row && c <= limit.col;
  const next = () => ({ r: row + dRow, c: col + dCol });
  if (!inside(next().r, next().c)) return from;
  const startFilled = filled(row, col) && filled(next().r, next().c);
  if (startFilled) {
    while (inside(next().r, next().c) && filled(next().r, next().c)) {
      row += dRow;
      col += dCol;
    }
    return { row, col };
  }
  row += dRow;
  col += dCol;
  while (inside(row, col) && !filled(row, col)) {
    if (!inside(row + dRow, col + dCol)) return { row, col };
    row += dRow;
    col += dCol;
  }
  return { row, col };
}

function rewriteFormulas(workbook: Workbook, rewrite: (formula: string, ownSheet: string) => string): Workbook {
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => {
      let changed = false;
      const cells: Record<string, Cell> = {};
      for (const [key, cell] of Object.entries(sheet.cells)) {
        if (cell.f === undefined) {
          cells[key] = cell;
          continue;
        }
        const f = rewrite(cell.f, sheet.name);
        if (f !== cell.f) changed = true;
        cells[key] = f === cell.f ? cell : { ...cell, f, cached: undefined };
      }
      return changed ? { ...sheet, cells } : sheet;
    }),
  };
}

function shiftIndex(value: number, at: number, count: number): number | null {
  if (count > 0) return value >= at ? value + count : value;
  const removed = -count;
  if (value >= at && value < at + removed) return null;
  return value >= at + removed ? value - removed : value;
}

/** Inserts (count > 0) or deletes (count < 0) rows or columns and keeps every reference pointing at the same data. */
export function changeStructure(workbook: Workbook, sheetIndex: number, axis: 'row' | 'col', at: number, count: number): Workbook {
  const sheet = workbook.sheets[sheetIndex];
  const change: StructureChange = { sheet: sheet.name, axis, at, count };
  const adjusted = rewriteFormulas(workbook, (formula, own) => adjustFormula(formula, own, change));
  const target = adjusted.sheets[sheetIndex];

  const cells: Record<string, Cell> = {};
  for (const [key, cell] of Object.entries(target.cells)) {
    const { row, col } = parseKey(key);
    const moved = shiftIndex(axis === 'row' ? row : col, at, count);
    if (moved === null) continue;
    cells[axis === 'row' ? cellKey(moved, col) : cellKey(row, moved)] = cell;
  }

  let cols = target.cols;
  if (axis === 'col') {
    cols = {};
    for (const [key, width] of Object.entries(target.cols)) {
      const moved = shiftIndex(Number(key), at, count);
      if (moved !== null) cols[moved] = width;
    }
  }

  let filter = target.filter;
  if (filter) {
    if (axis === 'row') {
      const header = shiftIndex(filter.header, at, count);
      filter = header === null ? null : { ...filter, header };
    } else {
      const left = shiftIndex(filter.left, at, count) ?? at;
      const right = shiftIndex(filter.right, at, count) ?? at - 1;
      const rules: Record<number, string[]> = {};
      for (const [key, values] of Object.entries(filter.rules)) {
        const moved = shiftIndex(Number(key), at, count);
        if (moved !== null) rules[moved] = values;
      }
      filter = right < left ? null : { ...filter, left, right, rules };
    }
  }

  const charts = target.charts.map((chart) => {
    const move = (value: number) => shiftIndex(value, at, count) ?? at;
    const range =
      axis === 'row'
        ? { ...chart.range, top: move(chart.range.top), bottom: Math.max(move(chart.range.top), shiftIndex(chart.range.bottom, at, count) ?? at - 1) }
        : { ...chart.range, left: move(chart.range.left), right: Math.max(move(chart.range.left), shiftIndex(chart.range.right, at, count) ?? at - 1) };
    const anchor = axis === 'row' ? { ...chart.anchor, row: move(chart.anchor.row) } : { ...chart.anchor, col: move(chart.anchor.col) };
    return { ...chart, range, anchor };
  });

  return replaceSheet(adjusted, sheetIndex, { ...target, cells, cols, filter, charts });
}

export function validSheetName(workbook: Workbook, name: string, exceptIndex = -1): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give the sheet a name.';
  if (trimmed.length > 31) return 'Sheet names can be up to 31 characters.';
  if (/[[\]:*?/\\]/.test(trimmed)) return 'Sheet names can’t contain [ ] : * ? / or \\.';
  if (/^'|'$/.test(trimmed)) return 'Sheet names can’t start or end with an apostrophe.';
  const clash = workbook.sheets.findIndex((sheet, index) => index !== exceptIndex && sheet.name.toLowerCase() === trimmed.toLowerCase());
  if (clash !== -1) return 'Another sheet already has that name.';
  return null;
}

export function uniqueSheetName(workbook: Workbook, base: string) {
  const taken = new Set(workbook.sheets.map((sheet) => sheet.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base.slice(0, 26)} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function renameSheet(workbook: Workbook, index: number, name: string): Workbook {
  const from = workbook.sheets[index].name;
  const renamed = rewriteFormulas(workbook, (formula) => renameSheetInFormula(formula, from, name));
  return replaceSheet(renamed, index, { ...renamed.sheets[index], name });
}

export function deleteSheet(workbook: Workbook, index: number): Workbook {
  const name = workbook.sheets[index].name;
  const remaining = { ...workbook, sheets: workbook.sheets.filter((_, i) => i !== index) };
  return rewriteFormulas(remaining, (formula) => breakSheetInFormula(formula, name));
}

export function duplicateSheet(workbook: Workbook, index: number): Workbook {
  const source = workbook.sheets[index];
  const copy: Sheet = {
    ...source,
    id: newId(),
    name: uniqueSheetName(workbook, `${source.name} copy`),
    charts: source.charts.map((chart) => ({ ...chart, id: newId() })),
  };
  const sheets = workbook.sheets.slice();
  sheets.splice(index + 1, 0, copy);
  return { ...workbook, sheets };
}

export function moveSheet(workbook: Workbook, from: number, to: number): Workbook {
  const sheets = workbook.sheets.slice();
  const [sheet] = sheets.splice(from, 1);
  sheets.splice(to, 0, sheet);
  return { ...workbook, sheets };
}

/** A copied block of cells and where it came from, so formulas can be moved on paste. */
export interface Clip {
  origin: Point;
  rows: number;
  cols: number;
  cells: (Cell | undefined)[][];
  text: string;
}

export function copyBlock(sheet: Sheet, rect: Rect, display: (row: number, col: number) => string): Clip {
  const cells: (Cell | undefined)[][] = [];
  const lines: string[] = [];
  for (let row = rect.top; row <= rect.bottom; row += 1) {
    const line: (Cell | undefined)[] = [];
    const texts: string[] = [];
    for (let col = rect.left; col <= rect.right; col += 1) {
      line.push(sheet.cells[cellKey(row, col)]);
      texts.push(display(row, col));
    }
    cells.push(line);
    lines.push(texts.join('\t'));
  }
  return { origin: { row: rect.top, col: rect.left }, rows: cells.length, cols: cells[0]?.length ?? 0, cells, text: lines.join('\n') };
}

/** Pastes a block, repeating it to fill a larger selection that is a whole multiple of its size. */
export function pasteBlock(sheet: Sheet, clip: Clip, target: Rect): { sheet: Sheet; area: Rect } {
  const tall = target.bottom - target.top + 1;
  const wide = target.right - target.left + 1;
  const repeatRows = tall % clip.rows === 0 ? tall / clip.rows : 1;
  const repeatCols = wide % clip.cols === 0 ? wide / clip.cols : 1;
  const updates: CellUpdate[] = [];
  for (let rr = 0; rr < repeatRows; rr += 1) {
    for (let rc = 0; rc < repeatCols; rc += 1) {
      for (let r = 0; r < clip.rows; r += 1) {
        for (let c = 0; c < clip.cols; c += 1) {
          const row = target.top + rr * clip.rows + r;
          const col = target.left + rc * clip.cols + c;
          const source = clip.cells[r][c];
          if (!source) {
            updates.push({ row, col, cell: null });
            continue;
          }
          const cell: Cell = { ...source };
          if (cell.f !== undefined) {
            cell.f = translateFormula(cell.f, row - (clip.origin.row + r), col - (clip.origin.col + c));
            delete cell.cached;
          }
          updates.push({ row, col, cell });
        }
      }
    }
  }
  const area = {
    top: target.top,
    left: target.left,
    bottom: target.top + repeatRows * clip.rows - 1,
    right: target.left + repeatCols * clip.cols - 1,
  };
  return { sheet: setCells(sheet, updates), area };
}

/** Values typed or pasted as plain text: tab-separated columns, one line per row. */
export function textToRows(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  return lines.map((line) => line.split('\t'));
}

/**
 * Fill handle and Ctrl+D/R: extends the source block across the target, continuing number
 * series (1, 2, 3 …) and moving formulas, otherwise repeating.
 */
export function fillCells(sheet: Sheet, source: Rect, target: Rect): Sheet {
  const vertical = target.left === source.left && target.right === source.right;
  const updates: CellUpdate[] = [];
  const lines = vertical ? source.right - source.left + 1 : source.bottom - source.top + 1;
  const length = vertical ? source.bottom - source.top + 1 : source.right - source.left + 1;
  const forward = vertical ? target.bottom > source.bottom : target.right > source.right;
  const start = vertical ? (forward ? source.bottom + 1 : target.top) : forward ? source.right + 1 : target.left;
  const end = vertical ? (forward ? target.bottom : source.top - 1) : forward ? target.right : source.left - 1;

  for (let line = 0; line < lines; line += 1) {
    const at = (i: number) => (vertical ? { row: source.top + i, col: source.left + line } : { row: source.top + line, col: source.left + i });
    const seeds = Array.from({ length }, (_, i) => {
      const point = at(i);
      return { point, cell: sheet.cells[cellKey(point.row, point.col)] };
    });
    const numbersOnly = seeds.every(({ cell }) => cell && cell.f === undefined && typeof cell.v === 'number');
    let step = 0;
    if (numbersOnly && length >= 2) {
      const values = seeds.map(({ cell }) => cell!.v as number);
      step = (values[values.length - 1] - values[0]) / (values.length - 1);
    }
    for (let pos = start; pos <= end; pos += 1) {
      const offset = pos - (vertical ? source.top : source.left);
      const index = ((offset % length) + length) % length;
      const seed = seeds[index];
      const row = vertical ? pos : source.top + line;
      const col = vertical ? source.left + line : pos;
      if (!seed.cell) {
        updates.push({ row, col, cell: null });
        continue;
      }
      const cell: Cell = { ...seed.cell };
      if (cell.f !== undefined) {
        cell.f = translateFormula(cell.f, row - seed.point.row, col - seed.point.col);
        delete cell.cached;
      } else if (numbersOnly && length >= 2) {
        const last = seeds[length - 1].cell!.v as number;
        const distance = offset - (length - 1);
        cell.v = Number((last + step * distance).toPrecision(15));
      }
      updates.push({ row, col, cell });
    }
  }
  return setCells(sheet, updates);
}

/** Rows of a filtered table that stay visible. */
export function hiddenRows(sheet: Sheet, display: (row: number, col: number) => string): Set<number> {
  const hidden = new Set<number>();
  const filter = sheet.filter;
  if (!filter) return hidden;
  const rules = Object.entries(filter.rules).map(([col, values]) => ({ col: Number(col), allowed: new Set(values) }));
  if (rules.length === 0) return hidden;
  const last = filterBottom(sheet, filter);
  for (let row = filter.header + 1; row <= last; row += 1) {
    if (rules.some(({ col, allowed }) => !allowed.has(display(row, col)))) hidden.add(row);
  }
  return hidden;
}

/** The last row of a filtered table: it grows as rows are added directly beneath it. */
export function filterBottom(sheet: Sheet, filter: FilterSpec) {
  let row = filter.header;
  for (;;) {
    const next = row + 1;
    let filled = false;
    for (let col = filter.left; col <= filter.right; col += 1) {
      if (hasContent(sheet.cells[cellKey(next, col)])) {
        filled = true;
        break;
      }
    }
    if (!filled) return row;
    row = next;
  }
}

/** True when a row only summarises the rows above it, such as a SUM total under a table. */
function isSummaryRow(sheet: Sheet, row: number, rect: Rect) {
  for (let col = rect.left; col <= rect.right; col += 1) {
    const f = sheet.cells[cellKey(row, col)]?.f;
    if (f && /[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+/i.test(f)) {
      const matches = [...f.matchAll(/\$?[A-Z]{1,3}\$?(\d+):\$?[A-Z]{1,3}\$?(\d+)/gi)];
      if (matches.some((m) => Number(m[1]) - 1 >= rect.top && Number(m[2]) - 1 < row)) return true;
    }
  }
  return false;
}

/** Whether the first row of a block reads as column headings. */
export function looksLikeHeader(sheet: Sheet, rect: Rect, value: (row: number, col: number) => CellValue) {
  if (rect.bottom <= rect.top) return false;
  let allText = true;
  let anyBold = false;
  for (let col = rect.left; col <= rect.right; col += 1) {
    const v = value(rect.top, col);
    if (v !== null && typeof v !== 'string') allText = false;
    if (sheet.cells[cellKey(rect.top, col)]?.s?.bold) anyBold = true;
  }
  if (!allText) return false;
  if (anyBold) return true;
  for (let col = rect.left; col <= rect.right; col += 1) {
    if (typeof value(rect.top + 1, col) === 'number') return true;
  }
  return false;
}

/** The rows a sort should move: skips the heading and any totals row under the data. */
export function sortableRows(sheet: Sheet, rect: Rect, hasHeader: boolean): Rect {
  let top = hasHeader ? rect.top + 1 : rect.top;
  let bottom = rect.bottom;
  while (bottom > top && isSummaryRow(sheet, bottom, { ...rect, top })) bottom -= 1;
  if (top > bottom) top = bottom;
  return { ...rect, top, bottom };
}

export function sortRows(sheet: Sheet, rect: Rect, col: number, descending: boolean, value: (row: number, col: number) => CellValue, compare: (a: CellValue, b: CellValue) => number): Sheet {
  const rows: number[] = [];
  for (let row = rect.top; row <= rect.bottom; row += 1) rows.push(row);
  const empty = (v: CellValue) => v === null || v === '';
  const order = rows
    .map((row) => ({ row, key: value(row, col) }))
    .sort((a, b) => {
      if (empty(a.key) && empty(b.key)) return a.row - b.row;
      if (empty(a.key)) return 1;
      if (empty(b.key)) return -1;
      const result = compare(a.key, b.key);
      return (descending ? -result : result) || a.row - b.row;
    });
  const updates: CellUpdate[] = [];
  order.forEach(({ row: from }, index) => {
    const to = rect.top + index;
    for (let c = rect.left; c <= rect.right; c += 1) {
      const cell = sheet.cells[cellKey(from, c)];
      if (!cell) {
        updates.push({ row: to, col: c, cell: null });
        continue;
      }
      updates.push({
        row: to,
        col: c,
        cell: cell.f !== undefined ? { ...cell, f: translateFormula(cell.f, to - from, 0), cached: undefined } : cell,
      });
    }
  });
  return setCells(sheet, updates);
}
