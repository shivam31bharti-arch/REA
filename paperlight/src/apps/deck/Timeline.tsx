import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ContextMenu } from '../../ui/ContextMenu';
import { formatSeconds, slideTitle, type Slide } from './model';

interface TimelineProps {
  slides: Slide[];
  current: number;
  total: number;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
}

/** The talk laid out in time: one numbered block per slide, as wide as the time planned for it. */
export function Timeline({ slides, current, total, onSelect, onMove, onAdd, onDuplicate, onDelete }: TimelineProps) {
  const trackRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; moved: boolean } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  useEffect(() => {
    trackRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const targetIndex = (clientX: number) => {
    const blocks = [...(trackRef.current?.querySelectorAll<HTMLElement>('.pl-tl-block') ?? [])];
    let index = blocks.length;
    for (let i = 0; i < blocks.length; i += 1) {
      const rect = blocks[i].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        index = i;
        break;
      }
    }
    return index;
  };

  const insertAt = drag && drag.moved ? drag.to : null;

  return (
    <section className="pl-timeline" aria-label="Talk timeline">
      <header className="pl-tl-head">
        <h2>Talk timeline</h2>
        <span className="pl-tl-total">
          {slides.length} {slides.length === 1 ? 'slide' : 'slides'} · {formatSeconds(total)} planned
        </span>
      </header>
      <ol className="pl-tl-track" ref={trackRef}>
        {slides.map((slide, index) => (
          <li
            key={slide.id}
            className="pl-tl-slot"
            style={{ flexGrow: Math.max(slide.seconds, 10) }}
            data-insert={insertAt === index || undefined}
            data-insert-end={insertAt === slides.length && index === slides.length - 1 ? true : undefined}
          >
            <button
              type="button"
              className="pl-tl-block"
              aria-current={index === current ? 'step' : undefined}
              aria-label={`Slide ${index + 1}, ${slideTitle(slide)}, ${formatSeconds(slide.seconds)} planned`}
              data-dragging={drag?.from === index && drag.moved ? true : undefined}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({ from: index, to: index, moved: false });
              }}
              onPointerMove={(event) => {
                if (!drag) return;
                const to = targetIndex(event.clientX);
                if (to !== drag.to || !drag.moved) setDrag({ ...drag, to, moved: drag.moved || to !== drag.from });
              }}
              onPointerUp={() => {
                if (drag?.moved) {
                  const to = drag.to > drag.from ? drag.to - 1 : drag.to;
                  if (to !== drag.from) onMove(drag.from, to);
                } else onSelect(index);
                setDrag(null);
              }}
              onPointerCancel={() => setDrag(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelect(index);
                setMenu({ x: event.clientX, y: event.clientY, index });
              }}
            >
              <span className="pl-tl-top" aria-hidden="true">
                <span className="pl-tl-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="pl-tl-time">{formatSeconds(slide.seconds)}</span>
              </span>
              <span className="pl-tl-title" title={slideTitle(slide)}>
                {slideTitle(slide)}
              </span>
            </button>
          </li>
        ))}
        <li className="pl-tl-add-slot">
          <button type="button" className="pl-tl-add" onClick={onAdd} aria-label="Add a slide" title="Add a slide (Ctrl M)">
            <Plus aria-hidden="true" />
          </button>
        </li>
      </ol>
      {menu && (
        <ContextMenu
          label="Slide actions"
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { id: 'duplicate', label: 'Duplicate slide', icon: <Copy />, onSelect: () => onDuplicate(menu.index) },
            ...(menu.index > 0 ? [{ id: 'earlier', label: 'Move earlier', icon: <ArrowLeft />, onSelect: () => onMove(menu.index, menu.index - 1) }] : []),
            ...(menu.index < slides.length - 1 ? [{ id: 'later', label: 'Move later', icon: <ArrowRight />, onSelect: () => onMove(menu.index, menu.index + 1) }] : []),
            { separator: true as const, id: 'sep' },
            { id: 'delete', label: 'Delete slide', icon: <Trash2 />, danger: true, onSelect: () => onDelete(menu.index) },
          ]}
        />
      )}
    </section>
  );
}
