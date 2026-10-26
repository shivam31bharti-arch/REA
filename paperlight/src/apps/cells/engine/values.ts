export type Scalar = number | string | boolean | null;

export interface CellError {
  error: string;
}

export type CellValue = Scalar | CellError;

/** A block of values from a range argument, row by row, with where it came from when it was a range. */
export interface Matrix {
  m: CellValue[][];
  top?: number;
  left?: number;
}

export type Value = CellValue | Matrix;

export const ERRORS = {
  div0: '#DIV/0!',
  na: '#N/A',
  name: '#NAME?',
  ref: '#REF!',
  value: '#VALUE!',
  num: '#NUM!',
  circ: '#CIRC!',
} as const;

const errorCache = new Map<string, CellError>();

export function err(code: string): CellError {
  let hit = errorCache.get(code);
  if (!hit) {
    hit = { error: code };
    errorCache.set(code, hit);
  }
  return hit;
}

export function isError(value: unknown): value is CellError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export function isMatrix(value: unknown): value is Matrix {
  return typeof value === 'object' && value !== null && 'm' in value;
}
