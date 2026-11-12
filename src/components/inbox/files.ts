import { MAX_FILES, MAX_TEXT_FILE_CHARS, MAX_TOTAL_CHARS, type InboxFile } from "@/lib/inbox";
import { isLegacyOffice, officeKind, officeToText } from "@/lib/office";

export type LocalFile = InboxFile & { preview?: string | undefined };

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_SIDE = 1600;

const toBase64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const utf8ToBase64 = (t: string) => toBase64(new TextEncoder().encode(t).buffer as ArrayBuffer);

/** Print/foto: reduz para no máximo 1600 px e comprime (JPEG), para caber no envio e a IA ler bem. */
async function shrinkImage(f: File): Promise<LocalFile> {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("não consegui ler a imagem");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("falha ao comprimir"))), "image/jpeg", 0.85));
  const name = /\.(png|jpe?g|webp|gif|heic)$/i.test(f.name) ? f.name.replace(/\.[^.]+$/, ".jpg") : `${f.name || "print"}.jpg`;
  return { name, mime: "image/jpeg", size: blob.size, data: toBase64(await blob.arrayBuffer()), preview: URL.createObjectURL(blob) };
}

export async function readFiles(list: File[], current: LocalFile[]): Promise<{ added: LocalFile[]; rejected: string[] }> {
  const added: LocalFile[] = [];
  const rejected: string[] = [];
  let total = current.reduce((n, f) => n + f.data.length, 0);
  for (const f of list) {
    const name = f.name || "arquivo";
    try {
      if (current.length + added.length >= MAX_FILES) { rejected.push(`${name}: no máximo ${MAX_FILES} arquivos por vez`); continue; }
      let out: LocalFile;
      if (f.type.startsWith("image/")) out = await shrinkImage(f);
      else if (f.type === "application/pdf" || /\.pdf$/i.test(name)) {
        if (f.size > MAX_PDF_BYTES) { rejected.push(`${name}: PDF maior que 3 MB`); continue; }
        out = { name, mime: "application/pdf", size: f.size, data: toBase64(await f.arrayBuffer()) };
      } else if (f.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(name)) {
        const t = (await f.text()).slice(0, MAX_TEXT_FILE_CHARS);
        out = { name, mime: "text/plain", size: t.length, data: utf8ToBase64(t) };
      } else if (f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|aac)$/i.test(name)) {
        rejected.push(`${name}: áudio ainda não é transcrito aqui. Use o microfone (ditado) ou cole a transcrição`); continue;
      } else if (officeKind(name)) {
        // Planilha/Word/PowerPoint: vira texto aqui no navegador (planilha em CSV) e segue como um .txt.
        const full = await officeToText(await f.arrayBuffer(), officeKind(name)!);
        const t = full.length > MAX_TEXT_FILE_CHARS ? `${full.slice(0, MAX_TEXT_FILE_CHARS - 100)}\n[… cortado: o arquivo passou de ${MAX_TEXT_FILE_CHARS.toLocaleString("pt-BR")} caracteres]` : full;
        out = { name, mime: "text/plain", size: f.size, data: utf8ToBase64(t) };
      } else if (isLegacyOffice(name)) {
        rejected.push(`${name}: formato antigo do Office. Salve como .xlsx, .docx ou .pptx (ou PDF) e envie de novo`); continue;
      } else { rejected.push(`${name}: tipo de arquivo não suportado`); continue; }
      if (total + out.data.length > MAX_TOTAL_CHARS) { rejected.push(`${name}: passou do limite total de ~3 MB por envio`); continue; }
      total += out.data.length;
      added.push(out);
    } catch (e) { rejected.push(`${name}: ${e instanceof Error ? e.message : "erro ao ler"}`); }
  }
  return { added, rejected };
}

export const sizeLabel = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace(".", ",")} MB`);
