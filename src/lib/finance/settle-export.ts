/** Saídas do acerto: imagem (PNG) para mandar no WhatsApp e PDF (pela impressão do navegador). Só no navegador. */

const stripMarks = (l: string) => l.replace(/^\*(.*)\*$/, "$1");

/** Desenha o texto do extrato numa imagem de fundo branco (fácil de ler e de enviar). */
export async function statementPng(text: string): Promise<Blob> {
  const W = 900, PAD = 40, LH = 34;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("não consegui montar a imagem");
  const font = (bold: boolean) => `${bold ? "700" : "400"} ${bold ? 24 : 22}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  // 1) quebra as linhas longas medindo o texto; 2) dimensiona a imagem; 3) desenha
  const rows: { t: string; bold: boolean }[] = [];
  for (const raw of text.split("\n")) {
    const bold = /^\*.*\*$/.test(raw); ctx.font = font(bold);
    let cur = "";
    for (const w of stripMarks(raw).split(" ")) { const test = cur ? `${cur} ${w}` : w; if (ctx.measureText(test).width > W - PAD * 2 && cur) { rows.push({ t: cur, bold }); cur = w; } else cur = test; }
    rows.push({ t: cur, bold });
  }
  canvas.width = W; canvas.height = PAD * 2 + rows.length * LH;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, canvas.height);
  let y = PAD + 24;
  for (const r of rows) { ctx.font = font(r.bold); ctx.fillStyle = r.bold ? "#0b1b2b" : "#26323f"; ctx.fillText(r.t, PAD, y); y += LH; }
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("falha ao gerar a imagem"))), "image/png"));
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Abre a impressão do navegador com o extrato formatado ("Salvar como PDF"). */
export function printStatement(title: string, text: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const body = text.split("\n").map((l) => (/^\*.*\*$/.test(l) ? `<h3>${esc(stripMarks(l))}</h3>` : l ? `<p>${esc(l)}</p>` : "<br/>")).join("");
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open(); d.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px/1.5 system-ui,sans-serif;color:#111;padding:24px;max-width:680px;margin:auto}h3{margin:18px 0 4px;font-size:15px}p{margin:2px 0}</style></head><body>${body}</body></html>`); d.close();
  let done = false;
  const go = () => { if (done || !f.contentWindow) return; done = true; f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 3000); };
  f.onload = go; setTimeout(go, 400);
}
