import { createContext, useContext } from 'react';
import type { ThemeControls } from '../lib/theme';

export type ToastTone = 'info' | 'error';

export interface ShellApi {
  openPalette: () => void;
  toast: (message: string, tone?: ToastTone) => void;
  theme: ThemeControls;
}

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell() {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error('useShell must be used inside <Shell>');
  return shell;
}
