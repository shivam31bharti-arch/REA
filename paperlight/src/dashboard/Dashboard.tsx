import { ArrowRight, HardDrive, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatSeconds, themeOf, totalSeconds } from '../apps/deck/model';
import type { AppId } from '../lib/bridge';
import { relativeTime } from '../lib/format';
import { SUITE_APPS } from '../shell/apps';
import { useShell } from '../shell/ShellContext';
import { StagePreview } from './StagePreview';
import { loadWork, NO_WORK, type Work, type WorkItem } from './work';
import '../home/home.css';
import './dashboard.css';

interface DashboardProps {
  onOpen: (item: WorkItem) => void;
  onNew: (app: AppId) => void;
}

const APP_ORDER: AppId[] = ['prose', 'jotbook', 'cells', 'deck'];
const NAMES = Object.fromEntries(SUITE_APPS.map((app) => [app.id, app.name])) as Record<AppId, string>;
const NOUNS: Record<AppId, [string, string]> = {
  prose: ['document', 'documents'],
  jotbook: ['page', 'pages'],
  cells: ['workbook', 'workbooks'],
  deck: ['deck', 'decks'],
};
const NEW_LABELS: Record<AppId, string> = { prose: 'New document', jotbook: 'New page', cells: 'New workbook', deck: 'New deck' };
/** How long the pointer rests on an item before it takes the stage. */
const DWELL_MS = 300;

const count = (n: number, app: AppId) => `${n.toLocaleString()} ${NOUNS[app][n === 1 ? 0 : 1]}`;

interface Figure {
  label: string;
  value: string;
  /** Numbers and times set in mono; words stay Geist. */
  figure: boolean;
}

function figuresFor(item: WorkItem): Figure[] {
  const target = item.target;
  if (target.kind === 'deck') {
    return [
      { label: 'Slides', value: String(target.deck.slides.length).padStart(2, '0'), figure: true },
      { label: 'Planned', value: formatSeconds(totalSeconds(target.deck)), figure: true },
      { label: 'Theme', value: themeOf(target.deck.theme).name, figure: false },
    ];
  }
  if (target.kind === 'draft') {
    return [
      { label: 'Words', value: (item.amount ?? 0).toLocaleString(), figure: true },
      { label: 'Reading', value: `${Math.max(1, Math.round((item.amount ?? 0) / 230))} min`, figure: true },
      { label: 'File', value: target.draft.filePath ? 'Unsaved changes' : 'Not saved to a file yet', figure: false },
    ];
  }
  if (target.kind === 'cells-draft') {
    const sheets = target.draft.workbook.sheets;
    return [
      { label: 'Sheets', value: String(sheets.length).padStart(2, '0'), figure: true },
      { label: 'Rows', value: (item.amount ?? 0).toLocaleString(), figure: true },
      { label: 'Charts', value: String(sheets.reduce((sum, sheet) => sum + sheet.charts.length, 0)), figure: true },
      { label: 'File', value: target.draft.filePath ? 'Unsaved changes' : 'Not saved to a file yet', figure: false },
    ];
  }
  if (target.kind === 'page') {
    return [
      { label: 'Notebook', value: target.notebook, figure: false },
      { label: 'Section', value: target.section, figure: false },
      { label: 'Words', value: (item.amount ?? 0).toLocaleString(), figure: true },
    ];
  }
  return [
    { label: 'Type', value: (/\.[^.]+$/.exec(item.title)?.[0] ?? '').toLowerCase(), figure: false },
    { label: 'Opened', value: relativeTime(item.time), figure: false },
  ];
}

/** One line under a title: where it lives and when it was last touched. */
function detailOf(item: WorkItem) {
  const parts = [item.amountLabel ?? item.place, relativeTime(item.time)];
  if (item.draft && item.app !== 'jotbook' && item.app !== 'deck') parts.splice(1, 0, 'draft');
  return parts.join(' · ');
}

