import type { Editor } from '@tiptap/core';
import { countWords } from '../../lib/format';

export interface OutlineEntry {
  pos: number;
  level: number;
  text: string;
  /** 'title' sits above the numbered level, 'section' is numbered, 'sub' is nested below. */
  kind: 'title' | 'section' | 'sub';
  number: number | null;
  words: number;
  share: number;
  current: boolean;
}

/**
 * Numbers the highest heading level that repeats, so a single H1 title above
 * H2 sections reads as a title followed by 01, 02, 03.
 */
export function computeOutline(editor: Editor): OutlineEntry[] {
  const { doc, selection } = editor.state;
  const headings: { pos: number; level: number; text: string }[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === 'heading') {
      headings.push({ pos: offset, level: Number(node.attrs.level), text: node.textContent.trim() });
    }
  });
  if (headings.length === 0) return [];

  const counts = new Map<number, number>();
  for (const heading of headings) counts.set(heading.level, (counts.get(heading.level) ?? 0) + 1);
  const levels = [...counts.keys()].sort((a, b) => a - b);
  const numberedLevel = levels.find((level) => (counts.get(level) ?? 0) >= 2) ?? levels[0];

  let sectionNumber = 0;
  const entries: OutlineEntry[] = headings.map((heading, index) => {
    const kind: OutlineEntry['kind'] =
      heading.level < numberedLevel ? 'title' : heading.level === numberedLevel ? 'section' : 'sub';
    const next = headings.slice(index + 1).find((candidate) =>
      kind === 'sub' ? true : candidate.level <= Math.max(heading.level, numberedLevel),
    );
    const end = next ? next.pos : doc.content.size;
    const words = countWords(doc.textBetween(heading.pos, end, ' ', ' '));
    if (kind === 'section') sectionNumber += 1;
    return {
      pos: heading.pos,
      level: heading.level,
      text: heading.text,
      kind,
      number: kind === 'section' ? sectionNumber : null,
      words,
      share: 0,
      current: false,
    };
  });

  const longest = Math.max(1, ...entries.filter((entry) => entry.kind === 'section').map((entry) => entry.words));
  for (const entry of entries) entry.share = entry.kind === 'section' ? entry.words / longest : 0;

  const cursor = selection.from;
  const lastSection = [...entries].reverse().find((entry) => entry.kind === 'section' && entry.pos <= cursor);
  if (lastSection) lastSection.current = true;
  const lastSub = [...entries].reverse().find((entry) => entry.pos <= cursor);
  if (lastSub && lastSub.kind === 'sub') lastSub.current = true;
  return entries;
}
