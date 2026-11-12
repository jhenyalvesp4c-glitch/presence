/**
 * Leitura de documentos do Office (.xlsx, .docx, .pptx) no navegador, sem biblioteca externa.
 * Esses arquivos são um zip com XML dentro: descompactamos com o DecompressionStream do próprio navegador
 * e tiramos o texto. Planilhas viram CSV (uma seção por aba), documentos e apresentações viram texto corrido.
 * Formatos antigos (.xls, .doc, .ppt) são binários e não são lidos aqui.
 */

export type OfficeKind = "xlsx" | "docx" | "pptx";

export const officeKind = (name: string): OfficeKind | null => {
  const m = /\.(xlsx|xlsm|docx|pptx)$/i.exec(name);
  if (!m) return null;
  const ext = m[1]!.toLowerCase();
  return ext === "xlsm" ? "xlsx" : (ext as OfficeKind);
};

export const isLegacyOffice = (name: string) => /\.(xls|doc|ppt)$/i.test(name);

// ---------- zip ----------

type Entry = { name: string; method: number; compSize: number; offset: number };

function listZip(buf: Uint8Array): Map<string, Entry> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("arquivo corrompido ou não é um documento do Office");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, Entry>();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("arquivo corrompido");
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    out.set(name, { name, method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readEntry(buf: Uint8Array, e: Entry): Promise<string> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (v.getUint32(e.offset, true) !== 0x04034b50) throw new Error("arquivo corrompido");
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const raw = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return new TextDecoder().decode(raw);
  if (e.method !== 8) throw new Error("compactação não suportada");
  const stream = new Response(raw as Uint8Array<ArrayBuffer>).body!.pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

class Zip {
  private constructor(private buf: Uint8Array, private entries: Map<string, Entry>) {}
  static open(buf: ArrayBuffer) { const u = new Uint8Array(buf); return new Zip(u, listZip(u)); }
  names() { return [...this.entries.keys()]; }
  async text(name: string): Promise<string | null> {
    const e = this.entries.get(name);
    return e ? readEntry(this.buf, e) : null;
  }
  async xml(name: string): Promise<Document | null> {
    const t = await this.text(name);
    return t === null ? null : new DOMParser().parseFromString(t, "application/xml");
  }
}

// ---------- XML ----------

const all = (n: Document | Element, tag: string) => Array.from(n.getElementsByTagNameNS("*", tag));
const kids = (n: Element, tag: string) => Array.from(n.children).filter((c) => c.localName === tag);
const attr = (n: Element, name: string) => n.getAttribute(name) ?? (Array.from(n.attributes).find((a) => a.localName === name)?.value ?? null);

/** Resolve o alvo de uma relação (relativo à pasta do arquivo, ou absoluto a partir da raiz do zip). */
const resolve = (dir: string, target: string) => {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${dir}/${target}`.split("/");
  const out: string[] = [];
  for (const p of parts) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
  return out.join("/");
};

async function rels(zip: Zip, path: string) {
  const doc = await zip.xml(path);
  const map = new Map<string, string>();
  if (doc) for (const r of all(doc, "Relationship")) { const id = attr(r, "Id"), t = attr(r, "Target"); if (id && t) map.set(id, t); }
  return map;
}

// ---------- planilhas ----------

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const isDateFormat = (code: string) => /[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ""));

/** Número serial do Excel -> "dd/mm/aaaa" (com hora se houver). */
export function excelDate(serial: number, date1904 = false): string {
  const ms = Math.round((serial + (date1904 ? 1462 : 0) - 25569) * 86400000);
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  const time = d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds() ? ` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : "";
  if (serial < 1) return time.trim() || day; // só hora
  return day + time;
}

const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const csvCell = (s: string) => (/[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const textOf = (n: Element) => all(n, "t").filter((t) => !t.closest("rPh")).map((t) => t.textContent ?? "").join("");

async function readXlsx(zip: Zip): Promise<string> {
  const wb = await zip.xml("xl/workbook.xml");
  if (!wb) throw new Error("planilha sem conteúdo");
  const date1904 = all(wb, "workbookPr").some((p) => ["1", "true"].includes(attr(p, "date1904") ?? ""));
  const wbRels = await rels(zip, "xl/_rels/workbook.xml.rels");

  const sstDoc = await zip.xml("xl/sharedStrings.xml");
  const shared = sstDoc ? all(sstDoc, "si").map(textOf) : [];

  const dateStyles = new Set<number>();
  const styles = await zip.xml("xl/styles.xml");
  if (styles) {
    const custom = new Map<number, string>();
    for (const f of all(styles, "numFmt")) custom.set(Number(attr(f, "numFmtId")), attr(f, "formatCode") ?? "");
    const xfs = all(styles, "cellXfs")[0];
    if (xfs) kids(xfs, "xf").forEach((xf, i) => {
      const id = Number(attr(xf, "numFmtId") ?? 0);
      if (BUILTIN_DATE.has(id) || (custom.has(id) && isDateFormat(custom.get(id)!))) dateStyles.add(i);
    });
  }

  const sections: string[] = [];
  const sheets = all(wb, "sheet");
  for (const sh of sheets) {
    const name = attr(sh, "name") ?? "Planilha";
    const target = wbRels.get(attr(sh, "id") ?? "");
    const doc = target ? await zip.xml(resolve("xl", target)) : null;
    if (!doc) continue;
    const lines: string[] = [];
    for (const row of all(doc, "row")) {
      const cells: string[] = [];
      let next = 0;
      for (const c of kids(row, "c")) {
        const ref = attr(c, "r");
        const idx = ref ? colIndex(ref) : next;
        next = idx + 1;
        const t = attr(c, "t") ?? "n";
        const v = kids(c, "v")[0]?.textContent ?? "";
        let val: string;
        if (t === "s") val = shared[Number(v)] ?? "";
        else if (t === "inlineStr") val = kids(c, "is")[0] ? textOf(kids(c, "is")[0]!) : "";
        else if (t === "b") val = v === "1" ? "VERDADEIRO" : v === "0" ? "FALSO" : v;
        else if (t === "n" && v !== "" && dateStyles.has(Number(attr(c, "s") ?? -1))) val = excelDate(Number(v), date1904);
        else val = v;
        cells[idx] = val;
      }
      const filled = Array.from(cells, (x) => x ?? "");
      while (filled.length && !filled[filled.length - 1]!.trim()) filled.pop();
      if (filled.length) lines.push(filled.map(csvCell).join(","));
    }
    if (lines.length) sections.push(`${sheets.length > 1 ? `## Aba: ${name}\n` : ""}${lines.join("\n")}`);
  }
  return sections.join("\n\n");
}

// ---------- Word ----------

const paraText = (p: Element) => {
  let s = "";
  const walk = (n: Element) => {
    for (const c of Array.from(n.children)) {
      if (c.localName === "t") s += c.textContent ?? "";
      else if (c.localName === "tab") s += "\t";
      else if (c.localName === "br" || c.localName === "cr") s += "\n";
      else if (c.localName !== "p" && c.localName !== "tbl") walk(c);
    }
  };
  walk(p);
  return s;
};

function blockText(n: Element): string[] {
  const out: string[] = [];
  for (const c of Array.from(n.children)) {
    if (c.localName === "p") out.push(paraText(c));
    else if (c.localName === "tbl") {
      for (const tr of kids(c, "tr")) out.push(kids(tr, "tc").map((tc) => blockText(tc).join(" ").trim()).join(" | "));
    } else out.push(...blockText(c));
  }
  return out;
}

async function readDocx(zip: Zip): Promise<string> {
  const doc = await zip.xml("word/document.xml");
  const body = doc ? all(doc, "body")[0] : undefined;
  if (!body) throw new Error("documento sem conteúdo");
  return blockText(body).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------- PowerPoint ----------

async function readPptx(zip: Zip): Promise<string> {
  const num = (n: string) => Number(/(\d+)\.xml$/.exec(n)?.[1] ?? 0);
  const slides = zip.names().filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  const out: string[] = [];
  for (const s of slides) {
    const doc = await zip.xml(s);
    if (!doc) continue;
    const paras = all(doc, "p").map((p) => all(p, "t").map((t) => t.textContent ?? "").join("")).filter((t) => t.trim());
    if (paras.length) out.push(`## Slide ${num(s)}\n${paras.join("\n")}`);
  }
  return out.join("\n\n");
}

/** Extrai o texto de um .xlsx/.docx/.pptx. */
export async function officeToText(buf: ArrayBuffer, kind: OfficeKind): Promise<string> {
  const zip = Zip.open(buf);
  const text = kind === "xlsx" ? await readXlsx(zip) : kind === "docx" ? await readDocx(zip) : await readPptx(zip);
  if (!text.trim()) throw new Error("não encontrei texto no arquivo");
  return text;
}
