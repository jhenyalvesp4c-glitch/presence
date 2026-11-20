/** Plano final de uma ideia: documento único com detalhes, referências (imagens), perguntas e respostas, riscos, passos e o que precisa. Dá para imprimir/salvar em PDF ou guardar na documentação. */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Pencil, Check, Clock, ExternalLink, HelpCircle, ListChecks, Loader2, Printer, Users, Wallet, X } from "lucide-react";

import { Ring } from "@/components/finance/charts";
import { FinBackdrop, HeroPanel, LiveDot, OrbitArt, Tilt } from "@/components/finance/fx";

import { addEntry, type NewFile } from "@/lib/data/brain";
import { ideaFileUrls } from "@/lib/data/ideas";
import { brl } from "@/lib/finance/settle";
import { AREAS, budgetLines, budgetTotals, statusLabel, type Idea } from "@/lib/ideas";

const dateBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const rise = (n: number) => ({ animation: "fin-rise .65s both", animationDelay: `${n * 90}ms` }) as React.CSSProperties;
const Sec = ({ n, Icon, title, color = "var(--cyan)", children }: { n: number; Icon: typeof Clock; title: string; color?: string; children: React.ReactNode }) => (
  <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6" style={rise(n)}>
    <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-20 blur-3xl" style={{ background: color }} />
    <h3 className="relative mb-4 flex items-center gap-2.5 font-display text-sm font-semibold uppercase tracking-[0.16em]"><span className="grid h-8 w-8 place-items-center rounded-xl border" style={{ color, borderColor: `color-mix(in oklab, ${color} 40%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)` }}><Icon size={15} /></span>{title}<span aria-hidden className="ml-1 h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" /></h3>
    <div className="relative">{children}</div>
  </section>
);
const doneKey = (id: string) => `orion:plano-passos:${id}`;

/** Texto corrido do plano (vai para a documentação). */
export function planMarkdown(i: Idea): string {
  const p = i.plan, L = (t: string, xs: string[]) => (xs.length ? `\n${t}:\n${xs.map((x) => `- ${x}`).join("\n")}` : "");
  return [
    `PLANO FINAL: ${i.title}`, `${AREAS.find((a) => a.id === i.area)?.label ?? i.area} · ${statusLabel(i.status)}${i.tags.length ? ` · ${i.tags.map((t) => `#${t}`).join(" ")}` : ""}`,
    i.body && `\nDetalhes:\n${i.body}`, p?.resumo && `\nResumo: ${p.resumo}`, p?.proximoPasso && `\nPróximo passo: ${p.proximoPasso}`,
    p?.perguntas.length ? `\nPerguntas e respostas:\n${p.perguntas.map((q) => `- ${q.q}\n  → ${q.a || "(sem resposta)"}`).join("\n")}` : "",
    p ? L("Riscos", p.riscos) : "", p ? L("Primeiros passos", p.passos.map((x, n) => `${n + 1}. ${x}`)) : "",
    p ? `\nO que precisa: tempo — ${p.precisa.tempo || "—"}; dinheiro — ${p.precisa.dinheiro || "—"}; pessoas — ${p.precisa.pessoas || "—"}` : "",
    i.budget.length ? `\nOrçamento (total ${budgetTotals(i.budget).total.toFixed(2).replace(".", ",")} reais; já gasto ${budgetTotals(i.budget).comprado.toFixed(2).replace(".", ",")}):\n${budgetLines(i.budget).map((x) => `- ${x}`).join("\n")}` : "",
    i.links.length ? L("Links", i.links) : "",
  ].filter(Boolean).join("\n");
}

