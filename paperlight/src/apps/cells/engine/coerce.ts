import { formatGeneral, parseInput } from './format.ts';
import { err, ERRORS, isError, isMatrix, type CellError, type CellValue, type Matrix, type Value } from './values.ts';

/** A range used where one value is expected: one cell, or the cell in the formula's own row or column. */
export function scalar(value: Value, row = -1, col = -1): CellValue {
  if (!isMatrix(value)) return value;
  const { m } = value;
  if (m.length === 0) return null;
  if (m.length === 1 && m[0].length === 1) return m[0][0];
  const top = value.top ?? 0;
  const left = value.left ?? 0;
  if (m[0].length === 1 && row >= top && row < top + m.length) return m[row - top][0];
  if (m.length === 1 && col >= left && col < left + m[0].length) return m[0][col - left];
  return err(ERRORS.value);
}

export function toNumber(value: CellValue): number | CellError {
  if (typeof value === 'number') return value;
  if (value === null) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isError(value)) return value;
  const parsed = parseInput(value).value;
  return typeof parsed === 'number' ? parsed : err(ERRORS.value);
}

export function toText(value: CellValue): string | CellError {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (isError(value)) return value;
  return formatGeneral(value);
}

export function toBool(value: CellValue): boolean | CellError {
  if (typeof value === 'boolean') return value;
  if (value === null) return false;
  if (typeof value === 'number') return value !== 0;
  if (isError(value)) return value;
  const upper = value.trim().toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  return err(ERRORS.value);
}

/** Every value in the arguments, ranges flattened row by row. */
export function flatten(args: Value[]): CellValue[] {
  const out: CellValue[] = [];
  for (const arg of args) {
    if (isMatrix(arg)) for (const row of arg.m) out.push(...row);
    else out.push(arg);
  }
  return out;
}

/**
 * Numbers for SUM-style functions. Inside ranges only real numbers count; values typed
 * straight into the function are converted, and errors always win.
 */
export function numbers(args: Value[]): number[] | CellError {
  const out: number[] = [];
  for (const arg of args) {
    if (isMatrix(arg)) {
      for (const row of arg.m) {
        for (const value of row) {
          if (typeof value === 'number') out.push(value);
          else if (isError(value)) return value;
        }
      }
    } else if (arg !== null) {
      if (isError(arg)) return arg;
      if (typeof arg === 'string') {
        const parsed = parseInput(arg).value;
        if (typeof parsed === 'number') out.push(parsed);
        continue;
      }
      const n = toNumber(arg);
      if (isError(n)) return n;
      out.push(n);
    }
  }
  return out;
}

export function asMatrix(value: Value): Matrix {
  return isMatrix(value) ? value : { m: [[value]] };
}

const TYPE_RANK = { number: 0, string: 1, boolean: 2 } as const;

/** Spreadsheet ordering: numbers, then text (ignoring case), then TRUE/FALSE; blanks act as 0, "" or FALSE. */
export function compare(a: CellValue, b: CellValue): number {
  if (a === null && b === null) return 0;
  if (a === null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b === null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  if (isError(a) || isError(b)) return 0;
  const ta = TYPE_RANK[typeof a as 'number' | 'string' | 'boolean'];
  const tb = TYPE_RANK[typeof b as 'number' | 'string' | 'boolean'];
  if (ta !== tb) return ta - tb;
  if (typeof a === 'string') {
    const x = a.toLowerCase();
    const y = (b as string).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return Number(a) - Number(b);
}

function wildcard(pattern: string) {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '~' && i + 1 < pattern.length) {
      source += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i += 1;
    } else if (ch === '*') source += '.*';
    else if (ch === '?') source += '.';
    else source += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'i');
}

/** Builds the test for SUMIF/COUNTIF criteria such as ">5", "<>done", "a*" or a plain value. */
export function criteria(value: CellValue): (candidate: CellValue) => boolean {
  if (typeof value === 'number') return (candidate) => toComparable(candidate) === value;
  if (typeof value === 'boolean') return (candidate) => candidate === value;
  if (value === null) return (candidate) => candidate === null || candidate === '';
  if (isError(value)) return (candidate) => isError(candidate) && candidate.error === value.error;
  const match = /^(<=|>=|<>|=|<|>)?([\s\S]*)$/.exec(value)!;
  const op = match[1] ?? '=';
  const rhsText = match[2];
  const parsed = rhsText === '' ? null : parseInput(rhsText).value;
  if (typeof parsed === 'number') {
    return (candidate) => {
      const n = toComparable(candidate);
      if (typeof n !== 'number') return op === '<>';
      switch (op) {
        case '<':
          return n < parsed;
        case '<=':
          return n <= parsed;
        case '>':
          return n > parsed;
        case '>=':
          return n >= parsed;
        case '<>':
          return n !== parsed;
        default:
          return n === parsed;
      }
    };
  }
  if (rhsText === '') {
    if (op === '<>') return (candidate) => candidate !== null && candidate !== '';
    return (candidate) => candidate === null || candidate === '';
  }
  if (op === '=' || op === '<>') {
    const test = wildcard(rhsText);
    return (candidate) => {
      const text = candidate === null || isError(candidate) ? '' : String(toText(candidate));
      const hit = test.test(text);
      return op === '=' ? hit : !hit;
    };
  }
  return (candidate) => {
    if (typeof candidate !== 'string') return false;
    const order = compare(candidate, rhsText);
    return op === '<' ? order < 0 : op === '<=' ? order <= 0 : op === '>' ? order > 0 : order >= 0;
  };
}

function toComparable(value: CellValue) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInput(value).value;
    return typeof parsed === 'number' ? parsed : value;
  }
  return value;
}
