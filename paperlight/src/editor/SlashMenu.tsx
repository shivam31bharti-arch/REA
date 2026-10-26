import type { Range } from '@tiptap/core';
import type { SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { BlockItem } from './blocks';

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

type SlashMenuProps = SuggestionProps<BlockItem, BlockItem> & { range: Range };

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu({ items, command, query }, ref) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setActive(0), [items]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        setActive((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActive((index) => (index - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[active];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="pl-slash" role="listbox" aria-label="Insert a block" ref={listRef}>
      {items.length === 0 ? (
        <p className="pl-slash-empty">No block called “{query}”.</p>
      ) : (
        items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              role="option"
              aria-selected={index === active}
              className="pl-slash-item"
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                command(item);
              }}
            >
              <span className="pl-slash-icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="pl-slash-text">
                <span className="pl-slash-title">{item.title}</span>
                <span className="pl-slash-desc">{item.description}</span>
              </span>
            </div>
          );
        })
      )}
    </div>
  );
});