export function PlanView({ idea, onClose, onEdit }: { idea: Idea; onClose: () => void; onEdit?: () => void }) {
  const p = idea.plan, [urls, setUrls] = useState<Record<string, { view: string; download: string }>>({}), [saving, setSaving] = useState(false), [zoom, setZoom] = useState<string | null>(null);
  const [done, setDone] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem(doneKey(idea.id)) ?? "[]") as number[]; } catch { return []; } });
  const imgs = idea.attachments.filter((a) => a.mime.startsWith("image/")), others = idea.attachments.filter((a) => !a.mime.startsWith("image/"));
  const answered = p ? p.perguntas.filter((q) => q.a.trim()).length : 0, total = p?.perguntas.length ?? 0;
  useEffect(() => { if (idea.attachments.length) void ideaFileUrls(idea.attachments).then(setUrls).catch(() => undefined); }, [idea.attachments]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") { if (zoom) setZoom(null); else onClose(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose, zoom]);
  const tick = (n: number) => setDone((d) => { const next = d.includes(n) ? d.filter((x) => x !== n) : [...d, n]; try { localStorage.setItem(doneKey(idea.id), JSON.stringify(next)); } catch { /* sem armazenamento: vale só nesta tela */ } return next; });

  const toDocs = async () => {
    setSaving(true);
    try {
      const files: NewFile[] = [];
      for (const a of idea.attachments) { const u = urls[a.path]; if (!u) continue; const r = await fetch(u.view); if (r.ok) files.push({ name: a.name, mime: a.mime, blob: await r.blob() }); }
      await addEntry({ title: `Plano final: ${idea.title}`.slice(0, 200), text: planMarkdown(idea).slice(0, 6000), files });
      toast.success("Plano guardado na documentação", { description: files.length ? `Com ${files.length} referência(s) anexada(s).` : undefined });
    } catch (e) { toast.error(`Não consegui guardar: ${(e as Error).message}`); }
    setSaving(false);
  };
  const pill = "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition";

  return createPortal(
    <div data-plano-portal className="plano-root fixed inset-0 z-[70] overflow-y-auto bg-background p-3 sm:p-8" onClick={onClose} data-testid="plano-final">
      <FinBackdrop />
      <div className="relative mx-auto w-full max-w-4xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div data-print-hide className="flex flex-wrap items-center justify-end gap-2" style={rise(0)}>
          {onEdit && <button onClick={onEdit} className={`${pill} border-violet/50 bg-violet/15 text-violet hover:bg-violet/25`} data-testid="plano-editar"><Pencil size={15} /> Editar</button>}
          <button onClick={() => window.print()} className={`${pill} border-white/15 bg-white/[0.06] hover:bg-white/10`} data-testid="plano-imprimir"><Printer size={15} /> Imprimir / salvar PDF</button>
          <button onClick={() => void toDocs()} disabled={saving} className={`${pill} border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20 disabled:opacity-50`} data-testid="plano-guardar">{saving ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />} Guardar na documentação</button>
          <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.06] hover:bg-white/10"><X size={16} /></button>
        </div>

        <HeroPanel glow="var(--violet)">
          <div className="grid items-center gap-6 md:grid-cols-[1.4fr_0.6fr]">
            <div>
              <p className="mono-caps flex flex-wrap items-center gap-3">Plano final · Orion <LiveDot color="var(--emerald)" label={idea.status === "fazendo" ? "em andamento" : "plano pronto"} /></p>
              <h2 className="mt-3 font-serif text-4xl leading-[0.98] tracking-tight sm:text-6xl" style={{ animation: "fin-rise .7s both" }}><span className="text-gradient inline-block pr-3 italic drop-shadow-[0_0_30px_color-mix(in_oklab,var(--violet)_55%,transparent)]">{idea.title}</span></h2>
              <span aria-hidden className="mt-4 block h-px w-48 bg-gradient-to-r from-cyan via-violet to-transparent" />
              <p className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-white/15 px-3 py-1">{AREAS.find((a) => a.id === idea.area)?.label}</span><span className="rounded-full border border-violet/40 bg-violet/10 px-3 py-1 text-violet">{statusLabel(idea.status)}</span>{idea.tags.map((t) => <span key={t} className="rounded-full border border-white/10 px-3 py-1 text-muted-foreground">#{t}</span>)}</p>
            </div>
            <div className="mx-auto"><OrbitArt size={190}>{total > 0 ? <Ring pct={(answered / total) * 100} size={96} thickness={8} color="var(--emerald)"><span className="text-center leading-tight"><b className="block text-lg tabular-nums">{answered}/{total}</b><span className="text-[0.55rem] uppercase tracking-wider text-muted-foreground">respondidas</span></span></Ring> : <span className="font-display text-sm text-muted-foreground">sem plano</span>}</OrbitArt></div>
          </div>
          {p && <div className="mt-5 grid grid-cols-3 gap-3 text-center">{([["Passos", p.passos.length, "var(--cyan)"], ["Riscos", p.riscos.length, "var(--amber)"], ["Referências", idea.attachments.length, "var(--violet)"]] as const).map(([k, v, c]) => <Tilt key={k} max={7} className="rounded-2xl"><div className="glass rounded-2xl px-3 py-3"><p className="font-display text-3xl font-semibold tabular-nums" style={{ color: c, textShadow: `0 0 22px ${c}` }}>{v}</p><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">{k}</p></div></Tilt>)}</div>}
        </HeroPanel>

        {p?.proximoPasso && <div className="shine relative overflow-hidden rounded-3xl border border-emerald/40 bg-emerald/10 p-5" style={rise(1)}><span aria-hidden className="absolute inset-0 bg-gradient-to-r from-emerald/10 via-transparent to-transparent" /><p className="relative flex items-start gap-3 text-sm"><span className="relative mt-1 grid h-3 w-3 shrink-0 place-items-center"><span className="absolute h-3 w-3 rounded-full bg-emerald" style={{ animation: "fin-pulse 1.8s ease-out infinite" }} /><span className="h-2 w-2 rounded-full bg-emerald" /></span><span><b className="text-emerald">Próximo passo (24 a 48 h):</b> {p.proximoPasso}</span></p></div>}

        {(p?.resumo || idea.body) && <Sec n={2} Icon={ListChecks} title="A ideia" color="var(--violet)">{p?.resumo && <p className="text-base leading-relaxed">{p.resumo}</p>}{idea.body && <p className={`whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground ${p?.resumo ? "mt-3 border-t border-white/10 pt-3" : ""}`}>{idea.body}</p>}</Sec>}

        {imgs.length > 0 && <Sec n={3} Icon={ListChecks} title="Referências" color="var(--pink)">
          <ul className="columns-2 gap-3 sm:columns-3" data-testid="plano-imagens">{imgs.map((a, n) => <li key={a.path} className="mb-3 break-inside-avoid" style={rise(n)}><Tilt max={6} className="rounded-2xl">{urls[a.path] ? <button type="button" onClick={() => setZoom(urls[a.path]!.view)} className="block w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_50px_-24px_var(--violet)]"><img src={urls[a.path]!.view} alt={a.name} className="w-full transition duration-500 hover:scale-105" /></button> : <span className="grid h-32 place-items-center rounded-2xl border border-white/10 text-xs text-muted-foreground">carregando…</span>}</Tilt></li>)}</ul>
          {others.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Outros arquivos: {others.map((a) => a.name).join(", ")}</p>}
        </Sec>}

        {p && p.perguntas.length > 0 && <Sec n={4} Icon={HelpCircle} title="Perguntas e respostas" color="var(--cyan)"><ul className="grid gap-3 sm:grid-cols-2">{p.perguntas.map((q, n) => <li key={q.q} className={`rounded-2xl border p-4 ${q.a.trim() ? "border-cyan/25 bg-cyan/[0.05]" : "border-dashed border-amber/40 bg-amber/[0.04]"}`} style={rise(n)}><p className="text-sm font-medium">{q.q}</p><p className={`mt-1.5 flex items-start gap-2 text-sm ${q.a.trim() ? "text-foreground/85" : "italic text-amber"}`}>{q.a.trim() ? <Check size={14} className="mt-0.5 shrink-0 text-emerald" /> : null}{q.a.trim() || "Ainda sem resposta"}</p></li>)}</ul></Sec>}

        {p && p.passos.length > 0 && <Sec n={5} Icon={ListChecks} title="Primeiros passos" color="var(--emerald)">
          <ol className="relative space-y-3 pl-2" data-testid="plano-passos">
            <span aria-hidden className="absolute bottom-3 left-[1.15rem] top-3 w-px bg-gradient-to-b from-emerald via-cyan to-violet opacity-60" />
            {p.passos.map((x, n) => { const ok = done.includes(n); return <li key={x} className="relative flex items-start gap-3" style={rise(n)}>
              <button type="button" onClick={() => tick(n)} aria-pressed={ok} aria-label={`Passo ${n + 1}: ${ok ? "desmarcar" : "marcar como feito"}`} className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition ${ok ? "border-emerald bg-emerald/25 text-emerald shadow-[0_0_18px_var(--emerald)]" : "border-white/20 bg-background text-muted-foreground hover:border-emerald/60"}`}>{ok ? <Check size={14} /> : n + 1}</button>
              <p className={`flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm transition ${ok ? "text-muted-foreground line-through decoration-emerald/60" : ""}`}>{x}</p>
            </li>; })}
          </ol>
          <p className="mt-3 text-[0.65rem] text-muted-foreground/70">Toque no número para marcar o passo como feito (fica salvo neste aparelho).</p>
        </Sec>}

        {p && p.riscos.length > 0 && <Sec n={6} Icon={AlertTriangle} title="Riscos" color="var(--amber)"><ul className="grid gap-3 sm:grid-cols-2">{p.riscos.map((x, n) => <li key={x} className="flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/[0.06] p-4 text-sm" style={rise(n)}><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />{x}</li>)}</ul></Sec>}

        {p && <Sec n={7} Icon={Wallet} title="O que precisa" color="var(--violet)"><div className="grid gap-3 sm:grid-cols-3">{([["Tempo", p.precisa.tempo, Clock, "var(--cyan)"], ["Dinheiro", p.precisa.dinheiro, Wallet, "var(--emerald)"], ["Pessoas", p.precisa.pessoas, Users, "var(--pink)"]] as const).map(([k, v, I, c], n) => <Tilt key={k} max={8} className="rounded-2xl"><div className="glass h-full rounded-2xl p-4" style={{ ...rise(n), boxShadow: `0 20px 60px -34px ${c}` }}><span className="grid h-9 w-9 place-items-center rounded-xl border" style={{ color: c, borderColor: `color-mix(in oklab, ${c} 40%, transparent)`, background: `color-mix(in oklab, ${c} 12%, transparent)` }}><I size={16} /></span><p className="mt-3 text-[0.65rem] uppercase tracking-wider text-muted-foreground">{k}</p><p className="mt-1 text-sm">{v || "—"}</p></div></Tilt>)}</div></Sec>}

        {idea.budget.length > 0 && (() => { const t = budgetTotals(idea.budget); return <Sec n={8} Icon={Wallet} title="Orçamento" color="var(--emerald)">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3" data-testid="plano-orcamento"><div><p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Total do projeto</p><p className="font-display text-4xl font-semibold tabular-nums text-emerald" style={{ textShadow: "0 0 24px var(--emerald)" }}>{brl(t.total)}</p></div><div className="flex gap-5 text-right text-xs"><div><p className="text-muted-foreground">Já gasto</p><p className="font-medium tabular-nums">{brl(t.comprado)}</p></div><div><p className="text-muted-foreground">Falta gastar</p><p className="font-medium tabular-nums text-amber">{brl(t.falta)}</p></div></div></div>
          <ul className="space-y-2">{idea.budget.map((b, n) => <li key={b.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-4 py-2.5 text-sm ${b.status === "tenho" ? "border-cyan/25 text-muted-foreground" : b.status === "comprado" ? "border-emerald/30" : "border-white/10"} bg-white/[0.03]`} style={rise(n)}>
            <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] ${b.status === "comprado" ? "border-emerald/40 text-emerald" : b.status === "tenho" ? "border-cyan/40 text-cyan" : "border-amber/40 text-amber"}`}>{b.status === "comprado" ? "comprado" : b.status === "tenho" ? "já tenho" : "a comprar"}</span>
            <span className="min-w-0 flex-1 font-medium">{b.nome}{b.qtd > 1 ? ` ×${b.qtd}` : ""}{b.nota ? <span className="ml-2 text-xs font-normal text-muted-foreground">{b.nota}</span> : null}</span>
            {b.link && <a href={b.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan hover:underline"><ExternalLink size={11} />link</a>}
            <span className="min-w-24 text-right tabular-nums">{b.status === "tenho" ? "—" : b.valor === null ? "sem valor" : `${b.estimado ? "~" : ""}${brl(b.valor * b.qtd)}`}</span>
          </li>)}</ul>
          {(t.semValor > 0 || t.estimados > 0) && <p className="mt-3 text-[0.7rem] text-amber">{t.semValor > 0 && `${t.semValor} ${t.semValor === 1 ? "item sem valor" : "itens sem valor"} (fora da soma). `}{t.estimados > 0 && `${t.estimados} ${t.estimados === 1 ? "valor estimado" : "valores estimados"}.`}</p>}
        </Sec>; })()}

        {idea.links.length > 0 && <Sec n={9} Icon={ExternalLink} title="Links" color="var(--cyan)"><ul className="space-y-1.5">{idea.links.map((l) => <li key={l}><a href={l} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 break-all text-sm text-cyan hover:underline"><ExternalLink size={12} />{l}</a></li>)}</ul></Sec>}

        {!p && <Sec n={2} Icon={HelpCircle} title="Sem plano ainda" color="var(--amber)"><p className="text-sm text-muted-foreground">Esta ideia ainda não tem plano. Volte e use "Desenvolver com o Orion" para montar um.</p></Sec>}

        <p className="px-2 pb-6 text-center text-[0.65rem] text-muted-foreground/70">Criada em {dateBR(idea.createdAt)}{p ? ` · plano do Orion de ${dateBR(p.geradoEm)}` : ""} · estimativas do Orion a partir do que você contou: confira antes de decidir.</p>
      </div>

      {zoom && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setZoom(null); }} role="dialog" aria-label="Imagem ampliada"><img src={zoom} alt="" className="max-h-full max-w-full rounded-xl shadow-[0_0_80px_-10px_var(--violet)]" style={{ animation: "fin-pop .35s both" }} /></div>}
    </div>, document.body);
}
