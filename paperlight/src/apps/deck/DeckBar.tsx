import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  BringToFront,
  ChevronDown,
  Circle,
  Copy,
  Crop,
  FileDown,
  Bold,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  LayoutTemplate,
  List,
  Minus,
  PaintBucket,
  Palette,
  Pencil,
  Play,
  Plus,
  Presentation,
  Scan,
  Search,
  SendToBack,
  Shapes,
  Square,
  SquareDashed,
  Trash2,
  Type,
  Underline,
  X,
} from 'lucide-react';
import { Menu, type MenuEntry } from '../../ui/Menu';
import { LAYOUTS, THEMES, paint, type Align, type Deck, type LayoutId, type Paint, type ShapeKind, type SlideElement, type ThemeId, type Theme } from './model';
import type { SaveState } from './useDecks';

export const TEXT_SIZES = [16, 20, 24, 28, 32, 40, 48, 56, 72, 96, 128, 200];

const FIXED_COLORS = [
  { value: '#111111', label: 'Ink' },
  { value: '#FFFFFF', label: 'White' },
  { value: '#D63A22', label: 'Vermilion' },
  { value: '#2448D8', label: 'Cobalt' },
  { value: '#0B7A6C', label: 'Viridian' },
  { value: '#F2C230', label: 'Sun' },
];

interface DeckBarProps {
  decks: Deck[];
  deck: Deck;
  theme: Theme;
  save: SaveState;
  selection: SlideElement[];
  editor: Editor | null;
  sorterOpen: boolean;
  onOpenDeck: (id: string) => void;
  onNewDeck: (template: string) => void;
  onRenameDeck: () => void;
  onDeleteDeck: () => void;
  onNewSlide: (layout: LayoutId) => void;
  onLayout: (layout: LayoutId) => void;
  onTheme: (theme: ThemeId) => void;
  onAddText: () => void;
  onAddShape: (shape: ShapeKind) => void;
  onAddImage: () => void;
  onToggleSorter: () => void;
  onTextSize: (size: number) => void;
  onTextAlign: (align: Align) => void;
  onTextColor: (color: Paint) => void;
  onFill: (fill: Paint | null) => void;
  onStroke: (stroke: Paint | null) => void;
  onReplaceImage: () => void;
  onFit: (fit: 'cover' | 'contain') => void;
  onArrange: (where: 'front' | 'back') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeselect: () => void;
  onExport: (kind: 'pptx' | 'pdf') => void;
  onPresent: () => void;
  onOpenPalette: () => void;
}

