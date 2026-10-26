import { ArrowRight, FolderOpen, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cellKey } from '../apps/cells/engine/address';
import { Calc } from '../apps/cells/engine/evaluate';
import { formatValue } from '../apps/cells/engine/format';
import { listCellsDrafts, type CellsDraft } from '../apps/cells/files';
import { calcSource, hasContent, sheetExtent } from '../apps/cells/model';
import { CELLS_TEMPLATES, type CellsTemplate } from '../apps/cells/templates';
import { themeOf } from '../apps/deck/model';
import { SlideView } from '../apps/deck/SlideView';
import { loadDecks } from '../apps/deck/store';
import { DECK_TEMPLATES, type DeckTemplate } from '../apps/deck/templates';
import { bridge, type AppId, type RecentFile } from '../lib/bridge';
import { folderOf, relativeTime } from '../lib/format';
import { listDrafts, type Draft } from '../lib/library';
import { SUITE_APPS } from '../shell/apps';
import { useShell } from '../shell/ShellContext';
import { TEMPLATES, type Template } from './templates';
import '../editor/doc.css';
import './home.css';

interface HomeProps {
  onNewDocument: (template?: Template) => void;
  onOpenDocument: () => void;
  onNewWorkbook: (template?: CellsTemplate) => void;
  /** A deck id, or "template:<id>" for a new deck. */
  onOpenDeck: (open: string) => void;
  onOpenRecent: (entry: RecentFile) => void;
  onOpenDraft: (draft: Draft) => void;
  onOpenCellsDraft: (draft: CellsDraft) => void;
  onOpenApp: (app: AppId) => void;
}

type ShelfEntry =
  | { kind: 'file'; key: string; app: AppId; name: string; detail: string; time: number; file: RecentFile }
  | { kind: 'draft'; key: string; app: 'prose'; name: string; detail: string; time: number; draft: Draft }
  | { kind: 'cells-draft'; key: string; app: 'cells'; name: string; detail: string; time: number; draft: CellsDraft }
  | { kind: 'deck'; key: string; app: 'deck'; name: string; detail: string; time: number; deckId: string };

/** A deck template as its first two slides, stacked like a deck on a page. */
function DeckThumb({ template }: { template: DeckTemplate }) {
  const deck = useMemo(() => template.build(), [template]);
  const theme = themeOf(deck.theme);
  return (
    <span className="pl-template-deck">
      {deck.slides.slice(0, 2).map((slide, index) => (
        <SlideView key={slide.id} slide={slide} theme={theme} index={index} count={deck.slides.length} deckTitle={deck.title} width={66} />
      ))}
    </span>
  );
}

function draftDetail(filePath: string | null) {
  return filePath ? `Unsaved changes · ${filePath}` : 'Unsaved draft · kept on this computer';
}

