import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { shortDate } from './PageStrip';
import type { Library } from './store';

interface SearchPanelProps {
  library: Library;
  onOpen: (pageId: string, query: string) => void;
  onClose: () => void;
}

interface Result {
  pageId: string;
  title: string;
  where: string;
  snippet: [string, string, string] | null;
  updatedAt: number;
}

function snippetAround(text: string, at: number, length: number): [string, string, string] {
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + length + 90);
  return [
    `${start > 0 ? '…' : ''}${text.slice(start, at)}`,
    text.slice(at, at + length),
    `${text.slice(at + length, end)}${end < text.length ? '…' : ''}`,
  ];
}

function Marked({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query);
  if (at === -1 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

/** Replaces the page strip with results from every notebook. */
export function SearchPanel({ library, onOpen, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const needle = query.trim().toLowerCase();

  const results = useMemo<Result[]>(() => {
    if (!needle) return [];
    const sections = new Map(library.sections.map((section) => [section.id, section]));
    const notebooks = new Map(library.notebooks.map((notebook) => [notebook.id, notebook]));
    return library.pages
      .map((page) => {
        const titleHit = page.title.toLowerCase().includes(needle);
        const textAt = page.text.toLowerCase().indexOf(needle);
        if (!titleHit && textAt === -1) return null;
        const section = sections.get(page.sectionId);
        const notebook = section ? notebooks.get(section.notebookId) : undefined;
        return {
          score: titleHit ? 2 : 1,
          result: {
            pageId: page.id,
            title: page.title.trim() || 'Untitled page',
            where: `${notebook?.name ?? 'Notebook'} / ${section?.name ?? 'Section'}`,
            snippet: textAt === -1 ? null : snippetAround(page.text, textAt, needle.length),
            updatedAt: page.updatedAt,
          },
        };
      })
      .filter((entry): entry is { score: number; result: Result } => entry !== null)
      .sort((a, b) => b.score - a.score || b.result.updatedAt - a.result.updatedAt)
      .slice(0, 50)
      .map((entry) => entry.result);
  }, [library, needle]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [needle]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const open = (result: Result | undefined) => result && onOpen(result.pageId, query.trim());

  return (
    <section className="pl-strip pl-search" aria-label="Search notes">
      <div className="pl-search-box">
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              open(results[active]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder="Search every notebook"
          aria-label="Search every notebook"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="pl-search-results"
          spellCheck={false}
        />
        <button type="button" className="pl-btn pl-btn--icon" onClick={onClose} aria-label="Close search" title="Close (Esc)">
          <X />
        </button>
      </div>
      <p className="pl-search-count" aria-live="polite">
        {!needle ? 'Titles and text across all notebooks.' : results.length === 0 ? `Nothing matches “${query.trim()}”.` : `${results.length} ${results.length === 1 ? 'page' : 'pages'}`}
      </p>
      <ol className="pl-search-results" id="pl-search-results" role="listbox" ref={listRef} aria-label="Matching pages">
        {results.map((result, index) => (
          <li
            key={result.pageId}
            role="option"
            aria-selected={index === active}
            className="pl-search-hit"
            onPointerMove={() => setActive(index)}
            onClick={() => open(result)}
          >
            <span className="pl-search-where">{result.where}</span>
            <span className="pl-search-title">
              <Marked text={result.title} query={needle} />
            </span>
            {result.snippet && (
              <span className="pl-search-snippet">
                {result.snippet[0]}
                <mark>{result.snippet[1]}</mark>
                {result.snippet[2]}
              </span>
            )}
            <span className="pl-search-date">{shortDate(result.updatedAt)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
