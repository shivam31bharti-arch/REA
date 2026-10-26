import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState } from '@tiptap/react';
import { Bold, Code, Highlighter, Italic, Link2, RemoveFormatting, Strikethrough, Underline } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BubbleToolbarProps {
  editor: Editor;
  onEditLink: () => void;
}

function keep(event: React.MouseEvent) {
  event.preventDefault();
}

export function BubbleToolbar({ editor, onEditLink }: BubbleToolbarProps) {
  // The scrolling canvas bounds the toolbar, so it never rides over the command bar.
  const [canvas, setCanvas] = useState<Element | null>(null);
  useEffect(() => setCanvas(editor.view.dom.closest('.pl-canvas')), [editor]);

  const marks = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      highlight: current.isActive('highlight'),
      code: current.isActive('code'),
      link: current.isActive('link'),
    }),
  });

  if (!canvas) return null;

  const buttons = [
    { id: 'bold', label: 'Bold', icon: Bold, active: marks.bold, run: () => editor.chain().focus().toggleBold().run() },
    { id: 'italic', label: 'Italic', icon: Italic, active: marks.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { id: 'underline', label: 'Underline', icon: Underline, active: marks.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { id: 'strike', label: 'Strikethrough', icon: Strikethrough, active: marks.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { id: 'highlight', label: 'Highlight', icon: Highlighter, active: marks.highlight, run: () => editor.chain().focus().toggleHighlight().run() },
    { id: 'code', label: 'Inline code', icon: Code, active: marks.code, run: () => editor.chain().focus().toggleCode().run() },
    { id: 'link', label: marks.link ? 'Edit link' : 'Add link', icon: Link2, active: marks.link, run: onEditLink },
  ];

  return (
    <BubbleMenu
      editor={editor}
      className="pl-bubble"
      options={{
        placement: 'top',
        offset: 10,
        flip: { boundary: canvas, padding: 8 },
        shift: { boundary: canvas, padding: 8 },
        hide: { boundary: canvas },
      }}
      shouldShow={({ editor: current, state, view }) => {
        if (state.selection.empty || !current.isEditable || !view.hasFocus()) return false;
        if (state.selection instanceof NodeSelection) return false;
        return !current.isActive('codeBlock');
      }}
    >
      <div role="toolbar" aria-label="Selected text" className="pl-bubble-row">
        {buttons.map(({ id, label, icon: Icon, active, run }) => (
          <button
            key={id}
            type="button"
            className="pl-bubble-btn"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onMouseDown={keep}
            onClick={run}
          >
            <Icon aria-hidden="true" />
          </button>
        ))}
        <span className="pl-bubble-gap" aria-hidden="true" />
        <button
          type="button"
          className="pl-bubble-btn"
          aria-label="Clear formatting"
          title="Clear formatting"
          onMouseDown={keep}
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
        >
          <RemoveFormatting aria-hidden="true" />
        </button>
      </div>
    </BubbleMenu>
  );
}
