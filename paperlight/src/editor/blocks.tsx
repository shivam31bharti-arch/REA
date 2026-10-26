import type { ChainedCommands, Editor, Range } from '@tiptap/core';
import {
  CodeXml,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Quote,
  Table,
  type LucideIcon,
} from 'lucide-react';

export interface BlockItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  keywords: string;
  run: (editor: Editor, range?: Range) => void;
}

function chainFrom(editor: Editor, range?: Range) {
  const chain = editor.chain().focus();
  return range ? chain.deleteRange(range) : chain;
}

function block(apply: (chain: ChainedCommands) => ChainedCommands) {
  return (editor: Editor, range?: Range) => {
    apply(chainFrom(editor, range)).run();
  };
}

/** The blocks offered by the "/" menu and the Insert menu. */
export function buildBlocks(actions: { insertImage: () => void }): BlockItem[] {
  return [
    { id: 'text', title: 'Text', description: 'A plain paragraph', icon: Pilcrow, keywords: 'paragraph body normal', run: block((c) => c.setParagraph()) },
    { id: 'h1', title: 'Heading 1', description: 'Document title', icon: Heading1, keywords: 'title h1 large', run: block((c) => c.setHeading({ level: 1 })) },
    { id: 'h2', title: 'Heading 2', description: 'Section heading', icon: Heading2, keywords: 'section h2', run: block((c) => c.setHeading({ level: 2 })) },
    { id: 'h3', title: 'Heading 3', description: 'Sub-section heading', icon: Heading3, keywords: 'subsection h3 small', run: block((c) => c.setHeading({ level: 3 })) },
    { id: 'bullets', title: 'Bulleted list', description: 'A simple list', icon: List, keywords: 'unordered ul points', run: block((c) => c.toggleBulletList()) },
    { id: 'numbers', title: 'Numbered list', description: 'Steps in order', icon: ListOrdered, keywords: 'ordered ol steps', run: block((c) => c.toggleOrderedList()) },
    { id: 'checklist', title: 'Checklist', description: 'Tasks you can tick off', icon: ListTodo, keywords: 'todo tasks checkbox', run: block((c) => c.toggleTaskList()) },
    { id: 'quote', title: 'Quote', description: 'Set a passage apart', icon: Quote, keywords: 'blockquote citation', run: block((c) => c.toggleBlockquote()) },
    { id: 'code', title: 'Code block', description: 'Monospaced text', icon: CodeXml, keywords: 'pre snippet mono', run: block((c) => c.toggleCodeBlock()) },
    { id: 'table', title: 'Table', description: 'Three by three, with a header row', icon: Table, keywords: 'grid rows columns', run: block((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })) },
    {
      id: 'image',
      title: 'Image',
      description: 'A picture from this computer',
      icon: ImageIcon,
      keywords: 'picture photo png jpg',
      run: (editor, range) => {
        chainFrom(editor, range).run();
        actions.insertImage();
      },
    },
    { id: 'divider', title: 'Divider', description: 'A horizontal rule', icon: Minus, keywords: 'hr line separator rule', run: block((c) => c.setHorizontalRule()) },
  ];
}

export function filterBlocks(items: BlockItem[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => `${item.title} ${item.keywords}`.toLowerCase().includes(needle));
}
