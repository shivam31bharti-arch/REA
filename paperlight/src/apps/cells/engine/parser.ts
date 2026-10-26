import { colIndex, colName, MAX_COLS, MAX_ROWS } from './address.ts';

/** One side of a reference. A null row means a whole column; a null column means a whole row. */
export interface RefPart {
  row: number | null;
  col: number | null;
  absRow: boolean;
  absCol: boolean;
}

export type Token =
  | { type: 'num'; text: string; value: number }
  | { type: 'str'; text: string; value: string }
  | { type: 'bool'; text: string; value: boolean }
  | { type: 'err'; text: string }
  | { type: 'ref'; text: string; sheet: string | null; start: RefPart; end: RefPart | null }
  | { type: 'fn'; text: string; name: string }
  | { type: 'name'; text: string }
  | { type: 'op'; text: string }
  | { type: 'lparen'; text: string }
  | { type: 'rparen'; text: string }
  | { type: 'comma'; text: string }
  | { type: 'ws'; text: string }
  | { type: 'bad'; text: string };

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'err'; v: string }
  | { k: 'missing' }
  | { k: 'ref'; sheet: string | null; row: number; col: number }
  | { k: 'range'; sheet: string | null; top: number; left: number; bottom: number; right: number }
  | { k: 'fn'; name: string; args: Node[] }
  | { k: 'neg'; a: Node }
  | { k: 'pct'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'name'; v: string };

export class FormulaError extends Error {}

const ERROR_LITERAL = /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|CIRC!)/i;
const CELL_PART = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)/;
const COL_PART = /^(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_])/;
const ROW_PART = /^(\$?)(\d+)/;
const WORD = /^[A-Za-z_][A-Za-z0-9_.]*/;
const OPERATORS = ['<=', '>=', '<>', '+', '-', '*', '/', '^', '&', '=', '<', '>', '%'];

function cellPart(text: string): { part: RefPart; length: number } | null {
  const match = CELL_PART.exec(text);
  if (!match) return null;
  const row = Number(match[4]) - 1;
  const col = colIndex(match[2]);
  if (row < 0 || row >= MAX_ROWS || col >= MAX_COLS) return null;
  return { part: { row, col, absCol: match[1] === '$', absRow: match[3] === '$' }, length: match[0].length };
}

