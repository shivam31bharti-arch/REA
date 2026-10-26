import { listCellsDrafts, type CellsDraft } from '../apps/cells/files';
import { sheetExtent } from '../apps/cells/model';
import { formatSeconds, totalSeconds, type Deck } from '../apps/deck/model';
import { loadDecks } from '../apps/deck/store';
import { loadLibrary, type Library, type Page } from '../apps/jotbook/store';
import type { Selection } from '../apps/jotbook/useLibrary';
import { bridge, type AppId, type RecentFile } from '../lib/bridge';
import { countWords, folderOf } from '../lib/format';
import { listDrafts, type Draft } from '../lib/library';

/** Where a piece of work opens. */
export type WorkTarget =
  | { kind: 'file'; file: RecentFile }
  | { kind: 'draft'; draft: Draft }
  | { kind: 'cells-draft'; draft: CellsDraft }
  | { kind: 'deck'; deck: Deck }
  | { kind: 'page'; selection: Selection; page: Page; notebook: string; section: string };

export interface WorkItem {
  key: string;
  app: AppId;
  title: string;
  /** Where it lives: a folder, a notebook and section, or "kept on this computer". */
  place: string;
  time: number;
  /** How much of it there is, for the length bar; null when the file has not been read. */
  amount: number | null;
  amountLabel: string | null;
  draft: boolean;
  target: WorkTarget;
}

export interface AppTotals {
  count: number;
  amount: number;
}

export interface Work {
  items: WorkItem[];
  totals: Record<AppId, AppTotals>;
  notebooks: number;
}

export const NO_WORK: Work = {
  items: [],
  totals: { prose: { count: 0, amount: 0 }, cells: { count: 0, amount: 0 }, deck: { count: 0, amount: 0 }, jotbook: { count: 0, amount: 0 } },
  notebooks: 0,
};

/** A folder short enough for one line: the drive, then the last two folders ("C:\…\Videos\Scripts"). */
export function shortFolder(filePath: string) {
  const parts = folderOf(filePath).split('\\').filter(Boolean);
  return parts.length > 3 ? `${parts[0]}\\…\\${parts.slice(-2).join('\\')}` : parts.join('\\');
}

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function cellsRows(draft: CellsDraft) {
  return draft.workbook.sheets.reduce((sum, sheet) => sum + sheetExtent(sheet).rows, 0);
}

/** Everything made in the four apps, newest first, read from this computer only. */
export async function loadWork(): Promise<Work> {
  const [recent, decks, library] = await Promise.all([
    bridge.listRecent().catch(() => [] as RecentFile[]),
    loadDecks().catch(() => [] as Deck[]),
    loadLibrary().catch((): Library => ({ notebooks: [], sections: [], pages: [] })),
  ]);
  const drafts = listDrafts();
  const cellsDrafts = listCellsDrafts();
  const draftPaths = new Set([...drafts, ...cellsDrafts].map((draft) => draft.filePath).filter(Boolean));
  const items: WorkItem[] = [];

  for (const draft of drafts) {
    const words = countWords(plain(draft.html));
    items.push({
      key: `draft-${draft.id}`,
      app: 'prose',
      title: draft.title || 'Untitled',
      place: draft.filePath ? shortFolder(draft.filePath) : 'Kept on this computer',
      time: draft.updatedAt,
      amount: words,
      amountLabel: plural(words, 'word'),
      draft: true,
      target: { kind: 'draft', draft },
    });
  }

  for (const draft of cellsDrafts) {
    const rows = cellsRows(draft);
    items.push({
      key: `cells-draft-${draft.id}`,
      app: 'cells',
      title: draft.title || 'Untitled workbook',
      place: draft.filePath ? shortFolder(draft.filePath) : 'Kept on this computer',
      time: draft.updatedAt,
      amount: rows,
      amountLabel: plural(rows, 'row'),
      draft: true,
      target: { kind: 'cells-draft', draft },
    });
  }

  for (const file of recent) {
    if (draftPaths.has(file.path)) continue;
    const app: AppId = file.app === 'cells' || /\.(xlsx|csv)$/i.test(file.name) ? 'cells' : 'prose';
    items.push({
      key: `file-${file.path}`,
      app,
      title: file.name,
      place: shortFolder(file.path),
      time: file.openedAt,
      amount: null,
      amountLabel: null,
      draft: false,
      target: { kind: 'file', file },
    });
  }

  for (const deck of decks) {
    const seconds = totalSeconds(deck);
    items.push({
      key: `deck-${deck.id}`,
      app: 'deck',
      title: deck.title || 'Untitled deck',
      place: plural(deck.slides.length, 'slide'),
      time: deck.updatedAt,
      amount: seconds,
      amountLabel: `${formatSeconds(seconds)} talk`,
      draft: false,
      target: { kind: 'deck', deck },
    });
  }

  const sections = new Map(library.sections.map((section) => [section.id, section]));
  const notebooks = new Map(library.notebooks.map((notebook) => [notebook.id, notebook]));
  for (const page of library.pages) {
    const section = sections.get(page.sectionId);
    const notebook = section ? notebooks.get(section.notebookId) : undefined;
    if (!section || !notebook) continue;
    const words = countWords(page.text);
    items.push({
      key: `page-${page.id}`,
      app: 'jotbook',
      title: page.title || 'Untitled page',
      place: `${notebook.name} / ${section.name}`,
      time: page.updatedAt,
      amount: words,
      amountLabel: plural(words, 'word'),
      draft: false,
      target: { kind: 'page', selection: { notebookId: notebook.id, sectionId: section.id, pageId: page.id }, page, notebook: notebook.name, section: section.name },
    });
  }

  items.sort((a, b) => b.time - a.time);
  const totals = { prose: { count: 0, amount: 0 }, cells: { count: 0, amount: 0 }, deck: { count: 0, amount: 0 }, jotbook: { count: 0, amount: 0 } };
  for (const item of items) {
    totals[item.app].count += 1;
    totals[item.app].amount += item.amount ?? 0;
  }
  return { items, totals, notebooks: library.notebooks.length };
}
