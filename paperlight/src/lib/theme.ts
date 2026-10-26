import { useCallback, useEffect, useState } from 'react';
import { bridge } from './bridge';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'paperlight.theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return darkQuery.matches ? 'dark' : 'light';
  return preference;
}

export function applyInitialTheme() {
  document.documentElement.dataset.theme = resolve(readPreference());
  if (bridge.isElectron) document.documentElement.classList.add('has-overlay');
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(darkQuery.matches);
  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    darkQuery.addEventListener('change', onChange);
    return () => darkQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    void bridge.setTheme(resolved);
  }, [resolved]);

  const choose = useCallback((next: ThemePreference) => {
    setPreference(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Preference simply won't persist.
    }
  }, []);

  const toggle = useCallback(() => choose(resolved === 'dark' ? 'light' : 'dark'), [choose, resolved]);

  return { preference, resolved, choose, toggle };
}

export type ThemeControls = ReturnType<typeof useTheme>;
