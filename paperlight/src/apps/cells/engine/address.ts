export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384;

export interface Point {
  row: number;
  col: number;
}

/** An inclusive block of cells, zero-based. */
export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export function colName(col: number): string {
  let n = col + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function cellName(row: number, col: number) {
  return `${colName(col)}${row + 1}`;
}

export function cellKey(row: number, col: number) {
  return `${row},${col}`;
}

export function parseKey(key: string): Point {
  const comma = key.indexOf(',');
  return { row: Number(key.slice(0, comma)), col: Number(key.slice(comma + 1)) };
}

export function parseAddress(text: string): Point | null {
  const match = /^\s*\$?([A-Za-z]{1,3})\$?(\d+)\s*$/.exec(text);
  if (!match) return null;
  const row = Number(match[2]) - 1;
  const col = colIndex(match[1]);
  if (row < 0 || row >= MAX_ROWS || col >= MAX_COLS) return null;
  return { row, col };
}

export function parseRange(text: string): Rect | null {
  const [first, second] = text.split(':');
  const a = parseAddress(first ?? '');
  if (!a) return null;
  const b = second === undefined ? a : parseAddress(second);
  if (!b) return null;
  return normalize(a, b);
}

export function normalize(a: Point, b: Point): Rect {
  return {
    top: Math.min(a.row, b.row),
    left: Math.min(a.col, b.col),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.col, b.col),
  };
}

export function rectName(rect: Rect) {
  const start = cellName(rect.top, rect.left);
  return rect.top === rect.bottom && rect.left === rect.right ? start : `${start}:${cellName(rect.bottom, rect.right)}`;
}

export function contains(rect: Rect, row: number, col: number) {
  return row >= rect.top && row <= rect.bottom && col >= rect.left && col <= rect.right;
}

export function rectSize(rect: Rect) {
  return (rect.bottom - rect.top + 1) * (rect.right - rect.left + 1);
}
