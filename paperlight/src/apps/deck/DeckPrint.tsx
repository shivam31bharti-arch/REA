import { createPortal } from 'react-dom';
import { SlideView } from './SlideView';
import { SLIDE_W, type Deck, type Theme } from './model';

/** Every slide, one per page, for PDF export. Only shown when printing. */
export function DeckPrint({ deck, theme }: { deck: Deck; theme: Theme }) {
  return createPortal(
    <div className="pl-deck-print" aria-hidden="true">
      {deck.slides.map((slide, index) => (
        <div key={slide.id} className="pl-deck-print-page">
          <SlideView slide={slide} theme={theme} index={index} count={deck.slides.length} deckTitle={deck.title} width={SLIDE_W} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
