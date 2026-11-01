import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { useCreateWorkout, useDeleteWorkout, useSaveSplit, useSaveWorkout, type ExerciseDraft } from "@/lib/data/workouts";
import type { Exercise, SplitDay, Workout } from "@/lib/types";

const field = "w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-cyan [color-scheme:dark]";
const dayNames = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const dayDows = [1, 2, 3, 4, 5, 6, 0];

/** Editar fichas (exercícios), a divisão da semana e a meta semanal. */
export function WorkoutEditDialog({ workouts, exercises, split, goal, currentId, onClose, onSelect }: {
  workouts: Workout[]; exercises: Exercise[]; split: SplitDay[]; goal: number; currentId: string; onClose: () => void; onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<"ficha" | "semana">("ficha");
  const [selectedId, setSelectedId] = useState(currentId);
  const createWorkout = useCreateWorkout();

  const pick = (id: string) => { setSelectedId(id); onSelect(id); };
  const selected = workouts.find((w) => w.id === selectedId) ?? workouts[0];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-3xl p-6 animate-rise">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Editar treino</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="flex gap-1 rounded-2xl border border-border p-1">
          {([["ficha", "Ficha e exercícios"], ["semana", "Semana e meta"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`flex-1 rounded-xl py-2 text-sm transition ${tab === k ? "bg-cyan/10 text-cyan shadow-[inset_0_0_0_1px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 scroll-neon">
          {tab === "ficha" && (
            <>
              <div className="mb-4 flex gap-2">
                <select value={selected?.id ?? ""} onChange={(e) => pick(e.target.value)} className={field} aria-label="Ficha">
                  {workouts.map((w) => <option key={w.id} value={w.id} className="bg-popover">{w.name}</option>)}
                </select>
                <button type="button" disabled={createWorkout.isPending}
                  onClick={() => createWorkout.mutate(undefined, { onSuccess: (w) => pick(w.id), onError: (e) => toast.error(e.message) })}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan/50 px-3 text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"><Plus size={14} /> Nova ficha</button>
              </div>
              {selected
                ? <FichaForm key={selected.id} workout={selected} exercises={exercises.filter((e) => e.workout_id === selected.id)} onDeleted={() => { const other = workouts.find((w) => w.id !== selected.id); if (other) pick(other.id); }} canDelete={workouts.length > 1} />
                : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ficha. Crie a primeira.</p>}
            </>
          )}
          {tab === "semana" && <SemanaForm workouts={workouts} split={split} goal={goal} />}
        </div>
      </div>
    </div>
  );
}

function FichaForm({ workout, exercises, canDelete, onDeleted }: { workout: Workout; exercises: Exercise[]; canDelete: boolean; onDeleted: () => void }) {
  const save = useSaveWorkout();
  const del = useDeleteWorkout();
  const [name, setName] = useState(workout.name);
  const [duration, setDuration] = useState(workout.duration_min);
  const [muscles, setMuscles] = useState(workout.muscles.join(", "));
  const [list, setList] = useState<ExerciseDraft[]>(exercises.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, sets_reps: e.sets_reps, rest_seconds: e.rest_seconds })));

  const patch = (i: number, p: Partial<ExerciseDraft>) => setList((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => setList((l) => { const j = i + d; if (j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });

  const submit = () => {
    if (!name.trim()) { toast.error("Dê um nome para a ficha."); return; }
    if (list.some((e) => !e.name.trim())) { toast.error("Todo exercício precisa de um nome."); return; }
    save.mutate(
      {
        workoutId: workout.id, name, durationMin: Math.min(300, Math.max(5, Math.round(duration) || 60)),
        muscles: muscles.split(",").map((m) => m.trim()).filter(Boolean), exercises: list, existingIds: exercises.map((e) => e.id),
      },
      { onSuccess: () => toast.success("Ficha salva"), onError: (e) => toast.error(e.message) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Nome da ficha" maxLength={80} aria-label="Nome da ficha" />
        <input type="number" min={5} max={300} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field} aria-label="Duração em minutos" title="Duração (min)" />
      </div>
      <input value={muscles} onChange={(e) => setMuscles(e.target.value)} className={field} placeholder="Músculos trabalhados (separe por vírgula)" aria-label="Músculos" />

      <ul className="space-y-2">
        {list.map((e, i) => (
          <li key={e.id ?? `novo-${i}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-border/60 p-2">
            <span className="flex flex-col">
              <button type="button" aria-label="Subir exercício" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-cyan disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" aria-label="Descer exercício" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="text-muted-foreground hover:text-cyan disabled:opacity-30"><ArrowDown size={14} /></button>
            </span>
            <span className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1.2fr_0.8fr_0.6fr]">
              <input value={e.name} onChange={(ev) => patch(i, { name: ev.target.value })} className={field} placeholder="Exercício" maxLength={80} aria-label="Nome do exercício" />
              <input value={e.muscle} onChange={(ev) => patch(i, { muscle: ev.target.value })} className={field} placeholder="Músculo" maxLength={80} aria-label="Músculo do exercício" />
              <input value={e.sets_reps} onChange={(ev) => patch(i, { sets_reps: ev.target.value })} className={field} placeholder="3 x 12" maxLength={40} aria-label="Séries e repetições" />
              <input type="number" min={0} max={600} value={e.rest_seconds} onChange={(ev) => patch(i, { rest_seconds: Math.min(600, Math.max(0, Number(ev.target.value) || 0)) })} className={field} aria-label="Descanso em segundos" title="Descanso (s)" />
            </span>
            <button type="button" aria-label="Remover exercício" onClick={() => setList((l) => l.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
          </li>
        ))}
        {list.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">Sem exercícios. Adicione o primeiro.</li>}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setList((l) => [...l, { name: "", muscle: "", sets_reps: "3 x 12", rest_seconds: 60 }])}
          className="flex items-center gap-1.5 rounded-full border border-cyan/50 px-4 py-2 text-sm text-cyan hover:bg-cyan/10"><Plus size={14} /> Adicionar exercício</button>
        {canDelete && (
          <button type="button" disabled={del.isPending}
            onClick={() => { if (window.confirm(`Excluir a ficha "${workout.name}"? O histórico de treinos dela continua guardado.`)) del.mutateAsync(workout.id).then(() => { toast.success("Ficha excluída"); onDeleted(); }).catch((e: Error) => toast.error(e.message)); }}
            className="flex items-center gap-1.5 rounded-full border border-destructive/50 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"><Trash2 size={14} /> Excluir ficha</button>
        )}
        <button type="button" onClick={submit} disabled={save.isPending}
          className="ml-auto flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {save.isPending && <Loader2 size={14} className="animate-spin" />} Salvar ficha
        </button>
      </div>
    </div>
  );
}

function SemanaForm({ workouts, split, goal }: { workouts: Workout[]; split: SplitDay[]; goal: number }) {
  const save = useSaveSplit();
  const [days, setDays] = useState(() =>
    dayDows.map((dow) => { const s = split.find((x) => x.weekday === dow); return { weekday: dow, title: s?.title ?? "Livre", workout_id: s?.workout_id ?? null }; }),
  );
  const [g, setG] = useState(goal);
  const patch = (i: number, p: Partial<(typeof days)[number]>) => setDays((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {days.map((d, i) => (
          <li key={d.weekday} className="grid grid-cols-[84px_1fr_1fr] items-center gap-2">
            <span className="text-sm text-muted-foreground">{dayNames[i]}</span>
            <input value={d.title} onChange={(e) => patch(i, { title: e.target.value })} className={field} maxLength={80} aria-label={`Título de ${dayNames[i]}`} />
            <select value={d.workout_id ?? ""} onChange={(e) => patch(i, { workout_id: e.target.value || null })} className={field} aria-label={`Ficha de ${dayNames[i]}`}>
              <option value="" className="bg-popover">Sem ficha (livre/descanso)</option>
              {workouts.map((w) => <option key={w.id} value={w.id} className="bg-popover">{w.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Meta semanal
          <input type="number" min={1} max={14} value={g} onChange={(e) => setG(Number(e.target.value))} className={`${field} w-20`} aria-label="Meta de treinos por semana" /> treinos
        </label>
        <button type="button" disabled={save.isPending}
          onClick={() => save.mutate({ days, goal: g }, { onSuccess: () => toast.success("Semana salva"), onError: (e) => toast.error(e.message) })}
          className="ml-auto flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {save.isPending && <Loader2 size={14} className="animate-spin" />} Salvar semana
        </button>
      </div>
    </div>
  );
}
