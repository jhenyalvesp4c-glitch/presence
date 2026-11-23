/** Editar ou criar um playbook: nome, descrição, cor, passos (com dia), documentos modelo e checklist. */
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { ClipboardList, FileText, ListChecks, Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePlaybookActions } from "@/lib/data/user-playbooks";
import { PLAYBOOKS, newPlaybookId, type Playbook, type PlaybookStep, type StarterDoc, type StepKind } from "@/lib/playbooks";

const TONES: Playbook["tone"][] = ["cyan", "violet", "emerald", "amber"];
const fld = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-cyan/50 focus:bg-white/[0.05]";
const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

export function PlaybookEditor({ playbook, onClose }: { playbook: Playbook | null; onClose: () => void }) {
  const acts = usePlaybookActions(), builtin = !!playbook && PLAYBOOKS.some((b) => b.id === playbook.id);
  const [name, setName] = useState(playbook?.name ?? ""), [tagline, setTagline] = useState(playbook?.tagline ?? ""), [tone, setTone] = useState<Playbook["tone"]>(playbook?.tone ?? "cyan");
  const [steps, setSteps] = useState<PlaybookStep[]>(playbook?.steps ?? []), [docs, setDocs] = useState<StarterDoc[]>(playbook?.docs ?? []), [check, setCheck] = useState((playbook?.checklist ?? []).join("\n"));
  const busy = acts.save.isPending || acts.remove.isPending || acts.restore.isPending;
  const upd = (id: string, patch: Partial<PlaybookStep>) => setSteps((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const updDoc = (i: number, patch: Partial<StarterDoc>) => setDocs((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const save = () => {
    if (!name.trim()) { toast.error("Dê um nome ao playbook."); return; }
    const p: Playbook = { id: playbook?.id ?? newPlaybookId(name), name: name.trim(), tagline: tagline.trim(), tone, steps: steps.filter((s) => s.title.trim()), docs: docs.filter((d) => d.title.trim()), checklist: lines(check) };
    acts.save.mutate(p, { onSuccess: () => { toast.success(playbook ? "Playbook salvo" : "Playbook criado"); onClose(); }, onError: (e) => toast.error((e as Error).message) });
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-[40rem] overflow-hidden rounded-[2rem] border-white/10 bg-[oklch(0.14_0.035_265/0.9)] p-0 shadow-[0_40px_120px_-30px_var(--violet)] backdrop-blur-2xl [&>button]:right-5 [&>button]:top-5" aria-describedby={undefined} data-testid="playbook-editor">
        <div className="max-h-[92dvh] overflow-y-auto px-6 pb-4 pt-6 scroll-neon">
          <DialogTitle className="font-serif text-2xl"><span className="text-gradient">{playbook ? "Editar playbook" : "Novo playbook"}</span></DialogTitle>
          <div className="mt-4 space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Fechamento do mês)" maxLength={120} className={fld} data-testid="pb-nome" />
            <textarea value={tagline} onChange={(e) => setTagline(e.target.value)} rows={2} maxLength={500} placeholder="Para que serve (uma frase)" className={`${fld} resize-y`} />
            <div className="flex items-center gap-2"><span className="mono-caps">Cor</span>{TONES.map((t) => <button key={t} type="button" onClick={() => setTone(t)} aria-pressed={tone === t} aria-label={t} className="h-6 w-6 rounded-full border-2 transition active:scale-90" style={{ background: `var(--${t})`, borderColor: tone === t ? "white" : "transparent", boxShadow: tone === t ? `0 0 14px var(--${t})` : "none" } as CSSProperties} />)}</div>

            <section><p className="mono-caps mb-2 flex items-center gap-1.5"><ClipboardList size={12} /> Passos (tarefas e demandas) · {steps.length}</p>
              <ul className="space-y-1.5">{steps.map((st) => (
                <li key={st.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <input value={st.title} onChange={(e) => upd(st.id, { title: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Passo" />
                  <button type="button" onClick={() => upd(st.id, { kind: st.kind === "demanda" ? "tarefa" : "demanda" })} className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] text-muted-foreground transition hover:text-foreground">{st.kind === "demanda" ? "Demanda" : "Tarefa"}</button>
                  <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground"><button type="button" onClick={() => upd(st.id, { days: Math.max(0, st.days - 1) })} aria-label="Um dia antes">−</button><span className="min-w-[3rem] text-center tabular-nums">dia {st.days}</span><button type="button" onClick={() => upd(st.id, { days: st.days + 1 })} aria-label="Um dia depois">+</button></span>
                  <button type="button" onClick={() => setSteps((l) => l.filter((x) => x.id !== st.id))} aria-label="Tirar passo" className="text-muted-foreground transition hover:text-pink"><X size={14} /></button>
                </li>))}
              </ul>
              <button type="button" onClick={() => setSteps((l) => [...l, { id: `x-${Date.now().toString(36)}`, kind: "tarefa" as StepKind, title: "", days: (l.at(-1)?.days ?? 0) + 1, priority: "media", on: true }])} className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan transition hover:underline"><Plus size={13} /> Adicionar passo</button>
            </section>

            <section><p className="mono-caps mb-2 flex items-center gap-1.5"><FileText size={12} /> Documentos modelo · {docs.length}</p>
              <ul className="space-y-2">{docs.map((d, i) => (
                <li key={i} className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex items-center gap-2"><input value={d.title} onChange={(e) => updDoc(i, { title: e.target.value })} placeholder="Título do documento" className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" aria-label="Título do documento" /><button type="button" onClick={() => setDocs((l) => l.filter((_, k) => k !== i))} aria-label="Tirar documento" className="text-muted-foreground transition hover:text-pink"><Trash2 size={13} /></button></div>
                  <textarea value={d.desc} onChange={(e) => updDoc(i, { desc: e.target.value })} rows={2} placeholder="Descrição" className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none focus:border-cyan/50" />
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <textarea value={(d.rules ?? []).join("\n")} onChange={(e) => updDoc(i, { rules: lines(e.target.value) })} rows={2} placeholder="Regras (uma por linha)" className="resize-y rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none focus:border-cyan/50" />
                    <textarea value={(d.steps ?? []).join("\n")} onChange={(e) => updDoc(i, { steps: lines(e.target.value) })} rows={2} placeholder="Passo a passo (um por linha)" className="resize-y rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none focus:border-cyan/50" />
                  </div>
                </li>))}
              </ul>
              <button type="button" onClick={() => setDocs((l) => [...l, { kind: "Documento", title: "", desc: "" }])} className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan transition hover:underline"><Plus size={13} /> Adicionar documento</button>
            </section>

            <section><p className="mono-caps mb-2 flex items-center gap-1.5"><ListChecks size={12} /> Checklist (um item por linha)</p>
              <textarea value={check} onChange={(e) => setCheck(e.target.value)} rows={5} placeholder="Contrato assinado&#10;Briefing preenchido" className={`${fld} resize-y`} data-testid="pb-checklist" /></section>
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-6 py-3">
          <span className="flex items-center gap-3">
            {playbook && <button type="button" disabled={busy} onClick={() => { if (confirm(`Excluir o playbook "${playbook.name}"?`)) acts.remove.mutate(playbook, { onSuccess: () => { toast.success("Playbook excluído"); onClose(); }, onError: (e) => toast.error((e as Error).message) }); }} data-testid="pb-excluir" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-pink"><Trash2 size={13} /> Excluir</button>}
            {builtin && <button type="button" disabled={busy} onClick={() => acts.restore.mutate(playbook!.id, { onSuccess: () => { toast.success("Modelo original restaurado"); onClose(); } })} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"><RotateCcw size={13} /> Restaurar original</button>}
          </span>
          <span className="flex items-center gap-2"><button type="button" onClick={onClose} disabled={busy} className="px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">Cancelar</button>
            <button type="button" onClick={save} disabled={busy} data-testid="pb-salvar" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-6 py-2 text-sm font-semibold text-background transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50">{acts.save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar</button></span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
