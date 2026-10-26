import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../../lib/library';
import { starterLibrary } from './seed';
import { commit, loadLibrary, type Library, type Notebook, type Page, type Section } from './store';

const LAST_KEY = 'paperlight.jotbook.last';

export interface Selection {
  notebookId: string;
  sectionId: string;
  pageId: string | null;
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

function sectionsOf(library: Library, notebookId: string) {
  return library.sections.filter((section) => section.notebookId === notebookId).sort(byOrder);
}

function pagesOf(library: Library, sectionId: string) {
  return library.pages.filter((page) => page.sectionId === sectionId).sort(byOrder);
}

function firstSelection(library: Library, notebookId?: string): Selection | null {
  const notebook = library.notebooks.find((entry) => entry.id === notebookId) ?? [...library.notebooks].sort(byOrder)[0];
  if (!notebook) return null;
  const section = sectionsOf(library, notebook.id)[0];
  if (!section) return null;
  return { notebookId: notebook.id, sectionId: section.id, pageId: pagesOf(library, section.id)[0]?.id ?? null };
}

function restoreSelection(library: Library): Selection | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as Selection | null;
    if (
      saved &&
      library.notebooks.some((entry) => entry.id === saved.notebookId) &&
      library.sections.some((entry) => entry.id === saved.sectionId && entry.notebookId === saved.notebookId)
    ) {
      const pageOk = saved.pageId === null || library.pages.some((entry) => entry.id === saved.pageId);
      return pageOk ? saved : { ...saved, pageId: pagesOf(library, saved.sectionId)[0]?.id ?? null };
    }
  } catch {
    // Fall through to the first page.
  }
  return firstSelection(library);
}

/** The load in flight, shared so a second mount (StrictMode in development) does not seed a second starter notebook. */
let opening: Promise<Library> | null = null;

function openLibrary() {
  opening ??= (async () => {
    const loaded = await loadLibrary();
    if (loaded.notebooks.length > 0) return loaded;
    const seeded = starterLibrary();
    await commit({ put: seeded });
    return seeded;
  })().finally(() => {
    opening = null;
  });
  return opening;
}

/** Makes Jotbook open on this page the next time it mounts. */
export function rememberJotbookPage(selection: Selection) {
  localStorage.setItem(LAST_KEY, JSON.stringify(selection));
}

function blankPage(sectionId: string, now = Date.now()): Page {
  return { id: newId(), sectionId, title: '', html: '', text: '', order: now, createdAt: now, updatedAt: now };
}

