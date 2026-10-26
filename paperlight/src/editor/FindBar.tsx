import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { ArrowDown, ArrowUp, CaseSensitive, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { findPluginKey } from './extensions/find';

interface FindBarProps {
  editor: Editor;
  mode: 'find' | 'replace';
  focusToken: number;
  onClose: () => void;
  onReplacedAll: (count: number) => void;
}

export function FindBar({ editor, mode, focusToken, onClose, onReplacedAll }: FindBarProps) {
  const [query, setQuery] = useState(() => {
    const { from, to, empty } = editor.state.selection;
    const selected = empty ? '' : editor.state.doc.textBetween(from, to, ' ');
    return selected.length <= 80 && !selected.includes('\n') ? selected : '';
  });
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const status = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const state = findPluginKey.getState(current.state);
      return { count: state?.matches.length ?? 0, index: state?.index ?? -1 };
    },
  });

  useEffect(() => {
    editor.commands.setFindQuery(query, caseSensitive);
  }, [editor, query, caseSensitive]);

  useEffect(() => () => void editor.commands.clearFind(), [editor]);

  useEffect(() => {
    const target = mode === 'replace' && findRef.current?.value ? replaceRef.current : findRef.current;
    target?.focus();
    target?.select();
  }, [focusToken, mode]);

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const label = !query
    ? ''
    : status.count === 0
      ? 'No matches'
      : status.index >= 0
        ? `${status.index + 1} of ${status.count}`
        : `${status.count} found`;

  return (
    <div className="pl-findbar" role="search" aria-label="Find and replace" onKeyDown={onKeyDown}>
      <div className="pl-findbar-row">
        <input
          ref={findRef}
          className="pl-findbar-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              editor.commands.findStep(event.shiftKey ? -1 : 1);
            }
          }}
          placeholder="Find in document"
          aria-label="Find"
          spellCheck={false}
        />
        <span className="pl-findbar-count" aria-live="polite">
          {label}
        </span>
        <button
          type="button"
          className="pl-btn pl-btn--icon"
          aria-pressed={caseSensitive}
          aria-label="Match case"
          title="Match case"
          onClick={() => setCaseSensitive((value) => !value)}
        >
          <CaseSensitive />
        </button>
        <button type="button" className="pl-btn pl-btn--icon" aria-label="Previous match" title="Previous (Shift Enter)" onClick={() => editor.commands.findStep(-1)}>
          <ArrowUp />
        </button>
        <button type="button" className="pl-btn pl-btn--icon" aria-label="Next match" title="Next (Enter)" onClick={() => editor.commands.findStep(1)}>
          <ArrowDown />
        </button>
        <button type="button" className="pl-btn pl-btn--icon" aria-label="Close find" title="Close (Esc)" onClick={close}>
          <X />
        </button>
      </div>
      {mode === 'replace' && (
        <div className="pl-findbar-row">
          <input
            ref={replaceRef}
            className="pl-findbar-input"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (editor.commands.replaceCurrentMatch(replacement)) editor.commands.findStep(0);
              }
            }}
            placeholder="Replace with"
            aria-label="Replace with"
            spellCheck={false}
          />
          <button
            type="button"
            className="pl-btn pl-btn--outline"
            disabled={status.count === 0}
            onClick={() => {
              if (status.index < 0) {
                editor.commands.findStep(1);
                return;
              }
              if (editor.commands.replaceCurrentMatch(replacement)) editor.commands.findStep(0);
            }}
          >
            Replace
          </button>
          <button
            type="button"
            className="pl-btn pl-btn--outline"
            disabled={status.count === 0}
            onClick={() => {
              const count = status.count;
              if (editor.commands.replaceAllMatches(replacement)) onReplacedAll(count);
            }}
          >
            Replace all
          </button>
        </div>
      )}
    </div>
  );
}
