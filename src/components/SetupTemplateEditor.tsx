/** Editor do roteiro de implantação padrão do projeto: configurado uma vez, todo cliente novo já nasce com ele. */
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, Lightbulb, Loader2, Plus, RotateCcw, Rocket, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSetupTemplate, useSetupTemplateActions } from "@/lib/data/setup-templates";
import { SETUP_TEMPLATE, sanitizeTemplate, type SetupPhaseDef } from "@/lib/setup";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const TONES = ["cyan", "violet", "emerald", "amber", "pink"] as const;
const rk = () => Math.random().toString(36).slice(2, 7);
const clone = (p: SetupPhaseDef[]): SetupPhaseDef[] => p.map((x) => ({ ...x, steps: x.steps.map((s) => ({ ...s })) }));

export function SetupTemplateEditor({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const q = useSetupTemplate(projectId), acts = useSetupTemplateActions(projectId);
  if (q.isPending) return <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}><DialogContent className="max-w-sm border-white/10 bg-background" aria-describedby={undefined}><DialogTitle className="sr-only">Carregando</DialogTitle><p className="py-6 text-center text-sm text-muted-foreground"><Loader2 size={14} className="mr-2 inline animate-spin" />Carregando…</p></DialogContent></Dialog>;
  return <Editor key={q.dataUpdatedAt} initial={q.data?.phases ?? SETUP_TEMPLATE} custom={!!q.data?.custom} onClose={onClose} save={(p) => acts.save.mutate(p, { onSuccess: () => { toast.success("Padrão do projeto salvo"); onClose(); }, onError: (e) => toast.error((e as Error).message) })} reset={() => acts.reset.mutate(undefined, { onSuccess: () => toast.success("Modelo inicial restaurado"), onError: (e) => toast.error((e as Error).message) })} busy={acts.save.isPending || acts.reset.isPending} />;
}

