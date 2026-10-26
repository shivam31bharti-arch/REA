import type { Editor } from '@tiptap/core';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface LinkPopoverProps {
  editor: Editor;
  onClose: () => void;
}

export function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^(javascript|data|vbscript):/i.test(url)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) return url;
  return `https://${url}`;
}

export function LinkPopover({ editor, onClose }: LinkPopoverProps) {
  const [position] = useState(() => {
    const coords = editor.view.coordsAtPos(editor.state.selection.to);
    return { top: coords.bottom + 10, left: Math.min(coords.left, window.innerWidth - 380) };
  });
  const selectionEmpty = editor.state.selection.empty;
  const existing = (editor.getAttributes('link').href as string | undefined) ?? '';
  const [url, setUrl] = useState(existing);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    urlRef.current?.focus();
    urlRef.current?.select();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const href = normalizeUrl(url);
    if (!href) {
      setError('Enter a web address, like example.com');
      return;
    }
    if (selectionEmpty && !existing) {
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: text.trim() || href, marks: [{ type: 'link', attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <form
      ref={rootRef}
      className="pl-popover"
      role="dialog"
      aria-label={existing ? 'Edit link' : 'Add link'}
      style={{ top: position.top, left: position.left }}
      onSubmit={apply}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          editor.commands.focus();
        }
      }}
    >
      {selectionEmpty && !existing && (
        <label className="pl-field-row">
          <span>Text</span>
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Shown in the document" />
        </label>
      )}
      <label className="pl-field-row">
        <span>Address</span>
        <input
          ref={urlRef}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          placeholder="example.com/page"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'pl-link-error' : undefined}
        />
      </label>
      {error && (
        <p id="pl-link-error" className="pl-popover-error">
          {error}
        </p>
      )}
      <div className="pl-popover-actions">
        {existing && (
          <button type="button" className="pl-btn pl-btn--danger" onClick={remove}>
            Remove link
          </button>
        )}
        <span className="pl-popover-spacer" />
        <button type="button" className="pl-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="pl-btn pl-btn--primary">
          {existing ? 'Update' : 'Add link'}
        </button>
      </div>
    </form>
  );
}
