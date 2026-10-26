import type { Editor } from '@tiptap/core';
import type { OutlineEntry } from './outlineModel';

interface OutlineProps {
  editor: Editor;
  entries: OutlineEntry[];
}

function goTo(editor: Editor, entry: OutlineEntry) {
  editor.chain().focus().setTextSelection(entry.pos + 1).run();
  const dom = editor.view.nodeDOM(entry.pos);
  if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

export function Outline({ editor, entries }: OutlineProps) {
  const sections = entries.filter((entry) => entry.kind === 'section').length;
  return (
    <nav className="pl-outline" aria-label="Document outline">
      <h2 className="pl-outline-head">
        Outline
        {sections > 0 && <span className="pl-outline-count">{sections} sections</span>}
      </h2>
      {entries.length === 0 ? (
        <p className="pl-outline-empty">Headings you add appear here as a numbered outline. Type / and choose a heading.</p>
      ) : (
        <ol className="pl-outline-list">
          {entries.map((entry) => (
            <li key={`${entry.pos}-${entry.level}`} className={`pl-outline-entry is-${entry.kind}`}>
              <button
                type="button"
                className="pl-outline-link"
                aria-current={entry.current ? 'location' : undefined}
                onClick={() => goTo(editor, entry)}
              >
                {entry.kind === 'section' && (
                  <span className="pl-outline-num" aria-hidden="true">
                    {String(entry.number).padStart(2, '0')}
                  </span>
                )}
                <span className="pl-outline-text">{entry.text || 'Untitled heading'}</span>
                {entry.kind === 'section' && (
                  <span className="pl-outline-meter" aria-label={`${entry.words} words`}>
                    <span className="pl-outline-bar" style={{ width: `${Math.max(entry.share * 100, 4)}%` }} />
                    <span className="pl-outline-words">{entry.words}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
