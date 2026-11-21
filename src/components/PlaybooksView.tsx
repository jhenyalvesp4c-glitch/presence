/** Documentação → Playbooks: executa um roteiro (ex.: onboarding de cliente) que cria dossiê, cliente, pasta, documentos, tarefas, demandas e checklist. */
import { useMemo, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, CalendarClock, Check, CheckCircle2, ClipboardList, FileText, FolderOpen, ListChecks, Loader2, Play, Rocket, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FinBackdrop, HeroPanel, OrbitArt, SectionTitle, Tilt } from "@/components/finance/fx";
import { todayBR, dateBR } from "@/lib/clients";
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
  const [input, setInput] = useState<RunInput>({ ...BLANK, start: todayBR() }), [steps, setSteps] = useState<PlaybookStep[]>(playbook.steps);
  const [phase, setPhase] = useState<"form" | "running" | "done">("form"), [now, setNow] = useState(""), [result, setResult] = useState<RunResult | null>(null);
  const plan = useMemo(() => buildPlan(playbook, input, steps), [playbook, input, steps]), sum = summarizePlan(plan);
  const set = <K extends keyof RunInput>(k: K, v: RunInput[K]) => setInput((x) => ({ ...x, [k]: v }));
  const upd = (id: string, patch: Partial<PlaybookStep>) => setSteps((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const inp = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60";
  const ok = input.clientName.trim().length > 0 && !!input.start;
  const go = async () => {
    setPhase("running");
    try {
      const r = await runPlaybook(projectId, plan, input, setNow);
      setResult(r); setPhase("done");
      await Promise.all(["tasks", "clients", "client-dossiers", "dossier-hub", "checklists", "central"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success("Playbook executado");
    } catch (e) { setPhase("form"); toast.error(`Não consegui terminar: ${(e as Error).message}. O que já foi criado não é duplicado se você tentar de novo.`); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o && phase !== "running") onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-white/10 bg-background" data-testid="playbook-dialog">
        <DialogHeader><DialogTitle className="font-display">{playbook.name}</DialogTitle></DialogHeader>
        {phase === "done" && result ? (
          <div className="space-y-4" data-testid="playbook-resultado">
            <div className="flex items-center gap-3"><span className="icon-tile h-12 w-12 !rounded-2xl" style={tint("emerald")}><CheckCircle2 size={22} /></span><div><p className="font-display text-lg font-semibold">Tudo pronto para {result.dossierName}</p><p className="text-xs text-muted-foreground">O que foi criado já está ligado ao dossiê.</p></div></div>
            <ul className="grid gap-2 sm:grid-cols-2">{[["Dossiê", result.created.dossie ? "criado" : "já existia", Building2], ["Cliente", result.created.cliente ? "criado" : "já existia", Building2], ["Pasta", result.created.pasta ? "criada" : "já existia", FolderOpen], ["Documentos", `${result.created.docs} novo(s)`, FileText], ["Tarefas", `${result.created.tarefas} nova(s)`, ClipboardList], ["Demandas", `${result.created.demandas} nova(s)`, CalendarClock], ["Checklist", result.created.checklist ? "criado" : "já existia", ListChecks]].map(([l, v, I]) => { const Ic = I as typeof Check; return <li key={String(l)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"><Ic size={14} className="text-cyan" /><span className="flex-1">{String(l)}</span><b className="text-xs text-emerald">{String(v)}</b></li>; })}</ul>
            <div className="flex flex-wrap gap-2"><button onClick={onOpenClients} className="rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background">Abrir cliente</button><button onClick={onOpenLibrary} className="rounded-full border border-white/15 px-5 py-2 text-sm">Abrir pasta na Biblioteca</button><button onClick={onClose} className="rounded-full border border-white/15 px-5 py-2 text-sm">Fechar</button></div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2"><span className="mono-caps">Nome do cliente</span><input autoFocus value={input.clientName} onChange={(e) => set("clientName", e.target.value)} className={inp} data-testid="playbook-cliente" maxLength={160} placeholder="Ex.: Clínica Vida Plena" /></label>
              <label className="block space-y-1"><span className="mono-caps">Responsável / contato</span><input value={input.contactName} onChange={(e) => set("contactName", e.target.value)} className={inp} /></label>
              <label className="block space-y-1"><span className="mono-caps">Início do onboarding</span><input type="date" value={input.start} onChange={(e) => set("start", e.target.value)} className={inp} data-testid="playbook-inicio" /></label>
              <label className="block space-y-1"><span className="mono-caps">E-mail</span><input type="email" value={input.email} onChange={(e) => set("email", e.target.value)} className={inp} /></label>
              <label className="block space-y-1"><span className="mono-caps">Telefone</span><input value={input.phone} onChange={(e) => set("phone", e.target.value)} className={inp} /></label>
              <label className="block space-y-1"><span className="mono-caps">Valor por mês (R$)</span><input type="number" min={0} step="0.01" value={input.monthlyValue || ""} onChange={(e) => set("monthlyValue", Number(e.target.value) || 0)} className={inp} /></label>
              <label className="block space-y-1"><span className="mono-caps">Fim do contrato (opcional)</span><input type="date" value={input.contractEnd ?? ""} onChange={(e) => set("contractEnd", e.target.value || null)} className={inp} /></label>
            </div>
            <div>
              <p className="mono-caps mb-2">Passos (marque, renomeie e ajuste os dias)</p>
              <ul className="space-y-1.5">{steps.map((st) => (
                <li key={st.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"><input type="checkbox" checked={st.on} onChange={(e) => upd(st.id, { on: e.target.checked })} aria-label={`Incluir ${st.title}`} className="h-4 w-4 accent-cyan" />
                  <span className={`tag shrink-0 !py-0 !text-[0.6rem] ${st.kind === "demanda" ? "" : ""}`} style={tint(st.kind === "demanda" ? "violet" : "cyan")}>{st.kind === "demanda" ? "demanda" : "tarefa"}</span>
                  <input value={st.title} onChange={(e) => upd(st.id, { title: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Título do passo" />
                  <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">dia <input type="number" min={0} max={365} value={st.days} onChange={(e) => upd(st.id, { days: Number(e.target.value) || 0 })} className="w-14 rounded-lg border border-white/10 bg-black/25 px-1.5 py-1 text-right text-foreground" aria-label="Dia a partir do início" /></label>
                  <span className="hidden w-12 shrink-0 text-right font-mono text-[0.7rem] text-muted-foreground sm:block">{st.on && ok ? plan.steps.find((p) => p.id === st.id)?.date.slice(8) + "/" + plan.steps.find((p) => p.id === st.id)?.date.slice(5, 7) : ""}</span></li>))}</ul>
            </div>
            <div className="rounded-2xl border border-cyan/25 bg-cyan/5 p-3 text-xs text-muted-foreground">Vai criar (ou reaproveitar, se já existir): <b className="text-foreground">dossiê, cliente, pasta</b> com {sum.documentos} documentos-modelo, <b className="text-foreground">{sum.tarefas} tarefa(s)</b>, <b className="text-foreground">{sum.demandas} demanda(s)</b> e um checklist de {sum.checklist} itens{sum.ultimaData ? `, até ${dateBR(sum.ultimaData)}` : ""}. Tarefas e demandas repetidas não são duplicadas.</div>
            <div className="flex items-center justify-end gap-2"><button onClick={onClose} disabled={phase === "running"} className="rounded-full border border-white/15 px-5 py-2 text-sm disabled:opacity-50"><X size={13} className="mr-1 inline" />Cancelar</button><button onClick={() => void go()} disabled={!ok || phase === "running"} data-testid="playbook-executar" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-6 py-2 text-sm font-semibold text-background disabled:opacity-50">{phase === "running" ? <><Loader2 size={14} className="animate-spin" /> {now}…</> : <><Play size={14} /> Executar playbook</>}</button></div>
          </div>)}
      </DialogContent>
    </Dialog>
  );
}