function time(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function keep(event: React.MouseEvent) {
  event.preventDefault();
}

function Swatch({ color }: { color: string }) {
  return <span className="pl-swatch" style={{ background: color }} aria-hidden="true" />;
}

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;
const SHAPES: { id: ShapeKind; label: string; icon: React.ReactNode }[] = [
  { id: 'rect', label: 'Rectangle', icon: <Square /> },
  { id: 'ellipse', label: 'Ellipse', icon: <Circle /> },
  { id: 'line', label: 'Line', icon: <Minus /> },
  { id: 'arrow', label: 'Arrow', icon: <ArrowRight /> },
];

/** Colour choices. For type, the theme accent is its readable text version. */
function colorItems(theme: Theme, current: Paint | null | undefined, pick: (value: Paint | null) => void, allowNone: boolean, forText = false): MenuEntry[] {
  const themed = [
    { value: 'text' as Paint, label: 'Theme text' },
    { value: 'muted' as Paint, label: 'Theme muted' },
    { value: (forText ? 'accent-text' : 'accent') as Paint, label: 'Theme accent' },
  ];
  return [
    ...themed.map((entry) => ({ id: entry.value, label: entry.label, icon: <Swatch color={paint(entry.value, theme)} />, active: current === entry.value, onSelect: () => pick(entry.value) })),
    { separator: true as const, id: 'sep' },
    ...FIXED_COLORS.map((entry) => ({ id: entry.value, label: entry.label, icon: <Swatch color={entry.value} />, active: current === entry.value, onSelect: () => pick(entry.value) })),
    ...(allowNone ? [{ separator: true as const, id: 'sep-none' }, { id: 'none', label: 'None', icon: <SquareDashed />, active: current === null, onSelect: () => pick(null) }] : []),
  ];
}

export function DeckBar(props: DeckBarProps) {
  const { deck, theme, selection, editor } = props;
  const marks = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      underline: current?.isActive('underline') ?? false,
      list: current?.isActive('bulletList') ?? false,
    }),
  }) ?? { bold: false, italic: false, underline: false, list: false };

  const single = selection.length === 1 ? selection[0] : null;
  const kinds = new Set(selection.map((element) => element.kind));
  const label = selection.length > 1 ? `${selection.length} objects` : single?.kind === 'text' ? 'Text' : single?.kind === 'shape' ? 'Shape' : 'Picture';

  const deckItems: MenuEntry[] = [
    ...props.decks.slice(0, 12).map((entry) => ({ id: entry.id, label: entry.title || 'Untitled deck', description: `${entry.slides.length} slides`, active: entry.id === deck.id, onSelect: () => props.onOpenDeck(entry.id) })),
    { separator: true, id: 'sep' },
    { id: 'new', label: 'New deck', icon: <Plus />, onSelect: () => props.onNewDeck('blank') },
    { id: 'rename', label: 'Rename deck…', icon: <Pencil />, onSelect: props.onRenameDeck },
    { separator: true, id: 'sep-2' },
    { id: 'delete', label: 'Delete deck…', icon: <Trash2 />, danger: true, onSelect: props.onDeleteDeck },
  ];

  const layoutItems = (run: (layout: LayoutId) => void): MenuEntry[] => LAYOUTS.map((layout) => ({ id: layout.id, label: layout.name, description: layout.description, onSelect: () => run(layout.id) }));

  const themeItems: MenuEntry[] = THEMES.map((entry) => ({
    id: entry.id,
    label: entry.name,
    description: entry.description,
    icon: <span className="pl-theme-chip" style={{ backgroundColor: entry.background, borderColor: entry.text, color: entry.accent }} aria-hidden="true" />,
    active: entry.id === deck.theme,
    onSelect: () => props.onTheme(entry.id),
  }));

  const mark = (name: 'bold' | 'italic' | 'underline', icon: React.ReactNode, title: string, shortcut: string) => (
    <button
      type="button"
      className="pl-btn pl-btn--icon"
      aria-pressed={marks[name]}
      aria-label={title}
      title={`${title} (${shortcut})`}
      onMouseDown={keep}
      onClick={() => {
        if (!editor) return;
        const chain = editor.chain().focus();
        if (editor.state.selection.empty) chain.selectAll();
        if (name === 'bold') chain.toggleBold().run();
        else if (name === 'italic') chain.toggleItalic().run();
        else chain.toggleUnderline().run();
      }}
    >
      {icon}
    </button>
  );

  const arrangeItems: MenuEntry[] = [
    { id: 'front', label: 'Bring to front', icon: <BringToFront />, onSelect: () => props.onArrange('front') },
    { id: 'back', label: 'Send to back', icon: <SendToBack />, onSelect: () => props.onArrange('back') },
    { id: 'duplicate', label: 'Duplicate', icon: <Copy />, shortcut: 'Ctrl D', onSelect: props.onDuplicate },
    { separator: true, id: 'sep' },
    { id: 'delete', label: 'Delete', icon: <Trash2 />, shortcut: 'Delete', danger: true, onSelect: props.onDelete },
  ];

  const stamp = props.save.kind === 'saving' ? 'Saving…' : props.save.kind === 'error' ? 'Save failed' : props.save.at ? `Saved ${time(props.save.at)}` : 'Saved';

  return (
    <header className="pl-cmdbar pl-drag">
      <div className="pl-crumb">
        <span className="pl-crumb-app">Deck</span>
        <span className="pl-crumb-slash" aria-hidden="true">
          /
        </span>
        <Menu label={`Deck: ${deck.title}`} items={deckItems} className="pl-btn pl-picker" width={280} title="Switch deck">
          <span className="pl-picker-name">{deck.title || 'Untitled deck'}</span>
          <ChevronDown aria-hidden="true" />
        </Menu>
      </div>

      {selection.length === 0 ? (
        <div className="pl-cmdbar-tools pl-deck-tools" role="toolbar" aria-label="Slide tools" key="slide">
          <span className="pl-sep" aria-hidden="true" />
          <Menu label="New slide" items={layoutItems(props.onNewSlide)} className="pl-btn pl-tool-btn" width={260} title="New slide (Ctrl M)">
            <Plus aria-hidden="true" />
            <span className="pl-btn-label">Slide</span>
          </Menu>
          <Menu label="Layout" items={layoutItems(props.onLayout)} className="pl-btn pl-tool-btn pl-tool-btn--menu" width={260} title="Change this slide's layout">
            <LayoutTemplate aria-hidden="true" />
            <span className="pl-btn-label">Layout</span>
          </Menu>
          <Menu label="Theme" items={themeItems} className="pl-btn pl-tool-btn pl-tool-btn--menu" width={300} title="Theme for every slide">
            <Palette aria-hidden="true" />
            <span className="pl-btn-label">Theme</span>
          </Menu>
          <span className="pl-sep" aria-hidden="true" />
          <button type="button" className="pl-btn pl-tool-btn" onClick={props.onAddText} title="Add a text box" aria-label="Text">
            <Type aria-hidden="true" />
            <span className="pl-btn-label">Text</span>
          </button>
          <Menu
            label="Shape"
            items={SHAPES.map((shape) => ({ id: shape.id, label: shape.label, icon: shape.icon, onSelect: () => props.onAddShape(shape.id) }))}
            className="pl-btn pl-tool-btn"
            width={200}
            title="Add a shape"
          >
            <Shapes aria-hidden="true" />
            <span className="pl-btn-label">Shape</span>
          </Menu>
          <button type="button" className="pl-btn pl-tool-btn" onClick={props.onAddImage} title="Add a picture" aria-label="Picture">
            <ImageIcon aria-hidden="true" />
            <span className="pl-btn-label">Picture</span>
          </button>
          <span className="pl-sep" aria-hidden="true" />
          <button type="button" className="pl-btn pl-tool-btn" aria-pressed={props.sorterOpen} onClick={props.onToggleSorter} title="See every slide" aria-label="Sorter">
            <LayoutGrid aria-hidden="true" />
            <span className="pl-btn-label">Sorter</span>
          </button>
        </div>
      ) : (
        <div className="pl-cmdbar-tools pl-deck-tools pl-deck-tools--object" role="toolbar" aria-label={`${label} tools`} key="object">
          <span className="pl-sep" aria-hidden="true" />
          <button type="button" className="pl-object-chip" onClick={props.onDeselect} title="Done (Esc)">
            {label}
            <X aria-hidden="true" />
          </button>
          {single?.kind === 'text' && (
            <>
              <Menu
                label="Text size"
                items={TEXT_SIZES.map((size) => ({ id: String(size), label: `${size}`, active: single.size === size, onSelect: () => props.onTextSize(size) }))}
                className="pl-btn pl-size-btn"
                width={120}
                title="Text size"
              >
                <span className="pl-size-value">{single.size}</span>
                <ChevronDown aria-hidden="true" />
              </Menu>
              {mark('bold', <Bold />, 'Bold', 'Ctrl B')}
              {mark('italic', <Italic />, 'Italic', 'Ctrl I')}
              {mark('underline', <Underline />, 'Underline', 'Ctrl U')}
              <button
                type="button"
                className="pl-btn pl-btn--icon"
                aria-pressed={marks.list}
                aria-label="Bulleted list"
                title="Bulleted list"
                onMouseDown={keep}
                onClick={() => {
                  if (!editor) return;
                  const chain = editor.chain().focus();
                  if (editor.state.selection.empty) chain.selectAll();
                  chain.toggleBulletList().run();
                }}
              >
                <List />
              </button>
              <Menu
                label="Alignment"
                items={(['left', 'center', 'right'] as const).map((align) => {
                  const Icon = ALIGN_ICONS[align];
                  return { id: align, label: `Align ${align}`, icon: <Icon />, active: single.align === align, onSelect: () => props.onTextAlign(align) };
                })}
                className="pl-btn pl-btn--icon"
                width={190}
                title="Alignment"
              >
                {(() => {
                  const Icon = ALIGN_ICONS[single.align];
                  return <Icon aria-hidden="true" />;
                })()}
              </Menu>
              <Menu label="Text colour" items={colorItems(theme, single.color, (value) => value && props.onTextColor(value), false, true)} className="pl-btn pl-btn--icon pl-color-btn" width={200} title="Text colour">
                <Type aria-hidden="true" />
                <span className="pl-color-bar" style={{ background: paint(single.color, theme) }} aria-hidden="true" />
              </Menu>
            </>
          )}
          {single?.kind === 'shape' && (
            <>
              <Menu label="Fill" items={colorItems(theme, single.fill, props.onFill, true)} className="pl-btn pl-tool-btn pl-color-btn" width={200} title="Fill colour">
                <PaintBucket aria-hidden="true" />
                <span className="pl-btn-label">Fill</span>
                <span className="pl-color-bar" style={{ background: single.fill ? paint(single.fill, theme) : 'transparent' }} aria-hidden="true" />
              </Menu>
              <Menu label="Outline" items={colorItems(theme, single.stroke, props.onStroke, true)} className="pl-btn pl-tool-btn pl-color-btn" width={200} title="Outline colour">
                <Square aria-hidden="true" />
                <span className="pl-btn-label">Outline</span>
                <span className="pl-color-bar" style={{ background: single.stroke ? paint(single.stroke, theme) : 'transparent' }} aria-hidden="true" />
              </Menu>
            </>
          )}
          {single?.kind === 'image' && (
            <>
              <button type="button" className="pl-btn pl-tool-btn" onClick={props.onReplaceImage} title="Replace the picture" aria-label="Replace picture">
                <ImageIcon aria-hidden="true" />
                <span className="pl-btn-label">Replace</span>
              </button>
              <Menu
                label="Fit"
                items={[
                  { id: 'cover', label: 'Fill the frame', description: 'Crops to fit', active: single.fit === 'cover', onSelect: () => props.onFit('cover') },
                  { id: 'contain', label: 'Show it all', description: 'Leaves space around it', active: single.fit === 'contain', onSelect: () => props.onFit('contain') },
                ]}
                className="pl-btn pl-tool-btn"
                width={220}
                title="How the picture fits"
              >
                {single.fit === 'cover' ? <Crop aria-hidden="true" /> : <Scan aria-hidden="true" />}
                <span className="pl-btn-label">{single.fit === 'cover' ? 'Fill' : 'Fit'}</span>
              </Menu>
            </>
          )}
          {kinds.size > 0 && (
            <>
              <span className="pl-sep" aria-hidden="true" />
              <Menu label="Arrange" items={arrangeItems} className="pl-btn pl-tool-btn" width={220} title="Arrange">
                <BringToFront aria-hidden="true" />
                <span className="pl-btn-label">Arrange</span>
              </Menu>
            </>
          )}
        </div>
      )}

      <div className="pl-cmdbar-end">
        <button type="button" className="pl-search-pill" onClick={props.onOpenPalette} aria-label="Search commands">
          <Search aria-hidden="true" />
          <span className="pl-search-label">Search commands</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span className="pl-stamp" data-kind={props.save.kind === 'saving' ? 'saving' : props.save.kind === 'error' ? 'error' : 'saved'} role="status" aria-live="polite">
          {stamp}
        </span>
        <Menu
          label="Export"
          items={[
            { id: 'pptx', label: 'PowerPoint file (.pptx)', description: 'Slides, text, shapes, pictures and notes', icon: <Presentation />, onSelect: () => props.onExport('pptx') },
            { id: 'pdf', label: 'PDF', description: 'One slide per page', icon: <FileDown />, onSelect: () => props.onExport('pdf') },
          ]}
          className="pl-btn pl-btn--outline pl-export-btn"
          align="end"
          width={280}
          title="Export"
        >
          <FileDown aria-hidden="true" />
          <span className="pl-btn-label">Export</span>
        </Menu>
        <button type="button" className="pl-btn pl-btn--primary" onClick={props.onPresent} title="Present from this slide (F5 from the start)">
          <Play aria-hidden="true" />
          Present
        </button>
      </div>
    </header>
  );
}