function Editor({ initial, custom, onClose, save, reset, busy }: { initial: SetupPhaseDef[]; custom: boolean; onClose: () => void; save: (p: SetupPhaseDef[]) => void; reset: () => void; busy: boolean }) {
  const [phases, setPhases] = useState(() => clone(initial)), [open, setOpen] = useState<number | null>(0), [hintOpen, setHintOpen] = useState<string | null>(null), [adding, setAdding] = useState<Record<number, string>>({});
  const mut = (fn: (p: SetupPhaseDef[]) => SetupPhaseDef[]) => setPhases((l) => fn(clone(l)));
  const total = phases.reduce((a, p) => a + p.steps.length, 0), valid = !!sanitizeTemplate(phases);
  const fld = "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50";
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-[38rem] overflow-hidden rounded-[2rem] border-white/10 bg-[oklch(0.14_0.035_265/0.84)] p-0 shadow-[0_40px_120px_-30px_var(--violet)] backdrop-blur-2xl [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:border [&>button]:border-white/10 [&>button]:p-1.5" data-testid="implantacao-modelo" aria-describedby={undefined}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"><span className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[var(--cyan)] opacity-[0.14] blur-3xl" style={{ animation: "fin-aurora 18s ease-in-out infinite" }} /><span className="absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-[var(--violet)] opacity-[0.18] blur-3xl" style={{ animation: "fin-aurora 22s ease-in-out infinite reverse" }} /></div>
        <div className="relative max-h-[92dvh] overflow-y-auto px-7 pb-6 pt-7 scroll-neon">
          <div className="mb-5 flex items-center gap-3"><span className="icon-tile h-10 w-10 shrink-0 !rounded-full shadow-[0_0_28px_-6px_var(--glow)]" style={tint("cyan")}><Rocket size={16} /></span><div className="min-w-0"><p className="mono-caps">{custom ? "Padrão do projeto" : "Modelo inicial"}</p><DialogTitle className="font-display text-lg font-semibold">Roteiro de implantação</DialogTitle></div></div>
          <p className="mb-5 text-xs leading-relaxed text-muted-foreground">Monte uma vez. Todo cliente novo (pelo playbook ou pela ficha) já começa com estas fases e passos, e você só ajusta o que for diferente. {phases.length} fases · {total} passos.</p>

          <ol className="space-y-2.5">
            {phases.map((ph, i) => { const tone = TONES[i % TONES.length]!, on = open === i; return (
              <li key={i} className="rounded-2xl border border-white/10 bg-white/[0.03]" style={tint(tone)}>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button onClick={() => setOpen(on ? null : i)} aria-expanded={on} aria-label={on ? "Recolher fase" : "Abrir fase"} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_18%,transparent)] text-[0.65rem] font-semibold">{i + 1}</button>
                  <input value={ph.name} onChange={(e) => mut((l) => { l[i]!.name = e.target.value; return l; })} aria-label={`Nome da fase ${i + 1}`} placeholder="Nome da fase" className={`${fld} font-medium`} />
                  <span className="shrink-0 text-[0.7rem] text-muted-foreground">{ph.steps.length}</span>
                  <button onClick={() => mut((l) => { if (i > 0) [l[i - 1], l[i]] = [l[i]!, l[i - 1]!]; return l; })} disabled={i === 0} aria-label="Subir fase" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp size={12} /></button>
                  <button onClick={() => mut((l) => { if (i < l.length - 1) [l[i + 1], l[i]] = [l[i]!, l[i + 1]!]; return l; })} disabled={i === phases.length - 1} aria-label="Descer fase" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown size={12} /></button>
                  <button onClick={() => { if (window.confirm(`Excluir a fase "${ph.name || i + 1}" e os ${ph.steps.length} passos dela?`)) mut((l) => l.filter((_, k) => k !== i)); }} aria-label="Excluir fase" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                  <button onClick={() => setOpen(on ? null : i)} aria-label="Alternar" className="text-muted-foreground"><ChevronDown size={14} className={`transition ${on ? "rotate-180" : ""}`} /></button>
                </div>
                {on && <div className="space-y-1.5 border-t border-white/10 px-3 pb-3 pt-2.5" style={{ animation: "fin-rise .3s both" }}>
                  <input value={ph.goal} onChange={(e) => mut((l) => { l[i]!.goal = e.target.value; return l; })} placeholder="Objetivo da fase (opcional)" aria-label="Objetivo da fase" className={`${fld} w-full px-1 pb-1 text-xs text-muted-foreground`} />
                  {ph.steps.map((st, k) => { const hk = `${i}-${k}`; return (
                    <div key={st.key} className="group rounded-xl bg-black/20 px-2.5 py-1.5">
                      <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--glow)]" />
                        <input value={st.title} onChange={(e) => mut((l) => { l[i]!.steps[k]!.title = e.target.value; return l; })} aria-label={`Passo ${k + 1} da fase ${i + 1}`} placeholder="Título do passo" className={fld} />
                        <button onClick={() => setHintOpen(hintOpen === hk ? null : hk)} aria-label="Editar como fazer" title="Como fazer" className={`grid h-6 w-6 place-items-center rounded-md transition ${hintOpen === hk || st.hint ? "text-cyan" : "text-muted-foreground hover:text-foreground"}`}><Lightbulb size={12} /></button>
                        <button onClick={() => mut((l) => { if (k > 0) [l[i]!.steps[k - 1], l[i]!.steps[k]] = [l[i]!.steps[k]!, l[i]!.steps[k - 1]!]; return l; })} disabled={k === 0} aria-label="Subir passo" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 hover:text-foreground disabled:opacity-0 group-hover:opacity-100"><ArrowUp size={11} /></button>
                        <button onClick={() => mut((l) => { const a = l[i]!.steps; if (k < a.length - 1) [a[k + 1], a[k]] = [a[k]!, a[k + 1]!]; return l; })} disabled={k === ph.steps.length - 1} aria-label="Descer passo" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 hover:text-foreground disabled:opacity-0 group-hover:opacity-100"><ArrowDown size={11} /></button>
                        <button onClick={() => mut((l) => { l[i]!.steps.splice(k, 1); return l; })} aria-label={`Excluir passo ${st.title}`} data-testid={`modelo-excluir-${i}-${k}`} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button></div>
                      {hintOpen === hk && <textarea value={st.hint} onChange={(e) => mut((l) => { l[i]!.steps[k]!.hint = e.target.value; return l; })} rows={3} placeholder="Como fazer este passo (aparece para você no modo guiado)" aria-label="Como fazer" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs outline-none focus:border-cyan/50" />}
                    </div>); })}
                  <form onSubmit={(e) => { e.preventDefault(); const t = (adding[i] ?? "").trim(); if (!t) return; mut((l) => { l[i]!.steps.push({ key: `t-${rk()}`, title: t, hint: "" }); return l; }); setAdding((a) => ({ ...a, [i]: "" })); }} className="flex items-center gap-2 rounded-full border border-dashed border-white/15 px-3 py-1.5 focus-within:border-cyan/50"><Plus size={13} className="text-cyan" /><input value={adding[i] ?? ""} onChange={(e) => setAdding((a) => ({ ...a, [i]: e.target.value }))} placeholder="Adicionar passo…" aria-label={`Novo passo na fase ${i + 1}`} data-testid={`modelo-novo-passo-${i}`} className={fld} /></form>
                </div>}
              </li>); })}
          </ol>
          <button onClick={() => { mut((l) => [...l, { id: `p-${rk()}`, name: "", tone: "cyan", goal: "", steps: [{ key: `t-${rk()}`, title: "", hint: "" }] }]); setOpen(phases.length); }} data-testid="modelo-nova-fase" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-2.5 text-sm text-muted-foreground transition hover:border-cyan/50 hover:text-foreground"><Plus size={14} /> Nova fase</button>

          <div className="sticky -bottom-6 -mx-7 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[oklch(0.14_0.035_265/0.92)] px-7 pb-5 pt-4 backdrop-blur-xl">
            <button onClick={() => { if (window.confirm("Voltar ao modelo inicial? O padrão que você salvou será apagado (clientes que já têm roteiro não mudam).")) reset(); }} disabled={busy || !custom} className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"><RotateCcw size={12} /> Restaurar modelo inicial</button>
            <div className="flex items-center gap-2"><button onClick={onClose} disabled={busy} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button><button onClick={() => save(phases)} disabled={busy || !valid} data-testid="modelo-salvar" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-6 py-2.5 text-sm font-semibold text-background shadow-[0_0_32px_-8px_var(--cyan)] transition active:scale-[0.97] disabled:opacity-40 disabled:shadow-none">{busy ? <Loader2 size={14} className="animate-spin" /> : null} Salvar como padrão</button></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
