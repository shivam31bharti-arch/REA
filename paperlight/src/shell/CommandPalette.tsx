import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Command } from '../lib/commands';

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

function score(command: Command, query: string) {
  const title = command.title.toLowerCase();
  const haystack = `${title} ${command.group.toLowerCase()} ${command.keywords?.toLowerCase() ?? ''}`;
  if (title.startsWith(query)) return 3;
  if (title.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  if (haystack.includes(query)) return 1;
  let cursor = 0;
  for (const char of query) {
    cursor = title.indexOf(char, cursor);
    if (cursor === -1) return 0;
    cursor += 1;
  }
  return 0.5;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return commands;
    return commands
      .map((command) => ({ command, score: score(command, trimmed) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command);
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    requestAnimationFrame(() => command.run());
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const grouped = !query.trim();
  let previousGroup = '';

  return (
    <div className="pl-palette-scrim" onPointerDown={onClose}>
      <div
        className="pl-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <label className="pl-palette-search">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command or search"
            role="combobox"
            aria-expanded="true"
            aria-controls="pl-palette-list"
            aria-activedescendant={results[active] ? `pl-cmd-${results[active].id}` : undefined}
            aria-label="Search commands"
          />
          <kbd>Esc</kbd>
        </label>
        <div className="pl-palette-list" id="pl-palette-list" role="listbox" ref={listRef} aria-label="Commands">
          {results.length === 0 && <p className="pl-palette-empty">No command matches “{query.trim()}”.</p>}
          {results.map((command, index) => {
            const showGroup = grouped && command.group !== previousGroup;
            previousGroup = command.group;
            return (
              <div key={command.id} role="presentation">
                {showGroup && (
                  <div className="pl-palette-group" role="presentation">
                    {command.group}
                  </div>
                )}
                <div
                  id={`pl-cmd-${command.id}`}
                  role="option"
                  aria-selected={index === active}
                  className="pl-palette-item"
                  onPointerMove={() => setActive(index)}
                  onClick={() => run(command)}
                >
                  <span className="pl-palette-title">{command.title}</span>
                  {!grouped && <span className="pl-palette-meta">{command.group}</span>}
                  {command.shortcut && <kbd>{command.shortcut}</kbd>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
