/** Arquivos que a usuária anexa ao documentar: lê, reduz imagens e separa o que a IA pode ler (para a pesquisa achar o conteúdo). */
import { readFiles, sizeLabel, type LocalFile } from "@/components/inbox/files";

export { sizeLabel };
export const MAX_PENDING = 8;
export const MAX_BYTES = 25 * 1024 * 1024;
/** Arquivo único: limite do armazenamento. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Documentar no Orion: arquivar muitas imagens de uma vez (ex.: personagens de um livro). */
export const ARCHIVE_LIMITS = { maxFiles: 150, maxBytes: 200 * 1024 * 1024, aiCap: 16 } as const;
export type PendingLimits = { maxFiles: number; maxBytes: number; /** Quantos arquivos guardam a cópia para a IA ler (os demais são só arquivados). */ aiCap?: number | undefined };
const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

export type Pending = {
  key: string; name: string; mime: string; blob: Blob; size: number;
  /** Cópia em base64 (já reduzida) para a IA ler; ausente em arquivos que ela não lê ou grandes demais. */
  ai?: LocalFile | undefined; preview?: string | undefined;
};

const fromBase64 = (b64: string, mime: string) => {
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};
let seq = 0;

export async function toPending(files: File[], current: Pending[], limits: PendingLimits = { maxFiles: MAX_PENDING, maxBytes: MAX_BYTES }): Promise<{ added: Pending[]; rejected: string[] }> {
  const added: Pending[] = []; const rejected: string[] = [];
  let bytes = current.reduce((n, p) => n + p.size, 0);
  for (const f of files) {
    const name = f.name || (f.type.startsWith("image/") ? "imagem-colada.png" : "arquivo");
    if (current.length + added.length >= limits.maxFiles) { rejected.push(`${name}: no máximo ${limits.maxFiles} arquivos por vez`); continue; }
    if (f.size > MAX_FILE_BYTES) { rejected.push(`${name}: maior que 25 MB`); continue; }
    if (bytes + f.size > limits.maxBytes) { rejected.push(`${name}: passou do limite de ${mb(limits.maxBytes)} por documentação`); continue; }
    const key = `p${++seq}`;
    const r = await readFiles([f.name ? f : new File([f], name, { type: f.type })], []);
    // passou do teto de leitura por IA: guarda só o arquivo (e a miniatura), sem a cópia em base64, para poupar memória
    const reading = limits.aiCap === undefined || [...current, ...added].filter((p) => p.ai).length < limits.aiCap;
    const ai = reading ? r.added[0] : undefined, shrunk = r.added[0];
    if (!ai && shrunk && shrunk.mime === "image/jpeg" && f.type.startsWith("image/")) {
      const blob = fromBase64(shrunk.data, shrunk.mime);
      added.push({ key, name: shrunk.name, mime: blob.type || shrunk.mime, blob, size: blob.size, preview: shrunk.preview });
      bytes += blob.size;
    } else if (ai) {
      // Imagem: guarda a versão reduzida (leve). PDF e texto: guarda o original.
      const blob = ai.mime === "image/jpeg" && f.type.startsWith("image/") ? fromBase64(ai.data, ai.mime) : f;
      added.push({ key, name: ai.mime === "image/jpeg" && f.type.startsWith("image/") ? ai.name : name, mime: blob.type || ai.mime, blob, size: blob.size, ai, preview: ai.preview });
      bytes += blob.size;
    } else {
      // Tipo que a IA não lê (Office, áudio, zip…) ou grande demais para ela: guarda mesmo assim, só sem texto para busca.
      added.push({ key, name, mime: f.type || "application/octet-stream", blob: f, size: f.size, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined });
      bytes += f.size;
    }
  }
  return { added, rejected };
}

/** Arquivos colados (Ctrl+V) viram File; prints costumam vir sem nome. */
export const filesFromClipboard = (e: ClipboardEvent | React.ClipboardEvent): File[] => {
  const cd = e.clipboardData;
  if (!cd) return [];
  const out = [...(cd.files ?? [])];
  if (out.length) return out;
  // Algumas origens (copiar imagem de uma página, recortes) só vêm em `items`.
  const fromItems: File[] = [];
  for (const it of [...(cd.items ?? [])]) if (it.kind === "file") { const f = it.getAsFile(); if (f) fromItems.push(f); }
  return fromItems;
};

import { summarizeFiles } from "@/lib/brain.functions";
/** Lê o conteúdo dos anexos (texto direto; imagem/PDF pela IA) para a pesquisa do Orion achar depois. */
export async function readPending(pending: Pending[]): Promise<{ summary: string; note?: string }> {
  const textual = pending.filter((p) => p.ai?.mime === "text/plain").map((p) => `## ${p.name}\n${new TextDecoder().decode(Uint8Array.from(atob(p.ai!.data), (c) => c.charCodeAt(0)))}`);
  const visual = pending.filter((p) => p.ai && p.ai.mime !== "text/plain").map((p) => ({ name: p.name, mime: p.ai!.mime, data: p.ai!.data }));
  let ai = "", note: string | undefined;
  if (visual.length) {
    const r = await summarizeFiles({ data: { files: visual } });
    if (r.ok) { ai = r.text; note = r.note; } else note = r.error;
  }
  return { summary: [...textual, ai].filter(Boolean).join("\n\n"), ...(note ? { note } : {}) };
}

/** Divide os arquivos a ler em grupos que cabem numa chamada (poucos arquivos e corpo abaixo do limite da função). */
export function batchVisual<T extends { data: string }>(items: T[], maxFiles = 4, maxChars = 3_200_000): T[][] {
  const out: T[][] = []; let cur: T[] = [], chars = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= maxFiles || chars + it.data.length > maxChars)) { out.push(cur); cur = []; chars = 0; }
    cur.push(it); chars += it.data.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Como `readPending`, mas para muitos arquivos: lê em grupos (a IA recebe poucos por vez) e informa o andamento. */
export async function readArchive(pending: Pending[], onProgress?: (done: number, total: number) => void): Promise<{ summary: string; note?: string }> {
  const textual = pending.filter((p) => p.ai?.mime === "text/plain").map((p) => `## ${p.name}\n${new TextDecoder().decode(Uint8Array.from(atob(p.ai!.data), (c) => c.charCodeAt(0)))}`);
  const visual = pending.filter((p) => p.ai && p.ai.mime !== "text/plain").map((p) => ({ name: p.name, mime: p.ai!.mime, data: p.ai!.data }));
  const groups = batchVisual(visual), parts: string[] = []; let note: string | undefined;
  for (let i = 0; i < groups.length; i++) {
    onProgress?.(i, groups.length);
    const r = await summarizeFiles({ data: { files: groups[i]! } });
    if (r.ok) { if (r.text) parts.push(r.text); if (r.note) note = r.note; } else { note = r.error; break; }
  }
  const unread = pending.filter((p) => !p.ai).length;
  if (unread > 0 && !note) note = `${unread} ${unread === 1 ? "arquivo foi guardado" : "arquivos foram guardados"} sem leitura por IA; ${unread === 1 ? "ele" : "eles"} continuam salvos e dá para abrir quando quiser.`;
  return { summary: [...textual, ...parts].filter(Boolean).join("\n\n"), ...(note ? { note } : {}) };
}
