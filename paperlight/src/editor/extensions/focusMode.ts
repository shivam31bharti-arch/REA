import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const focusModeKey = new PluginKey<boolean>('paperlightFocusMode');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    focusMode: {
      setFocusMode: (enabled: boolean) => ReturnType;
    };
  }
}

/** Marks the top-level block holding the cursor, whether or not the editor has keyboard focus. */
export const FocusMode = Extension.create({
  name: 'focusMode',

  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key: focusModeKey,
        state: {
          init: () => false,
          apply: (tr, enabled) => {
            const meta: unknown = tr.getMeta(focusModeKey);
            return typeof meta === 'boolean' ? meta : enabled;
          },
        },
        props: {
          decorations(state) {
            if (!focusModeKey.getState(state)) return DecorationSet.empty;
            const { $from } = state.selection;
            const start = $from.depth > 0 ? $from.before(1) : state.selection.from;
            const node = state.doc.nodeAt(start);
            if (!node) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [Decoration.node(start, start + node.nodeSize, { class: 'is-current' })]);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setFocusMode:
        (enabled) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(focusModeKey, enabled);
          return true;
        },
    };
  },
});
