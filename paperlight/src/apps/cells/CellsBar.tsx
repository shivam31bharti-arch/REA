import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowDownZA,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChevronDown,
  FileDown,
  FilePlus2,
  FolderOpen,
  Funnel,
  Italic,
  PaintBucket,
  Plus,
  Save,
  Search,
  Sigma,
  Trash2,
  Underline,
} from 'lucide-react';
import { Menu, type MenuEntry } from '../../ui/Menu';
import { formatLabel, NUMBER_FORMATS } from './engine/format';
import type { Align, ChartKind, CellStyle } from './model';

export type CellsStamp =
  | { kind: 'new' }
  | { kind: 'unsaved' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date | null }
  | { kind: 'error' };

export const FILL_COLORS = [
  { id: 'grey', label: 'Grey', value: '#EDEDEB' },
  { id: 'cobalt', label: 'Cobalt tint', value: '#DCE3FB' },
  { id: 'vermilion', label: 'Vermilion tint', value: '#FBE1DB' },
  { id: 'viridian', label: 'Viridian tint', value: '#D4EDE9' },
  { id: 'sun', label: 'Sun tint', value: '#FCEFC4' },
];

export const TEXT_COLORS = [
  { id: 'cobalt', label: 'Cobalt', value: '#2448D8' },
  { id: 'vermilion', label: 'Vermilion', value: '#C2311A' },
  { id: 'viridian', label: 'Viridian', value: '#0B7A6C' },
  { id: 'grey', label: 'Grey', value: '#595959' },
];

interface CellsBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onTitleDone: () => void;
  style: CellStyle;
  stamp: CellsStamp;
  filterOn: boolean;
  onFormat: (code: string) => void;
  onToggle: (key: 'bold' | 'italic' | 'underline') => void;
  onFill: (color: string | undefined) => void;
  onTextColor: (color: string | undefined) => void;
  onAlign: (align: Align | undefined) => void;
  onSort: (descending: boolean) => void;
  onFilter: () => void;
  onChart: (kind: ChartKind) => void;
  onInsert: (what: 'row-above' | 'row-below' | 'col-left' | 'col-right') => void;
  onDelete: (what: 'rows' | 'cols') => void;
  onAutoSum: () => void;
  onNewSheet: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportCsv: () => void;
  onOpen: () => void;
  onNew: () => void;
  onOpenPalette: () => void;
}

