/** Documentação → Playbooks: executa um roteiro (ex.: onboarding de cliente) que cria dossiê, cliente, pasta, documentos, tarefas, demandas e checklist. */
import { useMemo, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, CalendarClock, Check, CheckCircle2, ChevronDown, ClipboardList, FileText, FolderOpen, ListChecks, Loader2, Play, Rocket } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FinBackdrop, HeroPanel, OrbitArt, SectionTitle, Tilt } from "@/components/finance/fx";
import { todayBR, dateBR } from "@/lib/clients";
import { addDays } from "@/lib/central";
import { PLAYBOOKS, buildPlan, summarizePlan, type Playbook, type PlaybookStep, type RunInput } from "@/lib/playbooks";
import { runPlaybook, type RunResult } from "@/lib/data/playbooks";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const BLANK: RunInput = { clientName: "", contactName: "", email: "", phone: "", monthlyValue: 0, contractEnd: null, start: todayBR() };

export function PlaybooksView({ projectId, onOpenClients, onOpenLibrary }: { projectId: string; onOpenClients: () => void; onOpenLibrary: () => void }) {
  const [run, setRun] = useState<Playbook | null>(null);
  return (
    <div className="relative space-y-5" data-testid="playbooks"><FinBackdrop />
      <HeroPanel glow="var(--cyan)">
        <div className="grid items-center gap-6 md:grid-cols-[1.4fr_auto]">
          <div><SectionTitle kicker="Documentação" title="Playbooks" accent="de processo" sub="Um clique cria tudo de um processo: dossiê, cliente, pasta com documentos, prazos, demandas e checklist, já ligados entre si." /></div>
          <div className="hidden md:block"><OrbitArt size={190}><Rocket size={30} className="text-cyan" /></OrbitArt></div>
        </div>
      </HeroPanel>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {PLAYBOOKS.map((p) => { const sum = summarizePlan(buildPlan(p, { ...BLANK, clientName: "x" })); return (
          <Tilt key={p.id} max={8}>
            <button onClick={() => setRun(p)} data-testid={`playbook-${p.id}`} className="ex-card block w-full p-5 text-left" style={{ "--rail": `var(--${p.tone})` } as CSSProperties}>
              <div className="flex items-start gap-4"><span className="icon-tile h-14 w-14 shrink-0 !rounded-2xl shadow-[0_0_28px_-6px_var(--glow)]" style={tint(p.tone)}><Rocket size={24} /></span><div className="min-w-0"><p className="mono-caps">Processo</p><h3 className="font-display text-xl font-semibold">{p.name}</h3><p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p></div></div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">{[["Tarefas", sum.tarefas, ClipboardList], ["Demandas", sum.demandas, CalendarClock], ["Documentos", sum.documentos, FileText], ["Checklist", sum.checklist, ListChecks]].map(([l, n, I]) => { const Ic = I as typeof Check; return <div key={String(l)} className="rounded-xl border border-white/10 bg-black/20 py-2"><Ic size={13} className="mx-auto text-cyan" /><p className="font-display text-lg font-semibold tabular-nums">{String(n)}</p><p className="text-[0.6rem] text-muted-foreground">{String(l)}</p></div>; })}</div>
              <p className="mt-4 flex items-center gap-2 text-sm text-cyan"><Play size={14} /> Executar playbook</p>
            </button>
          </Tilt>); })}
        <div className="grid min-h-[12rem] place-items-center rounded-[1.25rem] border border-dashed border-white/15 p-5 text-center text-xs text-muted-foreground">Novos playbooks (fechamento do mês, renovação, projeto…) entram aqui.<br />Diga o processo e eu monto o roteiro.</div>
      </div>
      {run && <RunDialog key={run.id} playbook={run} projectId={projectId} onClose={() => setRun(null)} onOpenClients={() => { setRun(null); onOpenClients(); }} onOpenLibrary={() => { setRun(null); onOpenLibrary(); }} />}
    </div>
  );
}

