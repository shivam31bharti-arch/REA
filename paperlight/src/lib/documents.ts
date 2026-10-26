import { bridge, type OpenedFile } from './bridge';
import { docxToHtml } from './docx-import';
import { stripExtension } from './format';
import { newId, type Draft } from './library';
import type { Template } from '../home/templates';

export interface ProseDoc {
  /** Unique per opened editor session; changing it remounts the editor. */
  key: string;
  draftId: string;
  title: string;
  html: string;
  filePath: string | null;
  /** True when the content has not been written to `filePath` yet. */
  dirty: boolean;
}

export const DOCX_FILTERS = [{ name: 'Document (.docx)', extensions: ['docx'] }];

export function blankDoc(template?: Template): ProseDoc {
  return {
    key: newId(),
    draftId: newId(),
    title: template?.title ?? 'Untitled',
    html: template?.html ?? '',
    filePath: null,
    dirty: false,
  };
}

export function docFromDraft(draft: Draft): ProseDoc {
  return { key: newId(), draftId: draft.id, title: draft.title, html: draft.html, filePath: draft.filePath, dirty: true };
}

export async function docFromFile(file: OpenedFile): Promise<{ doc: ProseDoc; warnings: string[] }> {
  const { html, warnings } = await docxToHtml(file.data);
  return {
    doc: { key: newId(), draftId: newId(), title: stripExtension(file.name), html, filePath: file.path, dirty: false },
    warnings,
  };
}

export async function pickDocx() {
  return bridge.openFile({ title: 'Open a document', filters: DOCX_FILTERS });
}
