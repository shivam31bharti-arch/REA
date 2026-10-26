import { Focus, Minus, PanelLeft, Plus } from 'lucide-react';

interface StatusBarProps {
  words: number;
  characters: number;
  page: number;
  pages: number;
  zoom: number;
  focusMode: boolean;
  outlineOpen: boolean;
  onToggleFocus: () => void;
  onToggleOutline: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function StatusBar(props: StatusBarProps) {
  const minutes = Math.max(1, Math.round(props.words / 200));
  return (
    <footer className="pl-statusbar">
      <button
        type="button"
        className="pl-status-btn"
        aria-pressed={props.outlineOpen}
        onClick={props.onToggleOutline}
        title="Show or hide the outline"
      >
        <PanelLeft aria-hidden="true" />
        Outline
      </button>
      <span className="pl-status-fig">{props.words.toLocaleString()} words</span>
      <span className="pl-status-fig">{props.characters.toLocaleString()} characters</span>
      <span className="pl-status-fig">{props.words === 0 ? 'Empty' : `${minutes} min read`}</span>
      <span className="pl-status-fig">
        Page {props.page} of {props.pages}
      </span>
      <div className="pl-status-end">
        <button
          type="button"
          className="pl-status-btn"
          aria-pressed={props.focusMode}
          onClick={props.onToggleFocus}
          title="Focus mode (Ctrl Shift F)"
        >
          <Focus aria-hidden="true" />
          Focus
        </button>
        <div className="pl-zoom" role="group" aria-label="Zoom">
          <button type="button" className="pl-status-btn pl-status-btn--icon" onClick={props.onZoomOut} aria-label="Zoom out" title="Zoom out (Ctrl −)">
            <Minus aria-hidden="true" />
          </button>
          <button type="button" className="pl-status-btn pl-zoom-value" onClick={props.onZoomReset} title="Actual size (Ctrl 0)">
            {Math.round(props.zoom * 100)}%
          </button>
          <button type="button" className="pl-status-btn pl-status-btn--icon" onClick={props.onZoomIn} aria-label="Zoom in" title="Zoom in (Ctrl =)">
            <Plus aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