function RunDialog({ playbook, projectId, onClose, onOpenClients, onOpenLibrary }: { playbook: Playbook; projectId: string; onClose: () => void; onOpenClients: () => void; onOpenLibrary: () => void }) {
  const qc = useQueryClient();
  const [input, setInput] = useState<RunInput>({ ...BLANK, start: todayBR() }), [steps, setSteps] = useState<PlaybookStep[]>(playbook.steps), [more, setMore] = useState(false), [editing, setEditing] = useState<string | null>(null);
  const [phase, setPhase] = useState<"form" | "running" | "done">("form"), [now, setNow] = useState(""), [result, setResult] = useState<RunResult | null>(null);
  const plan = useMemo(() => buildPlan(playbook, input, steps), [playbook, input, steps]), sum = summarizePlan(plan);
  const set = <K extends keyof RunInput>(k: K, v: RunInput[K]) => setInput((x) => ({ ...x, [k]: v }));
  const upd = (id: string, patch: Partial<PlaybookStep>) => setSteps((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const ok = input.clientName.trim().length > 0 && !!input.start;
  const today = todayBR(), tomorrow = addDays(today, 1), monday = (() => { const d = new Date(`${today}T12:00:00`); const add = ((8 - d.getDay()) % 7) || 7; return addDays(today, add); })();
  const dateOf = (id: string) => plan.steps.find((x) => x.id === id)?.date;
  const fld = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-cyan/50 focus:bg-white/[0.05]";
  const go = async () => {
    setPhase("running");
    try {
      const r = await runPlaybook(projectId, plan, input, setNow);
      setResult(r); setPhase("done");
      await Promise.all(["tasks", "clients", "client-dossiers", "dossier-hub", "checklists", "central", "client-setup"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success("Playbook executado");
    } catch (e) { setPhase("form"); toast.error(`Não consegui terminar: ${(e as Error).message}. O que já foi criado não é duplicado se você tentar de novo.`); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o && phase !== "running") onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-[34rem] overflow-hidden rounded-[2rem] border-white/10 bg-[oklch(0.14_0.035_265/0.82)] p-0 shadow-[0_40px_120px_-30px_var(--violet)] backdrop-blur-2xl [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:border [&>button]:border-white/10 [&>button]:p-1.5" data-testid="playbook-dialog" aria-describedby={undefined}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"><span className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[var(--cyan)] opacity-[0.16] blur-3xl" style={{ animation: "fin-aurora 18s ease-in-out infinite" }} /><span className="absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-[var(--violet)] opacity-[0.2] blur-3xl" style={{ animation: "fin-aurora 22s ease-in-out infinite reverse" }} /><div className="fin-dots absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_top,#000,transparent_70%)]" /></div>
        <div className="relative max-h-[92vh] overflow-y-auto px-7 pb-6 pt-7 scroll-neon">
          <DialogTitle className="sr-only">{playbook.name}</DialogTitle>
          {phase === "done" && result ? (
            <div className="space-y-6 py-2 text-center" data-testid="playbook-resultado">
              <span className="icon-tile mx-auto h-16 w-16 !rounded-full shadow-[0_0_50px_-8px_var(--emerald)]" style={tint("emerald")}><CheckCircle2 size={28} style={{ animation: "ex-tick .6s both" }} /></span>
              <div><p className="mono-caps">Tudo pronto</p><h2 className="mt-1 font-serif text-4xl leading-tight">{result.dossierName}</h2></div>
              <ul className="mx-auto flex max-w-sm flex-wrap justify-center gap-2">{[["Dossiê", result.created.dossie ? "novo" : "existia", Building2], ["Cliente", result.created.cliente ? "novo" : "existia", Building2], ["Pasta", result.created.pasta ? "nova" : "existia", FolderOpen], ["Documentos", String(result.created.docs), FileText], ["Tarefas", String(result.created.tarefas), ClipboardList], ["Demandas", String(result.created.demandas), CalendarClock], ["Checklist", result.created.checklist ? "novo" : "existia", ListChecks], ["Implantação", result.created.implantacao ? `${result.created.implantacao} passos` : "existia", Rocket]].map(([l, v, I], i) => { const Ic = I as typeof Check; return <li key={String(l)} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs" style={{ animation: `fin-pop .4s ${i * 0.05}s both` }}><Ic size={12} className="text-cyan" />{String(l)} <b className="text-emerald">{String(v)}</b></li>; })}</ul>
              <div className="flex flex-wrap justify-center gap-2"><button onClick={onOpenClients} className="rounded-full bg-gradient-to-r from-cyan to-violet px-6 py-2.5 text-sm font-semibold text-background shadow-[0_0_34px_-8px_var(--cyan)]">Abrir cliente</button><button onClick={onOpenLibrary} className="rounded-full border border-white/15 px-5 py-2.5 text-sm">Pasta</button><button onClick={onClose} className="rounded-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">Fechar</button></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3"><span className="icon-tile h-10 w-10 shrink-0 !rounded-full shadow-[0_0_28px_-6px_var(--glow)]" style={tint(playbook.tone)}><Rocket size={16} /></span><div><p className="mono-caps">Playbook</p><p className="font-display text-sm font-semibold">{playbook.name}</p></div></div>

              <label className="block"><span className="sr-only">Nome do cliente</span>
                <input autoFocus value={input.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Nome do cliente" maxLength={160} data-testid="playbook-cliente" className="w-full border-0 border-b border-white/15 bg-transparent pb-2 font-serif text-4xl leading-tight outline-none transition placeholder:text-muted-foreground/40 focus:border-cyan/70 focus:shadow-[0_8px_24px_-16px_var(--cyan)]" /></label>

              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Início do onboarding"><span className="mono-caps mr-1">Início</span>
                {[[today, "Hoje"], [tomorrow, "Amanhã"], [monday, "Segunda"]].map(([d, l]) => <button key={d} onClick={() => set("start", d!)} aria-pressed={input.start === d} className={`rounded-full border px-3.5 py-1 text-xs transition ${input.start === d ? "border-cyan/60 bg-cyan/10 text-cyan shadow-[0_0_18px_-8px_var(--cyan)]" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{l}</button>)}
                <input type="date" value={input.start} onChange={(e) => set("start", e.target.value)} aria-label="Data de início" data-testid="playbook-inicio" className="rounded-full border border-white/10 bg-transparent px-3 py-1 text-xs text-muted-foreground outline-none focus:border-cyan/50" /></div>

              <div>
                <button onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"><ChevronDown size={13} className={`transition ${more ? "rotate-180" : ""}`} /> Contato, valor e contrato <span className="text-muted-foreground/60">(opcional)</span></button>
                {more && <div className="mt-3 grid gap-2.5 sm:grid-cols-2" style={{ animation: "fin-rise .3s both" }}>
                  <input value={input.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Responsável" aria-label="Responsável" className={fld} />
                  <input type="email" value={input.email} onChange={(e) => set("email", e.target.value)} placeholder="E-mail" aria-label="E-mail" className={fld} />
                  <input value={input.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Telefone" aria-label="Telefone" className={fld} />
                  <input type="number" min={0} step="0.01" value={input.monthlyValue || ""} onChange={(e) => set("monthlyValue", Number(e.target.value) || 0)} placeholder="Valor por mês (R$)" aria-label="Valor por mês" className={fld} />
                  <label className="flex items-center gap-2 sm:col-span-2"><span className="shrink-0 text-xs text-muted-foreground">Fim do contrato</span><input type="date" value={input.contractEnd ?? ""} onChange={(e) => set("contractEnd", e.target.value || null)} aria-label="Fim do contrato" className={`${fld} !w-auto`} /></label></div>}
              </div>

              <div>
                <p className="mono-caps mb-3">Linha do tempo · {sum.tarefas + sum.demandas} passos</p>
                <ol className="relative space-y-0.5 pl-1">
                  <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-px bg-gradient-to-b from-cyan/60 via-violet/40 to-transparent" />
                  {steps.map((st, i) => (
                    <li key={st.id} className="group relative flex items-center gap-3 rounded-xl py-1.5 pr-1 transition hover:bg-white/[0.04]" style={{ animation: `fin-rise .4s ${i * 0.03}s both` }}>
                      <button onClick={() => upd(st.id, { on: !st.on })} role="checkbox" aria-checked={st.on} aria-label={`Incluir ${st.title}`} className={`relative z-10 grid h-[1.65rem] w-[1.65rem] shrink-0 place-items-center rounded-full border transition ${st.on ? "border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_22%,transparent)] shadow-[0_0_16px_-3px_var(--glow)]" : "border-white/20 bg-background"}`} style={tint(st.kind === "demanda" ? "violet" : "cyan")}>{st.on && <Check size={12} className="text-[var(--glow)]" style={{ animation: "ex-tick .35s both" }} />}</button>
                      {editing === st.id ? <input autoFocus value={st.title} onChange={(e) => upd(st.id, { title: e.target.value })} onBlur={() => setEditing(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(null); }} aria-label="Título do passo" className="min-w-0 flex-1 border-b border-cyan/50 bg-transparent text-sm outline-none" />
                        : <button onClick={() => setEditing(st.id)} title="Clique para renomear" className={`min-w-0 flex-1 truncate text-left text-sm transition ${st.on ? "" : "text-muted-foreground/50 line-through"}`}>{st.title}</button>}
                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-1 text-[0.7rem] text-muted-foreground">
                        <button onClick={() => upd(st.id, { days: Math.max(0, st.days - 1) })} aria-label="Um dia antes" className="grid h-5 w-5 place-items-center rounded-full hover:text-foreground">−</button>
                        <span className="min-w-[3.6rem] text-center tabular-nums" aria-label={`Dia ${st.days}`}>{st.on && dateOf(st.id) ? `${dateOf(st.id)!.slice(8)}/${dateOf(st.id)!.slice(5, 7)}` : `dia ${st.days}`}</span>
                        <button onClick={() => upd(st.id, { days: st.days + 1 })} aria-label="Um dia depois" className="grid h-5 w-5 place-items-center rounded-full hover:text-foreground">+</button></span>
                    </li>))}
                </ol>
              </div>

              <div className="sticky -bottom-6 -mx-7 space-y-3 border-t border-white/10 bg-[oklch(0.14_0.035_265/0.92)] px-7 pb-5 pt-4 backdrop-blur-xl">
                <p className="text-center text-[0.7rem] leading-relaxed text-muted-foreground">Cria dossiê, cliente, pasta com {sum.documentos} modelos, roteiro de implantação, {sum.tarefas} tarefas, {sum.demandas} demandas e checklist{sum.ultimaData ? ` até ${dateBR(sum.ultimaData)}` : ""}. O que já existe é reaproveitado.</p>
                <div className="flex items-center justify-between gap-3"><button onClick={onClose} disabled={phase === "running"} className="px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50">Cancelar</button>
                  <button onClick={() => void go()} disabled={!ok || phase === "running"} data-testid="playbook-executar" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-7 py-2.5 text-sm font-semibold text-background shadow-[0_0_36px_-8px_var(--cyan)] transition active:scale-[0.97] disabled:opacity-40 disabled:shadow-none">{phase === "running" ? <><Loader2 size={14} className="animate-spin" /> {now}…</> : <><Play size={14} /> Executar</>}</button></div>
              </div>
            </div>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
