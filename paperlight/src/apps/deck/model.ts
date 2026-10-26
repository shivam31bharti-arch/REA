/** Slides are laid out on a 1280 × 720 surface and scaled to fit wherever they are drawn. */
export const SLIDE_W = 1280;
export const SLIDE_H = 720;
export const MARGIN = 96;
export const COLUMNS = 12;
export const GUTTER = 24;

/**
 * A colour named by the theme, so it follows a theme change, or a fixed hex colour.
 * "accent-text" is the accent as it can be read as type; "accent" is for bars and fills.
 */
export type Paint = 'text' | 'muted' | 'accent' | 'accent-text' | 'surface' | string;

export type Align = 'left' | 'center' | 'right';

export type Placeholder = 'title' | 'subtitle' | 'body' | 'number' | 'caption' | 'statement';

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextElement extends Box {
  kind: 'text';
  /** Paragraphs and bullet lists with bold, italic and underline, as editor HTML. */
  html: string;
  size: number;
  weight: 400 | 600 | 800;
  align: Align;
  color: Paint;
  placeholder?: Placeholder;
}

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow';

export interface ShapeElement extends Box {
  kind: 'shape';
  shape: ShapeKind;
  fill: Paint | null;
  stroke: Paint | null;
  strokeWidth: number;
}

export interface ImageElement extends Box {
  kind: 'image';
  /** A data URL, or null for an empty picture placeholder. */
  src: string | null;
  fit: 'cover' | 'contain';
}

export type SlideElement = TextElement | ShapeElement | ImageElement;

export type LayoutId = 'title' | 'content' | 'two' | 'section' | 'image' | 'statement' | 'blank';

export interface Slide {
  id: string;
  layout: LayoutId;
  elements: SlideElement[];
  notes: string;
  /** How long you plan to speak over this slide. */
  seconds: number;
}

export type ThemeId = 'paper' | 'ink' | 'sun' | 'cobalt' | 'grid';

export interface Deck {
  id: string;
  title: string;
  theme: ThemeId;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  background: string;
  text: string;
  muted: string;
  accent: string;
  /** The accent darkened or swapped where needed so type in it reads at 4.5:1 or better. */
  accentText: string;
  surface: string;
  /** Selection outline and handles drawn over this theme's slides, 3:1 or better against the ground. */
  select: string;
  /** Snap guides over this theme's slides, 3:1 or better against the ground. */
  guide: string;
  /** Drawn by the theme on every slide, behind the content. */
  decoration: 'bar' | 'grid' | 'band' | 'rule';
}

export const THEMES: Theme[] = [
  { id: 'paper', name: 'Paper', description: 'White, ink, a sun bar above each title', background: '#FFFFFF', text: '#111111', muted: '#595959', accent: '#F2C230', accentText: '#8C6A00', surface: '#F2F2F0', select: '#8C6A00', guide: '#D63A22', decoration: 'bar' },
  { id: 'ink', name: 'Ink', description: 'Black ground, white type, sun accents', background: '#111111', text: '#FFFFFF', muted: '#A6A6A6', accent: '#F2C230', accentText: '#F2C230', surface: '#262626', select: '#F2C230', guide: '#D63A22', decoration: 'bar' },
  { id: 'sun', name: 'Sun', description: 'The whole slide in sun yellow', background: '#F2C230', text: '#111111', muted: '#4D3D00', accent: '#111111', accentText: '#111111', surface: '#F7D766', select: '#111111', guide: '#A11F14', decoration: 'rule' },
  { id: 'cobalt', name: 'Cobalt', description: 'Cobalt ground with white type', background: '#2448D8', text: '#FFFFFF', muted: '#DCE3FB', accent: '#F2C230', accentText: '#FFD24D', surface: '#3A5BE0', select: '#F2C230', guide: '#FFFFFF', decoration: 'band' },
  { id: 'grid', name: 'Grid', description: 'White with the twelve-column grid drawn in', background: '#FFFFFF', text: '#111111', muted: '#595959', accent: '#D63A22', accentText: '#C2311A', surface: '#F2F2F0', select: '#8C6A00', guide: '#D63A22', decoration: 'grid' },
];

