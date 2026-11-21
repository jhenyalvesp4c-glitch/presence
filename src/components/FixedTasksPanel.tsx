/** Tarefas fixas: cadastre uma vez e ela aparece em "Hoje" e "Esta semana" nos dias escolhidos (todos os dias por padrão). */
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Pause, Play, Plus, Repeat, Trash2 } from "lucide-react";

import { Panel } from "@/components/PlanShell";
import { useFixedActions, useFixedTasks } from "@/lib/data/fixed-tasks";
import { ALL_DAYS, WEEK_CHIPS, weekdaysLabel } from "@/lib/fixed-tasks";
import { hhmm } from "@/lib/dates";
import type { Category } from "@/lib/types";

const PRESETS: { label: string; days: number[] }[] = [{ label: "Todos os dias", days: ALL_DAYS }, { label: "Dias úteis", days: [1, 2, 3, 4, 5] }, { label: "Fins de semana", days: [6, 0] }];
const field = "w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none transition focus:border-emerald";

export function FixedTasksPanel({ categories, defaultCategory }: { categories: Category[]; defaultCategory: string }) {
  const q = useFixedTasks(), act = useFixedActions(), list = q.data ?? [];
  const [title, setTitle] = useState(""), [time, setTime] = useState(""), [days, setDays] = useState<number[]>(ALL_DAYS), [cat, setCat] = useState(""), [open, setOpen] = useState(false);
  const catId = cat || defaultCategory, catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sem categoria";
  const add = () => {
    if (!title.trim() || !days.length) { toast.error(!title.trim() ? "Dê um nome à tarefa fixa." : "Escolha pelo menos um dia."); return; }
    act.create.mutate({ title, category_id: catId || null, priority: "media", due_time: time || null, weekdays: days }, { onSuccess: () => { setTitle(""); setTime(""); setDays(ALL_DAYS); toast.success("Tarefa fixa criada", { description: `${weekdaysLabel(days)} · aparece em Hoje e Esta semana.` }); }, onError: (e) => toast.error(`Não consegui salvar: ${e.message}`) });
  };
  return (
    <Panel c="emerald" className="!p-4" >
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="icon-tile h-10 w-10 rounded-full"><Repeat size={18} /></span><span><b className="block font-display text-base">Tarefas fixas</b><span className="text-xs text-muted-foreground">Aparecem nos dias que você escolher.</span></span></div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-emerald hover:text-emerald" aria-label={open ? "Fechar" : "Nova tarefa fixa"} aria-expanded={open} data-testid="fixa-abrir"><Plus size={15} className={`transition ${open ? "rotate-45" : ""}`} /></button></div>
      {open && <div className="mt-4 space-y-2.5" data-testid="fixa-form" style={{ animation: "fin-rise .35s both" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Ex.: Skin care, tomar vitamina…" maxLength={80} className={field} data-testid="fixa-titulo" />
        <div className="grid grid-cols-2 gap-2"><select value={catId} onChange={(e) => setCat(e.target.value)} className={field}>{categories.map((c) => <option key={c.id} value={c.id} className="bg-popover">{c.name}</option>)}</select><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${field} [color-scheme:dark]`} aria-label="Horário" data-testid="fixa-hora" /></div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">{WEEK_CHIPS.map(({ d, label }) => { const on = days.includes(d); return <button key={d} type="button" aria-pressed={on} onClick={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d]))} data-testid={`fixa-dia-${d}`} className={`rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${on ? "border-emerald/60 bg-emerald/15 text-emerald shadow-[0_0_14px_-4px_var(--emerald)]" : "border-border text-muted-foreground hover:text-foreground"}`}>{label}</button>; })}</div>
        <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p.label} type="button" onClick={() => setDays(p.days)} className="text-[0.7rem] text-muted-foreground underline-offset-2 hover:text-emerald hover:underline">{p.label}</button>)}</div>
        <button type="button" onClick={add} disabled={act.create.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald/50 bg-emerald/15 py-2.5 text-sm font-semibold text-emerald transition hover:bg-emerald/25 active:scale-95 disabled:opacity-60" data-testid="fixa-salvar">{act.create.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Criar tarefa fixa</button></div>}
      <ul className="mt-3 space-y-1.5" data-testid="fixas-lista">
        {q.isPending && <li className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-emerald" /></li>}
        {list.map((f) => (
          <li key={f.id} className={`flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm ${f.active ? "" : "opacity-55"}`} data-testid="fixa-item">
            <Repeat size={13} className="shrink-0 text-emerald" />
            <span className="min-w-0 flex-1"><b className={`block truncate text-[0.82rem] font-semibold ${f.active ? "" : "line-through"}`}>{f.title}</b><span className="block truncate text-[0.68rem] text-muted-foreground">{weekdaysLabel(f.weekdays)}{f.due_time ? ` · ${hhmm(f.due_time)}` : ""} · {catName(f.category_id)}</span></span>
            <button type="button" aria-label={f.active ? `Pausar ${f.title}` : `Retomar ${f.title}`} onClick={() => act.update.mutate({ id: f.id, patch: { active: !f.active } }, { onError: (e) => toast.error(e.message) })} className="text-muted-foreground transition hover:text-emerald">{f.active ? <Pause size={14} /> : <Play size={14} />}</button>
            <button type="button" aria-label={`Excluir ${f.title}`} onClick={() => { if (window.confirm(`Excluir a tarefa fixa “${f.title}”? Ela some de todos os dias.`)) act.remove.mutate(f.id, { onError: (e) => toast.error(e.message) }); }} className="text-muted-foreground transition hover:text-destructive"><Trash2 size={14} /></button>
          </li>
        ))}
        {q.isSuccess && list.length === 0 && <li className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">Nenhuma tarefa fixa ainda. Toque em + para criar uma que se repete.</li>}
      </ul>
    </Panel>
  );
}
