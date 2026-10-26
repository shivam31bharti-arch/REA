import { Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { countWords } from '../../lib/format';
import { Menu } from '../../ui/Menu';
import { stripBarWidth } from '../../ui/strip';
import type { Page, Section } from './store';

interface PageStripProps {
  section: Section;
  pages: Page[];
  currentPageId: string | null;
  onSelect: (id: string) => void;
  onNewPage: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function shortDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The section's pages, numbered in order like the Prose outline. */
export function PageStrip({ section, pages, currentPageId, onSelect, onNewPage, onDuplicate, onDelete }: PageStripProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const words = useMemo(() => new Map(pages.map((page) => [page.id, countWords(page.text)])), [pages]);
  const longest = Math.max(1, ...words.values());

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [currentPageId]);

  return (
    <nav className="pl-strip" aria-label={`Pages in ${section.name}`}>
      <h2 className="pl-strip-head">
        <span className="pl-strip-title">{section.name}</span>
        <span className="pl-strip-count">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </span>
      </h2>
      {pages.length === 0 ? (
        <div className="pl-strip-empty">
          <p>No pages in this section yet.</p>
          <button type="button" className="pl-btn pl-btn--outline" onClick={onNewPage}>
            <Plus aria-hidden="true" />
            New page
          </button>
        </div>
      ) : (
        <ol className="pl-strip-list" ref={listRef}>
          {pages.map((page, index) => (
            <li key={page.id} className="pl-strip-entry">
              <button
                type="button"
                className="pl-strip-link"
                aria-current={page.id === currentPageId ? 'page' : undefined}
                onClick={() => onSelect(page.id)}
              >
                <span className="pl-strip-num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="pl-strip-name">{page.title.trim() || 'Untitled page'}</span>
                <span className="pl-strip-meter" aria-label={`${words.get(page.id) ?? 0} words, edited ${shortDate(page.updatedAt)}`}>
                  <span className="pl-strip-bar" style={{ width: stripBarWidth(words.get(page.id) ?? 0, longest) }} />
                  <span className="pl-strip-date">{shortDate(page.updatedAt)}</span>
                </span>
              </button>
              <Menu
                label={`Actions for ${page.title.trim() || 'Untitled page'}`}
                className="pl-btn pl-btn--icon pl-strip-more"
                align="end"
                width={200}
                items={[
                  { id: 'duplicate', label: 'Duplicate page', icon: <Copy />, onSelect: () => onDuplicate(page.id) },
                  { separator: true, id: 'sep' },
                  { id: 'delete', label: 'Delete page…', icon: <Trash2 />, danger: true, onSelect: () => onDelete(page.id) },
                ]}
              >
                <MoreHorizontal aria-hidden="true" />
              </Menu>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
