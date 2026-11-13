/**
 * Notas (lembretes) da página de Demandas. Cada nota pode estar ligada a um dossiê ou ficar "Geral"
 * (sem vínculo). Assim como os dossiês, ficam no localStorage, uma lista por projeto.
 */

export type Note = { id: number; text: string; date: string; color: string; dossierId?: string | undefined };
export const NOTE_COLORS = ["violet", "cyan", "emerald", "amber", "pink"] as const;

/** As notas começam vazias (as 3 de exemplo do desenho foram retiradas ao ligar o banco). */
export const seedNotes = (_projectId: string): Note[] => [];

const key = (projectId: string) => `presence.notes.${projectId}`;

export function loadNotes(projectId: string): Note[] {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return seedNotes(projectId);
    const list = JSON.parse(raw) as Note[];
    return Array.isArray(list) ? list : seedNotes(projectId);
  } catch {
    return seedNotes(projectId);
  }
}

export function saveNotes(projectId: string, notes: Note[]) {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(notes));
  } catch {
    /* sem armazenamento: segue só em memória */
  }
}

export type NoteDraft = { text: string; color: string; dossierId?: string | undefined };

/** Nova nota entra no topo da lista. Sem dossiê = nota geral. */
export const addNote = (notes: Note[], d: NoteDraft, date: string, id = Date.now()): Note[] => [
  { id, text: d.text.trim(), date, color: d.color, dossierId: d.dossierId || undefined },
  ...notes,
];

export const editNote = (notes: Note[], id: number, d: NoteDraft): Note[] =>
  notes.map((n) => (n.id === id ? { ...n, text: d.text.trim(), color: d.color, dossierId: d.dossierId || undefined } : n));

export const deleteNote = (notes: Note[], id: number): Note[] => notes.filter((n) => n.id !== id);

/** Quando um dossiê é excluído, as notas dele continuam, mas viram gerais. */
export const unlinkDossier = (notes: Note[], dossierId: string): Note[] =>
  notes.map((n) => (n.dossierId === dossierId ? { ...n, dossierId: undefined } : n));

/** Nome do dossiê da nota, ou null se for geral (ou se o dossiê não existir mais). */
export const noteDossierName = (n: Note, dossiers: { id: string; name: string }[]): string | null =>
  (n.dossierId && dossiers.find((d) => d.id === n.dossierId)?.name) || null;
