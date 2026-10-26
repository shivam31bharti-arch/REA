import type { Deck } from './model';

const DB_NAME = 'paperlight-deck';
const DB_VERSION = 1;
const LAST_KEY = 'paperlight.deck.last';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('decks')) request.result.createObjectStore('decks', { keyPath: 'id' });
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

export async function loadDecks(): Promise<Deck[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('decks').objectStore('decks').getAll();
    request.onsuccess = () => resolve((request.result as Deck[]).sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function putDeck(deck: Deck) {
  const db = await openDb();
  const tx = db.transaction('decks', 'readwrite');
  tx.objectStore('decks').put(deck);
  await done(tx);
}

export async function removeDeck(id: string) {
  const db = await openDb();
  const tx = db.transaction('decks', 'readwrite');
  tx.objectStore('decks').delete(id);
  await done(tx);
}

export function lastDeckId() {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function rememberDeck(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    // Only the remembered choice is lost.
  }
}
