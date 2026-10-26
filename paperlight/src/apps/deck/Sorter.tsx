import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SlideView } from './SlideView';
import { formatSeconds, slideTitle, type Deck, type Theme } from './model';

interface SorterProps {
  deck: Deck;
  theme: Theme;
  current: number;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}

const THUMB_W = 232;

/** Every slide at once, to reorder by dragging or with the keyboard. */
export function Sorter({ deck, theme, current, onSelect, onOpen, onMove, onDelete, onClose }: SorterProps) {
  const gridRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; moved: boolean } | null>(null);

  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: false });
  }, [current]);

  const targetIndex = (x: number, y: number) => {
    const cards = [...(gridRef.current?.querySelectorAll<HTMLElement>('.pl-sorter-card') ?? [])];
    let best = 0;
    let bestDistance = Infinity;
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  };

  const columns = () => {
    const cards = [...(gridRef.current?.querySelectorAll<HTMLElement>('.pl-sorter-card') ?? [])];
    if (cards.length < 2) return 1;
    const top = cards[0].getBoundingClientRect().top;
    return Math.max(1, cards.findIndex((card) => card.getBoundingClientRect().top > top + 4) === -1 ? cards.length : cards.findIndex((card) => card.getBoundingClientRect().top > top + 4));
  };

  return (
    <div
      className="pl-sorter"
      role="dialog"
      aria-label="Slide sorter"
      onKeyDown={(event) => {
        const last = deck.slides.length - 1;
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? columns() : event.key === 'ArrowUp' ? -columns() : 0;
        if (step) {
          event.preventDefault();
          const next = Math.min(Math.max(current + step, 0), last);
          if (event.ctrlKey || event.metaKey) onMove(current, next);
          onSelect(next);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          onOpen(current);
        } else if (event.key === 'Delete') {
          event.preventDefault();
          onDelete(current);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="pl-sorter-head">
        <h2>All slides</h2>
        <span className="pl-sorter-hint">Drag to reorder · Ctrl + arrows move the selected slide · Enter opens it</span>
        <button type="button" className="pl-btn pl-btn--outline" onClick={onClose}>
          <X aria-hidden="true" />
          Close
        </button>
      </header>
      <ol className="pl-sorter-grid" ref={gridRef}>
        {deck.slides.map((slide, index) => (
          <li key={slide.id} data-insert={drag?.moved && drag.to === index && drag.from !== index ? true : undefined}>
            <button
              type="button"
              className="pl-sorter-card"
              aria-current={index === current}
              aria-label={`Slide ${index + 1}, ${slideTitle(slide)}`}
              data-dragging={drag?.moved && drag.from === index ? true : undefined}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({ from: index, to: index, moved: false });
              }}
              onPointerMove={(event) => {
                if (!drag) return;
                const to = targetIndex(event.clientX, event.clientY);
                if (to !== drag.to || !drag.moved) setDrag({ ...drag, to, moved: drag.moved || to !== drag.from });
              }}
              onPointerUp={() => {
                if (drag?.moved && drag.to !== drag.from) onMove(drag.from, drag.to);
                else onSelect(index);
                setDrag(null);
              }}
              onDoubleClick={() => onOpen(index)}
            >
              <SlideView slide={slide} theme={theme} index={index} count={deck.slides.length} deckTitle={deck.title} width={THUMB_W} />
              <span className="pl-sorter-meta">
                <span className="pl-sorter-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="pl-sorter-title">{slideTitle(slide)}</span>
                <span className="pl-sorter-time">{formatSeconds(slide.seconds)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
