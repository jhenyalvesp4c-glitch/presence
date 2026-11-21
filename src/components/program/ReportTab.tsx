/** Relatório para o nutricionista: ver, imprimir/salvar em PDF, copiar o texto ou compartilhar. */
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Copy, FileText, Printer, Share2, X } from "lucide-react";

import { MEASURE_FIELDS } from "@/lib/program";
import { reportText, type Report } from "@/lib/program-report";

const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 mt-6 border-b border-white/15 pb-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">{children}</h3>;

function Doc({ r }: { r: Report }) {
  return (
    <article className="text-sm leading-relaxed" data-testid="relatorio-doc">
      <p className="mono-caps">Relatório de acompanhamento</p><h2 className="mt-1 font-serif text-3xl leading-tight">{r.titulo}</h2>
      <p className="mt-1 text-xs text-muted-foreground">Semana {r.periodo.semana} de {r.periodo.total} · início {dm(r.periodo.inicio)} · emitido em {dm(r.periodo.hoje)}</p>
      {r.perfil.length > 0 && <><H>Perfil</H><ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{r.perfil.map((p) => <li key={p}>{p}</li>)}</ul></>}
      {r.medidas.length > 0 && <><H>Peso e medidas (cm)</H><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-xs"><thead><tr className="text-left text-[0.6rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 pr-2 font-medium">Data</th><th className="pb-1 pr-2 font-medium">Peso</th>{MEASURE_FIELDS.map((f) => <th key={f.key} className="pb-1 pr-2 font-medium">{f.label.replace("direito", "D").replace("esquerdo", "E").replace("direita", "D").replace("esquerda", "E")}</th>)}</tr></thead>
        <tbody>{r.medidas.map((m) => <tr key={m.date} className="border-t border-white/10"><td className="py-1 pr-2">{dm(m.date)}</td><td className="py-1 pr-2 tabular-nums">{m.peso || "—"}</td>{MEASURE_FIELDS.map((f) => <td key={f.key} className="py-1 pr-2 tabular-nums">{m.valores[f.key] || "—"}</td>)}</tr>)}</tbody></table></div></>}
      {r.semanais.length > 0 && <><H>Avaliações semanais</H><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-xs"><thead><tr className="text-left text-[0.6rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 pr-2 font-medium">Semana</th><th className="pb-1 pr-2 font-medium">Peso</th><th className="pb-1 pr-2 font-medium">Dias</th><th className="pb-1 pr-2 font-medium">Disposição</th><th className="pb-1 pr-2 font-medium">Recuperação</th><th className="pb-1 font-medium">Observações</th></tr></thead>
        <tbody>{r.semanais.map((w) => <tr key={w.week} className="border-t border-white/10 align-top"><td className="py-1 pr-2">{w.week}</td><td className="py-1 pr-2">{w.weight ?? "—"}</td><td className="py-1 pr-2">{w.daysTrained ?? "—"}</td><td className="py-1 pr-2">{w.energy ?? "—"}</td><td className="py-1 pr-2">{w.recovery ?? "—"}</td><td className="py-1">{w.notes || "—"}</td></tr>)}</tbody></table></div></>}
      {r.aderencia.length > 0 && <><H>Aderência (feitos / planejados)</H><p className="tabular-nums">{r.aderencia.map((a) => `S${a.week}: ${a.feitos}/${a.planejados}`).join(" · ")}</p></>}
      {r.cargas.length > 0 && <><H>Progressão das cargas</H><ul className="space-y-1">{r.cargas.map((c) => <li key={c.nome}><b>{c.nome}</b>: {String(c.primeira).replace(".", ",")} → {String(c.ultima).replace(".", ",")} kg em {c.treinos} treino(s){c.recorde ? ` · melhor série ${c.recorde}` : ""}</li>)}</ul></>}
      {r.observacoes.length > 0 && <><H>Observações</H><ul className="list-disc space-y-1 pl-5">{r.observacoes.map((o) => <li key={o}>{o}</li>)}</ul></>}
      <p className="mt-6 border-t border-white/10 pt-3 text-[0.65rem] text-muted-foreground">Uma medida isolada não indica ganho ou perda de músculo: a leitura é pela tendência, em conjunto com fotos e desempenho.</p>
    </article>
  );
}

export function ReportTab({ report }: { report: Report }) {
  const [open, setOpen] = useState(false), text = reportText(report);
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast.success("Relatório copiado", { description: "Cole no WhatsApp ou no e-mail do nutricionista." }); } catch { toast.error("Não consegui copiar. Use Imprimir / salvar PDF."); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: report.titulo, text }); else await copy(); } catch { /* cancelado */ } };
  const bar = <div data-print-hide className="mb-3 flex flex-wrap items-center justify-end gap-2">
    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm hover:bg-white/10" data-testid="relatorio-imprimir"><Printer size={15} /> Imprimir / salvar PDF</button>
    <button onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-4 py-2 text-sm text-cyan hover:bg-cyan/20" data-testid="relatorio-copiar"><Copy size={15} /> Copiar texto</button>
    <button onClick={() => void share()} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm hover:bg-white/10"><Share2 size={15} /> Compartilhar</button></div>;
  return (
    <div className="space-y-4">
      <section className="ex-card px-5 py-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-display text-xl font-semibold"><FileText size={18} className="text-cyan" /> Relatório para o nutricionista</h2><p className="text-xs text-muted-foreground">Peso, medidas, avaliações semanais, aderência e progressão das cargas, num documento só.</p></div>
        <button onClick={() => setOpen(true)} className="rounded-full border border-cyan/50 bg-cyan/10 px-5 py-2.5 text-sm font-medium text-cyan hover:bg-cyan/20" data-testid="relatorio-abrir">Abrir relatório em tela cheia</button></div>
        {bar}<Doc r={report} /></section>
      {open && createPortal(<div data-plano-portal className="fixed inset-0 z-[70] overflow-y-auto bg-background p-3 sm:p-8" onClick={() => setOpen(false)}><div className="mx-auto max-w-3xl" onClick={(e) => e.stopPropagation()}><div data-print-hide className="mb-2 flex justify-end"><button onClick={() => setOpen(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10"><X size={16} /></button></div>{bar}<div className="glass rounded-3xl p-6 sm:p-8"><Doc r={report} /></div></div></div>, document.body)}
    </div>
  );
}
