import { COLUMN_EDGES, MARGIN, paint, plainText, textPaint, SLIDE_H, SLIDE_W, themeOf, type Deck, type Slide, type TextElement, type Theme } from './model';
import { lineHeight } from './SlideView';

type PptxModule = typeof import('pptxgenjs');
type PptxSlide = ReturnType<InstanceType<PptxModule['default']>['addSlide']>;

/** Slide units are pixels of a 1280-wide slide; a 16:9 PowerPoint slide is 10 inches wide. */
const INCH = 10 / SLIDE_W;
const POINT = (10 * 72) / SLIDE_W;
const FONT = 'Geist';

const inches = (value: number) => Number((value * INCH).toFixed(4));
const hex = (color: string) => color.replace('#', '').toUpperCase().slice(0, 6);

interface Run {
  text: string;
  options: Record<string, unknown>;
}

/** Turns the editor's HTML into PowerPoint text runs: paragraphs, bullets, bold, italic, underline. */
function runsFor(element: TextElement): Run[] {
  const doc = new DOMParser().parseFromString(`<body>${element.html}</body>`, 'text/html');
  const blocks: { bullet: boolean; node: Element }[] = [];
  doc.body.querySelectorAll('p').forEach((p) => blocks.push({ bullet: !!p.closest('li'), node: p }));
  if (blocks.length === 0 && doc.body.textContent?.trim()) blocks.push({ bullet: false, node: doc.body });
  const runs: Run[] = [];
  blocks.forEach((block, index) => {
    const pieces: Run[] = [];
    const walk = (node: Node, marks: { bold: boolean; italic: boolean; underline: boolean }) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) {
          pieces.push({
            text: node.textContent,
            options: { bold: marks.bold || element.weight >= 600, italic: marks.italic, underline: marks.underline ? { style: 'sng' } : undefined },
          });
        }
        return;
      }
      if (!(node instanceof Element)) return;
      if (node.tagName === 'BR') {
        pieces.push({ text: '', options: { breakLine: true } });
        return;
      }
      const next = {
        bold: marks.bold || node.tagName === 'STRONG' || node.tagName === 'B',
        italic: marks.italic || node.tagName === 'EM' || node.tagName === 'I',
        underline: marks.underline || node.tagName === 'U',
      };
      node.childNodes.forEach((child) => walk(child, next));
    };
    walk(block.node, { bold: false, italic: false, underline: false });
    if (pieces.length === 0) pieces.push({ text: '', options: {} });
    pieces[0].options = { ...pieces[0].options, bullet: block.bullet ? { indent: 18 } : false };
    if (index < blocks.length - 1) pieces[pieces.length - 1].options = { ...pieces[pieces.length - 1].options, breakLine: true };
    runs.push(...pieces);
  });
  return runs;
}

function addDecoration(slide: PptxSlide, pptx: InstanceType<PptxModule['default']>, deckSlide: Slide, theme: Theme) {
  const rect = (x: number, y: number, w: number, h: number, color: string) =>
    slide.addShape(pptx.ShapeType.rect, { x: inches(x), y: inches(y), w: inches(w), h: inches(h), fill: { color: hex(color) }, line: { color: hex(color), width: 0 } });
  const anchor = deckSlide.elements.find(
    (element): element is TextElement => element.kind === 'text' && (element.placeholder === 'title' || element.placeholder === 'statement' || element.placeholder === 'number'),
  );
  if (theme.decoration === 'grid') for (const x of COLUMN_EDGES) rect(x, 0, 1, SLIDE_H, '#ECECEA');
  if ((theme.decoration === 'bar' || theme.decoration === 'grid') && anchor) rect(anchor.x, Math.max(24, anchor.y - 30), 64, 10, theme.accent);
  if (theme.decoration === 'band') rect(0, 0, 18, SLIDE_H, theme.accent);
  if (theme.decoration === 'rule') rect(MARGIN, SLIDE_H - 76, SLIDE_W - MARGIN * 2, 3, theme.text);
}

/** Writes the deck as a .pptx file: themes, text, shapes, pictures and speaker notes. */
export async function deckToPptx(deck: Deck): Promise<Uint8Array> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.title;
  pptx.author = 'Paperlight';
  const theme = themeOf(deck.theme);

  deck.slides.forEach((deckSlide, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: hex(theme.background) };
    addDecoration(slide, pptx, deckSlide, theme);

    for (const element of deckSlide.elements) {
      const box = { x: inches(element.x), y: inches(element.y), w: inches(element.w), h: inches(Math.max(element.h, 1)) };
      if (element.kind === 'text') {
        if (!plainText(element.html)) continue;
        slide.addText(runsFor(element) as Parameters<PptxSlide['addText']>[0], {
          ...box,
          fontFace: FONT,
          fontSize: Math.round(element.size * POINT * 10) / 10,
          color: hex(textPaint(element.color, theme)),
          align: element.align,
          valign: 'top',
          margin: 0,
          lineSpacingMultiple: lineHeight(element.size),
          charSpacing: element.size >= 40 ? -1 : 0,
          fit: 'none',
        });
      } else if (element.kind === 'shape') {
        const fill = element.fill ? { color: hex(paint(element.fill, theme)) } : undefined;
        const lineColor = element.stroke ? hex(paint(element.stroke, theme)) : fill?.color;
        if (element.shape === 'rect' || element.shape === 'ellipse') {
          slide.addShape(element.shape === 'rect' ? pptx.ShapeType.rect : pptx.ShapeType.ellipse, {
            ...box,
            fill: fill ?? { type: 'none' },
            line: element.stroke ? { color: lineColor, width: element.strokeWidth * POINT } : { type: 'none' },
          } as Parameters<PptxSlide['addShape']>[1]);
        } else {
          const flat = element.h <= 12;
          slide.addShape(pptx.ShapeType.line, {
            x: box.x,
            y: flat ? inches(element.y + element.h / 2) : box.y,
            w: box.w,
            h: flat ? 0 : box.h,
            line: { color: lineColor, width: Math.max(element.strokeWidth, 2) * POINT, endArrowType: element.shape === 'arrow' ? 'triangle' : undefined },
          } as Parameters<PptxSlide['addShape']>[1]);
        }
      } else if (element.src) {
        slide.addImage({ data: element.src.replace(/^data:/, ''), ...box, sizing: { type: element.fit === 'cover' ? 'cover' : 'contain', w: box.w, h: box.h } });
      }
    }

    if (deckSlide.layout !== 'title' && deckSlide.layout !== 'statement') {
      // Matches the slide footer: 15px type sitting 30px above the bottom edge.
      const footer = { y: inches(SLIDE_H - 30 - 24), h: inches(24), valign: 'bottom' as const, fontFace: FONT, fontSize: 15 * POINT, color: hex(theme.muted), margin: 0 };
      slide.addText(deck.title, { ...footer, x: inches(MARGIN), w: inches(700) });
      slide.addText(`${String(index + 1).padStart(2, '0')} / ${String(deck.slides.length).padStart(2, '0')}`, { ...footer, fontFace: 'Geist Mono', x: inches(SLIDE_W - MARGIN - 200), w: inches(200), align: 'right' });
    }
    if (deckSlide.notes.trim()) slide.addNotes(deckSlide.notes);
  });

  const data = await pptx.write({ outputType: 'uint8array' });
  return data as Uint8Array;
}
