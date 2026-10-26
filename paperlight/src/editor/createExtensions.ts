import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { filterBlocks, type BlockItem } from './blocks';
import { FindReplace } from './extensions/find';
import { FocusMode } from './extensions/focusMode';
import { SlashCommand } from './extensions/slash';

interface EditorSetup {
  blocks: BlockItem[];
  placeholder: string;
  focusMode?: boolean;
}

/** The editing kit shared by Prose and Jotbook. */
export function createExtensions({ blocks, placeholder, focusMode = false }: EditorSetup) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      dropcursor: { color: 'var(--accent)', width: 2 },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true } }),
    Image.configure({ allowBase64: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'heading' ? `Heading ${node.attrs.level as number}` : placeholder),
    }),
    CharacterCount,
    FindReplace,
    SlashCommand.configure({ items: (query: string) => filterBlocks(blocks, query) }),
    ...(focusMode ? [FocusMode] : []),
  ];
}
