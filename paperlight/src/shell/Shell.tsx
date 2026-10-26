import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppId } from '../lib/bridge';
import { CommandRegistryContext, useRegisterCommands, type Command } from '../lib/commands';
import type { ThemeControls } from '../lib/theme';
import { CommandPalette } from './CommandPalette';
import { Rail } from './Rail';
import { ShellContext, type ShellApi, type ToastTone } from './ShellContext';
import './shell.css';

interface ShellProps {
  current: AppId | 'home' | 'dashboard';
  theme: ThemeControls;
  onHome: () => void;
  onDashboard: () => void;
  onOpenApp: (app: AppId) => void;
  children: ReactNode;
}

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export function Shell({ current, theme, onHome, onDashboard, onOpenApp, children }: ShellProps) {
  const registry = useContext(CommandRegistryContext);
  const [paletteCommands, setPaletteCommands] = useState<Command[] | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToast = useRef(1);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.app = current;
  }, [current]);

  const openPalette = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setPaletteCommands(registry.all());
  }, [registry]);

  const closePalette = useCallback(() => {
    setPaletteCommands(null);
    returnFocus.current?.focus?.();
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextToast.current++;
    setToasts((list) => [...list, { id, message, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((entry) => entry.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();
        if (paletteCommands) closePalette();
        else openPalette();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [openPalette, closePalette, paletteCommands]);

  const shellCommands = useMemo<Command[]>(
    () => [
      { id: 'go-home', title: 'Go to Home', group: 'Paperlight', keywords: 'start recent templates', run: onHome },
      { id: 'go-dashboard', title: 'Open Dashboard', group: 'Paperlight', keywords: 'overview all apps work recent', run: onDashboard },
      { id: 'open-prose', title: 'Open Prose', group: 'Paperlight', keywords: 'documents writer', run: () => onOpenApp('prose') },
      { id: 'open-cells', title: 'Open Cells', group: 'Paperlight', keywords: 'spreadsheet workbook xlsx', run: () => onOpenApp('cells') },
      { id: 'open-deck', title: 'Open Deck', group: 'Paperlight', keywords: 'slides presentation talk', run: () => onOpenApp('deck') },
      { id: 'open-jotbook', title: 'Open Jotbook', group: 'Paperlight', keywords: 'notes notebook', run: () => onOpenApp('jotbook') },
      { id: 'theme-light', title: 'Use light theme', group: 'Appearance', keywords: 'theme day', run: () => theme.choose('light') },
      { id: 'theme-dark', title: 'Use dark theme', group: 'Appearance', keywords: 'theme night', run: () => theme.choose('dark') },
      { id: 'theme-system', title: 'Match system theme', group: 'Appearance', keywords: 'theme auto', run: () => theme.choose('system') },
    ],
    [onHome, onDashboard, onOpenApp, theme],
  );
  useRegisterCommands('shell', shellCommands);

  const api = useMemo<ShellApi>(() => ({ openPalette, toast, theme }), [openPalette, toast, theme]);

  return (
    <ShellContext.Provider value={api}>
      <div className="pl-shell">
        <Rail current={current} onHome={onHome} onDashboard={onDashboard} onOpenApp={onOpenApp} />
        <div className="pl-stage">{children}</div>
      </div>
      {paletteCommands && <CommandPalette commands={paletteCommands} onClose={closePalette} />}
      <div className="pl-toasts" role="status" aria-live="polite">
        {toasts.map((entry) => (
          <div key={entry.id} className="pl-toast" data-tone={entry.tone}>
            {entry.message}
          </div>
        ))}
      </div>
    </ShellContext.Provider>
  );
}
