import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Bold, ChevronDown, Italic, Link2, ListTodo, Pencil, Plus, Search, Trash2, Underline } from 'lucide-react';
import type { BlockItem } from '../../editor/blocks';
import { Menu, type MenuEntry } from '../../ui/Menu';
import type { Notebook, Section } from './store';

export type SaveStamp = { kind: 'saved'; at: Date | null } | { kind: 'saving' };

interface JotBarProps {
  editor: Editor | null;
  notebooks: Notebook[];
  notebook: Notebook;
  sections: Section[];
  section: Section;
  pageCounts: Map<string, number>;
  blocks: BlockItem[];
  stamp: SaveStamp;
  onSelectNotebook: (id: string) => void;
  onSelectSection: (id: string) => void;
  onNewNotebook: () => void;
  onRenameNotebook: () => void;
  onDeleteNotebook: () => void;
  onNewSection: () => void;
  onRenameSection: () => void;
  onDeleteSection: () => void;
  onNewPage: () => void;
  onSearch: () => void;
  onInsertLink: () => void;
}

function keep(event: React.MouseEvent) {
  event.preventDefault();
}

function time(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function JotBar(props: JotBarProps) {
  const { editor } = props;
  const marks = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      underline: current?.isActive('underline') ?? false,
      task: current?.isActive('taskList') ?? false,
    }),
  }) ?? { bold: false, italic: false, underline: false, task: false };

  const notebookItems: MenuEntry[] = [
    ...props.notebooks.map((notebook) => ({
      id: notebook.id,
      label: notebook.name,
      active: notebook.id === props.notebook.id,
      onSelect: () => props.onSelectNotebook(notebook.id),
    })),
    { separator: true, id: 'nb-sep' },
    { id: 'nb-new', label: 'New notebook…', icon: <Plus />, onSelect: props.onNewNotebook },
    { id: 'nb-rename', label: 'Rename notebook…', icon: <Pencil />, onSelect: props.onRenameNotebook },
    { separator: true, id: 'nb-sep-2' },
    { id: 'nb-delete', label: 'Delete notebook…', icon: <Trash2 />, danger: true, onSelect: props.onDeleteNotebook },
  ];

  const sectionItems: MenuEntry[] = [
    ...props.sections.map((section) => {
      const count = props.pageCounts.get(section.id) ?? 0;
      return {
        id: section.id,
        label: section.name,
        description: `${count} ${count === 1 ? 'page' : 'pages'}`,
        active: section.id === props.section.id,
        onSelect: () => props.onSelectSection(section.id),
      };
    }),
    { separator: true, id: 'sec-sep' },
    { id: 'sec-new', label: 'New section…', icon: <Plus />, shortcut: 'Ctrl Shift N', onSelect: props.onNewSection },
    { id: 'sec-rename', label: 'Rename section…', icon: <Pencil />, onSelect: props.onRenameSection },
    { separator: true, id: 'sec-sep-2' },
    { id: 'sec-delete', label: 'Delete section…', icon: <Trash2 />, danger: true, onSelect: props.onDeleteSection },
  ];

  const insertItems: MenuEntry[] = [
    ...props.blocks
      .filter((block) => ['table', 'image', 'bullets', 'numbers', 'checklist', 'quote', 'code', 'divider', 'h2'].includes(block.id))
      .map((block) => {
        const Icon = block.icon;
        return {
          id: block.id,
          label: block.title,
          description: block.description,
          icon: <Icon />,
          onSelect: () => editor && block.run(editor),
        };
      }),
    { id: 'link', label: 'Link', description: 'To a web page', icon: <Link2 />, onSelect: props.onInsertLink },
  ];

  const toggle = (label: string, active: boolean, icon: React.ReactNode, run: () => void, shortcut?: string) => (
    <button
      type="button"
      className="pl-btn pl-btn--icon"
      aria-pressed={active}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={!editor}
      onMouseDown={keep}
      onClick={run}
    >
      {icon}
    </button>
  );

  return (
    <header className="pl-cmdbar pl-drag">
      <div className="pl-crumb">
        <span className="pl-crumb-app">Jotbook</span>
        <span className="pl-crumb-slash" aria-hidden="true">
          /
        </span>
        <Menu label={`Notebook: ${props.notebook.name}`} items={notebookItems} className="pl-btn pl-picker" width={260} title="Switch notebook">
          <span className="pl-picker-name">{props.notebook.name}</span>
          <ChevronDown aria-hidden="true" />
        </Menu>
        <span className="pl-crumb-slash" aria-hidden="true">
          /
        </span>
        <Menu label={`Section: ${props.section.name}`} items={sectionItems} className="pl-btn pl-picker" width={260} title="Switch section">
          <span className="pl-picker-name">{props.section.name}</span>
          <ChevronDown aria-hidden="true" />
        </Menu>
      </div>

      <div className="pl-cmdbar-tools" role="toolbar" aria-label="Formatting">
        <span className="pl-sep" aria-hidden="true" />
        {toggle('Bold', marks.bold, <Bold />, () => editor?.chain().focus().toggleBold().run(), 'Ctrl B')}
        {toggle('Italic', marks.italic, <Italic />, () => editor?.chain().focus().toggleItalic().run(), 'Ctrl I')}
        {toggle('Underline', marks.underline, <Underline />, () => editor?.chain().focus().toggleUnderline().run(), 'Ctrl U')}
        {toggle('Checklist', marks.task, <ListTodo />, () => editor?.chain().focus().toggleTaskList().run())}
        <Menu label="Insert" items={insertItems} className="pl-btn pl-insert-btn" width={280} title="Insert">
          <Plus aria-hidden="true" />
          <span className="pl-btn-label">Insert</span>
        </Menu>
      </div>

      <div className="pl-cmdbar-end">
        <button type="button" className="pl-search-pill" onClick={props.onSearch} aria-label="Search notes">
          <Search aria-hidden="true" />
          <span className="pl-search-label">Search notes</span>
          <kbd>Ctrl F</kbd>
        </button>
        <span className="pl-stamp" data-kind={props.stamp.kind === 'saved' ? 'saved' : 'saving'} role="status" aria-live="polite">
          {props.stamp.kind === 'saving' ? 'Saving…' : props.stamp.at ? `Saved ${time(props.stamp.at)}` : 'Saved'}
        </span>
        <button type="button" className="pl-btn pl-btn--primary" onClick={props.onNewPage} title="New page (Ctrl N)">
          <Plus aria-hidden="true" />
          New page
        </button>
      </div>
    </header>
  );
}
