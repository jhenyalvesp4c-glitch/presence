import { useState } from "react";
import { backdropProps } from "@/lib/backdrop";
import { Flag, Loader2, Trash2, X } from "lucide-react";

import { colorVar } from "@/components/PlanShell";
import type { Category, Priority, Task } from "@/lib/types";

const prios: { k: Priority; l: string; c: string }[] = [
  { k: "alta", l: "Alta", c: "rose" }, { k: "media", l: "Média", c: "amber" }, { k: "baixa", l: "Baixa", c: "emerald" },
];

export type TaskPatch = Pick<Task, "title" | "description" | "category_id" | "priority" | "due_date" | "due_time">;

/** Editar uma tarefa: título, detalhes, categoria, prioridade, data e hora. */
export function TaskEditDialog({ task, categories, saving, onClose, onSave, onDelete }: {
  task: Task; categories: Category[]; saving: boolean; onClose: () => void; onSave: (patch: TaskPatch) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [categoryId, setCategoryId] = useState(task.category_id ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [date, setDate] = useState(task.due_date ?? "");
  const [time, setTime] = useState(task.due_time?.slice(0, 5) ?? "");
  const field = "w-full rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm outline-none focus:border-cyan [color-scheme:dark]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" {...backdropProps(onClose)}>
      <form onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSave({ title, description: description.trim() || null, category_id: categoryId || null, priority, due_date: date || null, due_time: time || null });
        }}
        className="glass w-full max-w-md space-y-4 rounded-3xl p-6 animate-rise">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Editar tarefa</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className={field} autoFocus maxLength={200} required />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes (opcional)" rows={2} maxLength={2000} className={`${field} resize-none`} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
          <option value="" className="bg-popover">Sem categoria</option>
          {categories.map((c) => <option key={c.id} value={c.id} className="bg-popover">{c.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} aria-label="Data" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} aria-label="Hora" />
        </div>
        <div className="flex gap-2">
          {prios.map((p) => (
            <button type="button" key={p.k} onClick={() => setPriority(p.k)} aria-pressed={priority === p.k}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 text-sm transition ${priority === p.k ? "border-current bg-secondary/60" : "border-border text-muted-foreground"}`}
              style={priority === p.k ? { color: colorVar(p.c) } : undefined}>
              <Flag size={13} /> {p.l}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onDelete} className="flex items-center gap-2 rounded-full border border-destructive/50 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"><Trash2 size={14} /> Excluir</button>
          <button type="submit" disabled={saving} className="ml-auto flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
