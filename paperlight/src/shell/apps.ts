import { FileText, Grid3x3, NotebookPen, Presentation, type LucideIcon } from 'lucide-react';
import type { AppId } from '../lib/bridge';

export interface SuiteApp {
  id: AppId;
  name: string;
  role: string;
  icon: LucideIcon;
  ready: boolean;
  status: string;
}

export const SUITE_APPS: SuiteApp[] = [
  { id: 'prose', name: 'Prose', role: 'Documents', icon: FileText, ready: true, status: 'Ready' },
  { id: 'cells', name: 'Cells', role: 'Spreadsheets', icon: Grid3x3, ready: true, status: 'Open' },
  { id: 'deck', name: 'Deck', role: 'Presentations', icon: Presentation, ready: true, status: 'Open' },
  { id: 'jotbook', name: 'Jotbook', role: 'Notebooks', icon: NotebookPen, ready: true, status: 'Open' },
];
