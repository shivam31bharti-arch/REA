import { Command, LayoutDashboard, Moon, Sun } from 'lucide-react';
import type { AppId } from '../lib/bridge';
import { SUITE_APPS } from './apps';
import { useShell } from './ShellContext';

interface RailProps {
  current: AppId | 'home' | 'dashboard';
  onHome: () => void;
  onDashboard: () => void;
  onOpenApp: (app: AppId) => void;
}

export function Rail({ current, onHome, onDashboard, onOpenApp }: RailProps) {
  const { openPalette, theme } = useShell();
  return (
    <nav className="pl-rail pl-drag" aria-label="Paperlight apps">
      <button
        type="button"
        className="pl-rail-mark"
        onClick={onHome}
        aria-label="Paperlight home"
        aria-current={current === 'home' ? 'page' : undefined}
        data-tip="Home"
      >
        P
      </button>
      <button
        type="button"
        className="pl-rail-app pl-rail-dash"
        onClick={onDashboard}
        aria-label="Dashboard"
        aria-current={current === 'dashboard' ? 'page' : undefined}
        data-tip="Dashboard"
      >
        <LayoutDashboard aria-hidden="true" />
        <span className="pl-rail-quad" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>
      <ul className="pl-rail-apps">
        {SUITE_APPS.map((app) => {
          const Icon = app.icon;
          const active = current === app.id;
          return (
            <li key={app.id}>
              <button
                type="button"
                className="pl-rail-app"
                data-app={app.id}
                aria-current={active ? 'page' : undefined}
                aria-disabled={!app.ready || undefined}
                aria-label={app.ready ? app.name : `${app.name}, ${app.status.toLowerCase()}`}
                data-tip={app.ready ? app.name : `${app.name} · ${app.status}`}
                onClick={() => app.ready && onOpenApp(app.id)}
              >
                <Icon aria-hidden="true" />
                <span className="pl-rail-swatch" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="pl-rail-foot">
        <button type="button" className="pl-rail-app" onClick={openPalette} aria-label="Search commands" data-tip="Commands · Ctrl K">
          <Command aria-hidden="true" />
        </button>
        <button
          type="button"
          className="pl-rail-app"
          onClick={theme.toggle}
          aria-label={theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          data-tip={theme.resolved === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme.resolved === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
      </div>
    </nav>
  );
}
