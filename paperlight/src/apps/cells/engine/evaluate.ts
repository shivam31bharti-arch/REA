import { compare, scalar, toNumber, toText } from './coerce.ts';
import { FUNCTIONS } from './functions.ts';
import { parseFormula, type Node } from './parser.ts';
import { err, ERRORS, isError, isMatrix, type CellValue, type Matrix, type Scalar, type Value } from './values.ts';

export interface CalcCell {
  v?: Scalar;
  f?: string;
  /** The result another program stored with the formula, used when Cells can't compute it. */
  cached?: Scalar;
}

export interface CalcSource {
  sheetIndex(name: string): number;
  cell(sheet: number, row: number, col: number): CalcCell | undefined;
  /** One past the last used row and column. */
  extent(sheet: number): { rows: number; cols: number };
  /** Formula cells in reading order, so long chains compute top-down without deep recursion. */
  formulaCells(sheet: number): [number, number][];
}

const LARGE_RANGE = 250_000;

/** Element-by-element arithmetic over ranges, the way array formulas work. */
function lift(a: Value, b: Value, op: (x: CellValue, y: CellValue) => CellValue): Value {
  if (!isMatrix(a) && !isMatrix(b)) return op(a, b);
  const ma = isMatrix(a) ? a.m : null;
  const mb = isMatrix(b) ? b.m : null;
  const rows = Math.max(ma?.length ?? 1, mb?.length ?? 1);
  const cols = Math.max(ma?.[0]?.length ?? 1, mb?.[0]?.length ?? 1);
  const pick = (m: CellValue[][] | null, value: Value, r: number, c: number): CellValue => {
    if (!m) return value as CellValue;
    const row = m.length === 1 ? m[0] : m[r];
    if (!row) return err(ERRORS.na);
    const cell = row.length === 1 ? row[0] : row[c];
    return cell === undefined ? err(ERRORS.na) : cell;
  };
  const out: CellValue[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const row: CellValue[] = [];
    for (let c = 0; c < cols; c += 1) row.push(op(pick(ma, a, r, c), pick(mb, b, r, c)));
    out.push(row);
  }
  return { m: out };
}

function arithmetic(op: string, x: CellValue, y: CellValue): CellValue {
  const a = toNumber(x);
  if (isError(a)) return a;
  const b = toNumber(y);
  if (isError(b)) return b;
  let result: number;
  switch (op) {
    case '+':
      result = a + b;
      break;
    case '-':
      result = a - b;
      break;
    case '*':
      result = a * b;
      break;
    case '/':
      if (b === 0) return err(ERRORS.div0);
      result = a / b;
      break;
    default:
      if (a === 0 && b < 0) return err(ERRORS.div0);
      result = a ** b;
  }
  if (!Number.isFinite(result)) return err(ERRORS.num);
  // Trim binary noise such as 0.1 + 0.2 = 0.30000000000000004.
  return Math.abs(result) < 1e15 ? Number(result.toPrecision(15)) : result;
}

function comparison(op: string, x: CellValue, y: CellValue): CellValue {
  if (isError(x)) return x;
  if (isError(y)) return y;
  const order = compare(x, y);
  switch (op) {
    case '=':
      return order === 0;
    case '<>':
      return order !== 0;
    case '<':
      return order < 0;
    case '>':
      return order > 0;
    case '<=':
      return order <= 0;
    default:
      return order >= 0;
  }
}

interface Context {
  sheet: number;
  row: number;
  col: number;
}

/**
 * Computes cell values for one version of a workbook. Make a new one after every edit;
 * results are cached for the lifetime of the instance.
 */
export class Calc {
  readonly source: CalcSource;
  private cache = new Map<string, CellValue>();
  private visiting = new Set<string>();
  private warmed = new Set<number>();
  private depth = 0;

  constructor(source: CalcSource) {
    this.source = source;
  }