/** A spreadsheet template drawn as a scaled-down sheet of its first rows. */
function SheetThumb({ template }: { template: CellsTemplate }) {
  const rows = useMemo(() => {
    const book = template.build();
    const sheet = book.sheets[0];
    const calc = new Calc(calcSource(book));
    const extent = sheetExtent(sheet);
    const out: { text: string; bold: boolean; right: boolean }[][] = [];
    for (let row = 0; row < Math.max(16, Math.min(extent.rows, 18)); row += 1) {
      const line = [];
      for (let col = 0; col < 4; col += 1) {
        const cell = sheet.cells[cellKey(row, col)];
        const value = hasContent(cell) ? calc.value(0, row, col) : null;
        line.push({ text: hasContent(cell) ? formatValue(value, cell?.s?.format) : '', bold: !!cell?.s?.bold, right: typeof value === 'number' });
      }
      out.push(line);
    }
    return out;
  }, [template]);

  return (
    <span className="pl-template-page pl-template-grid">
      <table>
        <tbody>
          {rows.map((line, r) => (
            <tr key={r}>
              {line.map((cell, c) => (
                <td key={c} style={{ fontWeight: cell.bold ? 700 : undefined, textAlign: cell.right ? 'right' : undefined }}>
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </span>
  );
}

export function Home({ onNewDocument, onOpenDocument, onNewWorkbook, onOpenDeck, onOpenRecent, onOpenDraft, onOpenCellsDraft, onOpenApp }: HomeProps) {
  const { openPalette } = useShell();
  const [shelf, setShelf] = useState<ShelfEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const recent = await bridge.listRecent().catch(() => []);
      const decks = await loadDecks().catch(() => []);
      const entries: ShelfEntry[] = [
        ...decks.slice(0, 3).map<ShelfEntry>((deck) => ({
          kind: 'deck',
          key: `deck-${deck.id}`,
          app: 'deck',
          name: deck.title || 'Untitled deck',
          detail: `${deck.slides.length} ${deck.slides.length === 1 ? 'slide' : 'slides'} · stored on this computer`,
          time: deck.updatedAt,
          deckId: deck.id,
        })),
        ...listDrafts().map<ShelfEntry>((draft) => ({
          kind: 'draft',
          key: `draft-${draft.id}`,
          app: 'prose',
          name: draft.title || 'Untitled',
          detail: draftDetail(draft.filePath),
          time: draft.updatedAt,
          draft,
        })),
        ...listCellsDrafts().map<ShelfEntry>((draft) => ({
          kind: 'cells-draft',
          key: `cells-draft-${draft.id}`,
          app: 'cells',
          name: draft.title || 'Untitled workbook',
          detail: draftDetail(draft.filePath),
          time: draft.updatedAt,
          draft,
        })),
        ...recent.map<ShelfEntry>((file) => ({
          kind: 'file',
          key: `file-${file.path}`,
          app: file.app === 'cells' || /\.xlsx$/i.test(file.name) ? 'cells' : 'prose',
          name: file.name,
          detail: folderOf(file.path),
          time: file.openedAt,
          file,
        })),
      ].sort((a, b) => b.time - a.time);
      if (!cancelled) setShelf(entries.slice(0, 6));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const others = SUITE_APPS.filter((app) => app.id !== 'prose');

  const openEntry = (entry: ShelfEntry) => {
    if (entry.kind === 'file') onOpenRecent(entry.file);
    else if (entry.kind === 'draft') onOpenDraft(entry.draft);
    else if (entry.kind === 'deck') onOpenDeck(entry.deckId);
    else onOpenCellsDraft(entry.draft);
  };

  return (
    <div className="pl-home">
      <header className="pl-topbar pl-drag">
        <span className="pl-topbar-title">Home</span>
        <button type="button" className="pl-search-pill" onClick={openPalette}>
          <Search aria-hidden="true" />
          <span className="pl-search-label">Search commands</span>
          <kbd>Ctrl K</kbd>
        </button>
      </header>

      <div className="pl-home-scroll">
        <div className="pl-home-grid">
          <h1 className="pl-home-title">Paperlight</h1>
          <p className="pl-home-lede">Four apps on one quiet desk. Everything you make stays on this computer.</p>

          <section className="pl-field pl-field--prose" aria-labelledby="pl-field-prose">
            <h2 id="pl-field-prose" className="pl-field-name">
              Prose
            </h2>
            <p className="pl-field-role">Documents, scripts, letters and reports. Opens and saves .docx, exports PDF.</p>
            <div className="pl-field-actions">
              <button type="button" className="pl-field-btn pl-field-btn--solid" onClick={() => onNewDocument()}>
                <Plus aria-hidden="true" />
                New document
              </button>
              <button type="button" className="pl-field-btn" onClick={onOpenDocument}>
                <FolderOpen aria-hidden="true" />
                Open…
              </button>
            </div>
          </section>

          <div className="pl-home-side">
            <section className="pl-home-templates" aria-labelledby="pl-templates-heading">
              <h2 id="pl-templates-heading" className="pl-home-h2">
                Start from a template
              </h2>
              <ul className="pl-templates">
                {TEMPLATES.map((template) => (
                  <li key={template.id}>
                    <button type="button" className="pl-template" onClick={() => onNewDocument(template)} title={template.description}>
                      <span className="pl-template-sheet" aria-hidden="true">
                        <span
                          className="pl-template-page pl-doc"
                          dangerouslySetInnerHTML={{ __html: template.html || '<p>&nbsp;</p>' }}
                        />
                      </span>
                      <span className="pl-template-name">{template.name}</span>
                    </button>
                  </li>
                ))}
                {CELLS_TEMPLATES.map((template, index) => (
                  <li key={`cells-${template.id}`} className={index === 0 ? 'pl-templates-break' : undefined}>
                    <button type="button" className="pl-template pl-template--cells" onClick={() => onNewWorkbook(template)} title={template.description}>
                      <span className="pl-template-sheet" aria-hidden="true">
                        <SheetThumb template={template} />
                      </span>
                      <span className="pl-template-name">{template.name}</span>
                    </button>
                  </li>
                ))}
                {DECK_TEMPLATES.map((template, index) => (
                  <li key={`deck-${template.id}`} className={index === 0 ? 'pl-templates-break' : undefined}>
                    <button type="button" className="pl-template pl-template--deck" onClick={() => onOpenDeck(`template:${template.id}`)} title={template.description}>
                      <span className="pl-template-sheet" aria-hidden="true">
                        <DeckThumb template={template} />
                      </span>
                      <span className="pl-template-name">{template.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="pl-home-recent" aria-labelledby="pl-recent-heading">
              <h2 id="pl-recent-heading" className="pl-home-h2">
                Recent
              </h2>
              {shelf === null ? null : shelf.length === 0 ? (
                <p className="pl-home-empty">Nothing yet. Files you open, save or start will appear here.</p>
              ) : (
                <ul className="pl-shelf">
                  {shelf.map((entry) => (
                    <li key={entry.key}>
                      <button type="button" className="pl-shelf-row" onClick={() => openEntry(entry)}>
                        <span
                          className="pl-shelf-swatch"
                          data-app={entry.app}
                          aria-label={entry.app === 'cells' ? 'Cells workbook' : entry.app === 'deck' ? 'Deck presentation' : 'Prose document'}
                        />
                        <span className="pl-shelf-text">
                          <span className="pl-shelf-name">{entry.name}</span>
                          <span className="pl-shelf-detail">{entry.detail}</span>
                        </span>
                        {(entry.kind === 'draft' || entry.kind === 'cells-draft') && (
                          <span className="pl-stamp" data-kind="unsaved">
                            Draft
                          </span>
                        )}
                        <span className="pl-shelf-time">{relativeTime(entry.time)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="pl-home-later">
            {others.map((app) =>
              app.ready ? (
                <button
                  key={app.id}
                  type="button"
                  className={`pl-field pl-field--${app.id} pl-field--later pl-field--ready`}
                  onClick={() => onOpenApp(app.id)}
                >
                  <span className="pl-field-name pl-field-name--small">{app.name}</span>
                  <span className="pl-field-role">{app.role}</span>
                  <span className="pl-field-status">
                    {app.status}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </button>
              ) : (
                <section key={app.id} className={`pl-field pl-field--${app.id} pl-field--later`} aria-label={`${app.name}, ${app.status}`}>
                  <h2 className="pl-field-name pl-field-name--small">{app.name}</h2>
                  <p className="pl-field-role">{app.role}</p>
                  <span className="pl-field-status">{app.status}</span>
                </section>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
