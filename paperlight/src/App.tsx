import { useCallback, useMemo, useState } from 'react';
import { Cells } from './apps/cells/Cells';
import { bookFromDraft, bookFromFile, pickWorkbookFile, type CellsDoc, type CellsDraft } from './apps/cells/files';
import { blankBook, type CellsTemplate } from './apps/cells/templates';
import { Deck } from './apps/deck/Deck';
import { Jotbook } from './apps/jotbook/Jotbook';
import { rememberJotbookPage } from './apps/jotbook/useLibrary';
import { Prose } from './apps/prose/Prose';
import { Dashboard } from './dashboard/Dashboard';
import type { WorkItem } from './dashboard/work';
import { Home } from './home/Home';
import type { Template } from './home/templates';
import { bridge, type AppId, type OpenedFile, type RecentFile } from './lib/bridge';
import { CommandRegistry, CommandRegistryContext } from './lib/commands';
import { blankDoc, docFromDraft, docFromFile, pickDocx, type ProseDoc } from './lib/documents';
import type { Draft } from './lib/library';
import { useTheme } from './lib/theme';
import { ErrorBoundary } from './shell/ErrorBoundary';
import { Shell } from './shell/Shell';
import { useShell } from './shell/ShellContext';
import './ui/ui.css';

type Route =
  | { view: 'home' }
  | { view: 'dashboard' }
  | { view: 'prose'; doc: ProseDoc }
  | { view: 'cells'; doc: CellsDoc }
  /** A deck id, "template:<id>" for a new deck from a template, or null for the last deck. */
  | { view: 'deck'; open: string | null; key: number }
  /** newPage starts a page in the current section as Jotbook opens. */
  | { view: 'jotbook'; newPage?: boolean };

const AREA_NAMES = { home: 'Home', dashboard: 'Dashboard', prose: 'Prose', cells: 'Cells', deck: 'Deck', jotbook: 'Jotbook' } as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Which app a file belongs to, from the recent list or its extension. */
function appForFile(entry: { name: string; app?: AppId }): AppId {
  if (entry.app === 'cells' || /\.(xlsx|csv)$/i.test(entry.name)) return 'cells';
  return 'prose';
}

export function App() {
  const registry = useMemo(() => new CommandRegistry(), []);
  const theme = useTheme();
  const [route, setRoute] = useState<Route>({ view: 'home' });

  const goHome = useCallback(() => setRoute({ view: 'home' }), []);
  const goDashboard = useCallback(() => setRoute({ view: 'dashboard' }), []);
  const openApp = useCallback((app: AppId) => {
    if (app === 'prose') setRoute((current) => (current.view === 'prose' ? current : { view: 'prose', doc: blankDoc() }));
    if (app === 'cells') setRoute((current) => (current.view === 'cells' ? current : { view: 'cells', doc: blankBook() }));
    if (app === 'deck') setRoute((current) => (current.view === 'deck' ? current : { view: 'deck', open: null, key: Date.now() }));
    if (app === 'jotbook') setRoute({ view: 'jotbook' });
  }, []);

  return (
    <CommandRegistryContext.Provider value={registry}>
      <Shell current={route.view} theme={theme} onHome={goHome} onDashboard={goDashboard} onOpenApp={openApp}>
        <ErrorBoundary key={route.view} area={AREA_NAMES[route.view]} onHome={goHome}>
          <Routes route={route} setRoute={setRoute} onOpenApp={openApp} />
        </ErrorBoundary>
      </Shell>
    </CommandRegistryContext.Provider>
  );
}

