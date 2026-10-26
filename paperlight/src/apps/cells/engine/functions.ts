import { asMatrix, compare, criteria, flatten, numbers, scalar, toBool, toNumber, toText } from './coerce.ts';
import { dateToSerial, formatValue, nowSerial, serialToDate, todaySerial } from './format.ts';
import type { Node } from './parser.ts';
import { err, ERRORS, isError, isMatrix, type CellError, type CellValue, type Matrix, type Value } from './values.ts';

export interface FnContext {
  row: number;
  col: number;
  nodes: Node[];
}

export type Fn = (args: Value[], ctx: FnContext) => Value;

type NumResult = number | CellError;

function arity(args: Value[], min: number, max = min): CellError | null {
  return args.length < min || args.length > max ? err(ERRORS.value) : null;
}

/** The scalar form of argument `i`, or `fallback` when it was left out. */
function arg(args: Value[], i: number, ctx: FnContext, fallback: CellValue = null): CellValue {
  if (i >= args.length || ctx.nodes[i]?.k === 'missing') return fallback;
  return scalar(args[i], ctx.row, ctx.col);
}

function num(args: Value[], i: number, ctx: FnContext, fallback?: number): NumResult {
  if (fallback !== undefined && (i >= args.length || ctx.nodes[i]?.k === 'missing')) return fallback;
  return toNumber(arg(args, i, ctx));
}

function text(args: Value[], i: number, ctx: FnContext, fallback = ''): string | CellError {
  if (i >= args.length) return fallback;
  return toText(arg(args, i, ctx));
}

/** Runs `fn` on numeric arguments, passing errors through. */
function math(fn: (...values: number[]) => number, count: number, defaults: number[] = []): Fn {
  return (args, ctx) => {
    const bad = arity(args, count - defaults.length, count);
    if (bad) return bad;
    const values: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const n = num(args, i, ctx, i >= count - defaults.length ? defaults[i - (count - defaults.length)] : undefined);
      if (isError(n)) return n;
      values.push(n);
    }
    const result = fn(...values);
    return Number.isFinite(result) ? result : err(ERRORS.num);
  };
}

function aggregate(fn: (values: number[]) => number | CellError): Fn {
  return (args) => {
    const values = numbers(args);
    if (isError(values)) return values;
    return fn(values);
  };
}

function roundTo(value: number, digits: number, mode: 'round' | 'up' | 'down') {
  const factor = 10 ** digits;
  const scaled = value * factor;
  const nudged = Math.abs(scaled - Math.round(scaled)) < 1e-9 ? Math.round(scaled) : scaled;
  let result: number;
  if (mode === 'round') result = Math.sign(nudged) * Math.round(Math.abs(nudged));
  else if (mode === 'up') result = Math.sign(nudged) * Math.ceil(Math.abs(nudged));
  else result = Math.sign(nudged) * Math.floor(Math.abs(nudged));
  return result / factor;
}

function variance(values: number[], sample: boolean): NumResult {
  const n = values.length;
  if (n < (sample ? 2 : 1)) return err(ERRORS.div0);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const squares = values.reduce((total, value) => total + (value - mean) ** 2, 0);
  return squares / (sample ? n - 1 : n);
}

function median(values: number[]): NumResult {
  if (values.length === 0) return err(ERRORS.num);
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Pairs each criteria range with its test, for the *IFS family. */
function conditions(args: Value[], start: number, ctx: FnContext): { ranges: Matrix[]; tests: ((v: CellValue) => boolean)[] } | CellError {
  const ranges: Matrix[] = [];
  const tests: ((v: CellValue) => boolean)[] = [];
  for (let i = start; i < args.length; i += 2) {
    if (i + 1 >= args.length) return err(ERRORS.value);
    ranges.push(asMatrix(args[i]));
    tests.push(criteria(arg(args, i + 1, ctx)));
  }
  return { ranges, tests };
}

/** Values of `target` (or of the first range) at positions where every criterion matches. */
function matching(target: Matrix, ranges: Matrix[], tests: ((v: CellValue) => boolean)[]): CellValue[] | CellError {
  const rows = target.m.length;
  const cols = target.m[0]?.length ?? 0;
  for (const range of ranges) {
    if (range.m.length !== rows || (range.m[0]?.length ?? 0) !== cols) return err(ERRORS.value);
  }
  const out: CellValue[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (ranges.every((range, i) => tests[i](range.m[r][c]))) out.push(target.m[r][c]);
    }
  }
  return out;
}

