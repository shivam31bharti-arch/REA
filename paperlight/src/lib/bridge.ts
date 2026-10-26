export type AppId = 'prose' | 'cells' | 'deck' | 'jotbook';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenedFile {
  path: string | null;
  name: string;
  data: Uint8Array;
}

export interface SavedFile {
  path: string | null;
  name: string;
}

export interface RecentFile {
  path: string;
  name: string;
  app: AppId;
  openedAt: number;
}

export interface PaperlightBridge {
  isElectron: boolean;
  openFile(options: { title: string; filters: FileFilter[] }): Promise<OpenedFile | null>;
  readFile(filePath: string): Promise<OpenedFile>;
  saveFile(options: {
    filePath?: string | null;
    defaultName: string;
    filters: FileFilter[];
    data: Uint8Array;
  }): Promise<SavedFile | null>;
  exportPdf(options: { defaultName: string }): Promise<SavedFile | null>;
  listRecent(): Promise<RecentFile[]>;
  addRecent(entry: RecentFile): Promise<RecentFile[]>;
  setTheme(theme: 'light' | 'dark'): Promise<void>;
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    paperlight?: PaperlightBridge;
  }
}

function pickFile(filters: FileFilter[]): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((filter) => filter.extensions.map((ext) => `.${ext}`)).join(',');
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

function download(name: string, data: Uint8Array) {
  const url = URL.createObjectURL(new Blob([data as BlobPart]));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Used by `npm run dev:web`, where there is no Electron main process. */
const browserBridge: PaperlightBridge = {
  isElectron: false,
  async openFile({ filters }) {
    const file = await pickFile(filters);
    if (!file) return null;
    return { path: null, name: file.name, data: new Uint8Array(await file.arrayBuffer()) };
  },
  async readFile() {
    throw new Error('Opening files by path needs the desktop app.');
  },
  async saveFile({ defaultName, data }) {
    download(defaultName, data);
    return { path: null, name: defaultName };
  },
  async exportPdf({ defaultName }) {
    window.print();
    return { path: null, name: defaultName };
  },
  async listRecent() {
    return [];
  },
  async addRecent() {
    return [];
  },
  async setTheme() {},
  async openExternal(url) {
    window.open(url, '_blank', 'noopener');
  },
};

export const bridge: PaperlightBridge = window.paperlight ?? browserBridge;
