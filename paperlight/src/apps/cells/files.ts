import type * as ExcelTypes from 'exceljs';
import { bridge, type OpenedFile } from '../../lib/bridge';
import { fileBase, stripExtension } from '../../lib/format';
import { cellKey, parseKey } from './engine/address';
import type { Calc } from './engine/evaluate';
import { dateToSerial, formatValue, parseInput } from './engine/format';
import { normalizeFormula, prefixFutureFunctions } from './engine/parser';
import { isError, type CellValue, type Scalar } from './engine/values';
import { DEFAULT_COL_WIDTH, newId, newSheet, sheetExtent, type Cell, type CellStyle, type ChartSpec, type Sheet, type Workbook } from './model';

export const XLSX_FILTERS = [{ name: 'Workbook (.xlsx)', extensions: ['xlsx'] }];
export const OPEN_FILTERS = [{ name: 'Spreadsheets (.xlsx, .csv)', extensions: ['xlsx', 'csv'] }];
export const CSV_FILTERS = [{ name: 'Comma-separated values (.csv)', extensions: ['csv'] }];

/** Paperlight keeps its charts and filters in a very hidden sheet that Excel preserves and never shows. */
const META_SHEET = 'paperlight_meta';
/**
 * Excel measures column width in digits of its default font. Cells draws 14px Geist, whose
 * digit is wider, so widths convert through Geist's digit and the cell padding.
 */
const DIGIT_PX = 9.3;
const CELL_PAD_PX = 16;
const FUTURE_FUNCTIONS = new Set(['XLOOKUP', 'IFS', 'SWITCH', 'CONCAT', 'TEXTJOIN', 'MAXIFS', 'MINIFS', 'XOR', 'IFNA', 'DAYS', 'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P']);

type ExcelModule = typeof ExcelTypes;
let loader: Promise<ExcelModule> | null = null;

/** ExcelJS is large, so it loads the first time a file is opened or saved. */
function excel(): Promise<ExcelModule> {
  loader ??= import('exceljs').then((mod) => ((mod as unknown as { default?: ExcelModule }).default ?? mod) as ExcelModule);
  return loader;
}

interface Meta {
  version: 1;
  sheets: { name: string; charts: ChartSpec[]; rules?: Record<number, string[]> }[];
}

function hex(argb: string | undefined) {
  if (!argb || argb.length < 6) return undefined;
  return `#${argb.slice(-6).toUpperCase()}`;
}

function argb(color: string) {
  return `FF${color.replace('#', '').toUpperCase()}`;
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if ('richText' in value) return (value as ExcelTypes.CellRichTextValue).richText.map((part) => part.text).join('');
    if ('text' in value) return textOf((value as { text: unknown }).text);
  }
  return value === null || value === undefined ? '' : String(value);
}

function scalarOf(value: unknown): Scalar | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
  if (value instanceof Date) return dateToSerial(value);
  if (typeof value === 'object' && 'error' in value) return String((value as { error: unknown }).error);
  return textOf(value);
}

function readStyle(xc: ExcelTypes.Cell): CellStyle | undefined {
  const style: CellStyle = {};
  const font = xc.font;
  if (font?.bold) style.bold = true;
  if (font?.italic) style.italic = true;
  if (font?.underline) style.underline = true;
  const color = hex(font?.color?.argb);
  if (color && color !== '#000000') style.color = color;
  const fill = xc.fill;
  if (fill?.type === 'pattern' && fill.pattern === 'solid') {
    const fg = hex(fill.fgColor?.argb);
    if (fg && fg !== '#FFFFFF') style.fill = fg;
  }
  const align = xc.alignment?.horizontal;
  if (align === 'left' || align === 'center' || align === 'right') style.align = align;
  if (xc.numFmt && xc.numFmt !== 'General') style.format = xc.numFmt;
  return Object.keys(style).length ? style : undefined;
}

function readCell(xc: ExcelTypes.Cell): Cell | null {
  const value = xc.value as unknown;
  const cell: Cell = {};
  if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
    const formula = xc.formula;
    if (formula) {
      cell.f = normalizeFormula(formula.replace(/^=/, ''));
      const cached = scalarOf((value as { result?: unknown }).result);
      if (cached !== undefined) cell.cached = cached;
    }
  } else if (xc.type !== 1) {
    const scalar = scalarOf(value);
    if (scalar !== undefined) cell.v = scalar;
  }
  const style = readStyle(xc);
  if (style) cell.s = style;
  return cell.f !== undefined || cell.v !== undefined || cell.s ? cell : null;
}