/** Like `matching`, but the target may be shorter or longer than the criteria range (as SUMIF allows). */
function sized(target: Matrix, like: Matrix): Matrix {
  const rows = like.m.length;
  const cols = like.m[0]?.length ?? 0;
  const m: CellValue[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const row: CellValue[] = [];
    for (let c = 0; c < cols; c += 1) row.push(target.m[r]?.[c] ?? null);
    m.push(row);
  }
  return { m };
}

const onlyNumbers = (values: CellValue[]) => values.filter((value): value is number => typeof value === 'number');

/** Exact-match test for lookups: same type, text ignoring case, with * and ? wildcards. */
function lookupEqual(candidate: CellValue, wanted: CellValue) {
  if (candidate === null || isError(candidate)) return false;
  if (typeof candidate === 'string' && typeof wanted === 'string') {
    return /[*?~]/.test(wanted) ? criteria(wanted)(candidate) : candidate.toLowerCase() === wanted.toLowerCase();
  }
  return candidate === wanted;
}

/** Exact or "largest value not above" position of `value` in a list, as MATCH and VLOOKUP use. */
function findIn(list: CellValue[], value: CellValue, mode: number): number {
  if (mode === 0) return list.findIndex((candidate) => lookupEqual(candidate, value));
  let best = -1;
  for (let i = 0; i < list.length; i += 1) {
    const candidate = list[i];
    if (candidate === null || isError(candidate)) continue;
    const order = compare(candidate, value);
    if (mode > 0 ? order <= 0 : order >= 0) best = i;
    else if (best !== -1) break;
  }
  return best;
}

function dateParts(args: Value[], ctx: FnContext): Date | CellError {
  const n = num(args, 0, ctx);
  if (isError(n)) return n;
  if (n < 0) return err(ERRORS.num);
  return serialToDate(n);
}

function pmt(rate: number, periods: number, pv: number, fv: number, type: number) {
  if (rate === 0) return -(pv + fv) / periods;
  const growth = (1 + rate) ** periods;
  return (-(pv * growth + fv) * rate) / ((1 + rate * type) * (growth - 1));
}