/** Reads a reference (A1, A1:B2, A:C or 3:5) at the start of `text`. */
function readRef(text: string): { start: RefPart; end: RefPart | null; length: number } | null {
  const first = cellPart(text);
  if (first) {
    let length = first.length;
    let end: RefPart | null = null;
    if (text[length] === ':') {
      const second = cellPart(text.slice(length + 1));
      if (second) {
        end = second.part;
        length += 1 + second.length;
      }
    }
    if (/^[A-Za-z0-9_.(]/.test(text.slice(length))) return null;
    return { start: first.part, end, length };
  }
  const colA = COL_PART.exec(text);
  if (colA && text[colA[0].length] === ':') {
    const colB = COL_PART.exec(text.slice(colA[0].length + 1));
    if (colB) {
      const length = colA[0].length + 1 + colB[0].length;
      return {
        start: { row: null, col: colIndex(colA[2]), absCol: colA[1] === '$', absRow: false },
        end: { row: null, col: colIndex(colB[2]), absCol: colB[1] === '$', absRow: false },
        length,
      };
    }
  }
  const rowA = ROW_PART.exec(text);
  if (rowA && text[rowA[0].length] === ':') {
    const rowB = ROW_PART.exec(text.slice(rowA[0].length + 1));
    if (rowB && !/^[A-Za-z0-9_.(]/.test(text.slice(rowA[0].length + 1 + rowB[0].length))) {
      return {
        start: { row: Number(rowA[2]) - 1, col: null, absCol: false, absRow: rowA[1] === '$' },
        end: { row: Number(rowB[2]) - 1, col: null, absCol: false, absRow: rowB[1] === '$' },
        length: rowA[0].length + 1 + rowB[0].length,
      };
    }
  }
  return null;
}

/** Splits a formula (without its leading "=") into tokens that join back to the exact input. */
export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < formula.length) {
    const rest = formula.slice(i);
    const ch = formula[i];

    if (/\s/.test(ch)) {
      const text = /^\s+/.exec(rest)![0];
      tokens.push({ type: 'ws', text });
      i += text.length;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < formula.length) {
        if (formula[j] === '"') {
          if (formula[j + 1] === '"') {
            value += '"';
            j += 2;
            continue;
          }
          break;
        }
        value += formula[j];
        j += 1;
      }
      const text = formula.slice(i, Math.min(j + 1, formula.length));
      tokens.push({ type: 'str', text, value });
      i += text.length;
      continue;
    }

    if (ch === '#') {
      const match = ERROR_LITERAL.exec(rest);
      if (match) {
        tokens.push({ type: 'err', text: match[0].toUpperCase() });
        i += match[0].length;
        continue;
      }
    }

    // Sheet-qualified references: 'My sheet'!A1 or Sheet2!A1:B4.
    let sheet: string | null = null;
    let prefix = 0;
    const quoted = /^'((?:[^']|'')+)'!/.exec(rest);
    const bare = /^([A-Za-z_][A-Za-z0-9_.]*)!/.exec(rest);
    if (quoted) {
      sheet = quoted[1].replace(/''/g, "'");
      prefix = quoted[0].length;
    } else if (bare) {
      sheet = bare[1];
      prefix = bare[0].length;
    }
    if (sheet !== null) {
      const ref = readRef(rest.slice(prefix));
      if (ref) {
        tokens.push({ type: 'ref', text: rest.slice(0, prefix + ref.length), sheet, start: ref.start, end: ref.end });
        i += prefix + ref.length;
        continue;
      }
    }

    if (/[A-Za-z_$\d]/.test(ch)) {
      const word = WORD.exec(rest);
      if (word && formula[i + word[0].length] === '(') {
        tokens.push({ type: 'fn', text: word[0], name: word[0].toUpperCase() });
        i += word[0].length;
        continue;
      }
      const ref = readRef(rest);
      if (ref) {
        tokens.push({ type: 'ref', text: rest.slice(0, ref.length), sheet: null, start: ref.start, end: ref.end });
        i += ref.length;
        continue;
      }
      if (word) {
        const upper = word[0].toUpperCase();
        if (upper === 'TRUE' || upper === 'FALSE') tokens.push({ type: 'bool', text: word[0], value: upper === 'TRUE' });
        else tokens.push({ type: 'name', text: word[0] });
        i += word[0].length;
        continue;
      }
    }

    const number = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest);
    if (number) {
      tokens.push({ type: 'num', text: number[0], value: Number(number[0]) });
      i += number[0].length;
      continue;
    }

    const op = OPERATORS.find((candidate) => rest.startsWith(candidate));
    if (op) {
      tokens.push({ type: 'op', text: op });
      i += op.length;
      continue;
    }
    if (ch === '(') tokens.push({ type: 'lparen', text: ch });
    else if (ch === ')') tokens.push({ type: 'rparen', text: ch });
    else if (ch === ',' || ch === ';') tokens.push({ type: 'comma', text: ch });
    else tokens.push({ type: 'bad', text: ch });
    i += 1;
  }
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter((token) => token.type !== 'ws');
  }

  parse(): Node {
    if (this.tokens.length === 0) throw new FormulaError('The formula is empty.');
    const node = this.comparison();
    if (this.pos < this.tokens.length) throw new FormulaError(`Unexpected “${this.tokens[this.pos].text}”.`);
    return node;
  }

  private peek() {
    return this.tokens[this.pos];
  }

  private isOp(...ops: string[]) {
    const token = this.peek();
    return token?.type === 'op' && ops.includes(token.text);
  }

  private comparison(): Node {
    let node = this.concat();
    while (this.isOp('=', '<>', '<', '>', '<=', '>=')) {
      const op = this.tokens[this.pos++].text;
      node = { k: 'bin', op, a: node, b: this.concat() };
    }
    return node;
  }

  private concat(): Node {
    let node = this.additive();
    while (this.isOp('&')) {
      this.pos += 1;
      node = { k: 'bin', op: '&', a: node, b: this.additive() };
    }
    return node;
  }

  private additive(): Node {
    let node = this.multiplicative();
    while (this.isOp('+', '-')) {
      const op = this.tokens[this.pos++].text;
      node = { k: 'bin', op, a: node, b: this.multiplicative() };
    }
    return node;
  }

  private multiplicative(): Node {
    let node = this.power();
    while (this.isOp('*', '/')) {
      const op = this.tokens[this.pos++].text;
      node = { k: 'bin', op, a: node, b: this.power() };
    }
    return node;
  }

  private power(): Node {
    let node = this.percent();
    while (this.isOp('^')) {
      this.pos += 1;
      node = { k: 'bin', op: '^', a: node, b: this.percent() };
    }
    return node;
  }

  private percent(): Node {
    let node = this.unary();
    while (this.isOp('%')) {
      this.pos += 1;
      node = { k: 'pct', a: node };
    }
    return node;
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.pos += 1;
      return { k: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.pos += 1;
      return this.unary();
    }
    return this.primary();
  }

  private primary(): Node {
    const token = this.peek();
    if (!token) throw new FormulaError('The formula ends too early.');
    this.pos += 1;
    switch (token.type) {
      case 'num':
        return { k: 'num', v: token.value };
      case 'str':
        return { k: 'str', v: token.value };
      case 'bool':
        return { k: 'bool', v: token.value };
      case 'err':
        return { k: 'err', v: token.text };
      case 'name':
        return { k: 'name', v: token.text };
      case 'ref':
        return refNode(token.sheet, token.start, token.end);
      case 'fn':
        return this.call(token.name);
      case 'lparen': {
        const inner = this.comparison();
        if (this.peek()?.type !== 'rparen') throw new FormulaError('A bracket is missing.');
        this.pos += 1;
        return inner;
      }
      default:
        throw new FormulaError(`Unexpected “${token.text}”.`);
    }
  }

  private call(name: string): Node {
    this.pos += 1; // the "(" that follows every function name
    const args: Node[] = [];
    if (this.peek()?.type === 'rparen') {
      this.pos += 1;
      return { k: 'fn', name, args };
    }
    for (;;) {
      const next = this.peek();
      if (next?.type === 'comma' || next?.type === 'rparen') args.push({ k: 'missing' });
      else args.push(this.comparison());
      const sep = this.peek();
      if (sep?.type === 'comma') {
        this.pos += 1;
        continue;
      }
      if (sep?.type === 'rparen') {
        this.pos += 1;
        return { k: 'fn', name, args };
      }
      throw new FormulaError(`${name} is missing its closing bracket.`);
    }
  }
}

