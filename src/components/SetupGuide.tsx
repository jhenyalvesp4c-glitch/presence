/**
 * Implantação do cliente: passo a passo guiado para colocar o sistema dele no ar (Kanban, fluxo de atendimento, horário, assinatura…).
 * `SetupSummary` é o resumo dentro da ficha; `SetupGuide` é o modo guiado em tela grande ("controle de missão").
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronRight, Lightbulb, Loader2, Pencil, Plus, Rocket, Sparkles, Trash2, Trophy, X } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Meter, Ring } from "@/components/finance/charts";
import { LiveDot } from "@/components/finance/fx";
import { useClientSetup, useSetupActions } from "@/lib/data/client-setup";
import { STATUS_LABEL, isFinished, progressOf, toneOfPhase, goalOfPhase, type SetupStatus, type SetupStep } from "@/lib/setup";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const STATUS_TONE: Record<SetupStatus, string> = { todo: "muted-foreground", doing: "cyan", done: "emerald", blocked: "destructive", na: "muted-foreground" };

/** Resumo na ficha do cliente. */
export function SetupSummary({ clientId, clientName }: { clientId: string; clientName: string }) {
  const q = useClientSetup(clientId), acts = useSetupActions(clientId), [open, setOpen] = useState(false);
  const steps = q.data ?? [], prog = useMemo(() => progressOf(steps), [steps]);
  if (q.isPending) return <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 size={14} className="mr-2 inline animate-spin" />Carregando…</p>;
  if (q.isError) return <p className="py-4 text-center text-sm text-muted-foreground">Não consegui carregar a implantação agora.</p>;
  if (steps.length === 0) return (
    <div className="space-y-3 rounded-2xl border border-dashed border-cyan/30 p-5 text-center" data-testid="implantacao-vazia">
      <span className="icon-tile mx-auto h-12 w-12 !rounded-2xl" style={tint("cyan")}><Rocket size={20} /></span>
      <p className="font-display text-base font-semibold">Roteiro de implantação</p>
      <p className="text-xs text-muted-foreground">Passo a passo para colocar o sistema do cliente no ar: horário de funcionamento, assinatura do usuário, fluxo de atendimento, Kanban e mais. 7 fases, 29 passos.</p>
      <button onClick={() => acts.seed.mutate(undefined, { onSuccess: () => toast.success("Roteiro criado"), onError: (e) => toast.error(`Não consegui criar: ${(e as Error).message}`) })} disabled={acts.seed.isPending} data-testid="implantacao-criar" className="rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background disabled:opacity-50">{acts.seed.isPending ? "Criando…" : "Criar roteiro de implantação"}</button>
    </div>);
  return (
    <div className="space-y-4" data-testid="implantacao-resumo">
      <div className="flex items-center gap-4"><Ring pct={prog.pct} size={84} thickness={8} color="var(--cyan)"><span className="text-sm font-semibold tabular-nums">{prog.pct}%</span></Ring>
        <div className="min-w-0 flex-1"><p className="mono-caps">Implantação</p><p className="font-display text-base font-semibold">{prog.finished} de {prog.total} passos</p>{prog.next ? <p className="truncate text-xs text-muted-foreground">Próximo: {prog.next.title}</p> : <p className="text-xs text-emerald">Tudo concluído</p>}</div></div>
      <div className="space-y-1.5">{prog.phases.map((p) => <div key={p.id} className="flex items-center gap-2.5 text-xs"><span className="w-32 shrink-0 truncate text-muted-foreground sm:w-40">{p.name}</span><div className="min-w-0 flex-1"><Meter pct={p.pct} color={`var(--${toneOfPhase(p.name)})`} height={5} warn={false} /></div><b className="w-9 text-right tabular-nums">{p.pct}%</b>{p.blocked > 0 && <AlertTriangle size={11} className="text-destructive" />}</div>)}</div>
      <button onClick={() => setOpen(true)} data-testid="implantacao-abrir" className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet py-2.5 text-sm font-semibold text-background shadow-[0_0_28px_-8px_var(--cyan)] transition active:scale-[0.98]"><Rocket size={15} /> Abrir modo guiado</button>
      {open && <SetupGuide clientId={clientId} clientName={clientName} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function SetupGuide({ clientId, clientName, onClose }: { clientId: string; clientName: string; onClose: () => void }) {
  const q = useClientSetup(clientId), acts = useSetupActions(clientId);
  const steps = q.data ?? [], prog = useMemo(() => progressOf(steps), [steps]);
  const [selId, setSelId] = useState<string | null>(null), [phase, setPhase] = useState<string | null>(null), [draft, setDraft] = useState(""), [adding, setAdding] = useState("");
  const [titleDraft, setTitleDraft] = useState(""), [hintDraft, setHintDraft] = useState(""), [editHint, setEditHint] = useState(false), [renamingPhase, setRenamingPhase] = useState<string | null>(null), [phaseName, setPhaseName] = useState(""), [newPhase, setNewPhase] = useState<string | null>(null);
  const init = useRef(false);
  useEffect(() => { if (!init.current && steps.length) { init.current = true; const n = prog.next ?? steps[0]!; setSelId(n.id); setPhase(n.phase); } }, [steps, prog.next]);
  const sel = steps.find((s) => s.id === selId) ?? null;
  useEffect(() => { setDraft(sel?.note ?? ""); setTitleDraft(sel?.title ?? ""); setHintDraft(sel?.hint ?? ""); setEditHint(false); }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = (e: unknown) => toast.error(`Não consegui salvar: ${(e as Error).message}`);
  const phaseSteps = steps.filter((s) => s.phase === phase), tone = toneOfPhase(phase ?? "");
  const ordered = useMemo(() => [...steps].sort((a, b) => a.phaseIndex - b.phaseIndex || a.position - b.position), [steps]);
  const goTo = (s: SetupStep | undefined) => { if (s) { setSelId(s.id); setPhase(s.phase); } };
  const nextAfter = (id: string) => { const i = ordered.findIndex((s) => s.id === id); return ordered.slice(i + 1).find((s) => !isFinished(s.status)) ?? ordered.find((s) => s.id !== id && !isFinished(s.status)); };
  const setStatus = (s: SetupStep, status: SetupStatus, advance = false) => acts.setStatus.mutate({ id: s.id, status }, { onSuccess: () => { if (advance) goTo(nextAfter(s.id)); }, onError: err });
  const saveNote = () => { if (sel && draft !== sel.note) acts.setNote.mutate({ id: sel.id, note: draft }, { onError: err }); };
  // trocou de fase (ex.: fase nova): vai para o primeiro passo dela
  useEffect(() => { if (phase && steps.length && sel && sel.phase !== phase) { const first = steps.filter((x) => x.phase === phase).sort((a, b) => a.position - b.position)[0]; if (first) { setSelId(first.id); } } }, [phase, steps]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveTitle = () => { if (sel && titleDraft.trim() && titleDraft.trim() !== sel.title) acts.rename.mutate({ id: sel.id, title: titleDraft }, { onError: err }); else if (sel) setTitleDraft(sel.title); };
  const saveHint = () => { if (sel && hintDraft !== sel.hint) acts.setHint.mutate({ id: sel.id, hint: hintDraft }, { onError: err }); setEditHint(false); };
  const removeStep = (s: SetupStep) => { if (!window.confirm(`Excluir o passo "${s.title}"?`)) return; if (selId === s.id) goTo(nextAfter(s.id) ?? phaseSteps.find((x) => x.id !== s.id)); acts.remove.mutate(s.id, { onError: err }); };
  const moveStep = (s: SetupStep, dir: -1 | 1) => { const list = phaseSteps, i = list.findIndex((x) => x.id === s.id), o = list[i + dir]; if (!o) return; acts.move.mutate({ a: { id: s.id, position: s.position }, b: { id: o.id, position: o.position === s.position ? o.position + dir : o.position } }, { onError: err }); };
  const savePhaseName = () => { const to = phaseName.trim(); if (renamingPhase && to && to !== renamingPhase) acts.renamePhase.mutate({ from: renamingPhase, to }, { onSuccess: () => setPhase(to), onError: err }); setRenamingPhase(null); };
  const removePhase = (name: string) => { if (!window.confirm(`Excluir a fase "${name}" e todos os passos dela?`)) return; const other = prog.phases.find((p) => p.name !== name); acts.removePhase.mutate(name, { onSuccess: () => { if (other) { setPhase(other.name); goTo(steps.find((x) => x.phase === other.name)); } }, onError: err }); };
  const createPhase = () => { const n = (newPhase ?? "").trim(); if (n) acts.addPhase.mutate({ name: n, phaseIndex: Math.max(-1, ...prog.phases.map((p) => p.index)) + 1 }, { onSuccess: () => { setPhase(n); setNewPhase(null); }, onError: err }); else setNewPhase(null); };
  const complete = prog.total > 0 && prog.pct === 100;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="h-[94vh] max-w-[min(96vw,1280px)] gap-0 overflow-hidden border-cyan/20 bg-[oklch(0.1_0.03_265)] p-0 [&>button]:hidden" data-testid="implantacao-guia" aria-describedby={undefined}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"><span className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--cyan)] opacity-[0.10] blur-3xl" style={{ animation: "fin-aurora 18s ease-in-out infinite" }} /><span className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[var(--violet)] opacity-[0.14] blur-3xl" style={{ animation: "fin-aurora 22s ease-in-out infinite reverse" }} /><div className="fin-dots absolute inset-0 opacity-30" /><span className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-cyan/10 to-transparent" style={{ animation: "health-scan 8s ease-in-out infinite" }} /></div>
        <div className="relative flex h-full min-h-0 flex-col">
          <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
            <Ring pct={prog.pct} size={72} thickness={7} color={complete ? "var(--emerald)" : "var(--cyan)"}><span className="text-sm font-semibold tabular-nums">{prog.pct}%</span></Ring>
            <div className="mr-auto min-w-0"><div className="flex items-center gap-2.5"><p className="mono-caps">Missão · Implantação</p><LiveDot color={complete ? "var(--emerald)" : "var(--cyan)"} label={complete ? "concluída" : "em andamento"} /></div><DialogTitle className="truncate font-serif text-3xl leading-tight sm:text-4xl">{clientName}</DialogTitle><p className="text-xs text-muted-foreground">{prog.finished} de {prog.total} passos{prog.blocked.length > 0 && <span className="text-destructive"> · {prog.blocked.length} travado{prog.blocked.length === 1 ? "" : "s"}</span>}</p></div>
            <button onClick={onClose} aria-label="Fechar modo guiado" className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </header>

          {q.isPending ? <div className="grid flex-1 place-items-center text-sm text-muted-foreground"><Loader2 className="animate-spin text-cyan" /></div> : (
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[230px_minmax(0,1fr)_minmax(0,400px)] lg:overflow-hidden">
              {/* trilha de fases */}
              <nav aria-label="Fases" className="border-b border-white/10 p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                <ol className="relative space-y-1">
                  <span aria-hidden className="absolute bottom-6 left-[21px] top-6 hidden w-px bg-gradient-to-b from-cyan/60 via-violet/40 to-transparent lg:block" />
                  {prog.phases.map((p, i) => { const on = p.name === phase, ph = toneOfPhase(p.name); return (
                    <li key={p.id}><button onClick={() => { setPhase(p.name); goTo(steps.filter((s) => s.phase === p.name).find((s) => !isFinished(s.status)) ?? steps.find((s) => s.phase === p.name)); }} data-testid={`fase-${i}`} aria-current={on ? "true" : undefined} className={`relative flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition ${on ? "bg-white/[0.07] shadow-[0_0_30px_-12px_var(--glow)]" : "hover:bg-white/[0.04]"}`} style={tint(ph)}>
                      <Ring pct={p.pct} size={42} thickness={4} color={`var(--${ph})`}>{p.pct === 100 ? <Check size={14} className="text-emerald" /> : <span className="text-[0.65rem] font-semibold">{i + 1}</span>}</Ring>
                      <span className="min-w-0 flex-1"><span className={`block truncate text-sm ${on ? "font-semibold" : ""}`}>{p.name}</span><span className="block text-[0.65rem] text-muted-foreground">{p.finished}/{p.total}{p.blocked > 0 && " · travado"}</span></span>
                      {on && <ChevronRight size={14} className="text-[var(--glow)]" />}</button></li>); })}
                </ol>
                {newPhase === null ? <button onClick={() => setNewPhase("")} data-testid="fase-nova" className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-2 text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-foreground"><Plus size={13} /> Nova fase</button>
                  : <input autoFocus value={newPhase} onChange={(e) => setNewPhase(e.target.value)} onBlur={createPhase} onKeyDown={(e) => { if (e.key === "Enter") createPhase(); if (e.key === "Escape") setNewPhase(null); }} placeholder="Nome da fase" aria-label="Nome da nova fase" className="mt-3 w-full rounded-2xl border border-cyan/50 bg-black/30 px-3 py-2 text-sm outline-none" />}
              </nav>

              {/* passos da fase */}
              <section className="min-w-0 p-4 sm:p-6 lg:overflow-y-auto" aria-label="Passos">
                {complete && <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald/40 bg-emerald/10 p-4" data-testid="implantacao-completa" style={{ animation: "fin-rise .5s both" }}><Trophy size={22} className="text-emerald" /><div><p className="font-display text-base font-semibold">Implantação concluída!</p><p className="text-xs text-muted-foreground">Todos os passos estão feitos. Combine o acompanhamento da primeira semana e feche o onboarding.</p></div><Sparkles size={18} className="ml-auto text-emerald" /></div>}
                {phase && <div className="mb-4"><p className="mono-caps" style={{ color: `var(--${tone})` }}>Fase {prog.phases.findIndex((p) => p.name === phase) + 1} de {prog.phases.length}</p>
                  <div className="group flex items-center gap-2">{renamingPhase === phase ? <input autoFocus value={phaseName} onChange={(e) => setPhaseName(e.target.value)} onBlur={savePhaseName} onKeyDown={(e) => { if (e.key === "Enter") savePhaseName(); if (e.key === "Escape") setRenamingPhase(null); }} aria-label="Nome da fase" data-testid="fase-nome" className="min-w-0 flex-1 border-b border-cyan/60 bg-transparent font-display text-2xl font-semibold outline-none" /> : <h2 className="min-w-0 truncate font-display text-2xl font-semibold">{phase}</h2>}
                    <button onClick={() => { setRenamingPhase(phase); setPhaseName(phase); }} aria-label="Renomear fase" data-testid="fase-renomear" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:text-foreground"><Pencil size={13} /></button>
                    <button onClick={() => removePhase(phase)} aria-label="Excluir fase" data-testid="fase-excluir" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:text-destructive"><Trash2 size={13} /></button></div>
                  {goalOfPhase(phase) && <p className="text-sm text-muted-foreground">{goalOfPhase(phase)}</p>}</div>}
                <ol className="space-y-2">
                  {phaseSteps.map((s, i) => { const on = s.id === selId, fin = isFinished(s.status); return (
                    <li key={s.id} style={{ animation: `fin-rise .4s ${i * 0.04}s both` }}>
                      <div className={`group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${on ? "border-cyan/60 bg-cyan/[0.07] shadow-[0_0_34px_-14px_var(--cyan)]" : "border-white/10 bg-black/20 hover:border-white/25"}`}>
                        <button onClick={() => setStatus(s, fin ? "todo" : "done")} aria-label={fin ? `Reabrir ${s.title}` : `Concluir ${s.title}`} data-testid={`passo-check-${s.key}`} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${fin ? "border-emerald bg-emerald/20 text-emerald shadow-[0_0_16px_-4px_var(--emerald)]" : s.status === "blocked" ? "border-destructive/70 text-destructive" : s.status === "doing" ? "border-cyan text-cyan" : "border-white/25 hover:border-cyan"}`}>{fin ? <Check size={14} style={{ animation: "ex-tick .4s both" }} /> : s.status === "blocked" ? <AlertTriangle size={12} /> : s.status === "doing" ? <span className="h-2 w-2 rounded-full bg-cyan" style={{ animation: "fin-pulse 1.8s ease-out infinite" }} /> : null}</button>
                        <button onClick={() => setSelId(s.id)} className="min-w-0 flex-1 text-left" data-testid={`passo-${s.key}`}><span className={`block text-sm ${fin ? "text-muted-foreground line-through" : "font-medium"}`}>{s.title}</span>{s.note && <span className="block truncate text-[0.7rem] text-muted-foreground">📝 {s.note}</span>}</button>
                        <span className="tag shrink-0 !py-0 !text-[0.65rem]" style={tint(STATUS_TONE[s.status])}>{STATUS_LABEL[s.status]}</span>
                        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <button onClick={() => moveStep(s, -1)} disabled={i === 0} aria-label={`Subir ${s.title}`} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp size={12} /></button>
                          <button onClick={() => moveStep(s, 1)} disabled={i === phaseSteps.length - 1} aria-label={`Descer ${s.title}`} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown size={12} /></button>
                          <button onClick={() => removeStep(s)} aria-label={`Excluir ${s.title}`} data-testid={`passo-excluir-${s.key}`} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button></span>
                      </div></li>); })}
                </ol>
                {phase && <form onSubmit={(e) => { e.preventDefault(); if (!adding.trim()) return; const p = prog.phases.find((x) => x.name === phase); acts.addStep.mutate({ phase, phaseIndex: p?.index ?? 0, title: adding, position: phaseSteps.length + 100 }, { onSuccess: () => setAdding(""), onError: err }); }} className="mt-3 flex gap-2"><input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Adicionar um passo nesta fase…" aria-label="Novo passo" className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm outline-none focus:border-cyan/60" /><button type="submit" disabled={!adding.trim()} aria-label="Adicionar passo" className="grid h-9 w-9 place-items-center rounded-full border border-cyan/60 text-cyan disabled:opacity-40"><Plus size={15} /></button></form>}
              </section>

              {/* foco */}
              <aside className="border-t border-white/10 p-4 sm:p-6 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Passo em foco" data-testid="passo-foco">
                {sel ? (
                  <div className="space-y-4" key={sel.id} style={{ animation: "fin-rise .35s both" }}>
                    <p className="mono-caps" style={{ color: `var(--${toneOfPhase(sel.phase)})` }}>{sel.phase}</p>
                    <textarea value={titleDraft} rows={2} onChange={(e) => setTitleDraft(e.target.value.replace(/\n/g, " "))} onBlur={saveTitle} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} aria-label="Título do passo" data-testid="passo-titulo" className="w-full resize-none rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-display text-xl font-semibold leading-snug outline-none transition hover:border-white/15 focus:border-cyan/60" />
                    <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.05] p-4"><div className="mb-1 flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-semibold text-cyan"><Lightbulb size={13} /> Como fazer</p>{!editHint && <button onClick={() => setEditHint(true)} aria-label="Editar como fazer" data-testid="passo-editar-como" className="text-muted-foreground transition hover:text-foreground"><Pencil size={12} /></button>}</div>
                      {editHint ? <textarea autoFocus value={hintDraft} onChange={(e) => setHintDraft(e.target.value)} onBlur={saveHint} rows={4} aria-label="Como fazer" className="w-full rounded-xl border border-cyan/40 bg-black/30 p-2.5 text-sm outline-none" /> : <p className="text-sm leading-relaxed text-muted-foreground">{sel.hint || "Clique no lápis para escrever como fazer este passo."}</p>}</div>
                    <div role="radiogroup" aria-label="Situação do passo" className="grid grid-cols-2 gap-1.5">{(["todo", "doing", "blocked", "na"] as SetupStatus[]).map((st) => <button key={st} role="radio" aria-checked={sel.status === st} onClick={() => setStatus(sel, st)} className={`rounded-xl border px-3 py-2 text-xs transition ${sel.status === st ? "border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_15%,transparent)] text-foreground" : "border-white/10 text-muted-foreground hover:text-foreground"}`} style={tint(STATUS_TONE[st] === "muted-foreground" ? "cyan" : STATUS_TONE[st])}>{STATUS_LABEL[st]}</button>)}</div>
                    <label className="block space-y-1"><span className="mono-caps">Anotações deste cliente</span><textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={saveNote} rows={5} placeholder="O que foi combinado, onde fica, quem fez, dúvidas… (sem senhas)" aria-label="Anotações do passo" data-testid="passo-nota" className="w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-sm outline-none focus:border-cyan/60" /></label>
                    <button onClick={() => { saveNote(); setStatus(sel, "done", true); }} data-testid="passo-concluir" className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet py-3 text-sm font-semibold text-background shadow-[0_0_34px_-8px_var(--cyan)] transition active:scale-[0.98]">{isFinished(sel.status) ? <><CheckCircle2 size={15} /> Concluído · ir ao próximo</> : <><Check size={15} /> Concluir e ir ao próximo</>} <ArrowRight size={15} /></button>
                    {isFinished(sel.status) && <button onClick={() => goTo(nextAfter(sel.id))} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">Pular para o próximo passo aberto</button>}
                    <button onClick={() => removeStep(sel)} className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition hover:text-destructive"><Trash2 size={12} /> Excluir este passo</button>
                  </div>) : <p className="text-sm text-muted-foreground">Escolha um passo para ver como fazer.</p>}
              </aside>
            </div>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
