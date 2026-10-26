export interface Draft {
  id: string;
  title: string;
  html: string;
  filePath: string | null;
  updatedAt: number;
}

const DRAFTS_KEY = 'paperlight.prose.drafts.v1';
const DRAFT_LIMIT = 8;

export function listDrafts(): Draft[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as Draft[]) : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: Draft[]) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.slice(0, DRAFT_LIMIT)));
  } catch {
    // Storage full (large embedded images): the open document is unaffected.
  }
}

export function saveDraft(draft: Draft) {
  writeDrafts([draft, ...listDrafts().filter((existing) => existing.id !== draft.id)]);
}

export function removeDraft(id: string) {
  writeDrafts(listDrafts().filter((existing) => existing.id !== id));
}

export function newId() {
  return crypto.randomUUID();
}
