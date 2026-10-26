import type { Editor } from '@tiptap/core';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  FileDown,
  FilePlus2,
  FolderOpen,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Plus,
  Save,
  Search,
  Underline,
} from 'lucide-react';
import { Menu, type MenuEntry } from '../../ui/Menu';
import type { BlockItem } from '../../editor/blocks';
import { PARAGRAPH_STYLES, type StyleId } from '../../editor/styles';

export type Alignment = 'left' | 'center' | 'right' | 'justify';

export type Stamp =
  | { kind: 'new' }
  | { kind: 'unsaved' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date | null }
  | { kind: 'exported'; at: Date; unsaved: boolean }
  | { kind: 'error' };

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bullet: boolean;
  ordered: boolean;
  task: boolean;
  style: StyleId;
  align: Alignment;
}

interface CommandBarProps {
  editor: Editor;
  format: FormatState;
  title: string;
  onTitleChange: (title: string) => void;
  stamp: Stamp;
  blocks: BlockItem[];
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf: () => void;
  onOpen: () => void;
  onNew: () => void;
  onInsertLink: () => void;
  onOpenPalette: () => void;
}

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify } as const;

function time(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function stampLabel(stamp: Stamp) {
  switch (stamp.kind) {
    case 'new':
      return 'Not saved';
    case 'unsaved':
      return 'Unsaved';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return stamp.at ? `Saved ${time(stamp.at)}` : 'Saved';
    case 'exported':
      return stamp.unsaved ? `PDF ${time(stamp.at)} · Unsaved` : `Exported ${time(stamp.at)}`;
    case 'error':
      return 'Save failed';
  }
}

function stampKind(stamp: Stamp) {
  return stamp.kind === 'exported' && stamp.unsaved ? 'unsaved' : stamp.kind;
}

function keep(event: React.MouseEvent) {
  event.preventDefault();
}

export function CommandBar(props: CommandBarProps) {
  const { editor, format } = props;
  const currentStyle = PARAGRAPH_STYLES.find((style) => style.id === format.style) ?? PARAGRAPH_STYLES[3];
  const AlignIcon = ALIGN_ICONS[format.align];

  const alignItems: MenuEntry[] = (Object.keys(ALIGN_ICONS) as Alignment[]).map((align) => {
    const Icon = ALIGN_ICONS[align];
    return {
      id: `align-${align}`,
      label: `Align ${align === 'justify' ? 'justified' : align}`,
      icon: <Icon />,
      active: format.align === align,
      onSelect: () => editor.chain().focus().setTextAlign(align).run(),
    };
  });

  // Alignment also lives in the paragraph menu, so it survives when the bar sheds its own button.
  const styleItems: MenuEntry[] = [
    ...PARAGRAPH_STYLES.map((style) => ({
      id: style.id,
      label: style.label,
      labelStyle: style.preview,
      active: style.id === format.style,
      onSelect: () => style.apply(editor),
    })),
    { separator: true, id: 'align-sep' },
    ...alignItems,
  ];

  const insertIds = ['table', 'image', 'bullets', 'numbers', 'checklist', 'quote', 'code', 'divider'];
  const insertItems: MenuEntry[] = [
    ...props.blocks
      .filter((block) => insertIds.includes(block.id))
      .map((block) => {
        const Icon = block.icon;
        return { id: block.id, label: block.title, description: block.description, icon: <Icon />, onSelect: () => block.run(editor) };
      }),
    { id: 'link', label: 'Link', description: 'To a web page', icon: <Link2 />, onSelect: props.onInsertLink },
  ];

  const fileItems: MenuEntry[] = [
    { id: 'save-as', label: 'Save as…', icon: <Save />, shortcut: 'Ctrl Shift S', onSelect: props.onSaveAs },
    { id: 'pdf', label: 'Export PDF', icon: <FileDown />, shortcut: 'Ctrl P', onSelect: props.onExportPdf },
    { separator: true, id: 'sep' },
    { id: 'open', label: 'Open…', icon: <FolderOpen />, shortcut: 'Ctrl O', onSelect: props.onOpen },
    { id: 'new', label: 'New document', icon: <FilePlus2 />, shortcut: 'Ctrl N', onSelect: props.onNew },
  ];

  const toggle = (label: string, active: boolean, icon: React.ReactNode, run: () => void, shortcut?: string) => (
    <button
      type="button"
      className="pl-btn pl-btn--icon"
      aria-pressed={active}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      onMouseDown={keep}
      onClick={run}
    >
      {icon}
    </button>
  );

  return (
    <header className="pl-cmdbar pl-drag">
      <div className="pl-crumb">
        <span className="pl-crumb-app">Prose</span>
        <span className="pl-crumb-slash" aria-hidden="true">
          /
        </span>
        <input
          className="pl-title-input"
          value={props.title}
          onChange={(event) => props.onTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              editor.commands.focus();
            }
          }}
          size={Math.max(8, props.title.length + 1)}
          aria-label="Document title"
          spellCheck={false}
        />
      </div>

      <div className="pl-cmdbar-tools" role="toolbar" aria-label="Formatting">
        <Menu label="Paragraph style" items={styleItems} className="pl-btn pl-style-btn" width={300} title="Paragraph style">
          <span className="pl-style-name">{currentStyle.label}</span>
          <ChevronDown aria-hidden="true" />
        </Menu>
        <span className="pl-sep" aria-hidden="true" />
        {toggle('Bold', format.bold, <Bold />, () => editor.chain().focus().toggleBold().run(), 'Ctrl B')}
        {toggle('Italic', format.italic, <Italic />, () => editor.chain().focus().toggleItalic().run(), 'Ctrl I')}
        {toggle('Underline', format.underline, <Underline />, () => editor.chain().focus().toggleUnderline().run(), 'Ctrl U')}
        <span className="pl-tool-group pl-list-tools">
          <span className="pl-sep" aria-hidden="true" />
          {toggle('Bulleted list', format.bullet, <List />, () => editor.chain().focus().toggleBulletList().run())}
          {toggle('Numbered list', format.ordered, <ListOrdered />, () => editor.chain().focus().toggleOrderedList().run())}
          {toggle('Checklist', format.task, <ListTodo />, () => editor.chain().focus().toggleTaskList().run())}
        </span>
        <span className="pl-tool-group pl-align-tool">
          <Menu label="Alignment" items={alignItems} className="pl-btn pl-btn--icon" width={200} title="Alignment">
            <AlignIcon aria-hidden="true" />
          </Menu>
        </span>
        <span className="pl-sep" aria-hidden="true" />
        <Menu label="Insert" items={insertItems} className="pl-btn pl-insert-btn" width={280} title="Insert">
          <Plus aria-hidden="true" />
          <span className="pl-btn-label">Insert</span>
        </Menu>
      </div>

      <div className="pl-cmdbar-end">
        <button type="button" className="pl-search-pill" onClick={props.onOpenPalette} aria-label="Search commands">
          <Search aria-hidden="true" />
          <span className="pl-search-label">Search commands</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span className="pl-stamp" data-kind={stampKind(props.stamp)} role="status" aria-live="polite">
          {stampLabel(props.stamp)}
        </span>
        <button
          type="button"
          className="pl-btn pl-btn--outline"
          onClick={props.onExportPdf}
          aria-label="Export PDF"
          title="Export PDF (Ctrl P)"
        >
          <FileDown aria-hidden="true" />
          <span className="pl-btn-label">PDF</span>
        </button>
        <div className="pl-split">
          <button type="button" className="pl-btn pl-btn--primary" onClick={props.onSave} title="Save as .docx (Ctrl S)">
            Save
          </button>
          <Menu label="More file actions" items={fileItems} className="pl-btn pl-btn--primary pl-split-more" align="end" width={260}>
            <ChevronDown aria-hidden="true" />
          </Menu>
        </div>
      </div>
    </header>
  );
}
