import { FUNCTION_CATALOG, type FunctionInfo } from './engine/catalog';
import { tokenize } from './engine/parser';

export interface SuggestState {
  items: FunctionInfo[];
  /** The part of the formula the chosen name replaces. */
  start: number;
  end: number;
  /** The function the caret is inside, for its argument hint. */
  hint: FunctionInfo | null;
}

const EMPTY: SuggestState = { items: [], start: 0, end: 0, hint: null };
const byName = new Map(FUNCTION_CATALOG.map((info) => [info.name, info]));

export function suggestFor(value: string, caret: number): SuggestState {
  if (!value.startsWith('=')) return EMPTY;
  const before = value.slice(0, caret);
  let items: FunctionInfo[] = [];
  let start = caret;
  const word = /([A-Za-z][A-Za-z0-9.]*)$/.exec(before);
  if (word) {
    const lead = before.slice(0, before.length - word[1].length);
    const after = value.slice(caret);
    const typedRef = /^[A-Za-z]{1,3}\d+$/.test(word[1]);
    if (/[=(,;+\-*/^&<>\s]$/.test(lead) && !after.startsWith('(') && !typedRef) {
      const prefix = word[1].toUpperCase();
      items = FUNCTION_CATALOG.filter((info) => info.name.startsWith(prefix) && info.name !== prefix).slice(0, 6);
      const exact = byName.get(prefix);
      if (exact) items = [exact, ...items].slice(0, 6);
      start = caret - word[1].length;
    }
  }

  const stack: string[] = [];
  for (const token of tokenize(before.slice(1))) {
    if (token.type === 'fn') stack.push(token.name);
    else if (token.type === 'lparen') stack.push('');
    else if (token.type === 'rparen') {
      stack.pop();
      if (stack.length && stack[stack.length - 1] !== '') stack.pop();
    }
  }
  // A function name is pushed, then its "(" — the open call is the name just under the top "(".
  let hint: FunctionInfo | null = null;
  for (let i = stack.length - 1; i >= 1; i -= 1) {
    if (stack[i] === '' && stack[i - 1] !== '') {
      hint = byName.get(stack[i - 1]) ?? null;
      break;
    }
  }
  return { items, start, end: caret, hint };
}

export function acceptSuggestion(value: string, state: SuggestState, item: FunctionInfo) {
  const next = `${value.slice(0, state.start)}${item.name}(${value.slice(state.end)}`;
  return { value: next, caret: state.start + item.name.length + 1 };
}

interface SuggestListProps {
  state: SuggestState;
  active: number;
  onPick: (item: FunctionInfo) => void;
}

export function SuggestList({ state, active, onPick }: SuggestListProps) {
  if (state.items.length > 0) {
    return (
      <div className="pl-suggest" role="listbox" aria-label="Functions">
        {state.items.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="option"
            aria-selected={index === active}
            className="pl-suggest-item"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(item)}
          >
            <span className="pl-suggest-name">{item.name}</span>
            <span className="pl-suggest-desc">{item.description}</span>
          </button>
        ))}
        <p className="pl-suggest-foot">Tab to insert</p>
      </div>
    );
  }
  if (state.hint) {
    return (
      <div className="pl-suggest pl-suggest--hint" role="note">
        <span className="pl-suggest-sig">
          {state.hint.name}({state.hint.args})
        </span>
        <span className="pl-suggest-desc">{state.hint.description}</span>
      </div>
    );
  }
  return null;
}
