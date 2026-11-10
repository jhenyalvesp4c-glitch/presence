import { createFileRoute, Link } from "@tanstack/react-router";
import { backdropProps } from "@/lib/backdrop";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Check, GripVertical, Loader2, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { Panel, PlanShell, colorVar, tint } from "@/components/PlanShell";
import { tempoLabels, todayLabel } from "@/lib/plan-data";
import { hhmm, todayIso } from "@/lib/dates";
import { getIcon } from "@/lib/icons";
import type { Color, Kind } from "@/lib/types";
import { useDayPlan, useDeleteScheduleItem, useGenerateDay, useSaveScheduleItem, useSchedule, useSetItemTimes, useToggleScheduleItem } from "@/lib/data/day";

export const Route = createFileRoute("/planejamento_/dia")({
  head: () => ({
    meta: [
      { title: "Seu plano do dia · Presence" },
      { name: "description", content: "Sua programação completa do dia, em uma timeline por horários, gerada pela Presence." },
      { property: "og:title", content: "Seu plano do dia · Presence" },
      { property: "og:description", content: "Conclua, edite e reorganize as atividades do seu dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanoDia,
});

type Activity = { id: string; time: string; title: string; desc: string; tag: string; color: Color; icon: string; kind: Kind; done: boolean; task_id: string | null };

const kinds: Record<Kind, string> = {
  tarefa: "Tarefa", compromisso: "Compromisso", habito: "Hábito", treino: "Treino", autocuidado: "Autocuidado", financeiro: "Financeiro", pausa: "Pausa", extra: "Adicionado por você",
};
const dispLabel = { alta: "Alta", normal: "Normal", baixa: "Baixa" } as const;

function PlanoDia() {
  const date = todayIso();
  const planQ = useDayPlan(date);
  const schedQ = useSchedule(date);
  const toggleItem = useToggleScheduleItem();
  const saveItem = useSaveScheduleItem();
  const deleteItem = useDeleteScheduleItem();
  const setTimes = useSetItemTimes();
  const generate = useGenerateDay();

  const input = planQ.data ?? { disposicao: "normal" as const, tempo: "completo" as const, pausas: true, prioridade: "" };
  const list: Activity[] = (schedQ.data ?? []).map((r) => ({
    id: r.id, time: r.time, title: r.title, desc: r.description, tag: r.tag, color: r.color, icon: r.icon, kind: r.kind, done: r.done, task_id: r.task_id,
  }));
  const [editing, setEditing] = useState<Activity | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const done = list.filter((a) => a.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const notify = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2200); };
  const fail = (e: Error) => toast.error(e.message);

  // Reorder keeps the time slots in place and moves activities between them.
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const times = list.map((a) => a.time);
    const next = [...list];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    setTimes.mutate(next.map((a, i) => ({ id: a.id, time: times[i]!, position: i })), { onSuccess: () => notify("Atividades reorganizadas"), onError: fail });
  };
  const toggle = (id: string) => { const a = list.find((x) => x.id === id); if (a) toggleItem.mutate({ id: a.id, done: a.done, task_id: a.task_id }, { onError: fail }); };
  const save = (a: Activity) => {
    saveItem.mutate(
      { ...(isNewItem ? {} : { id: a.id }), plan_date: date, time: a.time, title: a.title, description: a.desc, tag: a.tag, color: a.color, icon: a.icon, kind: a.kind },
      { onSuccess: () => { setEditing(null); notify("Atividade salva"); }, onError: fail },
    );
  };
  const remove = (id: string) => deleteItem.mutate(id, { onSuccess: () => { setEditing(null); notify("Atividade removida"); }, onError: fail });
  const restore = () => {
    generate.mutate(
      { mode: "planejamento", date, disposicao: input.disposicao, tempo: input.tempo, prioridade: input.prioridade, pausas: input.pausas },
      { onSuccess: () => notify("Plano restaurado"), onError: fail },
    );
  };

  return (
    <PlanShell>
      <div className="flex flex-col items-center justify-between gap-4 text-center animate-rise sm:flex-row sm:text-left">
        <div>
          <Link to="/planejamento" className="mono-caps mb-2 inline-flex items-center gap-2 !text-cyan hover:opacity-80"><ArrowLeft size={14} /> Ajustar preferências</Link>
          <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">Seu plano para <span className="text-gradient">hoje</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">{todayLabel()} · {list.length} atividades</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="tag" style={tint("cyan")}>Disposição: {dispLabel[input.disposicao]}</span>
          <span className="tag" style={tint("violet")}>{tempoLabels[input.tempo]}</span>
          <span className="tag" style={tint("emerald")}>{input.pausas ? "Com pausas" : "Sem pausas"}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel c="cyan" style={{ animationDelay: ".1s" }}>
          {schedQ.isPending && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-cyan" /></div>}
          {schedQ.isSuccess && list.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">Ainda não há plano para hoje.<br /><Link to="/planejamento" className="mt-3 inline-block text-cyan">Gerar planejamento</Link></p>
          )}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Timeline do dia</h2>
            <div className="flex gap-2">
              <button type="button" onClick={restore} disabled={generate.isPending} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"><RotateCcw size={14} /> Restaurar</button>
              <button type="button" onClick={() => { setIsNewItem(true); setEditing({ id: "novo", time: "15:00", title: "", desc: "", tag: "Nova", color: "cyan", icon: "star", kind: "extra", done: false, task_id: null }); }}
                className="flex items-center gap-2 rounded-full bg-cyan/15 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/25"><Plus size={14} /> Adicionar</button>
            </div>
          </div>

          <ol className="relative space-y-2 before:absolute before:bottom-6 before:left-[7px] before:top-6 before:w-px before:bg-[linear-gradient(var(--cyan),var(--violet))] before:opacity-50">
            {list.map((a, i) => {
              const I = getIcon(a.icon);
              const col = { "--glow": colorVar(a.color) } as CSSProperties;
              return (
                <li key={a.id} draggable onDragStart={() => setDragId(a.id)} onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { const f = list.findIndex((x) => x.id === dragId); if (f >= 0) move(f, i); setDragId(null); }}
                  className={`group relative flex items-center gap-3 rounded-2xl py-2 pl-6 pr-2 transition hover:bg-secondary/40 ${dragId === a.id ? "opacity-40" : ""} ${a.done ? "opacity-60" : ""}`}>
                  <span className={`absolute left-0.5 h-3 w-3 rounded-full border-2 border-cyan transition ${a.done ? "bg-cyan shadow-[0_0_10px_var(--cyan)]" : "bg-background"}`} />
                  <GripVertical size={16} className="hidden shrink-0 cursor-grab text-muted-foreground/40 sm:block" />
                  <span className="w-16 shrink-0 rounded-full border border-cyan/40 py-1.5 text-center text-sm font-semibold">{hhmm(a.time)}</span>
                  <span className="icon-tile hidden h-10 w-10 shrink-0 !rounded-full sm:grid" style={col}><I size={17} /></span>
                  <button type="button" onClick={() => { setIsNewItem(false); setEditing(a); }} className="min-w-0 flex-1 text-left">
                    <span className={`block truncate text-[0.95rem] font-semibold ${a.done ? "line-through" : ""}`}>{a.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.desc}</span>
                  </button>
                  <span className="tag hidden shrink-0 md:inline" style={col}>{a.tag}</span>
                  <span className="hidden shrink-0 flex-col opacity-0 transition group-hover:opacity-100 sm:flex">
                    <button type="button" aria-label="Subir" onClick={() => move(i, i - 1)} className="text-muted-foreground hover:text-cyan"><ArrowUp size={14} /></button>
                    <button type="button" aria-label="Descer" onClick={() => move(i, i + 1)} className="text-muted-foreground hover:text-cyan"><ArrowDown size={14} /></button>
                  </span>
                  <button type="button" aria-label="Editar" onClick={() => { setIsNewItem(false); setEditing(a); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Pencil size={14} /></button>
                  <button type="button" aria-label={a.done ? "Desmarcar" : "Concluir"} onClick={() => toggle(a.id)}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition ${a.done ? "border-emerald bg-emerald text-primary-foreground" : "border-muted-foreground/50 hover:border-emerald"}`}>
                    {a.done && <Check size={15} strokeWidth={3} />}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-center text-xs text-muted-foreground">Arraste ou use as setas para reorganizar · toque numa atividade para editar</p>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel c="emerald" style={{ animationDelay: ".2s" }}>
            <div className="mb-3 flex justify-between text-sm"><span className="text-muted-foreground">Progresso do dia</span><span className="font-semibold">{pct} %</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-brand transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{done} de {list.length} concluídas</p>
          </Panel>
          <Panel c="violet" style={{ animationDelay: ".28s" }}>
            <h2 className="mb-3 flex items-center gap-2.5 font-display text-lg font-semibold"><Sparkles size={20} className="text-violet" /> O que entrou no plano</h2>
            <ul className="space-y-2 text-sm">
              {(Object.keys(kinds) as Kind[]).map((k) => {
                const n = list.filter((a) => a.kind === k).length;
                return n ? <li key={k} className="flex justify-between rounded-xl border border-border px-3 py-2"><span className="text-muted-foreground">{kinds[k]}</span><span className="font-semibold">{n}</span></li> : null;
              })}
            </ul>
            {input.prioridade && <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">Encaixei sua prioridade <span className="text-foreground">"{input.prioridade}"</span> logo no início do dia, quando o foco é maior.</p>}
          </Panel>
          <Link to="/assistente" className="glass flex items-center justify-center gap-2 rounded-full py-3.5 text-sm transition hover:shadow-[0_0_30px_-8px_var(--cyan)]"><ArrowLeft size={16} /> Voltar ao início</Link>
        </div>
      </div>

      {editing && <EditDialog a={{ ...editing, time: hhmm(editing.time) || "15:00" }} isNew={isNewItem} onClose={() => setEditing(null)} onSave={save} onRemove={remove} />}
      {flash && <div className="glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm animate-rise"><Check size={14} className="mr-2 inline text-emerald" />{flash}</div>}
    </PlanShell>
  );
}

function EditDialog({ a, isNew, onClose, onSave, onRemove }: { a: Activity; isNew: boolean; onClose: () => void; onSave: (a: Activity) => void; onRemove: (id: string) => void }) {
  const [f, setF] = useState(a);
  const field = "w-full rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm outline-none focus:border-cyan";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" {...backdropProps(onClose)}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (f.title.trim()) onSave(f); }}
        className="glass w-full max-w-md space-y-4 rounded-3xl p-6 animate-rise">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{isNew ? "Nova atividade" : "Editar atividade"}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className={field} required />
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Título" className={field} autoFocus maxLength={60} required />
        </div>
        <input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Descrição" className={field} maxLength={90} />
        <input value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="Etiqueta" className={field} maxLength={16} />
        <div className="flex gap-2 pt-1">
          {!isNew && <button type="button" onClick={() => onRemove(a.id)} className="flex items-center gap-2 rounded-full border border-destructive/50 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"><Trash2 size={14} /> Remover</button>}
          <button type="submit" className="ml-auto rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground">Salvar</button>
        </div>
      </form>
    </div>
  );
}
