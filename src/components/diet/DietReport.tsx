/** Relatório da alimentação para o nutricionista: escolher o período, ver, imprimir/salvar PDF, copiar o texto ou compartilhar. */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { Copy, FileText, Printer, Share2, X } from "lucide-react";

import type { DietBundle } from "@/components/diet/DietHub";
import { buildDietReport, dietReportText, type DietReport } from "@/lib/diet-report";

const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const L = (iso: string, d: number) => { const x = new Date(iso + "T12:00:00"); x.setDate(x.getDate() - d + 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 mt-6 border-b border-white/15 pb-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">{children}</h3>;

function Doc({ r }: { r: DietReport }) {
  return (
    <article className="text-sm leading-relaxed" data-testid="dieta-relatorio-doc">
      <p className="mono-caps">Relatório de alimentação</p><h2 className="mt-1 font-serif text-3xl leading-tight">{r.titulo}</h2>
      <p className="mt-1 text-xs text-muted-foreground">Período {dm(r.periodo.de)} a {dm(r.periodo.ate)} · {r.periodo.registrados} de {r.periodo.dias} dias registrados · emitido em {dm(r.periodo.emitido)}</p>
      {r.perfil.length > 0 && <><H>Perfil</H><ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{r.perfil.map((p) => <li key={p}>{p}</li>)}</ul></>}
      {r.meta && <><H>Meta</H><p>{r.meta}</p></>}
      {r.media && <><H>Média dos dias registrados</H><div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">{([["Calorias", `${r.media.kcal} kcal`], ["Proteína", `${r.media.p} g`], ["Carboidrato", `${r.media.c} g`], ["Gordura", `${r.media.f} g`], ["Água", r.media.aguaMl !== null ? `${(r.media.aguaMl / 1000).toFixed(1).replace(".", ",")} L` : "—"]] as const).map(([k, v]) => <div key={k} className="rounded-xl border border-white/10 p-2"><b className="block font-display text-lg">{v}</b><span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{k}</span></div>)}</div></>}
      {r.dias.length > 0 && <><H>Dia a dia</H><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-xs"><thead><tr className="text-left text-[0.6rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 pr-2 font-medium">Data</th><th className="pb-1 pr-2 font-medium">Opção</th><th className="pb-1 pr-2 font-medium">kcal</th><th className="pb-1 pr-2 font-medium">Prot.</th><th className="pb-1 pr-2 font-medium">Carbo</th><th className="pb-1 pr-2 font-medium">Gord.</th><th className="pb-1 pr-2 font-medium">Refeições</th><th className="pb-1 pr-2 font-medium">Água</th><th className="pb-1 pr-2 font-medium">Evacuou</th></tr></thead>
        <tbody>{r.dias.map((d) => <tr key={d.date} className="border-t border-white/10 align-top"><td className="py-1 pr-2">{dm(d.date)}</td><td className="py-1 pr-2">{d.opcao.split("—")[0]?.trim()}</td><td className="py-1 pr-2 tabular-nums">{d.kcal}</td><td className="py-1 pr-2 tabular-nums">{d.p}</td><td className="py-1 pr-2 tabular-nums">{d.c}</td><td className="py-1 pr-2 tabular-nums">{d.f}</td><td className="py-1 pr-2">{d.refeicoes}</td><td className="py-1 pr-2">{d.aguaMl !== null ? `${(d.aguaMl / 1000).toFixed(1).replace(".", ",")} L` : "—"}</td><td className="py-1 pr-2">{d.bowel === null ? "—" : d.bowel ? "Sim" : "Não"}</td></tr>)}</tbody></table></div>
        <H>O que foi comido</H><div className="space-y-3">{r.dias.filter((d) => d.alimentos.length).map((d) => <div key={d.date} className="text-xs"><b>{dm(d.date)}</b>{d.alimentos.map((g) => <p key={g.refeicao} className="text-muted-foreground"><span className="text-foreground">{g.refeicao}:</span> {g.itens.map((e) => `${e.nome}${e.qtd ? ` (${e.qtd})` : ""}`).join(", ")}</p>)}</div>)}{!r.dias.some((d) => d.alimentos.length) && <p className="text-xs text-muted-foreground">Nenhum alimento registrado em gramas/colheres neste período.</p>}</div></>}
      {r.semanais.length > 0 && <><H>Avaliações semanais</H><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs"><thead><tr className="text-left text-[0.6rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 pr-2 font-medium">Semana</th><th className="pb-1 pr-2 font-medium">Peso</th><th className="pb-1 pr-2 font-medium">Cintura</th><th className="pb-1 pr-2 font-medium">Abdômen</th><th className="pb-1 pr-2 font-medium">Quadril</th><th className="pb-1 pr-2 font-medium">Evac.</th></tr></thead><tbody>{r.semanais.map((w) => <tr key={w.week} className="border-t border-white/10"><td className="py-1 pr-2">{w.week}</td><td className="py-1 pr-2">{w.weight ?? "—"}</td><td className="py-1 pr-2">{w.waist ?? "—"}</td><td className="py-1 pr-2">{w.abdomen ?? "—"}</td><td className="py-1 pr-2">{w.hip ?? "—"}</td><td className="py-1 pr-2">{w.bowelCount ?? "—"}</td></tr>)}</tbody></table></div></>}
      {r.opcoes.filter((o) => o.dias > 0).length > 1 && <><H>Comparação das opções</H><ul className="space-y-1">{r.opcoes.filter((o) => o.dias > 0).map((o) => <li key={o.id}><b>{o.nome}</b>: {o.dias} dia(s) · {o.kcal ?? "—"} kcal · proteína {o.protein ?? "—"} g · refeições cumpridas {o.adherence}%</li>)}</ul></>}
      {r.observacoes.length > 0 && <><H>Observações</H><ul className="list-disc space-y-1 pl-5">{r.observacoes.map((o) => <li key={o}>{o}</li>)}</ul></>}
      <p className="mt-6 border-t border-white/10 pt-3 text-[0.65rem] text-muted-foreground">Calorias e macros são estimativas pelas porções informadas; o plano é uma proposta inicial a validar com nutricionista e médico.</p>
    </article>
  );
}

export function DietReportTab({ b }: { b: DietBundle }) {
  const [days, setDays] = useState(7), [open, setOpen] = useState(false), to = b.today, from = days === 0 ? b.row.startDate : L(to, days);
  const report = useMemo(() => buildDietReport(b.plan, from, to, to, b.logs, b.weeklies), [b.plan, from, to, b.logs, b.weeklies]), text = dietReportText(report);
  const copy = async () => { if (await copyText(text)) toast.success("Relatório copiado", { description: "Cole no WhatsApp ou no e-mail do nutricionista." }); else toast.error("Não consegui copiar. Use Imprimir / salvar PDF."); };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: report.titulo, text }); else await copy(); } catch { /* cancelado */ } };
  const bar = <div data-print-hide className="mb-3 flex flex-wrap items-center justify-end gap-2">
    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm hover:bg-white/10" data-testid="dieta-relatorio-imprimir"><Printer size={15} /> Imprimir / salvar PDF</button>
    <button onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/10 px-4 py-2 text-sm text-emerald hover:bg-emerald/20" data-testid="dieta-relatorio-copiar"><Copy size={15} /> Copiar texto</button>
    <button onClick={() => void share()} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm hover:bg-white/10"><Share2 size={15} /> Compartilhar</button></div>;
  return (
    <div className="space-y-4" data-testid="dieta-relatorio">
      <section className="ex-card px-5 py-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-display text-xl font-semibold"><FileText size={18} className="text-emerald" /> Relatório para o nutricionista</h2><p className="text-xs text-muted-foreground">Dia a dia: calorias, macros, o que você comeu em gramas e colheres, água, como foi o dia e as avaliações semanais.</p></div>
        <div className="flex gap-1.5" role="tablist" aria-label="Período">{([[7, "7 dias"], [14, "14 dias"], [30, "30 dias"], [0, "Tudo"]] as const).map(([d, l]) => <button key={d} role="tab" aria-selected={days === d} onClick={() => setDays(d)} data-testid={`dieta-periodo-${d}`} className={`rounded-full border px-3 py-1.5 text-xs transition ${days === d ? "border-emerald/60 bg-emerald/15 text-emerald" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{l}</button>)}</div></div>
        <div className="mt-3 flex justify-end"><button onClick={() => setOpen(true)} className="rounded-full border border-emerald/50 bg-emerald/10 px-5 py-2 text-sm font-medium text-emerald hover:bg-emerald/20" data-testid="dieta-relatorio-abrir">Abrir em tela cheia</button></div>
        {bar}<Doc r={report} /></section>
      {open && createPortal(<div data-plano-portal className="fixed inset-0 z-[70] overflow-y-auto bg-background p-3 sm:p-8" onClick={() => setOpen(false)}><div className="mx-auto max-w-3xl" onClick={(e) => e.stopPropagation()}><div data-print-hide className="mb-2 flex justify-end"><button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full border border-white/15 p-2 hover:bg-white/10"><X size={16} /></button></div>{bar}<Doc r={report} /></div></div>, document.body)}
    </div>
  );
}
