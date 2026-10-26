import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BlockItem } from '../../editor/blocks';
import { createExtensions } from '../../editor/createExtensions';
import { imageEditorProps } from '../../editor/images';
import type { Page } from './store';

interface NoteEditorProps {
  page: Page;
  blocks: BlockItem[];
  highlight: string | null;
  focusTitle: boolean;
  onReady: (editor: Editor | null, pageId: string) => void;
  onPending: () => void;
  onSave: (pageId: string, patch: Partial<Pick<Page, 'title' | 'html' | 'text'>>) => void;
}

const SAVE_DELAY = 450;

function longDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function clock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** One page: a large title, its dates, and the body. Saves itself shortly after each change. */
export function NoteEditor({ page, blocks, highlight, focusTitle, onReady, onPending, onSave }: NoteEditorProps) {
  const extensions = useMemo(
    () => createExtensions({ blocks, placeholder: 'Start writing, or type / for a checklist, image or table' }),
    [blocks],
  );
  const [title, setTitle] = useState(page.title);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<Partial<Pick<Page, 'title' | 'html' | 'text'>>>({});
  const timer = useRef<number | undefined>(undefined);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onPendingRef = useRef(onPending);
  onPendingRef.current = onPending;

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (Object.keys(pending.current).length === 0) return;
    const patch = pending.current;
    pending.current = {};
    onSaveRef.current(page.id, patch);
  };

  const schedule = (patch: Partial<Pick<Page, 'title' | 'html' | 'text'>>) => {
    pending.current = { ...pending.current, ...patch };
    onPendingRef.current();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY);
  };

  const editor = useEditor({
    extensions,
    content: page.html,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'pl-doc', spellcheck: 'true', 'aria-label': 'Note', 'aria-multiline': 'true' },
      ...imageEditorProps,
    },
    onUpdate: ({ editor: current }) => {
      if (highlight) current.commands.clearFind();
      schedule({ html: current.getHTML(), text: current.getText({ blockSeparator: ' ' }) });
    },
  });

  useEffect(() => {
    onReady(editor, page.id);
    return () => onReady(null, page.id);
  }, [editor, onReady, page.id]);

  useEffect(() => {
    if (highlight) {
      editor.commands.setFindQuery(highlight, false);
      editor.commands.findStep(1);
      // The search highlight is a pointer, not a mark: it goes once you start working on the page.
      const clear = () => editor.commands.clearFind();
      editor.on('focus', clear);
      return () => {
        editor.off('focus', clear);
      };
    }
    if (!focusTitle) editor.commands.focus('end', { scrollIntoView: false });
    return undefined;
  }, [editor, highlight, focusTitle]);

  useLayoutEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);

  useLayoutEffect(() => {
    const element = titleRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  }, [title]);

  useEffect(() => () => flush(), []);

  return (
    <article className="pl-note">
      <textarea
        ref={titleRef}
        className="pl-note-title"
        value={title}
        rows={1}
        placeholder="Untitled page"
        aria-label="Page title"
        spellCheck
        onChange={(event) => {
          const next = event.target.value.replace(/\n/g, ' ');
          setTitle(next);
          schedule({ title: next });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || (event.key === 'ArrowDown' && !event.shiftKey)) {
            event.preventDefault();
            editor.commands.focus('start');
          }
        }}
      />
      <p className="pl-note-meta">
        Created {longDate(page.createdAt)} · Edited {clock(page.updatedAt)}
      </p>
      <EditorContent editor={editor} />
    </article>
  );
}