export function useLibrary(onError: (message: string) => void) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const libraryRef = useRef<Library | null>(null);
  libraryRef.current = library;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const save = useCallback((changes: Parameters<typeof commit>[0]) => {
    commit(changes).catch((error: unknown) => {
      onErrorRef.current(`Couldn't save to this computer: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await openLibrary();
        if (cancelled) return;
        setLibrary(loaded);
        setSelection(restoreSelection(loaded));
      } catch (error) {
        onErrorRef.current(`Couldn't open your notebooks: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selection) return;
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(selection));
    } catch {
      // The last position simply won't be remembered.
    }
  }, [selection]);

  const apply = useCallback((next: Library) => {
    libraryRef.current = next;
    setLibrary(next);
  }, []);

  const actions = useMemo(
    () => ({
      selectNotebook(notebookId: string) {
        const current = libraryRef.current;
        if (current) setSelection(firstSelection(current, notebookId));
      },
      selectSection(sectionId: string) {
        const current = libraryRef.current;
        const section = current?.sections.find((entry) => entry.id === sectionId);
        if (!current || !section) return;
        setSelection({ notebookId: section.notebookId, sectionId, pageId: pagesOf(current, sectionId)[0]?.id ?? null });
      },
      selectPage(pageId: string) {
        const current = libraryRef.current;
        const page = current?.pages.find((entry) => entry.id === pageId);
        const section = current?.sections.find((entry) => entry.id === page?.sectionId);
        if (!page || !section) return;
        setSelection({ notebookId: section.notebookId, sectionId: section.id, pageId });
      },

      createNotebook(name: string) {
        const current = libraryRef.current;
        if (!current) return null;
        const now = Date.now();
        const notebook: Notebook = { id: newId(), name, order: now, createdAt: now };
        const section: Section = { id: newId(), notebookId: notebook.id, name: 'Quick notes', order: now, createdAt: now };
        const page = blankPage(section.id, now);
        apply({
          notebooks: [...current.notebooks, notebook],
          sections: [...current.sections, section],
          pages: [...current.pages, page],
        });
        save({ put: { notebooks: [notebook], sections: [section], pages: [page] } });
        setSelection({ notebookId: notebook.id, sectionId: section.id, pageId: page.id });
        return page.id;
      },
      renameNotebook(id: string, name: string) {
        const current = libraryRef.current;
        const notebook = current?.notebooks.find((entry) => entry.id === id);
        if (!current || !notebook) return;
        const renamed = { ...notebook, name };
        apply({ ...current, notebooks: current.notebooks.map((entry) => (entry.id === id ? renamed : entry)) });
        save({ put: { notebooks: [renamed] } });
      },
      deleteNotebook(id: string) {
        const current = libraryRef.current;
        if (!current) return;
        const sectionIds = current.sections.filter((entry) => entry.notebookId === id).map((entry) => entry.id);
        const pageIds = current.pages.filter((entry) => sectionIds.includes(entry.sectionId)).map((entry) => entry.id);
        let next: Library = {
          notebooks: current.notebooks.filter((entry) => entry.id !== id),
          sections: current.sections.filter((entry) => entry.notebookId !== id),
          pages: current.pages.filter((entry) => !pageIds.includes(entry.id)),
        };
        const put: Library = { notebooks: [], sections: [], pages: [] };
        if (next.notebooks.length === 0) {
          const fresh = starterLibrary();
          fresh.pages = [blankPage(fresh.sections[0].id)];
          next = fresh;
          Object.assign(put, fresh);
        }
        apply(next);
        save({ put, remove: { notebooks: [id], sections: sectionIds, pages: pageIds } });
        setSelection(firstSelection(next));
      },

      createSection(notebookId: string, name: string) {
        const current = libraryRef.current;
        if (!current) return null;
        const now = Date.now();
        const section: Section = { id: newId(), notebookId, name, order: now, createdAt: now };
        const page = blankPage(section.id, now);
        apply({ ...current, sections: [...current.sections, section], pages: [...current.pages, page] });
        save({ put: { sections: [section], pages: [page] } });
        setSelection({ notebookId, sectionId: section.id, pageId: page.id });
        return page.id;
      },
      renameSection(id: string, name: string) {
        const current = libraryRef.current;
        const section = current?.sections.find((entry) => entry.id === id);
        if (!current || !section) return;
        const renamed = { ...section, name };
        apply({ ...current, sections: current.sections.map((entry) => (entry.id === id ? renamed : entry)) });
        save({ put: { sections: [renamed] } });
      },
      deleteSection(id: string) {
        const current = libraryRef.current;
        const section = current?.sections.find((entry) => entry.id === id);
        if (!current || !section) return;
        const pageIds = current.pages.filter((entry) => entry.sectionId === id).map((entry) => entry.id);
        const next: Library = {
          ...current,
          sections: current.sections.filter((entry) => entry.id !== id),
          pages: current.pages.filter((entry) => entry.sectionId !== id),
        };
        const put: Partial<Library> = {};
        if (sectionsOf(next, section.notebookId).length === 0) {
          const now = Date.now();
          const replacement: Section = { id: newId(), notebookId: section.notebookId, name: 'Quick notes', order: now, createdAt: now };
          const page = blankPage(replacement.id, now);
          next.sections = [...next.sections, replacement];
          next.pages = [...next.pages, page];
          put.sections = [replacement];
          put.pages = [page];
        }
        apply(next);
        save({ put, remove: { sections: [id], pages: pageIds } });
        setSelection(firstSelection(next, section.notebookId));
      },

      createPage(sectionId: string) {
        const current = libraryRef.current;
        const section = current?.sections.find((entry) => entry.id === sectionId);
        if (!current || !section) return null;
        const page = blankPage(sectionId);
        apply({ ...current, pages: [...current.pages, page] });
        save({ put: { pages: [page] } });
        setSelection({ notebookId: section.notebookId, sectionId, pageId: page.id });
        return page.id;
      },
      updatePage(id: string, patch: Partial<Pick<Page, 'title' | 'html' | 'text'>>) {
        const current = libraryRef.current;
        const page = current?.pages.find((entry) => entry.id === id);
        if (!current || !page) return;
        const updated = { ...page, ...patch, updatedAt: Date.now() };
        apply({ ...current, pages: current.pages.map((entry) => (entry.id === id ? updated : entry)) });
        save({ put: { pages: [updated] } });
      },
      duplicatePage(id: string) {
        const current = libraryRef.current;
        const page = current?.pages.find((entry) => entry.id === id);
        const section = current?.sections.find((entry) => entry.id === page?.sectionId);
        if (!current || !page || !section) return;
        const siblings = pagesOf(current, page.sectionId);
        const after = siblings[siblings.findIndex((entry) => entry.id === id) + 1];
        const now = Date.now();
        const copy: Page = {
          ...page,
          id: newId(),
          title: page.title ? `${page.title} (copy)` : '',
          order: after ? (page.order + after.order) / 2 : now,
          createdAt: now,
          updatedAt: now,
        };
        apply({ ...current, pages: [...current.pages, copy] });
        save({ put: { pages: [copy] } });
        setSelection({ notebookId: section.notebookId, sectionId: section.id, pageId: copy.id });
      },
      deletePage(id: string) {
        const current = libraryRef.current;
        const page = current?.pages.find((entry) => entry.id === id);
        const section = current?.sections.find((entry) => entry.id === page?.sectionId);
        if (!current || !page || !section) return;
        const siblings = pagesOf(current, page.sectionId);
        const index = siblings.findIndex((entry) => entry.id === id);
        const neighbour = siblings[index + 1] ?? siblings[index - 1] ?? null;
        apply({ ...current, pages: current.pages.filter((entry) => entry.id !== id) });
        save({ remove: { pages: [id] } });
        setSelection({ notebookId: section.notebookId, sectionId: section.id, pageId: neighbour?.id ?? null });
      },
    }),
    [apply, save],
  );

  const view = useMemo(() => {
    if (!library || !selection) return null;
    const notebooks = [...library.notebooks].sort(byOrder);
    const notebook = library.notebooks.find((entry) => entry.id === selection.notebookId) ?? null;
    const sections = notebook ? sectionsOf(library, notebook.id) : [];
    const section = library.sections.find((entry) => entry.id === selection.sectionId) ?? null;
    const pages = section ? pagesOf(library, section.id) : [];
    const page = library.pages.find((entry) => entry.id === selection.pageId) ?? null;
    return { library, notebooks, notebook, sections, section, pages, page };
  }, [library, selection]);

  return { view, actions };
}

export type LibraryActions = ReturnType<typeof useLibrary>['actions'];
