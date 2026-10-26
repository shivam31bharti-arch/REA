import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface FindMatch {
  from: number;
  to: number;
}

export interface FindState {
  query: string;
  caseSensitive: boolean;
  matches: FindMatch[];
  index: number;
}

type FindMeta = Partial<Pick<FindState, 'query' | 'caseSensitive' | 'index'>>;

export const findPluginKey = new PluginKey<FindState>('paperlightFind');

const EMPTY: FindState = { query: '', caseSensitive: false, matches: [], index: -1 };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    find: {
      setFindQuery: (query: string, caseSensitive: boolean) => ReturnType;
      /** Moves to the next (1) or previous (-1) match; 0 reselects the current one. */
      findStep: (direction: 1 | -1 | 0) => ReturnType;
      replaceCurrentMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
      clearFind: () => ReturnType;
    };
  }
}

/** Searches each text block as one string, so matches may span bold or linked runs. */
function findMatches(doc: ProseMirrorNode, query: string, caseSensitive: boolean): FindMatch[] {
  if (!query) return [];
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: FindMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const positions: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i += 1) positions.push(pos + 1 + offset + i);
        text += child.text;
      } else {
        positions.push(pos + 1 + offset);
        text += '￼';
      }
    });
    const haystack = caseSensitive ? text : text.toLowerCase();
    if (haystack.length !== text.length) return false;
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      matches.push({ from: positions[at], to: positions[at + needle.length - 1] + 1 });
      at = haystack.indexOf(needle, at + needle.length);
    }
    return false;
  });
  return matches;
}

function firstAtOrAfter(matches: FindMatch[], pos: number) {
  const index = matches.findIndex((match) => match.from >= pos);
  return index === -1 ? 0 : index;
}

export const FindReplace = Extension.create({
  name: 'findReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findPluginKey,
        state: {
          init: () => EMPTY,
          apply(tr, value, _oldState, newState) {
            const meta = tr.getMeta(findPluginKey) as FindMeta | undefined;
            const queryChanged = meta && (meta.query !== undefined || meta.caseSensitive !== undefined);
            if (!meta && !(tr.docChanged && value.query)) return value;

            const query = meta?.query ?? value.query;
            const caseSensitive = meta?.caseSensitive ?? value.caseSensitive;
            const matches =
              queryChanged || tr.docChanged ? findMatches(newState.doc, query, caseSensitive) : value.matches;
            let index = queryChanged ? firstAtOrAfter(matches, newState.selection.from) : (meta?.index ?? value.index);
            index = matches.length ? Math.min(Math.max(index, 0), matches.length - 1) : -1;
            return { query, caseSensitive, matches, index };
          },
        },
        props: {
          decorations(state) {
            const find = findPluginKey.getState(state);
            if (!find || find.matches.length === 0) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              find.matches.map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class: index === find.index ? 'pl-find-hit is-current' : 'pl-find-hit',
                }),
              ),
            );
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setFindQuery:
        (query, caseSensitive) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(findPluginKey, { query, caseSensitive } satisfies FindMeta);
          return true;
        },
      findStep:
        (direction) =>
        ({ state, tr, dispatch }) => {
          const find = findPluginKey.getState(state);
          if (!find || find.matches.length === 0) return false;
          const count = find.matches.length;
          const base = find.index < 0 ? (direction === -1 ? 0 : -1) : find.index;
          const index = direction === 0 ? Math.max(find.index, 0) : (base + direction + count) % count;
          const match = find.matches[index];
          if (dispatch) {
            tr.setMeta(findPluginKey, { index } satisfies FindMeta);
            tr.setSelection(TextSelection.create(tr.doc, match.from, match.to));
            tr.scrollIntoView();
          }
          return true;
        },
      replaceCurrentMatch:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const find = findPluginKey.getState(state);
          const match = find && find.index >= 0 ? find.matches[find.index] : undefined;
          if (!find || !match) return false;
          if (dispatch) {
            tr.insertText(replacement, match.from, match.to);
            tr.setMeta(findPluginKey, { index: find.index } satisfies FindMeta);
          }
          return true;
        },
      replaceAllMatches:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const find = findPluginKey.getState(state);
          if (!find || find.matches.length === 0) return false;
          if (dispatch) {
            for (const match of [...find.matches].reverse()) tr.insertText(replacement, match.from, match.to);
          }
          return true;
        },
      clearFind:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(findPluginKey, { query: '', index: -1 } satisfies FindMeta);
          return true;
        },
    };
  },
});