function time(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function stampLabel(stamp: CellsStamp) {
  switch (stamp.kind) {
    case 'new':
      return 'Not saved';
    case 'unsaved':
      return 'Unsaved';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return stamp.at ? `Saved ${time(stamp.at)}` : 'Saved';
    case 'error':
      return 'Save failed';
  }
}

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;

function keep(event: React.MouseEvent) {
  event.preventDefault();
}

function Swatch({ color }: { color: string }) {
  return <span className="pl-swatch" style={{ background: color }} aria-hidden="true" />;
}

export function CellsBar(props: CellsBarProps) {
  const { style } = props;
  const AlignIcon = ALIGN_ICONS[style.align ?? 'left'];

  const formatItems: MenuEntry[] = NUMBER_FORMATS.map((format) => ({
    id: format.id,
    label: format.label,
    description: format.code === 'General' ? 'As typed' : format.id === 'text' ? 'Numbers stay as typed text' : examples[format.id],
    active: (style.format ?? 'General') === format.code,
    onSelect: () => props.onFormat(format.code),
  }));

  const colorItems: MenuEntry[] = [
    ...FILL_COLORS.map((color) => ({
      id: `fill-${color.id}`,
      label: `Fill: ${color.label}`,
      icon: <Swatch color={color.value} />,
      active: style.fill === color.value,
      onSelect: () => props.onFill(color.value),
    })),
    { id: 'fill-none', label: 'No fill', icon: <Swatch color="transparent" />, onSelect: () => props.onFill(undefined) },
    { separator: true, id: 'sep' },
    ...TEXT_COLORS.map((color) => ({
      id: `text-${color.id}`,
      label: `Text: ${color.label}`,
      icon: <span className="pl-swatch-text" style={{ color: color.value }} aria-hidden="true">A</span>,
      active: style.color === color.value,
      onSelect: () => props.onTextColor(color.value),
    })),
    { id: 'text-auto', label: 'Text: Automatic', icon: <span className="pl-swatch-text" aria-hidden="true">A</span>, onSelect: () => props.onTextColor(undefined) },
  ];

  const alignItems: MenuEntry[] = (['left', 'center', 'right'] as const).map((align) => {
    const Icon = ALIGN_ICONS[align];
    return { id: align, label: `Align ${align}`, icon: <Icon />, active: style.align === align, onSelect: () => props.onAlign(align) };
  });
  alignItems.push({ separator: true, id: 'sep' }, { id: 'auto', label: 'Automatic alignment', description: 'Numbers right, text left', onSelect: () => props.onAlign(undefined) });

  const sortItems: MenuEntry[] = [
    { id: 'asc', label: 'Sort A to Z', description: 'Smallest first, by the selected column', icon: <ArrowDownAZ />, onSelect: () => props.onSort(false) },
    { id: 'desc', label: 'Sort Z to A', description: 'Largest first, by the selected column', icon: <ArrowDownZA />, onSelect: () => props.onSort(true) },
  ];

  const chartItems: MenuEntry[] = [
    { id: 'column', label: 'Column chart', description: 'Compare values side by side', icon: <ChartColumn />, onSelect: () => props.onChart('column') },
    { id: 'bar', label: 'Bar chart', description: 'Long labels read better', icon: <ChartBar />, onSelect: () => props.onChart('bar') },
    { id: 'line', label: 'Line chart', description: 'A change over time', icon: <ChartLine />, onSelect: () => props.onChart('line') },
    { id: 'pie', label: 'Pie chart', description: 'Parts of one whole', icon: <ChartPie />, onSelect: () => props.onChart('pie') },
  ];

  const insertItems: MenuEntry[] = [
    { id: 'sum', label: 'Sum', description: 'Adds the numbers above or to the left', icon: <Sigma />, shortcut: 'Alt =', onSelect: props.onAutoSum },
    { separator: true, id: 'sep-1' },
    { id: 'row-above', label: 'Row above', icon: <BetweenHorizontalStart />, onSelect: () => props.onInsert('row-above') },
    { id: 'row-below', label: 'Row below', icon: <BetweenHorizontalEnd />, onSelect: () => props.onInsert('row-below') },
    { id: 'col-left', label: 'Column to the left', icon: <BetweenVerticalStart />, onSelect: () => props.onInsert('col-left') },
    { id: 'col-right', label: 'Column to the right', icon: <BetweenVerticalEnd />, onSelect: () => props.onInsert('col-right') },
    { separator: true, id: 'sep-2' },
    { id: 'delete-rows', label: 'Delete selected rows', icon: <Trash2 />, danger: true, onSelect: () => props.onDelete('rows') },
    { id: 'delete-cols', label: 'Delete selected columns', icon: <Trash2 />, danger: true, onSelect: () => props.onDelete('cols') },
    { separator: true, id: 'sep-3' },
    { id: 'sheet', label: 'New sheet', icon: <Plus />, onSelect: props.onNewSheet },
  ];

  const fileItems: MenuEntry[] = [
    { id: 'save-as', label: 'Save as…', icon: <Save />, shortcut: 'Ctrl Shift S', onSelect: props.onSaveAs },
    { id: 'csv', label: 'Export this sheet as CSV', icon: <FileDown />, onSelect: props.onExportCsv },
    { separator: true, id: 'sep' },
    { id: 'open', label: 'Open…', icon: <FolderOpen />, shortcut: 'Ctrl O', onSelect: props.onOpen },
    { id: 'new', label: 'New workbook', icon: <FilePlus2 />, shortcut: 'Ctrl N', onSelect: props.onNew },
  ];

  const toggle = (label: string, key: 'bold' | 'italic' | 'underline', icon: React.ReactNode, shortcut: string) => (
    <button
      type="button"
      className="pl-btn pl-btn--icon"
      aria-pressed={!!style[key]}
      aria-label={label}
      title={`${label} (${shortcut})`}
      onMouseDown={keep}
      onClick={() => props.onToggle(key)}
    >
      {icon}
    </button>
  );

  return (
    <header className="pl-cmdbar pl-drag">
      <div className="pl-crumb">
        <span className="pl-crumb-app">Cells</span>
        <span className="pl-crumb-slash" aria-hidden="true">
          /
        </span>
        <input
          className="pl-title-input"
          value={props.title}
          onChange={(event) => props.onTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault();
              props.onTitleDone();
            }
          }}
          size={Math.max(8, props.title.length + 1)}
          aria-label="Workbook title"
          spellCheck={false}
        />
      </div>

      <div className="pl-cmdbar-tools" role="toolbar" aria-label="Cell formatting">
        <Menu label="Number format" items={formatItems} className="pl-btn pl-style-btn pl-format-btn" width={280} title="Number format">
          <span className="pl-style-name">{formatLabel(style.format)}</span>
          <ChevronDown aria-hidden="true" />
        </Menu>
        <span className="pl-sep" aria-hidden="true" />
        {toggle('Bold', 'bold', <Bold />, 'Ctrl B')}
        {toggle('Italic', 'italic', <Italic />, 'Ctrl I')}
        {toggle('Underline', 'underline', <Underline />, 'Ctrl U')}
        <Menu label="Fill and text colour" items={colorItems} className="pl-btn pl-btn--icon pl-color-btn" width={220} title="Fill and text colour">
          <PaintBucket aria-hidden="true" />
          <span className="pl-color-bar" style={{ background: style.fill ?? 'transparent' }} aria-hidden="true" />
        </Menu>
        <span className="pl-tool-group pl-cells-align">
          <Menu label="Alignment" items={alignItems} className="pl-btn pl-btn--icon" width={230} title="Alignment">
            <AlignIcon aria-hidden="true" />
          </Menu>
        </span>
        <span className="pl-sep" aria-hidden="true" />
        <Menu label="Sort" items={sortItems} className="pl-btn pl-tool-btn" width={300} title="Sort">
          <ArrowDownAZ aria-hidden="true" />
          <span className="pl-btn-label">Sort</span>
        </Menu>
        <button
          type="button"
          className="pl-btn pl-tool-btn"
          aria-pressed={props.filterOn}
          onClick={props.onFilter}
          title="Filter rows (Ctrl Shift L)"
          aria-label="Filter"
        >
          <Funnel aria-hidden="true" />
          <span className="pl-btn-label">Filter</span>
        </button>
        <Menu label="Chart" items={chartItems} className="pl-btn pl-tool-btn" width={260} title="Chart from the selection">
          <ChartColumn aria-hidden="true" />
          <span className="pl-btn-label">Chart</span>
        </Menu>
        <Menu label="Insert" items={insertItems} className="pl-btn pl-insert-btn" width={270} title="Insert">
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
        <span className="pl-stamp" data-kind={props.stamp.kind} role="status" aria-live="polite">
          {stampLabel(props.stamp)}
        </span>
        <div className="pl-split">
          <button type="button" className="pl-btn pl-btn--primary" onClick={props.onSave} title="Save as .xlsx (Ctrl S)">
            Save
          </button>
          <Menu label="More file actions" items={fileItems} className="pl-btn pl-btn--primary pl-split-more" align="end" width={270}>
            <ChevronDown aria-hidden="true" />
          </Menu>
        </div>
      </div>
    </header>
  );
}

const examples: Record<string, string> = {
  number: '1,234.50',
  whole: '1,235',
  currency: '$1,234.50',
  percent: '12%',
  percent1: '12.5%',
  date: '2 Jul 2026',
  iso: '2026-07-02',
  time: '13:30',
};
