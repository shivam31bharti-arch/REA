import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import { Suggestion, exitSuggestion } from '@tiptap/suggestion';
import type { ComponentProps } from 'react';
import type { BlockItem } from '../blocks';
import { SlashMenu, type SlashMenuHandle } from '../SlashMenu';

type SlashRenderer = ReactRenderer<SlashMenuHandle, ComponentProps<typeof SlashMenu>>;

const slashPluginKey = new PluginKey('paperlightSlash');

export interface SlashOptions {
  items: (query: string) => BlockItem[];
}

export const SlashCommand = Extension.create<SlashOptions>({
  name: 'slashCommand',

  addOptions() {
    return { items: () => [] };
  },

  addProseMirrorPlugins() {
    const getItems = this.options.items;
    return [
      Suggestion<BlockItem, BlockItem>({
        pluginKey: slashPluginKey,
        editor: this.editor,
        char: '/',
        allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
        items: ({ query }) => getItems(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: SlashRenderer | null = null;
          let unmount: (() => void) | null = null;
          return {
            onStart: (props) => {
              const created: SlashRenderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
              renderer = created;
              unmount = props.mount(created.element);
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: ({ event, view }) => {
              if (event.key === 'Escape') {
                exitSuggestion(view, slashPluginKey);
                return true;
              }
              return renderer?.ref?.onKeyDown(event) ?? false;
            },
            onExit: () => {
              unmount?.();
              renderer?.destroy();
              renderer = null;
              unmount = null;
            },
          };
        },
      }),
    ];
  },
});
