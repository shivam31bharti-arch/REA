import { ArrowDownAZ, ArrowDownZA, Search } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

interface FilterMenuProps {
  title: string;
  anchor: DOMRect;
  values: string[];
  /** The values that stay visible, or null when the column is not filtered. */
  allowed: string[] | null;
  onChange: (allowed: string[] | null) => void;
  onSort: (descending: boolean) => void;
  onClose: () => void;
}

const BLANK = '(Blanks)';

export function FilterMenu({ title, anchor, values, allowed, onChange, onSort, onClose }: FilterMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? values.filter((value) => (value || BLANK).toLowerCase().includes(q)) : values;
  }, [query, values]);
  const allowedSet = useMemo(() => new Set(allowed ?? values), [allowed, values]);
  const allOn = shown.every((value) => allowedSet.has(value));

  useLayoutEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  const commit = (next: Set<string>) => {
    onChange(next.size === values.length ? null : values.filter((value) => next.has(value)));
  };

  const toggle = (value: string) => {
    const next = new Set(allowedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    commit(next);
  };

  const toggleAll = () => {
    const next = new Set(allowedSet);
    for (const value of shown) {
      if (allOn) next.delete(value);
      else next.add(value);
    }
    commit(next);
  };

  const left = Math.min(anchor.left, window.innerWidth - 300);
  const top = Math.min(anchor.bottom + 6, window.innerHeight - 420);

  return (
    <div
      ref={rootRef}
      className="pl-filter-menu"
      role="dialog"
      aria-label={`Filter ${title}`}
      style={{ left, top }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <p className="pl-filter-title">{title || 'Column'}</p>
      <div className="pl-filter-sort">
        <button type="button" className="pl-btn" onClick={() => onSort(false)}>
          <ArrowDownAZ aria-hidden="true" />
          Sort A to Z
        </button>
        <button type="button" className="pl-btn" onClick={() => onSort(true)}>
          <ArrowDownZA aria-hidden="true" />
          Sort Z to A
        </button>
      </div>
      <label className="pl-filter-search">
        <Search aria-hidden="true" />
        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search values" aria-label="Search values" />
      </label>
      <div className="pl-filter-list" role="group" aria-label="Values to show">
        <label className="pl-filter-row pl-filter-row--all">
          <input type="checkbox" checked={allOn} onChange={toggleAll} />
          <span>{query ? 'All matches' : 'Select all'}</span>
        </label>
        {shown.map((value) => (
          <label key={value} className="pl-filter-row">
            <input type="checkbox" checked={allowedSet.has(value)} onChange={() => toggle(value)} />
            <span>{value || BLANK}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="pl-filter-none">No values match “{query}”.</p>}
      </div>
      <div className="pl-filter-actions">
        <button type="button" className="pl-btn pl-btn--outline" disabled={allowed === null} onClick={() => onChange(null)}>
          Clear filter
        </button>
        <span className="pl-dialog-spacer" />
        <button type="button" className="pl-btn pl-btn--primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