function Routes({
  route,
  setRoute,
  onOpenApp,
}: {
  route: Route;
  setRoute: (route: Route) => void;
  onOpenApp: (app: AppId) => void;
}) {
  const shell = useShell();

  const openProseFile = useCallback(
    async (file: OpenedFile) => {
      const { doc, warnings } = await docFromFile(file);
      setRoute({ view: 'prose', doc });
      if (file.path) void bridge.addRecent({ path: file.path, name: file.name, app: 'prose', openedAt: Date.now() });
      if (warnings.length > 0) shell.toast('Opened. Some formatting from the original file was simplified.');
    },
    [setRoute, shell],
  );

  const openCellsFile = useCallback(
    async (file: OpenedFile) => {
      const { doc, warnings } = await bookFromFile(file);
      setRoute({ view: 'cells', doc });
      if (file.path && /\.xlsx$/i.test(file.name)) void bridge.addRecent({ path: file.path, name: file.name, app: 'cells', openedAt: Date.now() });
      if (/\.csv$/i.test(file.name)) shell.toast('Opened the CSV. Saving makes a new .xlsx workbook.');
      else if (warnings.length > 0) shell.toast(`Opened. ${warnings.join(' ')}`);
    },
    [setRoute, shell],
  );

  const openDocument = useCallback(async () => {
    try {
      const file = await pickDocx();
      if (file) await openProseFile(file);
    } catch (error) {
      shell.toast(`Couldn't open the document: ${errorMessage(error)}`, 'error');
    }
  }, [openProseFile, shell]);

  const openWorkbook = useCallback(async () => {
    try {
      const file = await pickWorkbookFile();
      if (file) await openCellsFile(file);
    } catch (error) {
      shell.toast(`Couldn't open the workbook: ${errorMessage(error)}`, 'error');
    }
  }, [openCellsFile, shell]);

  const openRecent = useCallback(
    async (entry: RecentFile) => {
      try {
        const file = await bridge.readFile(entry.path);
        if (appForFile(entry) === 'cells') await openCellsFile(file);
        else await openProseFile(file);
      } catch (error) {
        shell.toast(`Couldn't open ${entry.name}: ${errorMessage(error)}`, 'error');
      }
    },
    [openCellsFile, openProseFile, shell],
  );

  const newDocument = useCallback((template?: Template) => setRoute({ view: 'prose', doc: blankDoc(template) }), [setRoute]);
  const openDraft = useCallback((draft: Draft) => setRoute({ view: 'prose', doc: docFromDraft(draft) }), [setRoute]);
  const newWorkbook = useCallback((template?: CellsTemplate) => setRoute({ view: 'cells', doc: blankBook(template) }), [setRoute]);
  const openCellsDraft = useCallback((draft: CellsDraft) => setRoute({ view: 'cells', doc: bookFromDraft(draft) }), [setRoute]);
  const openDeck = useCallback((open: string) => setRoute({ view: 'deck', open, key: Date.now() }), [setRoute]);

  const openWork = useCallback(
    (item: WorkItem) => {
      const target = item.target;
      if (target.kind === 'file') void openRecent(target.file);
      else if (target.kind === 'draft') openDraft(target.draft);
      else if (target.kind === 'cells-draft') openCellsDraft(target.draft);
      else if (target.kind === 'deck') openDeck(target.deck.id);
      else {
        rememberJotbookPage(target.selection);
        setRoute({ view: 'jotbook' });
      }
    },
    [openRecent, openDraft, openCellsDraft, openDeck, setRoute],
  );

  const newWork = useCallback(
    (app: AppId) => {
      if (app === 'prose') newDocument();
      else if (app === 'cells') newWorkbook();
      else if (app === 'deck') openDeck('template:blank');
      else setRoute({ view: 'jotbook', newPage: true });
    },
    [newDocument, newWorkbook, openDeck, setRoute],
  );

  if (route.view === 'dashboard') return <Dashboard onOpen={openWork} onNew={newWork} />;

  if (route.view === 'home') {
    return (
      <Home
        onNewDocument={newDocument}
        onOpenDocument={() => void openDocument()}
        onNewWorkbook={newWorkbook}
        onOpenDeck={openDeck}
        onOpenRecent={(entry) => void openRecent(entry)}
        onOpenDraft={openDraft}
        onOpenCellsDraft={openCellsDraft}
        onOpenApp={onOpenApp}
      />
    );
  }

  if (route.view === 'jotbook') return <Jotbook startNewPage={route.newPage} />;

  if (route.view === 'deck') return <Deck key={route.key} open={route.open} />;

  if (route.view === 'cells') {
    return <Cells key={route.doc.key} doc={route.doc} onNewWorkbook={() => newWorkbook()} onOpenWorkbook={() => void openWorkbook()} />;
  }

  return (
    <Prose
      key={route.doc.key}
      doc={route.doc}
      onNewDocument={() => newDocument()}
      onOpenDocument={() => void openDocument()}
    />
  );
}
