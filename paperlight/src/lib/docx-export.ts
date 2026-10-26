import type { JSONContent } from '@tiptap/core';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx';

const BODY_FONT = 'Geist';
const MONO_FONT = 'Geist Mono';
const MAX_IMAGE_WIDTH = 600;
const INK = '111111';

type RunStyle = {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  highlight?: boolean;
  link?: boolean;
};

type EmbeddedImage = { data: Uint8Array; type: 'png' | 'jpg' | 'gif'; width: number; height: number };

type Context = {
  images: Map<string, EmbeddedImage>;
  nextListInstance: number;
};

const ALIGNMENT = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const;

function alignmentOf(node: JSONContent) {
  const value = node.attrs?.textAlign as keyof typeof ALIGNMENT | undefined;
  return value && value !== 'left' ? ALIGNMENT[value] : undefined;
}

function textRun(text: string, style: RunStyle) {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    underline: style.underline ? {} : undefined,
    strike: style.strike,
    highlight: style.highlight ? 'yellow' : undefined,
    font: style.code ? MONO_FONT : undefined,
    style: style.link ? 'Hyperlink' : undefined,
  });
}

function inlineChildren(nodes: JSONContent[] | undefined, ctx: Context, base: RunStyle = {}): ParagraphChild[] {
  const children: ParagraphChild[] = [];
  for (const node of nodes ?? []) {
    if (node.type === 'text') {
      const style: RunStyle = { ...base };
      let href: string | null = null;
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') style.bold = true;
        else if (mark.type === 'italic') style.italics = true;
        else if (mark.type === 'underline') style.underline = true;
        else if (mark.type === 'strike') style.strike = true;
        else if (mark.type === 'code') style.code = true;
        else if (mark.type === 'highlight') style.highlight = true;
        else if (mark.type === 'link' && typeof mark.attrs?.href === 'string') href = mark.attrs.href;
      }
      if (href) {
        children.push(new ExternalHyperlink({ link: href, children: [textRun(node.text ?? '', { ...style, link: true })] }));
      } else {
        children.push(textRun(node.text ?? '', style));
      }
    } else if (node.type === 'hardBreak') {
      children.push(new TextRun({ text: '', break: 1 }));
    } else if (node.type === 'image') {
      const image = imageRun(node, ctx);
      if (image) children.push(image);
    }
  }
  return children;
}

function imageRun(node: JSONContent, ctx: Context) {
  const src = node.attrs?.src;
  const image = typeof src === 'string' ? ctx.images.get(src) : undefined;
  if (!image) return null;
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
  return new ImageRun({
    type: image.type,
    data: image.data,
    transformation: { width: Math.round(image.width * scale), height: Math.round(image.height * scale) },
  });
}

function listBlocks(
  list: JSONContent,
  ctx: Context,
  level: number,
  reference: 'pl-bullet' | 'pl-number',
  instance: number,
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const item of list.content ?? []) {
    let first = true;
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        const nestedReference = child.type === 'bulletList' ? 'pl-bullet' : 'pl-number';
        out.push(...listBlocks(child, ctx, Math.min(level + 1, 2), nestedReference, ctx.nextListInstance++));
      } else if (child.type === 'paragraph' && first) {
        out.push(
          new Paragraph({
            children: inlineChildren(child.content, ctx),
            numbering: { reference, level, instance },
            alignment: alignmentOf(child),
          }),
        );
        first = false;
      } else {
        out.push(...blocks([child], ctx, { indentLevel: level + 1 }));
      }
    }
  }
  return out;
}

function taskBlocks(list: JSONContent, ctx: Context, depth: number): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of list.content ?? []) {
    const checked = Boolean(item.attrs?.checked);
    for (const child of item.content ?? []) {
      if (child.type === 'taskList') {
        out.push(...taskBlocks(child, ctx, depth + 1));
      } else if (child.type === 'paragraph') {
        out.push(
          new Paragraph({
            indent: { left: 360 * depth },
            children: [new TextRun({ text: checked ? '☒  ' : '☐  ' }), ...inlineChildren(child.content, ctx, { strike: checked })],
          }),
        );
      }
    }
  }
  return out;
}

