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

/* ───────────── extrato premium (imagem) ───────────── */
export type CardRow = { title: string; sub: string; date: string; value: number; tone: "verde" | "roxo" | "neutro" };
export type StatementCardData = {
  me: string; person: string; period: string; accumulated: boolean; generatedOn: string;
  dele: CardRow[]; meu: CardRow[]; pix: CardRow[]; aguardando: number;
  owedToMe: number; owedByMe: number; pixNet: number; net: number; // centavos
};
const brlC = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const C = { cyan: "#5ee6ff", violet: "#a78bfa", emerald: "#4ade80", amber: "#fbbf24", text: "#eef2ff", muted: "#8b93b8", line: "rgba(255,255,255,0.09)" };

/** Extrato com a cara do Orion: fundo escuro com brilho, resultado em destaque e as compras de cada lado. Desenhado em canvas (2x). */
export async function statementCard(d: StatementCardData): Promise<Blob> {
  try { await document.fonts?.ready; } catch { /* sem fontes web: usa as do sistema */ }
  const W = 1080, PAD = 64, S = 2, sans = `"Manrope", system-ui, -apple-system, "Segoe UI", sans-serif`, display = `"Sora", "Manrope", system-ui, sans-serif`, mono = `"JetBrains Mono", ui-monospace, Menlo, monospace`;
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("não consegui montar a imagem");
  const rr = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const spaced = (t: string, x: number, y: number, gap: number, align: "left" | "right" = "left") => { // texto com espaçamento entre letras
    const chars = [...t], widths = chars.map((c) => ctx.measureText(c).width + gap), total = widths.reduce((a, b) => a + b, 0) - gap;
    let cx = align === "right" ? x - total : x; chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i]!; });
  };
  const ellipsis = (t: string, max: number) => { if (ctx.measureText(t).width <= max) return t; let o = t; while (o.length > 1 && ctx.measureText(`${o}…`).width > max) o = o.slice(0, -1); return `${o}…`; };

  const draw = (H: number, dry: boolean): number => {
    let y = 0;
    if (!dry) {
      ctx.save(); ctx.scale(S, S);
      const bg = ctx.createLinearGradient(0, 0, W * 0.4, H); bg.addColorStop(0, "#080b22"); bg.addColorStop(1, "#05060f");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const g1 = ctx.createRadialGradient(120, 60, 0, 120, 60, 620); g1.addColorStop(0, "rgba(139,92,246,0.42)"); g1.addColorStop(1, "rgba(139,92,246,0)"); ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      const g2 = ctx.createRadialGradient(W - 80, H - 40, 0, W - 80, H - 40, 560); g2.addColorStop(0, "rgba(34,211,238,0.28)"); g2.addColorStop(1, "rgba(34,211,238,0)"); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.045)"; for (let gx = 20; gx < W; gx += 24) for (let gy = 20; gy < H; gy += 24) ctx.fillRect(gx, gy, 1.4, 1.4);
      const bd = ctx.createLinearGradient(0, 0, W, H); bd.addColorStop(0, "rgba(167,139,250,0.7)"); bd.addColorStop(0.5, "rgba(255,255,255,0.08)"); bd.addColorStop(1, "rgba(94,230,255,0.6)");
      ctx.strokeStyle = bd; ctx.lineWidth = 2; rr(14, 14, W - 28, H - 28, 34); ctx.stroke();
    }
    const T = (fn: () => void) => { if (!dry) fn(); };
    y = 78;
    T(() => { ctx.font = `600 17px ${mono}`; ctx.fillStyle = C.cyan; ctx.textBaseline = "alphabetic"; spaced("ORION · ACERTO DE CONTAS", PAD, y, 3.4); ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.font = `500 17px ${mono}`; spaced(d.period.toUpperCase() + (d.accumulated ? " · ACUMULADO" : ""), W - PAD, y, 2.2, "right"); });
    y += 74;
    T(() => { ctx.font = `600 52px ${display}`; const a = ctx.measureText(`${d.me} `).width, x = ctx.measureText("×").width; ctx.fillStyle = C.text; ctx.fillText(d.me, PAD, y); ctx.fillStyle = C.violet; ctx.fillText("×", PAD + a, y); ctx.fillStyle = C.text; ctx.fillText(d.person, PAD + a + x + 14, y); });
    y += 34;
    T(() => { ctx.font = `500 20px ${sans}`; ctx.fillStyle = C.muted; ctx.fillText(`Gerado em ${d.generatedOn.split("-").reverse().join("/")}`, PAD, y); });
    // resultado em destaque
    y += 38;
    const heroH = 188, net = d.net, abs = Math.abs(net);
    const quite = net === 0, credito = net < 0 && d.owedByMe === 0, recebe = net > 0;
    const heroColor = quite ? C.cyan : recebe ? C.emerald : credito ? C.cyan : C.violet;
    T(() => {
      const hg = ctx.createLinearGradient(PAD, y, W - PAD, y + heroH); hg.addColorStop(0, "rgba(255,255,255,0.075)"); hg.addColorStop(1, "rgba(255,255,255,0.025)");
      ctx.fillStyle = hg; rr(PAD, y, W - PAD * 2, heroH, 28); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1.5; rr(PAD, y, W - PAD * 2, heroH, 28); ctx.stroke();
      ctx.fillStyle = heroColor; rr(PAD, y + 28, 5, heroH - 56, 3); ctx.fill();
      ctx.font = `600 16px ${mono}`; ctx.fillStyle = C.muted; spaced("RESULTADO", PAD + 36, y + 50, 3.2);
      ctx.font = `600 76px ${display}`; const vg = ctx.createLinearGradient(PAD + 36, 0, PAD + 560, 0); vg.addColorStop(0, heroColor); vg.addColorStop(1, quite ? C.violet : C.cyan);
      ctx.fillStyle = vg; ctx.fillText(quite ? "Quites" : brlC(abs), PAD + 34, y + 128);
      ctx.font = `500 24px ${sans}`; ctx.fillStyle = C.text;
      const msg = quite ? "Ninguém deve nada" : recebe ? `${d.person} paga a ${d.me}` : credito ? `${d.person} adiantou (crédito)` : `${d.me} paga a ${d.person}`;
      ctx.textAlign = "right"; ctx.fillText(msg, W - PAD - 36, y + 120); ctx.textAlign = "left";
    });
    y += heroH + 44;

    const section = (title: string, rows: CardRow[], total: number, color: string, emptyTxt: string) => {
      T(() => { ctx.font = `700 25px ${display}`; ctx.fillStyle = C.text; ctx.fillText(title, PAD, y); ctx.textAlign = "right"; ctx.fillStyle = color; ctx.fillText(brlC(total), W - PAD, y); ctx.textAlign = "left"; ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PAD, y + 16); ctx.lineTo(W - PAD, y + 16); ctx.stroke(); });
      y += 28;
      if (!rows.length) { T(() => { ctx.font = `400 19px ${sans}`; ctx.fillStyle = C.muted; ctx.fillText(emptyTxt, PAD, y + 28); }); y += 54; }
      for (const r of rows) {
        T(() => {
          ctx.font = `500 21px ${mono}`; ctx.fillStyle = C.muted; ctx.fillText(r.date, PAD, y + 34);
          ctx.font = `600 25px ${sans}`; ctx.fillStyle = C.text; ctx.fillText(ellipsis(r.title, 560), PAD + 92, y + 32);
          ctx.font = `400 19px ${sans}`; ctx.fillStyle = C.muted; ctx.fillText(ellipsis(r.sub, 600), PAD + 92, y + 60);
          ctx.font = `700 27px ${display}`; ctx.fillStyle = r.tone === "verde" ? C.emerald : r.tone === "roxo" ? C.violet : C.text; ctx.textAlign = "right"; ctx.fillText(brlC(r.value), W - PAD, y + 40); ctx.textAlign = "left";
          ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD + 92, y + 78); ctx.lineTo(W - PAD, y + 78); ctx.stroke();
        });
        y += 82;
      }
      y += 44;
    };
    section(`${d.person} deve a você`, d.dele, d.owedToMe, C.emerald, "Nada no seu cartão neste período.");
    section(`Você deve a ${d.person}`, d.meu, d.owedByMe, C.violet, "Nada no cartão dele(a) neste período.");
    if (d.pix.length) section("Pix já feitos", d.pix, Math.abs(d.pixNet), C.text, "");

    // conta final
    const lines: [string, string, string][] = [[`${d.person} deve a você`, brlC(d.owedToMe), C.emerald], [`Você deve a ${d.person}`, `− ${brlC(d.owedByMe)}`, C.violet]];
    if (d.pixNet !== 0) lines.push(["Pix já feitos", `${d.pixNet > 0 ? "−" : "+"} ${brlC(Math.abs(d.pixNet))}`, C.text]);
    if (d.aguardando !== 0) lines.push(["Pix aguardando (ainda não conta)", brlC(Math.abs(d.aguardando)), C.amber]);
    const boxH = 40 + lines.length * 40 + 24;
    T(() => {
      ctx.fillStyle = "rgba(0,0,0,0.28)"; rr(PAD, y, W - PAD * 2, boxH, 24); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; rr(PAD, y, W - PAD * 2, boxH, 24); ctx.stroke();
      lines.forEach(([l, v, col], i) => { const ly = y + 52 + i * 40; ctx.font = `400 21px ${sans}`; ctx.fillStyle = C.muted; ctx.fillText(l, PAD + 32, ly); ctx.font = `700 23px ${display}`; ctx.fillStyle = col; ctx.textAlign = "right"; ctx.fillText(v, W - PAD - 32, ly); ctx.textAlign = "left"; });
    });
    y += boxH + 52;
    T(() => { ctx.font = `500 15px ${mono}`; ctx.fillStyle = "rgba(139,147,184,0.75)"; spaced("GERADO PELO ORION", W / 2 - 100, y, 3); });
    y += 70;
    if (!dry) ctx.restore();
    return y;
  };
  const H = Math.ceil(draw(0, true));
  canvas.width = W * S; canvas.height = H * S;
  draw(H, false);
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
