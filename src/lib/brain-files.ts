/** Arquivos que a usuária anexa ao documentar: lê, reduz imagens e separa o que a IA pode ler (para a pesquisa achar o conteúdo). */
import { readFiles, sizeLabel, type LocalFile } from "@/components/inbox/files";

export { sizeLabel };
export const MAX_PENDING = 8;
export const MAX_BYTES = 25 * 1024 * 1024;

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

export async function toPending(files: File[], current: Pending[]): Promise<{ added: Pending[]; rejected: string[] }> {
  const added: Pending[] = []; const rejected: string[] = [];
  let bytes = current.reduce((n, p) => n + p.size, 0);
  for (const f of files) {
    const name = f.name || (f.type.startsWith("image/") ? "imagem-colada.png" : "arquivo");
    if (current.length + added.length >= MAX_PENDING) { rejected.push(`${name}: no máximo ${MAX_PENDING} arquivos por vez`); continue; }
    if (f.size > MAX_BYTES) { rejected.push(`${name}: maior que 25 MB`); continue; }
    if (bytes + f.size > MAX_BYTES) { rejected.push(`${name}: passou do limite de 25 MB por documentação`); continue; }
    const key = `p${++seq}`;
    const r = await readFiles([f.name ? f : new File([f], name, { type: f.type })], []);
    const ai = r.added[0];
    if (ai) {
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
export const filesFromClipboard = (e: ClipboardEvent | React.ClipboardEvent): File[] =>
  [...(e.clipboardData?.files ?? [])];