function tableBlock(node: JSONContent, ctx: Context): Table {
  const rows = (node.content ?? []).map((row, rowIndex) => {
    const isHeaderRow = (row.content ?? []).every((cell) => cell.type === 'tableHeader');
    return new TableRow({
      tableHeader: rowIndex === 0 && isHeaderRow ? true : undefined,
      children: (row.content ?? []).map((cell) => {
        const header = cell.type === 'tableHeader';
        const content = blocks(cell.content ?? [], ctx, { bold: header });
        return new TableCell({
          children: content.length ? content : [new Paragraph('')],
          columnSpan: Number(cell.attrs?.colspan) > 1 ? Number(cell.attrs?.colspan) : undefined,
          rowSpan: Number(cell.attrs?.rowspan) > 1 ? Number(cell.attrs?.rowspan) : undefined,
          shading: header ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } : undefined,
        });
      }),
    });
  });
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function blocks(
  nodes: JSONContent[],
  ctx: Context,
  options: { indentLevel?: number; bold?: boolean; quote?: boolean } = {},
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const indent = options.quote
    ? { left: 567 }
    : options.indentLevel
      ? { left: 720 * options.indentLevel }
      : undefined;
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        out.push(
          new Paragraph({
            children: inlineChildren(node.content, ctx, { bold: options.bold }),
            alignment: alignmentOf(node),
            indent,
            border: options.quote ? { left: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 12 } } : undefined,
          }),
        );
        break;
      case 'heading': {
        const level = Number(node.attrs?.level ?? 1);
        const heading =
          level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
        out.push(new Paragraph({ heading, children: inlineChildren(node.content, ctx), alignment: alignmentOf(node) }));
        break;
      }
      case 'bulletList':
        out.push(...listBlocks(node, ctx, 0, 'pl-bullet', ctx.nextListInstance++));
        break;
      case 'orderedList':
        out.push(...listBlocks(node, ctx, 0, 'pl-number', ctx.nextListInstance++));
        break;
      case 'taskList':
        out.push(...taskBlocks(node, ctx, 0));
        break;
      case 'blockquote':
        out.push(...blocks(node.content ?? [], ctx, { ...options, quote: true }));
        break;
      case 'codeBlock': {
        const text = (node.content ?? []).map((child) => child.text ?? '').join('');
        for (const line of text.split('\n')) {
          out.push(
            new Paragraph({
              shading: { type: ShadingType.CLEAR, fill: 'F3F3F1', color: 'auto' },
              children: [new TextRun({ text: line, font: MONO_FONT, size: 19 })],
            }),
          );
        }
        break;
      }
      case 'horizontalRule':
        out.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 1 } },
            children: [],
          }),
        );
        break;
      case 'table':
        out.push(tableBlock(node, ctx));
        break;
      case 'image': {
        const run = imageRun(node, ctx);
        if (run) out.push(new Paragraph({ children: [run] }));
        break;
      }
      default:
        if (node.content) out.push(...blocks(node.content, ctx, options));
    }
  }
  return out;
}

function collectImageSources(node: JSONContent, found: Set<string>) {
  if (node.type === 'image' && typeof node.attrs?.src === 'string') found.add(node.attrs.src);
  for (const child of node.content ?? []) collectImageSources(child, found);
}

async function embedImage(src: string): Promise<EmbeddedImage | null> {
  try {
    const blob = await (await fetch(src)).blob();
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    if (blob.type === 'image/png' || blob.type === 'image/jpeg' || blob.type === 'image/gif') {
      bitmap.close();
      const type = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : 'jpg';
      return { data: new Uint8Array(await blob.arrayBuffer()), type, width, height };
    }
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const png = await canvas.convertToBlob({ type: 'image/png' });
    return { data: new Uint8Array(await png.arrayBuffer()), type: 'png', width, height };
  } catch {
    return null;
  }
}

export async function documentToDocx(doc: JSONContent, title: string): Promise<Uint8Array> {
  const sources = new Set<string>();
  collectImageSources(doc, sources);
  const images = new Map<string, EmbeddedImage>();
  await Promise.all(
    [...sources].map(async (src) => {
      const image = await embedImage(src);
      if (image) images.set(src, image);
    }),
  );

  const ctx: Context = { images, nextListInstance: 1 };
  const children = blocks(doc.content ?? [], ctx);

  const listLevels = (format: 'bullet' | 'number') =>
    [0, 1, 2].map((level) => ({
      level,
      format:
        format === 'bullet'
          ? LevelFormat.BULLET
          : [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level],
      text: format === 'bullet' ? ['•', '◦', '▪'][level] : `%${level + 1}.`,
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    }));

  const document = new Document({
    creator: 'Paperlight Prose',
    title,
    styles: {
      default: {
        document: { run: { font: BODY_FONT, size: 22, color: '222222' }, paragraph: { spacing: { after: 160, line: 300 } } },
        heading1: { run: { font: BODY_FONT, size: 44, bold: true, color: INK }, paragraph: { spacing: { before: 360, after: 160 } } },
        heading2: { run: { font: BODY_FONT, size: 32, bold: true, color: INK }, paragraph: { spacing: { before: 320, after: 120 } } },
        heading3: { run: { font: BODY_FONT, size: 26, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 100 } } },
        hyperlink: { run: { color: 'C2311A', underline: {} } },
      },
    },
    numbering: {
      config: [
        { reference: 'pl-bullet', levels: listLevels('bullet') },
        { reference: 'pl-number', levels: listLevels('number') },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: children.length ? children : [new Paragraph('')],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  return new Uint8Array(await blob.arrayBuffer());
}
