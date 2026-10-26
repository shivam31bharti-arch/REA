import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  description?: string;
  active?: boolean;
  danger?: boolean;
  labelStyle?: CSSProperties;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | { separator: true; id: string };

interface MenuProps {
  label: string;
  items: MenuEntry[];
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
  width?: number;
  title?: string;
}

function isItem(entry: MenuEntry): entry is MenuItem {
  return !('separator' in entry);
}

export function Menu({ label, items, children, className = 'pl-btn', align = 'start', width = 240, title }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    const first = listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    const active = listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"][data-active="true"]');
    (active ?? first)?.focus();
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      buttons[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      buttons[buttons.length - 1]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      close(true);
    }
  };

  return (
    <div className="pl-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={title}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </button>
      {open && (
        <div
          id={menuId}
          ref={listRef}
          role="menu"
          aria-label={label}
          className={`pl-menu-list pl-menu-list--${align}`}
          style={{ width }}
          onKeyDown={onListKeyDown}
        >
          {items.map((entry) =>
            isItem(entry) ? (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                className={entry.danger ? 'pl-menu-item is-danger' : 'pl-menu-item'}
                data-active={entry.active ? 'true' : undefined}
                onClick={() => {
                  close(false);
                  entry.onSelect();
                }}
              >
                {entry.icon && <span className="pl-menu-icon">{entry.icon}</span>}
                <span className="pl-menu-text">
                  <span className="pl-menu-label" style={entry.labelStyle}>
                    {entry.label}
                  </span>
                  {entry.description && <span className="pl-menu-description">{entry.description}</span>}
                </span>
                {entry.shortcut && <kbd>{entry.shortcut}</kbd>}
              </button>
            ) : (
              <div key={entry.id} role="separator" className="pl-menu-separator" />
            ),
          )}
        </div>
      )}
    </div>
  );
}