export async function readXlsx(data: Uint8Array): Promise<{ workbook: Workbook; warnings: string[] }> {
  const ExcelJS = await excel();
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  const warnings = new Set<string>();
  let meta: Meta | null = null;
  const sheets: Sheet[] = [];

  book.eachSheet((ws) => {
    if (ws.name === META_SHEET) {
      try {
        meta = JSON.parse(textOf(ws.getCell('A1').value)) as Meta;
      } catch {
        // Not ours, or damaged: open the data without charts.
      }
      return;
    }
    if (ws.state === 'veryHidden') return;
    const sheet = newSheet(ws.name);
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (xc, colNumber) => {
        const cell = readCell(xc);
        if (cell) sheet.cells[cellKey(rowNumber - 1, colNumber - 1)] = cell;
      });
    });
    (ws.columns ?? []).forEach((column, index) => {
      if (column?.width) sheet.cols[index] = Math.max(28, Math.round(column.width * DIGIT_PX + CELL_PAD_PX));
    });
    const merges = (ws as unknown as { _merges?: Record<string, unknown> })._merges;
    if (merges && Object.keys(merges).length > 0) warnings.add('Merged cells were split into separate cells.');
    if (ws.getImages().length > 0) warnings.add('Pictures and charts made in other programs are not shown.');
    const filter = ws.autoFilter;
    if (filter) {
      const ref = typeof filter === 'string' ? filter : null;
      const match = ref ? /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?\d+$/i.exec(ref) : null;
      if (match) {
        const col = (name: string) => [...name.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        sheet.filter = { header: Number(match[2]) - 1, left: col(match[1]), right: col(match[3]), rules: {} };
      }
    }
    sheets.push(sheet);
  });

  const stored = meta as Meta | null;
  if (stored?.version === 1) {
    for (const entry of stored.sheets) {
      const sheet = sheets.find((candidate) => candidate.name === entry.name);
      if (!sheet) continue;
      sheet.charts = (entry.charts ?? []).map((chart) => ({ ...chart, id: newId() }));
      if (sheet.filter && entry.rules) sheet.filter.rules = entry.rules;
    }
    warnings.delete('Pictures and charts made in other programs are not shown.');
  }
  if (sheets.length === 0) sheets.push(newSheet('Sheet 1'));
  return { workbook: { sheets }, warnings: [...warnings] };
}

function resultFor(value: CellValue): ExcelTypes.CellFormulaValue['result'] {
  if (value === null) return undefined;
  if (isError(value)) {
    return value.error === '#CIRC!' ? undefined : ({ error: value.error } as ExcelTypes.CellErrorValue);
  }
  return value;
}

export async function writeXlsx(workbook: Workbook, calc: Calc, chartImages: Map<string, string>): Promise<Uint8Array> {
  const ExcelJS = await excel();
  const book = new ExcelJS.Workbook();
  book.creator = 'Paperlight';
  book.created = new Date();
  const meta: Meta = { version: 1, sheets: [] };

  workbook.sheets.forEach((sheet, index) => {
    const ws = book.addWorksheet(sheet.name, { properties: { defaultColWidth: (DEFAULT_COL_WIDTH - CELL_PAD_PX) / DIGIT_PX } as ExcelTypes.WorksheetProperties });
    for (const [col, width] of Object.entries(sheet.cols)) ws.getColumn(Number(col) + 1).width = Math.max(1, (width - CELL_PAD_PX) / DIGIT_PX);
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const { row, col } = parseKey(key);
      const xc = ws.getCell(row + 1, col + 1);
      if (cell.f !== undefined) {
        xc.value = { formula: prefixFutureFunctions(cell.f, FUTURE_FUNCTIONS), result: resultFor(calc.value(index, row, col)) } as ExcelTypes.CellFormulaValue;
      } else if (cell.v !== undefined && cell.v !== null) {
        xc.value = cell.v;
      }
      const s = cell.s;
      if (!s) continue;
      if (s.bold || s.italic || s.underline || s.color) {
        xc.font = {
          size: 11,
          bold: s.bold || undefined,
          italic: s.italic || undefined,
          underline: s.underline || undefined,
          color: s.color ? { argb: argb(s.color) } : undefined,
        };
      }
      if (s.fill) xc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(s.fill) } };
      if (s.align) xc.alignment = { horizontal: s.align };
      if (s.format) xc.numFmt = s.format;
    }
    if (sheet.filter) {
      const bottom = Math.max(sheet.filter.header + 1, sheetExtent(sheet).rows);
      ws.autoFilter = {
        from: { row: sheet.filter.header + 1, column: sheet.filter.left + 1 },
        to: { row: bottom, column: sheet.filter.right + 1 },
      };
    }
    for (const chart of sheet.charts) {
      const png = chartImages.get(chart.id);
      if (!png) continue;
      const imageId = book.addImage({ base64: png, extension: 'png' });
      ws.addImage(imageId, {
        tl: { col: chart.anchor.col, row: chart.anchor.row } as ExcelTypes.Anchor,
        ext: { width: chart.width, height: chart.height },
      });
    }
    meta.sheets.push({ name: sheet.name, charts: sheet.charts, rules: sheet.filter?.rules });
  });

  if (meta.sheets.some((entry) => entry.charts.length > 0 || (entry.rules && Object.keys(entry.rules).length > 0))) {
    const hidden = book.addWorksheet(META_SHEET, { state: 'veryHidden' });
    hidden.getCell('A1').value = JSON.stringify(meta);
  }
  const buffer = await book.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/** Reads CSV the way a spreadsheet does: numbers, dates and percentages become values. */