export function themeOf(id: ThemeId) {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function paint(value: Paint | null, theme: Theme): string {
  if (value === null) return 'transparent';
  if (value === 'text') return theme.text;
  if (value === 'muted') return theme.muted;
  if (value === 'accent') return theme.accent;
  if (value === 'accent-text') return theme.accentText;
  if (value === 'surface') return theme.surface;
  return value;
}

/** Colour for type: the accent always resolves to its readable text version. */
export function textPaint(value: Paint, theme: Theme): string {
  return paint(value === 'accent' ? 'accent-text' : value, theme);
}

export function newId() {
  return crypto.randomUUID();
}

/** The left edge of each of the 12 columns inside the slide margins. */
export const COLUMN_EDGES = (() => {
  const width = (SLIDE_W - MARGIN * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;
  const edges: number[] = [];
  for (let i = 0; i < COLUMNS; i += 1) {
    const left = MARGIN + i * (width + GUTTER);
    edges.push(left, left + width);
  }
  return edges;
})();

const text = (partial: Omit<TextElement, 'id' | 'kind' | 'color' | 'align' | 'weight'> & Partial<TextElement>): TextElement => ({
  id: newId(),
  kind: 'text',
  color: 'text',
  align: 'left',
  weight: 400,
  ...partial,
});

export const PLACEHOLDER_TEXT: Record<Placeholder, string> = {
  title: 'Click to add a title',
  subtitle: 'Add a subtitle',
  body: 'Add your points',
  number: '01',
  caption: 'Add a caption',
  statement: 'Say one thing, big',
};

export interface LayoutInfo {
  id: LayoutId;
  name: string;
  description: string;
}

export const LAYOUTS: LayoutInfo[] = [
  { id: 'title', name: 'Title', description: 'A big title and a subtitle' },
  { id: 'content', name: 'Title and points', description: 'A title over a list' },
  { id: 'two', name: 'Two columns', description: 'A title over two lists' },
  { id: 'section', name: 'Section', description: 'A big number and a section name' },
  { id: 'image', name: 'Picture and caption', description: 'A picture with words beside it' },
  { id: 'statement', name: 'Statement', description: 'One line, as large as it fits' },
  { id: 'blank', name: 'Blank', description: 'Nothing but the theme' },
];

/** The placeholders a layout starts with. Text may be given for each placeholder, in order. */
export function layoutElements(layout: LayoutId, fill: Partial<Record<Placeholder, string>> = {}): SlideElement[] {
  const html = (role: Placeholder, list = false) => {
    const value = fill[role];
    if (!value) return '';
    if (!list) return value.split('\n').map((line) => `<p>${escapeHtml(line)}</p>`).join('');
    return `<ul>${value.split('\n').map((line) => `<li><p>${escapeHtml(line)}</p></li>`).join('')}</ul>`;
  };
  switch (layout) {
    case 'title':
      return [
        text({ x: MARGIN, y: 236, w: 1088, h: 170, size: 80, weight: 800, html: html('title'), placeholder: 'title' }),
        text({ x: MARGIN, y: 420, w: 900, h: 90, size: 30, color: 'muted', html: html('subtitle'), placeholder: 'subtitle' }),
      ];
    case 'content':
      return [
        text({ x: MARGIN, y: 96, w: 1088, h: 110, size: 54, weight: 800, html: html('title'), placeholder: 'title' }),
        text({ x: MARGIN, y: 236, w: 1088, h: 400, size: 30, html: html('body', true), placeholder: 'body' }),
      ];
    case 'two':
      return [
        text({ x: MARGIN, y: 96, w: 1088, h: 110, size: 54, weight: 800, html: html('title'), placeholder: 'title' }),
        text({ x: MARGIN, y: 236, w: 532, h: 400, size: 28, html: html('body', true), placeholder: 'body' }),
        text({ x: MARGIN + 556, y: 236, w: 532, h: 400, size: 28, html: html('caption', true), placeholder: 'body' }),
      ];
    case 'section':
      return [
        text({ x: MARGIN, y: 150, w: 600, h: 240, size: 200, weight: 800, color: 'accent-text', html: html('number'), placeholder: 'number' }),
        text({ x: MARGIN, y: 420, w: 1088, h: 130, size: 60, weight: 800, html: html('title'), placeholder: 'title' }),
      ];
    case 'image':
      return [
        { id: newId(), kind: 'image', x: MARGIN, y: 96, w: 620, h: 528, src: null, fit: 'cover' },
        text({ x: 764, y: 96, w: 420, h: 220, size: 44, weight: 800, html: html('title'), placeholder: 'title' }),
        text({ x: 764, y: 336, w: 420, h: 288, size: 24, color: 'muted', html: html('caption'), placeholder: 'caption' }),
      ];
    case 'statement':
      return [text({ x: MARGIN, y: 180, w: 1088, h: 360, size: 76, weight: 800, html: html('statement'), placeholder: 'statement' })];
    default:
      return [];
  }
}

export function newSlide(layout: LayoutId, fill?: Partial<Record<Placeholder, string>>, seconds = 45, notes = ''): Slide {
  return { id: newId(), layout, elements: layoutElements(layout, fill), notes, seconds };
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain text of editor HTML, for titles, search and checks for empty placeholders. */
export function plainText(html: string) {
  return html
    .replace(/<\/(p|li)>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n+$/, '')
    .trim();
}

export function slideTitle(slide: Slide) {
  const title = slide.elements.find((element): element is TextElement => element.kind === 'text' && (element.placeholder === 'title' || element.placeholder === 'statement'));
  const first = title ?? slide.elements.find((element): element is TextElement => element.kind === 'text' && plainText(element.html) !== '');
  const value = first ? plainText(first.html).split('\n')[0] : '';
  return value || 'Untitled slide';
}

export function formatSeconds(total: number) {
  const seconds = Math.max(0, Math.round(total));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function parseSeconds(value: string): number | null {
  const match = /^\s*(?:(\d+):)?(\d{1,3})\s*$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds >= 60) return null;
  return minutes * 60 + seconds;
}

/** About how long the notes take to say at 150 words a minute. */
export function speakingSeconds(notes: string) {
  const words = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  return Math.round((words / 150) * 60);
}

export function totalSeconds(deck: Deck) {
  return deck.slides.reduce((sum, slide) => sum + slide.seconds, 0);
}

export function duplicateSlide(slide: Slide): Slide {
  return { ...slide, id: newId(), elements: slide.elements.map((element) => ({ ...element, id: newId() })) };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
