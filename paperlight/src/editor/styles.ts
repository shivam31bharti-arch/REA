import type { Editor } from '@tiptap/core';
import type { CSSProperties } from 'react';

export type StyleId = 'p' | 'h1' | 'h2' | 'h3' | 'quote' | 'code';

export interface ParagraphStyle {
  id: StyleId;
  label: string;
  /** Shown at the size the style really has on the page. */
  preview: CSSProperties;
  apply: (editor: Editor) => void;
}

export const PARAGRAPH_STYLES: ParagraphStyle[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    preview: { fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 },
    apply: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    preview: { fontSize: 26, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.15 },
    apply: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    preview: { fontSize: 19, fontWeight: 650, lineHeight: 1.25 },
    apply: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: 'p',
    label: 'Body text',
    preview: { fontSize: 16.5, fontWeight: 400 },
    apply: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: 'quote',
    label: 'Quote',
    preview: { fontSize: 18, fontStyle: 'italic' },
    apply: (editor) => editor.chain().focus().setParagraph().toggleBlockquote().run(),
  },
  {
    id: 'code',
    label: 'Code',
    preview: { fontSize: 14, fontFamily: 'var(--font-mono)' },
    apply: (editor) => editor.chain().focus().setCodeBlock().run(),
  },
];

export function currentStyle(editor: Editor): StyleId {
  if (editor.isActive('codeBlock')) return 'code';
  if (editor.isActive('heading', { level: 1 })) return 'h1';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('blockquote')) return 'quote';
  return 'p';
}