export function readCsv(text: string, name: string): Workbook {
  const sheet = newSheet(name.slice(0, 31) || 'Sheet 1');
  const source = text.replace(/^﻿/, '');
  const delimiter = (source.split('\n')[0].match(/;/g)?.length ?? 0) > (source.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  let row = 0;
  let col = 0;
  let field = '';
  let quoted = false;
  const put = () => {
    if (field !== '') {
      const parsed = parseInput(field);
      const cell: Cell = { v: parsed.value };
      if (parsed.format) cell.s = { format: parsed.format };
      sheet.cells[cellKey(row, col)] = cell;
    }
    field = '';
  };
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) {
      put();
      col += 1;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      put();
      row += 1;
      col = 0;
    } else field += ch;
  }
  put();
  return { sheets: [sheet] };
}

export function writeCsv(sheet: Sheet, sheetIndex: number, calc: Calc): Uint8Array {
  const { rows, cols } = sheetExtent(sheet);
  const lines: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const fields: string[] = [];
    for (let col = 0; col < cols; col += 1) {
      const cell = sheet.cells[cellKey(row, col)];
      const text = cell ? formatValue(calc.value(sheetIndex, row, col), cell.s?.format) : '';
      fields.push(/[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
    }
    lines.push(fields.join(','));
  }
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
}

export interface CellsDoc {
  key: string;
  draftId: string;
  title: string;
  workbook: Workbook;
  filePath: string | null;
  dirty: boolean;
}

export async function bookFromFile(file: OpenedFile): Promise<{ doc: CellsDoc; warnings: string[] }> {
  const title = stripExtension(file.name);
  if (/\.csv$/i.test(file.name)) {
    const workbook = readCsv(new TextDecoder().decode(file.data), title);
    // A CSV keeps one sheet of plain values, so saving always makes a new .xlsx.
    return { doc: { key: newId(), draftId: newId(), title, workbook, filePath: null, dirty: false }, warnings: [] };
  }
  const { workbook, warnings } = await readXlsx(file.data);
  return { doc: { key: newId(), draftId: newId(), title, workbook, filePath: file.path, dirty: false }, warnings };
}

export function pickWorkbookFile() {
  return bridge.openFile({ title: 'Open a workbook', filters: OPEN_FILTERS });
}

export function xlsxName(title: string) {
  return `${fileBase(title)}.xlsx`;
}

export interface CellsDraft {
  id: string;
  title: string;
  workbook: Workbook;
  filePath: string | null;
  updatedAt: number;
}

const DRAFTS_KEY = 'paperlight.cells.drafts.v1';
const DRAFT_LIMIT = 6;
const DRAFT_BYTES = 2_000_000;

export function listCellsDrafts(): CellsDraft[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as CellsDraft[]) : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: CellsDraft[]) {
  try {
    const kept = drafts.slice(0, DRAFT_LIMIT).filter((draft) => JSON.stringify(draft.workbook).length < DRAFT_BYTES);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(kept));
  } catch {
    // Storage full: the open workbook is unaffected.
  }
}

export function saveCellsDraft(draft: CellsDraft) {
  writeDrafts([draft, ...listCellsDrafts().filter((existing) => existing.id !== draft.id)]);
}

export function removeCellsDraft(id: string) {
  writeDrafts(listCellsDrafts().filter((existing) => existing.id !== id));
}

export function bookFromDraft(draft: CellsDraft): CellsDoc {
  return { key: newId(), draftId: draft.id, title: draft.title, workbook: draft.workbook, filePath: draft.filePath, dirty: true };
}
