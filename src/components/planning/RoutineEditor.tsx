import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { backdropProps } from "@/lib/backdrop";
import { useDeleteRoutineItem, useRoutineFull, useSaveRoutineItem, useStarterRoutine, type RoutineDraft } from "@/lib/data/planning";

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"], DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const KINDS: [string, string][] = [["habito", "Hábito"], ["tarefa", "Trabalho/tarefa"], ["treino", "Treino"], ["autocuidado", "Autocuidado"], ["pausa", "Pausa/refeição"], ["financeiro", "Financeiro"], ["extra", "Outro"]];
const COLORS = ["cyan", "violet", "emerald", "amber", "rose"] as const;
const blank = (): RoutineDraft => ({ time: "08:00", title: "", description: "", tag: "Rotina", color: "cyan", icon: "star", kind: "habito", duration_min: 30, weekdays: [0, 1, 2, 3, 4, 5, 6], active: true });
const inp = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-cyan";

/** Minha rotina: o "dia padrão" que o plano usa como base. Tudo aqui é editável: horário, duração, dias da semana, ligar e desligar. */
export function RoutineEditor({ onClose }: { onClose: () => void }) {
  const q = useRoutineFull(), save = useSaveRoutineItem(), del = useDeleteRoutineItem(), starter = useStarterRoutine();
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  if (typeof document === "undefined") return null;
  const rows = q.data ?? [];
  const submit = () => {
    if (!draft || !draft.title.trim()) { toast.error("Dê um nome para a atividade."); return; }
    if (!draft.weekdays.length) { toast.error("Escolha pelo menos um dia da semana."); return; }
    save.mutate(draft, { onSuccess: () => { setDraft(null); toast.success("Rotina salva"); }, onError: (e) => toast.error(e.message) });
  };
  const toggleDay = (d: number) => setDraft((x) => (x ? { ...x, weekdays: x.weekdays.includes(d) ? x.weekdays.filter((y) => y !== d) : [...x.weekdays, d].sort() } : x));
  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-background/80 p-4 backdrop-blur-md" {...backdropProps(onClose)} data-testid="editor-rotina">
      <div className="mx-auto my-6 w-full max-w-2xl rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Minha rotina">
        <div className="mb-4 flex items-start gap-3">
          <div className="mr-auto"><h2 className="font-display text-xl font-semibold">Minha rotina</h2><p className="text-sm text-muted-foreground">O dia padrão que o plano usa como base. Mude, adicione ou desligue o que quiser.</p></div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        {draft ? (
          <div className="space-y-3" data-testid="rotina-form">
            <label className="block text-sm">Atividade<input className={inp} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: Leitura, Academia, Almoço" autoFocus data-testid="rotina-titulo" /></label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="block text-sm">Horário<input type="time" className={inp} value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} data-testid="rotina-hora" /></label>
              <label className="block text-sm">Duração (min)<input type="number" min={5} max={720} step={5} className={inp} value={draft.duration_min} onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value) || 30 })} /></label>
              <label className="col-span-2 block text-sm sm:col-span-1">Tipo<select className={inp} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{KINDS.map(([v, l]) => <option key={v} value={v} className="bg-card">{l}</option>)}</select></label>
            </div>
            <label className="block text-sm">Descrição (opcional)<input className={inp} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <div><p className="mb-1.5 text-sm">Em quais dias?</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {DAYS.map((l, d) => <button key={d} type="button" aria-pressed={draft.weekdays.includes(d)} title={DAY_NAMES[d]} onClick={() => toggleDay(d)} className={`h-9 w-9 rounded-full border text-sm transition ${draft.weekdays.includes(d) ? "border-cyan bg-cyan/15 text-cyan" : "border-border text-muted-foreground"}`}>{l}</button>)}
                <button type="button" onClick={() => setDraft({ ...draft, weekdays: [1, 2, 3, 4, 5] })} className="ml-1 text-xs text-cyan hover:underline">dias úteis</button>
                <button type="button" onClick={() => setDraft({ ...draft, weekdays: [0, 1, 2, 3, 4, 5, 6] })} className="text-xs text-cyan hover:underline">todos</button>
              </div></div>
            <div><p className="mb-1.5 text-sm">Cor</p><div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={draft.color === c} onClick={() => setDraft({ ...draft, color: c })} className={`h-7 w-7 rounded-full border-2 ${draft.color === c ? "border-foreground" : "border-transparent"}`} style={{ background: `var(--${c})` }} />)}</div></div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setDraft(null)} className="rounded-full border border-border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={submit} disabled={save.isPending} data-testid="rotina-salvar" className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Salvar</button>
            </div>
          </div>
        ) : (
          <>
            {rows.length === 0 && !q.isLoading && (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Você ainda não tem uma rotina. Comece com um modelo (você edita tudo depois) ou crie a sua do zero.
                <div className="mt-3"><button onClick={() => starter.mutate(undefined, { onError: (e) => toast.error(e.message) })} disabled={starter.isPending} data-testid="rotina-modelo" className="inline-flex items-center gap-2 rounded-full border border-cyan/50 px-4 py-2 text-cyan hover:bg-cyan/10"><Sparkles size={15} /> Usar rotina modelo</button></div>
              </div>
            )}
            <ul className="space-y-2" data-testid="rotina-lista">
              {rows.map((r) => (
                <li key={r.id} className={`flex items-center gap-3 rounded-2xl border border-border px-3 py-2.5 ${r.active ? "" : "opacity-50"}`}>
                  <span className="w-14 shrink-0 text-center text-sm font-semibold tabular-nums">{r.time}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setDraft({ id: r.id, time: r.time, title: r.title, description: r.description, tag: r.tag, color: r.color, icon: r.icon, kind: r.kind, duration_min: r.duration_min, weekdays: r.weekdays, active: r.active })}>
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.duration_min} min · {r.weekdays.length === 7 ? "todos os dias" : r.weekdays.map((d) => DAY_NAMES[d]!.slice(0, 3)).join(", ")}</span>
                  </button>
                  <button role="switch" aria-checked={r.active} aria-label={`${r.active ? "Desligar" : "Ligar"} ${r.title}`} onClick={() => save.mutate({ id: r.id, time: r.time, title: r.title, description: r.description, tag: r.tag, color: r.color, icon: r.icon, kind: r.kind, duration_min: r.duration_min, weekdays: r.weekdays, active: !r.active })} className={`relative h-6 w-11 shrink-0 rounded-full transition ${r.active ? "bg-cyan" : "bg-secondary"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-background transition-all ${r.active ? "left-6" : "left-1"}`} /></button>
                  <button onClick={() => { if (window.confirm(`Apagar "${r.title}" da rotina?`)) del.mutate(r.id); }} aria-label={`Apagar ${r.title}`} className="text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between gap-2">
              <button onClick={() => setDraft(blank())} data-testid="rotina-nova" className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground"><Plus size={16} /> Adicionar atividade</button>
              <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