export const FUNCTIONS: Record<string, Fn> = {
  SUM: aggregate((values) => values.reduce((a, b) => a + b, 0)),
  PRODUCT: aggregate((values) => (values.length ? values.reduce((a, b) => a * b, 1) : 0)),
  AVERAGE: aggregate((values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : err(ERRORS.div0))),
  MIN: aggregate((values) => (values.length ? Math.min(...values) : 0)),
  MAX: aggregate((values) => (values.length ? Math.max(...values) : 0)),
  MEDIAN: aggregate(median),
  STDEV: aggregate((values) => {
    const v = variance(values, true);
    return isError(v) ? v : Math.sqrt(v);
  }),
  'STDEV.S': (args, ctx) => FUNCTIONS.STDEV(args, ctx),
  STDEVP: aggregate((values) => {
    const v = variance(values, false);
    return isError(v) ? v : Math.sqrt(v);
  }),
  'STDEV.P': (args, ctx) => FUNCTIONS.STDEVP(args, ctx),
  VAR: aggregate((values) => variance(values, true)),
  'VAR.S': (args, ctx) => FUNCTIONS.VAR(args, ctx),
  VARP: aggregate((values) => variance(values, false)),
  'VAR.P': (args, ctx) => FUNCTIONS.VARP(args, ctx),
  COUNT: (args) => flatten(args).filter((value) => typeof value === 'number').length,
  COUNTA: (args) => flatten(args).filter((value) => value !== null).length,
  COUNTBLANK: (args) => flatten(args).filter((value) => value === null || value === '').length,
  LARGE: (args, ctx) => {
    const values = numbers([args[0] ?? null]);
    const k = num(args, 1, ctx);
    if (isError(values)) return values;
    if (isError(k)) return k;
    const sorted = [...values].sort((a, b) => b - a);
    return k >= 1 && k <= sorted.length ? sorted[Math.ceil(k) - 1] : err(ERRORS.num);
  },
  SMALL: (args, ctx) => {
    const values = numbers([args[0] ?? null]);
    const k = num(args, 1, ctx);
    if (isError(values)) return values;
    if (isError(k)) return k;
    const sorted = [...values].sort((a, b) => a - b);
    return k >= 1 && k <= sorted.length ? sorted[Math.ceil(k) - 1] : err(ERRORS.num);
  },
  SUMPRODUCT: (args) => {
    const matrices = args.map(asMatrix);
    const rows = matrices[0]?.m.length ?? 0;
    const cols = matrices[0]?.m[0]?.length ?? 0;
    if (matrices.some((matrix) => matrix.m.length !== rows || (matrix.m[0]?.length ?? 0) !== cols)) return err(ERRORS.value);
    let total = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        let product = 1;
        for (const matrix of matrices) {
          const value = matrix.m[r][c];
          if (isError(value)) return value;
          product *= typeof value === 'number' ? value : typeof value === 'boolean' && matrices.length === 1 ? Number(value) : 0;
        }
        total += product;
      }
    }
    return total;
  },

  ROUND: math((value, digits) => roundTo(value, Math.trunc(digits), 'round'), 2, [0]),
  ROUNDUP: math((value, digits) => roundTo(value, Math.trunc(digits), 'up'), 2, [0]),
  ROUNDDOWN: math((value, digits) => roundTo(value, Math.trunc(digits), 'down'), 2, [0]),
  INT: math((value) => Math.floor(value), 1),
  TRUNC: math((value, digits) => roundTo(value, Math.trunc(digits), 'down'), 2, [0]),
  ABS: math((value) => Math.abs(value), 1),
  SIGN: math((value) => Math.sign(value), 1),
  MOD: (args, ctx) => {
    const a = num(args, 0, ctx);
    const b = num(args, 1, ctx);
    if (isError(a)) return a;
    if (isError(b)) return b;
    if (b === 0) return err(ERRORS.div0);
    return a - b * Math.floor(a / b);
  },
  POWER: math((base, exponent) => base ** exponent, 2),
  SQRT: math((value) => (value < 0 ? Number.NaN : Math.sqrt(value)), 1),
  EXP: math((value) => Math.exp(value), 1),
  LN: math((value) => (value <= 0 ? Number.NaN : Math.log(value)), 1),
  LOG10: math((value) => (value <= 0 ? Number.NaN : Math.log10(value)), 1),
  LOG: math((value, base) => (value <= 0 || base <= 0 || base === 1 ? Number.NaN : Math.log(value) / Math.log(base)), 2, [10]),
  PI: () => Math.PI,
  CEILING: math((value, step) => (step === 0 ? 0 : Math.ceil(value / step - 1e-12) * step), 2, [1]),
  FLOOR: math((value, step) => (step === 0 ? Number.NaN : Math.floor(value / step + 1e-12) * step), 2, [1]),
  RAND: () => Math.random(),
  RANDBETWEEN: math((low, high) => Math.floor(Math.random() * (Math.floor(high) - Math.ceil(low) + 1)) + Math.ceil(low), 2),

  SUMIF: (args, ctx) => {
    if (args.length < 2 || args.length > 3) return err(ERRORS.value);
    const range = asMatrix(args[0]);
    const target = args.length === 3 ? sized(asMatrix(args[2]), range) : range;
    const values = matching(target, [range], [criteria(arg(args, 1, ctx))]);
    return isError(values) ? values : onlyNumbers(values).reduce((a, b) => a + b, 0);
  },
  SUMIFS: (args, ctx) => {
    const parsed = conditions(args, 1, ctx);
    if (isError(parsed)) return parsed;
    const values = matching(asMatrix(args[0]), parsed.ranges, parsed.tests);
    return isError(values) ? values : onlyNumbers(values).reduce((a, b) => a + b, 0);
  },
  COUNTIF: (args, ctx) => {
    if (args.length !== 2) return err(ERRORS.value);
    const range = asMatrix(args[0]);
    const values = matching(range, [range], [criteria(arg(args, 1, ctx))]);
    return isError(values) ? values : values.length;
  },
  COUNTIFS: (args, ctx) => {
    const parsed = conditions(args, 0, ctx);
    if (isError(parsed) || parsed.ranges.length === 0) return isError(parsed) ? parsed : err(ERRORS.value);
    const values = matching(parsed.ranges[0], parsed.ranges, parsed.tests);
    return isError(values) ? values : values.length;
  },
  AVERAGEIF: (args, ctx) => {
    if (args.length < 2 || args.length > 3) return err(ERRORS.value);
    const range = asMatrix(args[0]);
    const target = args.length === 3 ? sized(asMatrix(args[2]), range) : range;
    const values = matching(target, [range], [criteria(arg(args, 1, ctx))]);
    if (isError(values)) return values;
    const nums = onlyNumbers(values);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : err(ERRORS.div0);
  },
  AVERAGEIFS: (args, ctx) => {
    const parsed = conditions(args, 1, ctx);
    if (isError(parsed)) return parsed;
    const values = matching(asMatrix(args[0]), parsed.ranges, parsed.tests);
    if (isError(values)) return values;
    const nums = onlyNumbers(values);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : err(ERRORS.div0);
  },
  MAXIFS: (args, ctx) => {
    const parsed = conditions(args, 1, ctx);
    if (isError(parsed)) return parsed;
    const values = matching(asMatrix(args[0]), parsed.ranges, parsed.tests);
    if (isError(values)) return values;
    const nums = onlyNumbers(values);
    return nums.length ? Math.max(...nums) : 0;
  },
  MINIFS: (args, ctx) => {
    const parsed = conditions(args, 1, ctx);
    if (isError(parsed)) return parsed;
    const values = matching(asMatrix(args[0]), parsed.ranges, parsed.tests);
    if (isError(values)) return values;
    const nums = onlyNumbers(values);
    return nums.length ? Math.min(...nums) : 0;
  },

  IF: (args, ctx) => {
    const bad = arity(args, 1, 3);
    if (bad) return bad;
    const test = toBool(arg(args, 0, ctx));
    if (isError(test)) return test;
    if (test) return args.length > 1 ? (ctx.nodes[1]?.k === 'missing' ? 0 : args[1]) : true;
    return args.length > 2 ? (ctx.nodes[2]?.k === 'missing' ? 0 : args[2]) : false;
  },
  IFS: (args, ctx) => {
    for (let i = 0; i + 1 < args.length; i += 2) {
      const test = toBool(arg(args, i, ctx));
      if (isError(test)) return test;
      if (test) return args[i + 1];
    }
    return err(ERRORS.na);
  },
  IFERROR: (args, ctx) => {
    const value = arg(args, 0, ctx);
    return isError(value) ? (args[1] ?? '') : args[0];
  },
  IFNA: (args, ctx) => {
    const value = arg(args, 0, ctx);
    return isError(value) && value.error === ERRORS.na ? (args[1] ?? '') : args[0];
  },
  AND: (args) => {
    const values = flatten(args).filter((value) => value !== null);
    let result = true;
    for (const value of values) {
      if (typeof value === 'string') continue;
      const b = toBool(value);
      if (isError(b)) return b;
      result = result && b;
    }
    return values.length ? result : err(ERRORS.value);
  },
  OR: (args) => {
    const values = flatten(args).filter((value) => value !== null);
    let result = false;
    for (const value of values) {
      if (typeof value === 'string') continue;
      const b = toBool(value);
      if (isError(b)) return b;
      result = result || b;
    }
    return values.length ? result : err(ERRORS.value);
  },
  XOR: (args) => {
    let count = 0;
    for (const value of flatten(args)) {
      if (value === null || typeof value === 'string') continue;
      const b = toBool(value);
      if (isError(b)) return b;
      if (b) count += 1;
    }
    return count % 2 === 1;
  },
  NOT: (args, ctx) => {
    const b = toBool(arg(args, 0, ctx));
    return isError(b) ? b : !b;
  },
  TRUE: () => true,
  FALSE: () => false,
  CHOOSE: (args, ctx) => {
    const index = num(args, 0, ctx);
    if (isError(index)) return index;
    const i = Math.trunc(index);
    return i >= 1 && i < args.length ? args[i] : err(ERRORS.value);
  },
  SWITCH: (args, ctx) => {
    const value = arg(args, 0, ctx);
    let i = 1;
    for (; i + 1 < args.length; i += 2) {
      if (compare(value, arg(args, i, ctx)) === 0) return args[i + 1];
    }
    return i < args.length ? args[i] : err(ERRORS.na);
  },

  VLOOKUP: (args, ctx) => {
    const bad = arity(args, 3, 4);
    if (bad) return bad;
    const value = arg(args, 0, ctx);
    const table = asMatrix(args[1]);
    const index = num(args, 2, ctx);
    if (isError(index)) return index;
    const approximate = args.length < 4 ? true : toBool(arg(args, 3, ctx));
    if (isError(approximate)) return approximate;
    const width = table.m[0]?.length ?? 0;
    if (index < 1 || index > width) return err(ERRORS.ref);
    const row = findIn(table.m.map((r) => r[0]), value, approximate ? 1 : 0);
    return row === -1 ? err(ERRORS.na) : table.m[row][Math.trunc(index) - 1];
  },
  HLOOKUP: (args, ctx) => {
    const bad = arity(args, 3, 4);
    if (bad) return bad;
    const value = arg(args, 0, ctx);
    const table = asMatrix(args[1]);
    const index = num(args, 2, ctx);
    if (isError(index)) return index;
    const approximate = args.length < 4 ? true : toBool(arg(args, 3, ctx));
    if (isError(approximate)) return approximate;
    if (index < 1 || index > table.m.length) return err(ERRORS.ref);
    const col = findIn(table.m[0] ?? [], value, approximate ? 1 : 0);
    return col === -1 ? err(ERRORS.na) : table.m[Math.trunc(index) - 1][col];
  },
  XLOOKUP: (args, ctx) => {
    const bad = arity(args, 3, 4);
    if (bad) return bad;
    const value = arg(args, 0, ctx);
    const look = asMatrix(args[1]);
    const result = asMatrix(args[2]);
    const vertical = look.m.length > 1 || (look.m[0]?.length ?? 0) === 1;
    const list = vertical ? look.m.map((r) => r[0]) : (look.m[0] ?? []);
    const at = findIn(list, value, 0);
    if (at === -1) return args.length > 3 ? args[3] : err(ERRORS.na);
    if (vertical) return result.m.length === 1 && result.m[0].length > 1 ? err(ERRORS.value) : { m: [result.m[at] ?? [null]] };
    return { m: result.m.map((r) => [r[at] ?? null]) };
  },
  MATCH: (args, ctx) => {
    const bad = arity(args, 2, 3);
    if (bad) return bad;
    const value = arg(args, 0, ctx);
    const range = asMatrix(args[1]);
    const mode = num(args, 2, ctx, 1);
    if (isError(mode)) return mode;
    const list = range.m.length === 1 ? range.m[0] : range.m.map((r) => r[0]);
    const at = findIn(list, value, Math.sign(mode));
    return at === -1 ? err(ERRORS.na) : at + 1;
  },
  INDEX: (args, ctx) => {
    const bad = arity(args, 2, 3);
    if (bad) return bad;
    const range = asMatrix(args[0]);
    let row = num(args, 1, ctx, 0);
    let col = num(args, 2, ctx, 0);
    if (isError(row)) return row;
    if (isError(col)) return col;
    if (range.m.length === 1 && args.length === 2) {
      col = row;
      row = 1;
    }
    if (row === 0 && col > 0) return { m: range.m.map((r) => [r[col - 1] ?? null]) };
    if (col === 0 && row > 0) return range.m[0].length === 1 ? (range.m[row - 1]?.[0] ?? err(ERRORS.ref)) : { m: [range.m[row - 1] ?? []] };
    const value = range.m[row - 1]?.[col - 1];
    return value === undefined ? err(ERRORS.ref) : value;
  },
  ROW: (_args, ctx) => {
    const node = ctx.nodes[0];
    if (!node) return ctx.row + 1;
    if (node.k === 'ref') return node.row + 1;
    if (node.k === 'range') return node.top + 1;
    return err(ERRORS.value);
  },
  COLUMN: (_args, ctx) => {
    const node = ctx.nodes[0];
    if (!node) return ctx.col + 1;
    if (node.k === 'ref') return node.col + 1;
    if (node.k === 'range') return node.left + 1;
    return err(ERRORS.value);
  },
  ROWS: (args) => (isMatrix(args[0]) ? args[0].m.length : 1),
  COLUMNS: (args) => (isMatrix(args[0]) ? (args[0].m[0]?.length ?? 0) : 1),

  CONCAT: (args) => {
    let out = '';
    for (const value of flatten(args)) {
      const t = toText(value);
      if (isError(t)) return t;
      out += t;
    }
    return out;
  },
  CONCATENATE: (args, ctx) => FUNCTIONS.CONCAT(args.map((_, i) => arg(args, i, ctx)), ctx),
  TEXTJOIN: (args, ctx) => {
    const delimiter = text(args, 0, ctx);
    if (isError(delimiter)) return delimiter;
    const skipEmpty = toBool(arg(args, 1, ctx, true));
    if (isError(skipEmpty)) return skipEmpty;
    const parts: string[] = [];
    for (const value of flatten(args.slice(2))) {
      const t = toText(value);
      if (isError(t)) return t;
      if (skipEmpty && t === '') continue;
      parts.push(t);
    }
    return parts.join(delimiter);
  },
  LEN: (args, ctx) => {
    const t = text(args, 0, ctx);
    return isError(t) ? t : t.length;
  },
  LEFT: (args, ctx) => {
    const t = text(args, 0, ctx);
    const n = num(args, 1, ctx, 1);
    if (isError(t)) return t;
    if (isError(n)) return n;
    return n < 0 ? err(ERRORS.value) : t.slice(0, Math.trunc(n));
  },
  RIGHT: (args, ctx) => {
    const t = text(args, 0, ctx);
    const n = num(args, 1, ctx, 1);
    if (isError(t)) return t;
    if (isError(n)) return n;
    return n < 0 ? err(ERRORS.value) : Math.trunc(n) === 0 ? '' : t.slice(-Math.trunc(n));
  },
  MID: (args, ctx) => {
    const t = text(args, 0, ctx);
    const start = num(args, 1, ctx);
    const n = num(args, 2, ctx);
    if (isError(t)) return t;
    if (isError(start)) return start;
    if (isError(n)) return n;
    if (start < 1 || n < 0) return err(ERRORS.value);
    return t.slice(Math.trunc(start) - 1, Math.trunc(start) - 1 + Math.trunc(n));
  },
  UPPER: (args, ctx) => {
    const t = text(args, 0, ctx);
    return isError(t) ? t : t.toUpperCase();
  },
  LOWER: (args, ctx) => {
    const t = text(args, 0, ctx);
    return isError(t) ? t : t.toLowerCase();
  },
  PROPER: (args, ctx) => {
    const t = text(args, 0, ctx);
    return isError(t) ? t : t.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
  },
  TRIM: (args, ctx) => {
    const t = text(args, 0, ctx);
    return isError(t) ? t : t.trim().replace(/ {2,}/g, ' ');
  },
  SUBSTITUTE: (args, ctx) => {
    const t = text(args, 0, ctx);
    const from = text(args, 1, ctx);
    const to = text(args, 2, ctx);
    if (isError(t)) return t;
    if (isError(from)) return from;
    if (isError(to)) return to;
    if (from === '') return t;
    if (args.length > 3) {
      const which = num(args, 3, ctx);
      if (isError(which)) return which;
      let seen = 0;
      return t.split(from).reduce((out, part, i) => (i === 0 ? part : out + (++seen === which ? to : from) + part), '');
    }
    return t.split(from).join(to);
  },
  REPLACE: (args, ctx) => {
    const t = text(args, 0, ctx);
    const start = num(args, 1, ctx);
    const n = num(args, 2, ctx);
    const insert = text(args, 3, ctx);
    if (isError(t)) return t;
    if (isError(start)) return start;
    if (isError(n)) return n;
    if (isError(insert)) return insert;
    return t.slice(0, start - 1) + insert + t.slice(start - 1 + n);
  },
  FIND: (args, ctx) => {
    const needle = text(args, 0, ctx);
    const hay = text(args, 1, ctx);
    const start = num(args, 2, ctx, 1);
    if (isError(needle)) return needle;
    if (isError(hay)) return hay;
    if (isError(start)) return start;
    const at = hay.indexOf(needle, start - 1);
    return at === -1 ? err(ERRORS.value) : at + 1;
  },
  SEARCH: (args, ctx) => {
    const needle = text(args, 0, ctx);
    const hay = text(args, 1, ctx);
    const start = num(args, 2, ctx, 1);
    if (isError(needle)) return needle;
    if (isError(hay)) return hay;
    if (isError(start)) return start;
    const test = criteria(`${needle}*`);
    for (let i = start - 1; i < hay.length; i += 1) if (test(hay.slice(i))) return i + 1;
    return err(ERRORS.value);
  },
  TEXT: (args, ctx) => {
    const value = arg(args, 0, ctx);
    const code = text(args, 1, ctx);
    if (isError(code)) return code;
    if (isError(value)) return value;
    const n = typeof value === 'string' ? toNumber(value) : value;
    return formatValue(isError(n) ? value : n, code);
  },
  VALUE: (args, ctx) => toNumber(arg(args, 0, ctx)),
  REPT: (args, ctx) => {
    const t = text(args, 0, ctx);
    const n = num(args, 1, ctx);
    if (isError(t)) return t;
    if (isError(n)) return n;
    return n < 0 ? err(ERRORS.value) : t.repeat(Math.trunc(n));
  },
  EXACT: (args, ctx) => {
    const a = text(args, 0, ctx);
    const b = text(args, 1, ctx);
    if (isError(a)) return a;
    if (isError(b)) return b;
    return a === b;
  },
  CHAR: (args, ctx) => {
    const code = num(args, 0, ctx);
    if (isError(code)) return code;
    return code >= 1 && code <= 65535 ? String.fromCharCode(Math.trunc(code)) : err(ERRORS.value);
  },

  ISBLANK: (args, ctx) => arg(args, 0, ctx) === null,
  ISNUMBER: (args, ctx) => typeof arg(args, 0, ctx) === 'number',
  ISTEXT: (args, ctx) => typeof arg(args, 0, ctx) === 'string',
  ISLOGICAL: (args, ctx) => typeof arg(args, 0, ctx) === 'boolean',
  ISERROR: (args, ctx) => isError(arg(args, 0, ctx)),
  ISERR: (args, ctx) => {
    const value = arg(args, 0, ctx);
    return isError(value) && value.error !== ERRORS.na;
  },
  ISNA: (args, ctx) => {
    const value = arg(args, 0, ctx);
    return isError(value) && value.error === ERRORS.na;
  },
  ISEVEN: (args, ctx) => {
    const n = num(args, 0, ctx);
    return isError(n) ? n : Math.trunc(n) % 2 === 0;
  },
  ISODD: (args, ctx) => {
    const n = num(args, 0, ctx);
    return isError(n) ? n : Math.abs(Math.trunc(n)) % 2 === 1;
  },
  NA: () => err(ERRORS.na),

  TODAY: () => todaySerial(),
  NOW: () => nowSerial(),
  DATE: (args, ctx) => {
    const y = num(args, 0, ctx);
    const m = num(args, 1, ctx);
    const d = num(args, 2, ctx);
    if (isError(y)) return y;
    if (isError(m)) return m;
    if (isError(d)) return d;
    const year = y < 1900 ? y + 1900 : y;
    return dateToSerial(new Date(Date.UTC(Math.trunc(year), Math.trunc(m) - 1, Math.trunc(d))));
  },
  YEAR: (args, ctx) => {
    const date = dateParts(args, ctx);
    return isError(date) ? date : date.getUTCFullYear();
  },
  MONTH: (args, ctx) => {
    const date = dateParts(args, ctx);
    return isError(date) ? date : date.getUTCMonth() + 1;
  },
  DAY: (args, ctx) => {
    const date = dateParts(args, ctx);
    return isError(date) ? date : date.getUTCDate();
  },
  HOUR: (args, ctx) => {
    const date = dateParts(args, ctx);
    return isError(date) ? date : date.getUTCHours();
  },
  MINUTE: (args, ctx) => {
    const date = dateParts(args, ctx);
    return isError(date) ? date : date.getUTCMinutes();
  },
  WEEKDAY: (args, ctx) => {
    const date = dateParts(args, ctx);
    const type = num(args, 1, ctx, 1);
    if (isError(date)) return date;
    if (isError(type)) return type;
    const day = date.getUTCDay();
    if (type === 2) return day === 0 ? 7 : day;
    if (type === 3) return day === 0 ? 6 : day - 1;
    return day + 1;
  },
  EDATE: (args, ctx) => {
    const date = dateParts(args, ctx);
    const months = num(args, 1, ctx);
    if (isError(date)) return date;
    if (isError(months)) return months;
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Math.trunc(months), 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), last));
    return dateToSerial(target);
  },
  EOMONTH: (args, ctx) => {
    const date = dateParts(args, ctx);
    const months = num(args, 1, ctx);
    if (isError(date)) return date;
    if (isError(months)) return months;
    return dateToSerial(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Math.trunc(months) + 1, 0)));
  },
  DAYS: (args, ctx) => {
    const end = num(args, 0, ctx);
    const start = num(args, 1, ctx);
    if (isError(end)) return end;
    if (isError(start)) return start;
    return Math.trunc(end) - Math.trunc(start);
  },

  PMT: (args, ctx) => {
    const values = [0, 1, 2, 3, 4].map((i) => num(args, i, ctx, i > 2 ? 0 : undefined));
    const bad = values.find(isError);
    if (bad) return bad;
    const [rate, periods, pv, fv, type] = values as number[];
    if (periods === 0) return err(ERRORS.num);
    return pmt(rate, periods, pv, fv, type);
  },
  FV: (args, ctx) => {
    const values = [0, 1, 2, 3, 4].map((i) => num(args, i, ctx, i > 2 ? 0 : undefined));
    const bad = values.find(isError);
    if (bad) return bad;
    const [rate, periods, payment, pv, type] = values as number[];
    if (rate === 0) return -(pv + payment * periods);
    const growth = (1 + rate) ** periods;
    return -(pv * growth + (payment * (1 + rate * type) * (growth - 1)) / rate);
  },
  PV: (args, ctx) => {
    const values = [0, 1, 2, 3, 4].map((i) => num(args, i, ctx, i > 2 ? 0 : undefined));
    const bad = values.find(isError);
    if (bad) return bad;
    const [rate, periods, payment, fv, type] = values as number[];
    if (rate === 0) return -(fv + payment * periods);
    const growth = (1 + rate) ** periods;
    return -(fv + (payment * (1 + rate * type) * (growth - 1)) / rate) / growth;
  },
};
