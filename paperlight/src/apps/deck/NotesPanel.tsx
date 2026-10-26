import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatSeconds, parseSeconds, speakingSeconds, type Slide } from './model';

interface NotesPanelProps {
  slide: Slide;
  onNotes: (notes: string) => void;
  onSeconds: (seconds: number) => void;
}

const STEP = 15;

/** What to say over the slide, and how long to plan for it. */
export function NotesPanel({ slide, onNotes, onSeconds }: NotesPanelProps) {
  const [timeText, setTimeText] = useState(formatSeconds(slide.seconds));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setTimeText(formatSeconds(slide.seconds));
    setInvalid(false);
  }, [slide.id, slide.seconds]);

  const words = slide.notes.trim() ? slide.notes.trim().split(/\s+/).length : 0;
  const suggested = speakingSeconds(slide.notes);
  const commitTime = () => {
    const parsed = parseSeconds(timeText);
    if (parsed === null || parsed < 5 || parsed > 3600) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (parsed !== slide.seconds) onSeconds(parsed);
  };

  return (
    <aside className="pl-notes" aria-label="Speaker notes">
      <header className="pl-notes-head">
        <h2>Speaker notes</h2>
        <div className="pl-notes-plan">
          <span>Planned</span>
          <div className="pl-notes-time" role="group" aria-label="Planned time">
          <button type="button" className="pl-btn pl-btn--icon" aria-label="15 seconds less" onClick={() => onSeconds(Math.max(5, slide.seconds - STEP))}>
            <Minus aria-hidden="true" />
          </button>
          <input
            value={timeText}
            aria-label="Planned time, minutes and seconds"
            aria-invalid={invalid || undefined}
            onChange={(event) => setTimeText(event.target.value)}
            onBlur={commitTime}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTime();
              }
            }}
          />
          <button type="button" className="pl-btn pl-btn--icon" aria-label="15 seconds more" onClick={() => onSeconds(Math.min(3600, slide.seconds + STEP))}>
            <Plus aria-hidden="true" />
          </button>
          </div>
        </div>
      </header>
      <textarea
        className="pl-notes-text"
        value={slide.notes}
        placeholder="What you'll say over this slide"
        onChange={(event) => onNotes(event.target.value)}
        aria-label="Notes for this slide"
      />
      <footer className="pl-notes-foot">
        <span>
          {words} {words === 1 ? 'word' : 'words'}
          {words > 0 && <> · about {formatSeconds(suggested)} to say</>}
        </span>
        {words > 0 && Math.abs(suggested - slide.seconds) >= 10 && (
          <button type="button" className="pl-btn pl-btn--outline pl-notes-use" onClick={() => onSeconds(Math.max(5, suggested))}>
            Use <span className="pl-fig">{formatSeconds(suggested)}</span>
          </button>
        )}
      </footer>
    </aside>
  );
}