function refNode(sheet: string | null, start: RefPart, end: RefPart | null): Node {
  if (!end && start.row !== null && start.col !== null) return { k: 'ref', sheet, row: start.row, col: start.col };
  const second = end ?? start;
  const top = Math.min(start.row ?? 0, second.row ?? 0);
  const bottom = start.row === null || second.row === null ? MAX_ROWS - 1 : Math.max(start.row, second.row);
  const left = Math.min(start.col ?? 0, second.col ?? 0);
  const right = start.col === null || second.col === null ? MAX_COLS - 1 : Math.max(start.col, second.col);
  return { k: 'range', sheet, top, left, bottom, right };
}

const cache = new Map<string, Node | FormulaError>();

export function parseFormula(formula: string): Node {
  let hit = cache.get(formula);
  if (!hit) {
    try {
      hit = new Parser(tokenize(formula)).parse();
    } catch (error) {
      hit = error instanceof FormulaError ? error : new FormulaError(String(error));
    }
    if (cache.size > 5000) cache.clear();
    cache.set(formula, hit);
  }
  if (hit instanceof FormulaError) throw hit;
  return hit;
}

export function quoteSheet(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) && !CELL_PART.test(name) ? name : `'${name.replace(/'/g, "''")}'`;
}

function partText(part: RefPart) {
  const col = part.col === null ? '' : `${part.absCol ? '$' : ''}${colName(part.col)}`;
  const row = part.row === null ? '' : `${part.absRow ? '$' : ''}${part.row + 1}`;
  return col + row;
}

export function refText(sheet: string | null, start: RefPart, end: RefPart | null) {
  return `${sheet === null ? '' : `${quoteSheet(sheet)}!`}${partText(start)}${end ? `:${partText(end)}` : ''}`;
}

