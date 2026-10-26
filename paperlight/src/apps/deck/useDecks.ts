import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck } from './model';
import { lastDeckId, loadDecks, putDeck, rememberDeck, removeDeck } from './store';
import { templateDeck } from './templates';

export type SaveState = { kind: 'saved'; at: Date | null } | { kind: 'saving' } | { kind: 'error' };

const SAVE_DELAY = 450;

/**
 * Every deck on this computer, with the open one. Changes save themselves shortly after
 * the last edit; leaving Deck saves straight away.
 */
export function useDecks(onError: (message: string) => void, startWith?: string | null) {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'saved', at: null });
  const pending = useRef<Map<string, Deck>>(new Map());
  const timer = useRef<number | undefined>(undefined);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const batch = [...pending.current.values()];
    pending.current.clear();
    if (batch.length === 0) return;
    try {
      await Promise.all(batch.map((deck) => putDeck(deck)));
      setSave({ kind: 'saved', at: new Date() });
    } catch (error) {
      setSave({ kind: 'error' });
      onErrorRef.current(`Couldn't save the deck: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  // One load per mount, even when development mode runs effects twice, so a starter deck is made once.
  const loading = useRef<Promise<{ list: Deck[]; id: string }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loading.current ??= (async () => {
      let list = await loadDecks();
      if (startWith?.startsWith('template:')) {
        const fresh = templateDeck(startWith.slice('template:'.length));
        await putDeck(fresh);
        return { list: [fresh, ...list], id: fresh.id };
      }
      if (list.length === 0) {
        const first = templateDeck('launch');
        await putDeck(first);
        list = [first];
      }
      const wanted = startWith ?? lastDeckId();
      return { list, id: list.find((deck) => deck.id === wanted)?.id ?? list[0].id };
    })();
    loading.current
      .then(({ list, id }) => {
        if (cancelled) return;
        setDecks(list);
        setCurrentId(id);
        const opened = list.find((deck) => deck.id === id);
        setSave({ kind: 'saved', at: opened ? new Date(opened.updatedAt) : null });
      })
      .catch((error: unknown) => {
        onErrorRef.current(`Couldn't open your decks: ${error instanceof Error ? error.message : String(error)}`);
        if (!cancelled) setDecks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [startWith]);

  useEffect(() => {
    if (currentId) rememberDeck(currentId);
  }, [currentId]);

  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  const update = useCallback(
    (deck: Deck) => {
      const next = { ...deck, updatedAt: Date.now() };
      setDecks((list) => (list ? list.map((entry) => (entry.id === next.id ? next : entry)) : list));
      pending.current.set(next.id, next);
      setSave({ kind: 'saving' });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY);
    },
    [flush],
  );

  const create = useCallback(
    async (templateId: string) => {
      await flush();
      const deck = templateDeck(templateId);
      await putDeck(deck);
      setDecks((list) => [deck, ...(list ?? [])]);
      setCurrentId(deck.id);
      setSave({ kind: 'saved', at: new Date() });
      return deck;
    },
    [flush],
  );

  const open = useCallback(
    async (id: string) => {
      await flush();
      setCurrentId(id);
      const deck = decks?.find((entry) => entry.id === id);
      setSave({ kind: 'saved', at: deck ? new Date(deck.updatedAt) : null });
    },
    [decks, flush],
  );

  const remove = useCallback(
    async (id: string) => {
      pending.current.delete(id);
      await removeDeck(id);
      let remaining = (decks ?? []).filter((deck) => deck.id !== id);
      if (remaining.length === 0) {
        const fresh = templateDeck('blank');
        await putDeck(fresh);
        remaining = [fresh];
      }
      setDecks(remaining);
      if (currentId === id) setCurrentId(remaining[0].id);
    },
    [currentId, decks],
  );

  const current = decks?.find((deck) => deck.id === currentId) ?? null;
  return { decks, current, save, update, create, open, remove, flush };
}
