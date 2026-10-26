import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MenuEntry, MenuItem } from './Menu';

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuEntry[];
  onClose: () => void;
  label: string;
}

function isItem(entry: MenuEntry): entry is MenuItem {
  return !('separator' in entry);
}

/** A right-click menu with the same look and keys as the bar's menus. */
export function ContextMenu({ x, y, items, onClose, label }: ContextMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const box = list.getBoundingClientRect();
    setPosition({
      left: Math.min(x, window.innerWidth - box.width - 8),
      top: Math.min(y, window.innerHeight - box.height - 8),
    });
    list.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!listRef.current?.contains(event.target as Node)) onClose();
    };
    const onBlur = () => onClose();
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [onClose]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      ref={listRef}
      role="menu"
      aria-label={label}
      className="pl-menu-list pl-context-menu"
      style={{ position: 'fixed', left: position.left, top: position.top, width: 250 }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((entry) =>
        isItem(entry) ? (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            className={entry.danger ? 'pl-menu-item is-danger' : 'pl-menu-item'}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
          >
            {entry.icon && <span className="pl-menu-icon">{entry.icon}</span>}
            <span className="pl-menu-text">
              <span className="pl-menu-label">{entry.label}</span>
              {entry.description && <span className="pl-menu-description">{entry.description}</span>}
            </span>
            {entry.shortcut && <kbd>{entry.shortcut}</kbd>}
          </button>
        ) : (
          <div key={entry.id} role="separator" className="pl-menu-separator" />
        ),
      )}
    </div>
  );
}