  value(sheet: number, row: number, col: number): CellValue {
    const cell = this.source.cell(sheet, row, col);
    if (!cell) return null;
    if (cell.f === undefined) return cell.v ?? null;
    if (!this.warmed.has(sheet) && this.depth === 0) this.warm(sheet);
    const key = `${sheet}:${row},${col}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    if (this.visiting.has(key)) return err(ERRORS.circ);

    this.visiting.add(key);
    this.depth += 1;
    let result: CellValue;
    try {
      result = this.compute(cell.f, { sheet, row, col });
    } catch (error) {
      result = error instanceof RangeError ? err(ERRORS.circ) : err(ERRORS.value);
    } finally {
      this.depth -= 1;
      this.visiting.delete(key);
    }
    if (isError(result) && result.error === ERRORS.name && cell.cached !== undefined) result = cell.cached;
    this.cache.set(key, result);
    return result;
  }

  /** Evaluates a formula as if it were in the given cell, without storing anything. */
  evaluate(formula: string, sheet: number, row: number, col: number): CellValue {
    try {
      return this.compute(formula, { sheet, row, col });
    } catch {
      return err(ERRORS.value);
    }
  }

  private warm(sheet: number) {
    this.warmed.add(sheet);
    for (const [row, col] of this.source.formulaCells(sheet)) this.value(sheet, row, col);
  }

  private compute(formula: string, ctx: Context): CellValue {
    let node: Node;
    try {
      node = parseFormula(formula);
    } catch {
      return err(ERRORS.name);
    }
    const result = scalar(this.node(node, ctx), ctx.row, ctx.col);
    return result === null ? 0 : result;
  }

  private sheetOf(name: string | null, ctx: Context) {
    return name === null ? ctx.sheet : this.source.sheetIndex(name);
  }

  private node(node: Node, ctx: Context): Value {
    switch (node.k) {
      case 'num':
      case 'str':
      case 'bool':
        return node.v;
      case 'err':
        return err(node.v);
      case 'missing':
        return null;
      case 'name':
        return err(ERRORS.name);
      case 'ref': {
        const sheet = this.sheetOf(node.sheet, ctx);
        return sheet < 0 ? err(ERRORS.ref) : this.value(sheet, node.row, node.col);
      }
      case 'range':
        return this.range(node, ctx);
      case 'neg': {
        return lift(this.node(node.a, ctx), null, (x) => {
          const n = toNumber(x);
          return isError(n) ? n : n === 0 ? 0 : -n;
        });
      }
      case 'pct':
        return lift(this.node(node.a, ctx), null, (x) => {
          const n = toNumber(x);
          return isError(n) ? n : n / 100;
        });
      case 'bin': {
        const a = this.node(node.a, ctx);
        const b = this.node(node.b, ctx);
        if (node.op === '&') {
          return lift(a, b, (x, y) => {
            const left = toText(x);
            if (isError(left)) return left;
            const right = toText(y);
            return isError(right) ? right : left + right;
          });
        }
        if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) return lift(a, b, (x, y) => comparison(node.op, x, y));
        return lift(a, b, (x, y) => arithmetic(node.op, x, y));
      }
      case 'fn': {
        const fn = FUNCTIONS[node.name] ?? FUNCTIONS[node.name.replace(/^_XLFN\./, '')];
        if (!fn) return err(ERRORS.name);
        const args = node.args.map((child) => this.node(child, ctx));
        return fn(args, { row: ctx.row, col: ctx.col, nodes: node.args });
      }
    }
  }

  private range(node: Extract<Node, { k: 'range' }>, ctx: Context): Value {
    const sheet = this.sheetOf(node.sheet, ctx);
    if (sheet < 0) return err(ERRORS.ref);
    let { bottom, right } = node;
    const size = (bottom - node.top + 1) * (right - node.left + 1);
    if (size > LARGE_RANGE) {
      const extent = this.source.extent(sheet);
      bottom = Math.min(bottom, Math.max(node.top, extent.rows - 1));
      right = Math.min(right, Math.max(node.left, extent.cols - 1));
    }
    const m: CellValue[][] = [];
    for (let r = node.top; r <= bottom; r += 1) {
      const row: CellValue[] = [];
      for (let c = node.left; c <= right; c += 1) row.push(this.value(sheet, r, c));
      m.push(row);
    }
    return { m, top: node.top, left: node.left } satisfies Matrix;
  }
}
