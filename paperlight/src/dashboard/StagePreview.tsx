import { FileText, Grid3x3 } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { colName, cellKey } from '../apps/cells/engine/address';
import { Calc } from '../apps/cells/engine/evaluate';
import { formatValue } from '../apps/cells/engine/format';
import { textColor } from '../apps/cells/Grid';
import { calcSource, colWidth, hasContent, type Workbook } from '../apps/cells/model';
import { themeOf, type Deck } from '../apps/deck/model';
import { SlideView } from '../apps/deck/SlideView';
import type { Page } from '../apps/jotbook/store';
import { folderOf } from '../lib/format';
import { useShell } from '../shell/ShellContext';
import type { WorkItem } from './work';
import '../editor/doc.css';

interface Box {
  width: number;
  height: number;
}

const PAGE_W = 794;
const PAGE_H = 1123;
const ROW_H = 28;
const ROW_HEAD_W = 44;
const EMPTY_PAGE =
  '<h1 class="pl-dash-ghost">Untitled document</h1><p class="pl-dash-ghost">Press New document to start writing. Pages, workbooks and decks show up on this stage too, as soon as you make them.</p>';

/** The slide that opens the deck, and the talk's shape as the presenting band under it. */
function DeckStage({ deck, box }: { deck: Deck; box: Box }) {
  const theme = themeOf(deck.theme);
  const width = Math.max(160, Math.floor(Math.min(box.width - 96, ((box.height - 72) * 16) / 9)));
  return (
    <div className="pl-dash-deck">
      <div className="pl-dash-slide">
        <SlideView slide={deck.slides[0]} theme={theme} index={0} count={deck.slides.length} deckTitle={deck.title} width={width} />
      </div>
      <div className="pl-dash-band" style={{ width }} aria-hidden="true">
        {deck.slides.map((slide, index) => (
          <span key={slide.id} style={{ flexGrow: Math.max(slide.seconds, 1) }} data-first={index === 0 || undefined} />
        ))}
      </div>
    </div>
  );
}

/** The document page, at a scale that keeps its body readable. */
function DocStage({ html, box }: { html: string; box: Box }) {
  const scale = Math.min(0.86, (box.width - 96) / PAGE_W);
  return (
    <div className="pl-dash-canvas">
      <div className="pl-dash-page-frame" style={{ width: Math.round(PAGE_W * scale), height: Math.round(PAGE_H * scale) }}>
        <div className="pl-dash-page pl-doc" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: html || '<p></p>' }} />
      </div>
    </div>
  );
}

/** The first sheet as the grid draws it: letters, row numbers, values in their formats. */
function SheetStage({ workbook, box }: { workbook: Workbook; box: Box }) {
  const dark = useShell().theme.resolved === 'dark';
  const sheet = workbook.sheets[0];
  const grid = useMemo(() => {
    const calc = new Calc(calcSource(workbook));
    const columns: { col: number; width: number }[] = [];
    let used = ROW_HEAD_W;
    for (let col = 0; col < 26; col += 1) {
      const width = colWidth(sheet, col);
      if (used + width > box.width - 2) break;
      columns.push({ col, width });
      used += width;
    }
    const rowCount = Math.max(1, Math.floor((box.height - ROW_H) / ROW_H));
    const rows = Array.from({ length: rowCount }, (_, row) =>
      columns.map(({ col }) => {
        const cell = sheet.cells[cellKey(row, col)];
        const value = hasContent(cell) ? calc.value(0, row, col) : null;
        return { cell, value, text: hasContent(cell) ? formatValue(value, cell?.s?.format) : '' };
      }),
    );
    return { columns, rows };
  }, [workbook, sheet, box.width, box.height]);

  return (
    <table className="pl-dash-sheet">
      <colgroup>
        <col style={{ width: ROW_HEAD_W }} />
        {grid.columns.map(({ col, width }) => (
          <col key={col} style={{ width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th aria-hidden="true" />
          {grid.columns.map(({ col }) => (
            <th key={col}>{colName(col)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grid.rows.map((line, row) => (
          <tr key={row}>
            <th>{row + 1}</th>
            {line.map(({ cell, value, text }, index) => {
              const style = cell?.s;
              const align = style?.align ?? (typeof value === 'number' ? 'right' : 'left');
              return (
                <td
                  key={index}
                  className={style?.fill ? 'has-fill' : undefined}
                  style={{
                    background: style?.fill,
                    color: style ? textColor(style, dark) : undefined,
                    fontWeight: style?.bold ? 700 : undefined,
                    fontStyle: style?.italic ? 'italic' : undefined,
                    textAlign: align,
                  }}
                >
                  {text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NoteStage({ page }: { page: Page }) {
  const edited = new Date(page.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="pl-dash-canvas">
      <article className="pl-dash-note">
        <h3 className="pl-dash-note-title">{page.title || 'Untitled page'}</h3>
        <p className="pl-dash-note-date">Edited {edited}</p>
        <div className="pl-doc" dangerouslySetInnerHTML={{ __html: page.html || '<p></p>' }} />
      </article>
    </div>
  );
}

/** A file known only by its path: Paperlight has not read it, so the stage says where it is rather than drawing it. */
function FileStage({ item }: { item: WorkItem }) {
  const Icon = item.app === 'cells' ? Grid3x3 : FileText;
  const type = (/\.[^.]+$/.exec(item.title)?.[0] ?? '').toLowerCase();
  const fullFolder = item.target.kind === 'file' ? folderOf(item.target.file.path) : item.place;
  return (
    <div className="pl-dash-file">
      <Icon aria-hidden="true" />
      <p className="pl-dash-file-name">A {type} file on this computer</p>
      <p className="pl-dash-file-place" title={fullFolder}>
        {item.place}
      </p>
      <p className="pl-dash-file-note">Paperlight reads it again when you open it, so you always see the saved version.</p>
    </div>
  );
}

/** What the stage shows for one piece of work, sized to the frame it sits in. */
export function StagePreview({ item }: { item: WorkItem | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setBox({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  let body: React.ReactNode = null;
  if (box && item) {
    const target = item.target;
    if (target.kind === 'deck') body = <DeckStage deck={target.deck} box={box} />;
    else if (target.kind === 'draft') body = <DocStage html={target.draft.html} box={box} />;
    else if (target.kind === 'cells-draft') body = <SheetStage workbook={target.draft.workbook} box={box} />;
    else if (target.kind === 'page') body = <NoteStage page={target.page} />;
    else body = <FileStage item={item} />;
  } else if (box) {
    body = <DocStage html={EMPTY_PAGE} box={box} />;
  }

  return (
    <div ref={ref} className="pl-dash-preview" data-kind={item?.target.kind ?? 'empty'}>
      {body}
    </div>
  );
}
