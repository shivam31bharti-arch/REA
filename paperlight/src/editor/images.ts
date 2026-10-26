import type { Editor } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import { bridge } from '../lib/bridge';
import { stripExtension } from '../lib/format';

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }];

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function mimeFor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/png';
}

export function imageFiles(list: DataTransfer | null) {
  return [...(list?.files ?? [])].filter((file) => file.type.startsWith('image/'));
}

async function insertImageFiles(view: EditorView, files: File[], at: number) {
  const sources = await Promise.all(files.map((file) => readAsDataUrl(file)));
  const { state } = view;
  const imageType = state.schema.nodes.image;
  if (!imageType) return;
  const pos = Math.min(at, state.doc.content.size);
  let tr = state.tr;
  for (const src of sources.reverse()) tr = tr.insert(pos, imageType.create({ src }));
  view.dispatch(tr.scrollIntoView());
}

/** Editor props that take pasted or dropped images, and open links on Ctrl+click. */
export const imageEditorProps = {
  handlePaste: (view: EditorView, event: ClipboardEvent) => {
    const files = imageFiles(event.clipboardData);
    if (files.length === 0) return false;
    void insertImageFiles(view, files, view.state.selection.from);
    return true;
  },
  handleDrop: (view: EditorView, event: DragEvent, _slice: unknown, moved: boolean) => {
    const files = imageFiles(event.dataTransfer);
    if (moved || files.length === 0) return false;
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
    void insertImageFiles(view, files, pos);
    return true;
  },
  handleClick: (_view: EditorView, _pos: number, event: MouseEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return false;
    const link = (event.target as HTMLElement).closest('a');
    if (!link?.href) return false;
    void bridge.openExternal(link.href);
    return true;
  },
};

/** Asks for an image file and returns it as a data URL, or null when the user cancels. */
export async function pickImageDataUrl(): Promise<{ src: string; name: string } | null> {
  const file = await bridge.openFile({ title: 'Insert an image', filters: IMAGE_FILTERS });
  if (!file) return null;
  const src = await readAsDataUrl(new Blob([file.data as BlobPart], { type: mimeFor(file.name) }));
  return { src, name: stripExtension(file.name) };
}

/** Asks for an image file and inserts it at the cursor. Returns false when the user cancels. */
export async function pickAndInsertImage(editor: Editor) {
  const file = await bridge.openFile({ title: 'Insert an image', filters: IMAGE_FILTERS });
  if (!file) return false;
  const src = await readAsDataUrl(new Blob([file.data as BlobPart], { type: mimeFor(file.name) }));
  editor.chain().focus().setImage({ src, alt: stripExtension(file.name) }).run();
  return true;
}