function rewrite(formula: string, map: (token: Extract<Token, { type: 'ref' }>) => string) {
  return tokenize(formula)
    .map((token) => (token.type === 'ref' ? map(token) : token.text))
    .join('');
}

/** Moves relative references by an offset, as when a formula is copied, filled or sorted. */
export function translateFormula(formula: string, dRow: number, dCol: number) {
  if (dRow === 0 && dCol === 0) return formula;
  return rewrite(formula, (token) => {
    const move = (part: RefPart): RefPart | null => {
      const row = part.row === null || part.absRow ? part.row : part.row + dRow;
      const col = part.col === null || part.absCol ? part.col : part.col + dCol;
      if ((row !== null && (row < 0 || row >= MAX_ROWS)) || (col !== null && (col < 0 || col >= MAX_COLS))) return null;
      return { ...part, row, col };
    };
    const start = move(token.start);
    const end = token.end ? move(token.end) : null;
    if (!start || (token.end && !end)) return '#REF!';
    return refText(token.sheet, start, end);
  });
}

export interface StructureChange {
  /** The sheet whose rows or columns change. */
  sheet: string;
  axis: 'row' | 'col';
  at: number;
  /** Positive inserts, negative deletes. */
  count: number;
}

/** Keeps references pointing at the same cells after rows or columns are inserted or deleted. */
export function adjustFormula(formula: string, ownSheet: string, change: StructureChange) {
  const { axis, at, count } = change;
  const deleted = count < 0 ? { from: at, to: at - count - 1 } : null;
  return rewrite(formula, (token) => {
    const target = token.sheet ?? ownSheet;
    if (target.toLowerCase() !== change.sheet.toLowerCase()) return token.text;
    const get = (part: RefPart) => (axis === 'row' ? part.row : part.col);
    const set = (part: RefPart, value: number): RefPart => (axis === 'row' ? { ...part, row: value } : { ...part, col: value });
    const start = get(token.start);
    if (start === null) return token.text;
    const end = token.end ? get(token.end) : null;

    if (!deleted) {
      const shift = (value: number) => (value >= at ? value + count : value);
      const nextStart = set(token.start, shift(start));
      const nextEnd = token.end && end !== null ? set(token.end, shift(end)) : token.end;
      return refText(token.sheet, nextStart, nextEnd);
    }

    const removed = deleted.to - deleted.from + 1;
    if (end === null || !token.end) {
      if (start >= deleted.from && start <= deleted.to) return '#REF!';
      return refText(token.sheet, set(token.start, start > deleted.to ? start - removed : start), null);
    }
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    if (low >= deleted.from && high <= deleted.to) return '#REF!';
    const newLow = low > deleted.to ? low - removed : low >= deleted.from ? deleted.from : low;
    const newHigh = high > deleted.to ? high - removed : high >= deleted.from ? deleted.from - 1 : high;
    return refText(token.sheet, set(token.start, newLow), set(token.end, newHigh));
  });
}

/** Upper-cases function names, references and TRUE/FALSE, the way a spreadsheet tidies what was typed. */
export function normalizeFormula(formula: string) {
  return tokenize(formula)
    .map((token) => {
      if (token.type === 'fn') return token.name.replace(/^_XL(FN|WS)\./, '');
      if (token.type === 'ref') return refText(token.sheet, token.start, token.end);
      if (token.type === 'bool') return token.value ? 'TRUE' : 'FALSE';
      return token.text;
    })
    .join('');
}

/** Function names newer than the original file format carry a prefix inside .xlsx files. */
export function prefixFutureFunctions(formula: string, names: Set<string>) {
  return tokenize(formula)
    .map((token) => (token.type === 'fn' && names.has(token.name) ? `_xlfn.${token.name}` : token.text))
    .join('');
}

export function renameSheetInFormula(formula: string, from: string, to: string) {
  return rewrite(formula, (token) =>
    token.sheet !== null && token.sheet.toLowerCase() === from.toLowerCase() ? refText(to, token.start, token.end) : token.text,
  );
}

export function breakSheetInFormula(formula: string, name: string) {
  return rewrite(formula, (token) => (token.sheet !== null && token.sheet.toLowerCase() === name.toLowerCase() ? '#REF!' : token.text));
}