export function Dashboard({ onOpen, onNew }: DashboardProps) {
  const { openPalette } = useShell();
  const [work, setWork] = useState<Work | null>(null);
  const [stageKey, setStageKey] = useState<string | null>(null);
  const dwell = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadWork()
      .then((next) => !cancelled && setWork(next))
      .catch(() => !cancelled && setWork(NO_WORK));
    return () => {
      cancelled = true;
      window.clearTimeout(dwell.current);
    };
  }, []);

  const items = work?.items ?? [];
  // The stage opens on the newest work that can be drawn; a file only known by its path waits in the lists.
  const latest = useMemo(() => items.find((item) => item.target.kind !== 'file') ?? items[0] ?? null, [items]);
  const staged = items.find((item) => item.key === stageKey) ?? latest;
  const leadApp: AppId = latest?.app ?? 'prose';
  // The strips follow the latest work, not the stage, so nothing moves under the pointer while browsing.
  const sideApps = APP_ORDER.filter((app) => app !== leadApp);
  const byApp = useMemo(() => {
    const map = { prose: [], jotbook: [], cells: [], deck: [] } as Record<AppId, WorkItem[]>;
    for (const item of items) map[item.app].push(item);
    return map;
  }, [items]);
  const inStrips = new Set(sideApps.flatMap((app) => byApp[app].slice(0, 3).map((item) => item.key)));
  const more = items.filter((item) => item !== latest && !inStrips.has(item.key)).slice(0, 8);

  const point = (key: string) => {
    window.clearTimeout(dwell.current);
    dwell.current = window.setTimeout(() => setStageKey(key), DWELL_MS);
  };
  const leave = () => window.clearTimeout(dwell.current);
  const itemEvents = (item: WorkItem) => ({
    onPointerEnter: () => point(item.key),
    onPointerLeave: leave,
    onFocus: () => setStageKey(item.key),
    onClick: () => onOpen(item),
    'aria-current': staged?.key === item.key ? ('true' as const) : undefined,
  });

  const isLatest = staged !== null && staged === latest;
  const title = staged ? staged.title : 'Nothing to continue yet';
  const meta = staged
    ? `${NAMES[staged.app]} · ${staged.target.kind === 'deck' ? staged.place : staged.target.kind === 'page' ? `${staged.target.notebook} / ${staged.target.section}` : staged.amountLabel ?? staged.place} · ${staged.target.kind === 'file' ? 'opened' : 'edited'} ${relativeTime(staged.time)}`
    : 'Start a document, a page, a workbook or a deck.';
  const total = items.length;

  return (
    <div className="pl-dash">
      <header className="pl-topbar pl-drag">
        <span className="pl-topbar-title">Dashboard</span>
        <button type="button" className="pl-search-pill" onClick={openPalette}>
          <Search aria-hidden="true" />
          <span className="pl-search-label">Search commands</span>
          <kbd>Ctrl K</kbd>
        </button>
      </header>

      <div className="pl-dash-scroll">
        <h1 className="pl-visually-hidden">Dashboard</h1>
        <div className="pl-home-grid pl-dash-grid" aria-busy={work === null}>
          <section className="pl-dash-stage" aria-labelledby="pl-dash-stage-title" data-app={staged?.app ?? 'prose'}>
            <header className="pl-dash-stage-head">
              <div className="pl-dash-stage-text">
                <h2 id="pl-dash-stage-title" className="pl-dash-title">
                  {work === null ? ' ' : title}
                </h2>
                <p className="pl-dash-meta">
                  {staged && <span className="pl-dash-swatch" data-app={staged.app} aria-hidden="true" />}
                  {work === null ? 'Reading your work…' : meta}
                </p>
              </div>
              <div className="pl-dash-stage-actions">
                {staged && !isLatest && (
                  <button type="button" className="pl-btn" onClick={() => setStageKey(null)}>
                    Back to latest
                  </button>
                )}
                {work !== null && (
                  <button type="button" className="pl-btn pl-btn--primary pl-dash-go" onClick={() => (staged ? onOpen(staged) : onNew('prose'))}>
                    {staged ? `${isLatest && staged.target.kind !== 'file' ? 'Continue' : 'Open'} in ${NAMES[staged.app]}` : NEW_LABELS.prose}
                    <ArrowRight aria-hidden="true" />
                  </button>
                )}
              </div>
            </header>

            <div className="pl-dash-frame" data-app={staged?.app ?? 'prose'}>
              {work !== null && <StagePreview key={staged?.key ?? 'empty'} item={staged} />}
            </div>

            {staged && (
              <div className="pl-dash-figures">
                <dl>
                  {figuresFor(staged).map((entry) => (
                    <div key={entry.label}>
                      <dt>{entry.label}</dt>
                      <dd className={entry.figure ? 'pl-dash-fig' : undefined}>{entry.value}</dd>
                    </div>
                  ))}
                </dl>
                {staged.app === leadApp && (
                  <button type="button" className="pl-btn pl-btn--outline" onClick={() => onNew(staged.app)}>
                    <Plus aria-hidden="true" />
                    {NEW_LABELS[staged.app]}
                  </button>
                )}
              </div>
            )}
          </section>

          <div className="pl-dash-apps">
            {sideApps.map((app) => {
              const list = byApp[app];
              return (
                <section key={app} className="pl-dash-app" data-app={app} aria-labelledby={`pl-dash-app-${app}`}>
                  <div className="pl-dash-field">
                    <h2 id={`pl-dash-app-${app}`} className="pl-dash-field-name">
                      {NAMES[app]}
                    </h2>
                    <span className="pl-dash-field-count">{work === null ? ' ' : count(work.totals[app].count, app)}</span>
                    <button type="button" className="pl-dash-new" onClick={() => onNew(app)} aria-label={NEW_LABELS[app]}>
                      <Plus aria-hidden="true" />
                      New
                    </button>
                  </div>
                  <ul className="pl-dash-list">
                    {work !== null && list.length === 0 && <li className="pl-dash-none">No {NOUNS[app][1]} yet</li>}
                    {list.slice(0, 3).map((item) => (
                      <li key={item.key}>
                        <button type="button" className="pl-dash-item" {...itemEvents(item)}>
                          <span className="pl-dash-item-name">{item.title}</span>
                          <span className="pl-dash-item-detail">{detailOf(item)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {more.length > 0 && (
            <section className="pl-dash-more" aria-labelledby="pl-dash-more-heading">
              <h2 id="pl-dash-more-heading" className="pl-home-h2">
                Also recent
              </h2>
              <ul className="pl-dash-more-list">
                {more.map((item) => (
                  <li key={item.key}>
                    <button type="button" className="pl-dash-item pl-dash-item--row" {...itemEvents(item)}>
                      <span className="pl-dash-swatch" data-app={item.app} role="img" aria-label={NAMES[item.app]} />
                      <span className="pl-dash-item-text">
                        <span className="pl-dash-item-name">{item.title}</span>
                        <span className="pl-dash-item-detail">{detailOf(item)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <footer className="pl-statusbar">
        <span className="pl-status-fig">{work === null ? 'Reading…' : `${total.toLocaleString()} ${total === 1 ? 'piece' : 'pieces'} of work`}</span>
        {work !== null &&
          APP_ORDER.map((app) => (
            <span key={app} className="pl-status-fig pl-dash-status-app">
              {NAMES[app]} {work.totals[app].count}
            </span>
          ))}
        <span className="pl-status-end">
          <span className="pl-status-local">
            <HardDrive aria-hidden="true" />
            Stored on this computer
          </span>
        </span>
      </footer>
    </div>
  );
}
