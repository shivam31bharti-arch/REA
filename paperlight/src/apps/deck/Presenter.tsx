import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlideView } from './SlideView';
import { formatSeconds, slideTitle, SLIDE_H, SLIDE_W, totalSeconds, type Deck, type Theme } from './model';

interface PresenterProps {
  deck: Deck;
  theme: Theme;
  start: number;
  onClose: (lastIndex: number) => void;
}

/** Full-screen presenting, with the talk timeline running as a thin band along the bottom. */
export function Presenter({ deck, theme, start, onClose }: PresenterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [presenterView, setPresenterView] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [slideStarted, setSlideStarted] = useState(() => Date.now());
  const [awake, setAwake] = useState(true);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const startedAt = useRef(Date.now());
  const indexRef = useRef(index);
  indexRef.current = index;
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onClose(indexRef.current);
  }, [onClose]);

  useEffect(() => {
    rootRef.current?.focus();
    const element = document.documentElement;
    if (!document.fullscreenElement) void element.requestFullscreen?.().catch(() => undefined);
    const onFullscreen = () => {
      if (!document.fullscreenElement) close();
    };
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('resize', onResize);
    const timer = window.setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 500);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('resize', onResize);
      window.clearInterval(timer);
    };
  }, [close]);

  useEffect(() => {
    if (!awake) return;
    const timer = window.setTimeout(() => setAwake(false), 2200);
    return () => window.clearTimeout(timer);
  }, [awake, index]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), deck.slides.length - 1);
      if (clamped !== indexRef.current) {
        setIndex(clamped);
        setSlideStarted(Date.now());
      }
    },
    [deck.slides.length],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    const key = event.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(key)) {
      event.preventDefault();
      go(index + 1);
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(key)) {
      event.preventDefault();
      go(index - 1);
    } else if (key === 'Home') {
      event.preventDefault();
      go(0);
    } else if (key === 'End') {
      event.preventDefault();
      go(deck.slides.length - 1);
    } else if (key === 'Escape') {
      event.preventDefault();
      close();
    } else if (key === 'p' || key === 'P') {
      event.preventDefault();
      setPresenterView((value) => !value);
    }
  };

  const slide = deck.slides[index];
  const next = deck.slides[index + 1];
  const total = Math.max(totalSeconds(deck), 1);
  const plannedBefore = deck.slides.slice(0, index).reduce((sum, entry) => sum + entry.seconds, 0);
  const onSlide = (Date.now() - slideStarted) / 1000;
  const fit = (width: number, height: number) => Math.min(width, (height * SLIDE_W) / SLIDE_H);
  const slideWidth = presenterView ? fit(viewport.width * 0.64, viewport.height - 120) : fit(viewport.width, viewport.height - 12);
  const ahead = elapsed - (plannedBefore + Math.min(onSlide, slide.seconds));

  return createPortal(
    <div
      ref={rootRef}
      className="pl-present"
      data-awake={awake || undefined}
      data-view={presenterView ? 'presenter' : 'slide'}
      tabIndex={-1}
      role="dialog"
      aria-label={`Presenting ${deck.title}, slide ${index + 1} of ${deck.slides.length}`}
      onKeyDown={onKeyDown}
      onPointerMove={() => setAwake(true)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('.pl-present-side')) return;
        go(index + 1);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        go(index - 1);
      }}
    >
      <div className="pl-present-stage">
        <div className="pl-present-slide" key={slide.id}>
          <SlideView slide={slide} theme={theme} index={index} count={deck.slides.length} deckTitle={deck.title} width={slideWidth} />
        </div>
        {presenterView && (
          <aside className="pl-present-side">
            <div className="pl-present-clock">
              <span className="pl-present-big">{formatSeconds(elapsed)}</span>
              <span>
                of {formatSeconds(total)} planned · {ahead > 5 ? `${formatSeconds(ahead)} behind` : ahead < -5 ? `${formatSeconds(-ahead)} ahead` : 'on time'}
              </span>
            </div>
            <div className="pl-present-now">
              <span className="pl-present-label">
                Slide {index + 1} of {deck.slides.length} · {formatSeconds(onSlide)} of {formatSeconds(slide.seconds)}
              </span>
              <p className="pl-present-notes">{slide.notes || 'No notes for this slide.'}</p>
            </div>
            <div className="pl-present-next">
              <span className="pl-present-label">{next ? `Next: ${slideTitle(next)}` : 'Last slide'}</span>
              {next && <SlideView slide={next} theme={theme} index={index + 1} count={deck.slides.length} deckTitle={deck.title} width={Math.min(360, viewport.width * 0.28)} />}
            </div>
          </aside>
        )}
      </div>
      <div className="pl-present-band" aria-hidden="true">
        {deck.slides.map((entry, i) => (
          <span key={entry.id} style={{ flexGrow: Math.max(entry.seconds, 1) }} data-state={i < index ? 'past' : i === index ? 'now' : 'next'} />
        ))}
        <i style={{ left: `${Math.min(elapsed / total, 1) * 100}%` }} />
      </div>
      <div className="pl-present-hud">
        <span className="pl-fig">
          {String(index + 1).padStart(2, '0')} / {String(deck.slides.length).padStart(2, '0')}
        </span>
        <span className="pl-fig">
          {formatSeconds(elapsed)} / {formatSeconds(total)}
        </span>
        <span>P for presenter view · Esc to stop</span>
      </div>
    </div>,
    document.body,
  );
}
