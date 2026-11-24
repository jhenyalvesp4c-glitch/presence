/** Planilhas (Excel, Google Sheets baixado como .xlsx ou .csv) → resumo em texto para a IA: abas, colunas, quantidade de linhas, valores mais comuns e uma amostra. Puro, testado. */
export type SheetLike = { sheet: string; data: unknown[][] };

const pad = (n: number) => String(n).padStart(2, "0");
const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace(".", ",");
  return String(v).replace(/\s+/g, " ").trim();
};
const fmt = (n: number) => n.toLocaleString("pt-BR");

/** CSV simples (vírgula ou ponto e vírgula, aspas). */
export function parseCsv(text: string): unknown[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export function summarizeSheets(file: string, sheets: SheetLike[], opts: { maxChars?: number; sample?: number } = {}): string {
  const maxChars = opts.maxChars ?? 14000, sample = opts.sample ?? 8, out: string[] = [`Planilha: ${file}`];
  const real = sheets.filter((s) => s.data.some((r) => r.some((c) => cell(c))));
  if (!real.length) return `${out[0]}\n(A planilha está vazia.)`;
  out.push(`${real.length} ${real.length === 1 ? "aba" : "abas"}: ${real.map((s) => s.sheet).join(", ")}`);
  for (const s of real) {
    const rows = s.data.map((r) => r.map(cell)).filter((r) => r.some(Boolean));
    const head = rows[0] ?? [], body = rows.slice(1), cols = Math.max(head.length, ...body.slice(0, 200).map((r) => r.length));
    const names = Array.from({ length: cols }, (_, i) => head[i] || `Coluna ${i + 1}`);
    out.push("", `Aba "${s.sheet}": ${fmt(body.length)} ${body.length === 1 ? "linha" : "linhas"} de dados · ${cols} ${cols === 1 ? "coluna" : "colunas"}: ${names.join(", ")}`);
    // valores mais comuns das colunas com poucos valores diferentes (status, cidade, template…)
    const common: string[] = [];
    for (let c = 0; c < cols; c++) {
      const count = new Map<string, number>();
      for (const r of body) { const v = r[c] ?? ""; if (v) count.set(v, (count.get(v) ?? 0) + 1); }
      if (count.size >= 2 && count.size <= 12 && count.size < body.length) common.push(`  ${names[c]}: ${[...count].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v.slice(0, 40)} (${fmt(n)})`).join(", ")}`);
    }
    if (common.length) out.push("Valores que se repetem:", ...common.slice(0, 8));
    // quantos telefones/e-mails parecem estar preenchidos (bases de disparo)
    const phoneCol = names.findIndex((n) => /telefone|celular|whats|fone|phone/i.test(n)), mailCol = names.findIndex((n) => /e-?mail/i.test(n));
    if (phoneCol >= 0) { const n = body.filter((r) => (r[phoneCol] ?? "").replace(/\D/g, "").length >= 8).length; out.push(`Coluna "${names[phoneCol]}": ${fmt(n)} de ${fmt(body.length)} linhas com telefone válido${body.length - n ? ` (${fmt(body.length - n)} vazias ou inválidas)` : ""}.`); }
    if (mailCol >= 0) { const n = body.filter((r) => /.+@.+\..+/.test(r[mailCol] ?? "")).length; out.push(`Coluna "${names[mailCol]}": ${fmt(n)} e-mails válidos.`); }
    out.push(`Amostra (${Math.min(sample, body.length)} primeiras linhas):`);
    for (const [i, r] of body.slice(0, sample).entries()) out.push(`  ${i + 1}) ${names.map((n, c) => (r[c] ? `${n}: ${r[c]!.slice(0, 60)}` : "")).filter(Boolean).join(" | ")}`);
  }
  const text = out.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(resumo cortado)` : text;
}
