export interface Notebook {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface Section {
  id: string;
  notebookId: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface Page {
  id: string;
  sectionId: string;
  title: string;
  html: string;
  /** Plain text of the body, kept for search. */
  text: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Library {
  notebooks: Notebook[];
  sections: Section[];
  pages: Page[];
}

type StoreName = 'notebooks' | 'sections' | 'pages';

const DB_NAME = 'paperlight-jotbook';
const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ['notebooks', 'sections', 'pages'] as const) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAll<T>(db: IDBDatabase, name: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(name).objectStore(name).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function loadLibrary(): Promise<Library> {
  const db = await openDb();
  const [notebooks, sections, pages] = await Promise.all([
    getAll<Notebook>(db, 'notebooks'),
    getAll<Section>(db, 'sections'),
    getAll<Page>(db, 'pages'),
  ]);
  return { notebooks, sections, pages };
}

/** Writes and deletes in one transaction, so a crash never leaves half a change. */
export async function commit(changes: {
  put?: Partial<Record<StoreName, (Notebook | Section | Page)[]>>;
  remove?: Partial<Record<StoreName, string[]>>;
}) {
  const db = await openDb();
  const tx = db.transaction(['notebooks', 'sections', 'pages'], 'readwrite');
  for (const [name, values] of Object.entries(changes.put ?? {})) {
    for (const value of values ?? []) tx.objectStore(name).put(value);
  }
  for (const [name, ids] of Object.entries(changes.remove ?? {})) {
    for (const id of ids ?? []) tx.objectStore(name).delete(id);
  }
  await done(tx);
}
