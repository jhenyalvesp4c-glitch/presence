/** Treino do dia: aquecimento, cada exercício com a meta, a sugestão de progressão e o registro série a série com cronômetro de descanso. */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, Flame, Loader2, Pause, Play, Timer, Trash2, TrendingUp } from "lucide-react";

import { useProgramActions } from "@/lib/data/program";
import { addDays, dayName, faseDaSemana, isoOf, sessionsOf, suggest, weekOf, type Action, type ProgDay, type ProgExercise, type Program, type SetLog } from "@/lib/program";

const TONE: Record<Action, { c: string; label: string }> = {
  aumentar: { c: "var(--emerald)", label: "Hora de progredir" }, subir_reps: { c: "var(--cyan)", label: "Suba as repetições" }, manter: { c: "var(--cyan)", label: "Mantenha" },
  reduzir: { c: "oklch(0.8 0.15 75)", label: "Reduza" }, interromper: { c: "oklch(0.7 0.18 10)", label: "Interrompa" }, aferir: { c: "var(--violet)", label: "Achar a carga" }, fixo: { c: "var(--cyan)", label: "Prescrição" },
};
const fmtKg = (n: number | null) => (n === null ? "—" : `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`);
const dateBR = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const parseKg = (s: string) => { const n = Number(s.replace(",", ".")); return s.trim() && Number.isFinite(n) && n >= 0 ? n : null; };
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };

/** Cronômetro de descanso (conta para trás, avisa no fim). */
export function RestTimer({ seconds, runId, onDone }: { seconds: number; runId: number; onDone?: () => void }) {
  const [left, setLeft] = useState(0), [paused, setPaused] = useState(false), done = useRef(onDone);
  done.current = onDone;
  useEffect(() => { setLeft(seconds); setPaused(false); }, [runId, seconds]);
  useEffect(() => {
    if (!left || paused) return;
    const t = setTimeout(() => setLeft((v) => { if (v <= 1) { done.current?.(); return 0; } return v - 1; }), 1000);
    return () => clearTimeout(t);
  }, [left, paused]);
  if (!left) return null;
  const pct = ((seconds - left) / seconds) * 100;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-2.5" role="timer" aria-label={`Descanso: ${left} segundos`} data-testid="descanso">
      <Timer size={16} className="text-cyan" />
      <span className="font-display text-xl font-semibold tabular-nums text-cyan">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-cyan to-violet transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} /></span>
      <button type="button" onClick={() => setPaused((v) => !v)} aria-label={paused ? "Retomar" : "Pausar"} className="text-muted-foreground hover:text-foreground">{paused ? <Play size={15} /> : <Pause size={15} />}</button>
      <button type="button" onClick={() => setLeft(0)} className="text-xs text-muted-foreground hover:text-foreground">Pular</button>
    </div>
  );
}

function SetRow({ ex, n, saved, date, week, preload, onSave, onDelete }: { ex: ProgExercise; n: number; saved: SetLog | undefined; date: string; week: number; preload: number | null; onSave: (l: SetLog) => Promise<void>; onDelete: (id: string) => void }) {
  const [load, setLoad] = useState(saved?.load !== undefined && saved.load !== null ? String(saved.load).replace(".", ",") : preload !== null ? String(preload).replace(".", ",") : "");
  const [reps, setReps] = useState(saved?.reps !== undefined && saved.reps !== null ? String(saved.reps) : ""), [rir, setRir] = useState(saved?.rir !== undefined && saved.rir !== null ? String(saved.rir) : ""), [flags, setFlags] = useState<string[]>(saved?.flags ?? []);
  const [busy, setBusy] = useState(false), [more, setMore] = useState(flags.length > 0);
  const r = Math.round(Number(reps));
  const ok = reps.trim() !== "" && Number.isFinite(r) && r >= 0 && (parseKg(load) !== null || load.trim() === "");
  const save = async () => { if (!ok) return; setBusy(true); try { await onSave({ exerciseId: ex.id, exerciseName: ex.nome, date, week, set: n, load: parseKg(load), reps: r, rir: rir === "" ? null : Number(rir), warmup: false, flags }); } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); } setBusy(false); };
  const input = "w-full rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 text-center text-sm tabular-nums outline-none transition focus:border-cyan/60";
  return (
    <li className={`rounded-2xl border p-2.5 transition ${saved ? "border-emerald/35 bg-emerald/[0.06]" : "border-white/10 bg-white/[0.02]"}`} data-testid="serie">
      <div className="grid grid-cols-[2rem_1fr_1fr_4.5rem_auto] items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${saved ? "bg-emerald/25 text-emerald" : "bg-white/10 text-muted-foreground"}`}>{saved ? <Check size={13} /> : n}</span>
        <label className="sr-only" htmlFor={`c-${ex.id}-${n}`}>Carga da série {n}</label><input id={`c-${ex.id}-${n}`} inputMode="decimal" placeholder="kg" value={load} onChange={(e) => setLoad(e.target.value)} className={input} data-testid="serie-carga" />
        <label className="sr-only" htmlFor={`r-${ex.id}-${n}`}>Repetições da série {n}</label><input id={`r-${ex.id}-${n}`} inputMode="numeric" placeholder={`${ex.repsMin}–${ex.repsMax}`} value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, "").slice(0, 3))} className={input} data-testid="serie-reps" />
        <select aria-label="Repetições em reserva" value={rir} onChange={(e) => setRir(e.target.value)} className={`${input} !px-1`} data-testid="serie-rir"><option value="">RIR</option>{[4, 3, 2, 1, 0].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => void save()} disabled={!ok || busy} aria-label={`Salvar série ${n}`} data-testid="serie-salvar" className="grid h-9 w-9 place-items-center rounded-full border border-emerald/50 bg-emerald/10 text-emerald transition hover:bg-emerald/25 disabled:opacity-35">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}</button>
          {saved?.id && <button type="button" onClick={() => onDelete(saved.id!)} aria-label={`Apagar série ${n}`} className="text-muted-foreground transition hover:text-destructive"><Trash2 size={14} /></button>}
        </span>
      </div>
      <button type="button" onClick={() => setMore((v) => !v)} className="mt-1.5 flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-foreground"><ChevronDown size={11} className={more ? "rotate-180" : ""} /> sentiu dor, perdeu a postura ou usou impulso?</button>
      {more && <div className="mt-1.5 flex flex-wrap gap-1.5">{(["dor", "postura", "impulso"] as const).map((f) => <button key={f} type="button" aria-pressed={flags.includes(f)} onClick={() => setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))} className={`rounded-full border px-2.5 py-1 text-[0.7rem] transition ${flags.includes(f) ? "border-amber/60 bg-amber/15 text-amber" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{f === "dor" ? "Dor articular" : f === "postura" ? "Perdi a postura" : "Usei impulso"}</button>)}</div>}
    </li>
  );
}

function ExerciseCard({ ex, logs, date, week, actions, onRest, index }: { ex: ProgExercise; logs: SetLog[]; date: string; week: number; actions: ReturnType<typeof useProgramActions>; onRest: (s: number) => void; index: number }) {
  const [help, setHelp] = useState(false);
  const before = useMemo(() => sessionsOf(logs.filter((l) => l.date < date), ex.id), [logs, date, ex.id]);
  const sug = useMemo(() => suggest(ex, before), [ex, before]), tone = TONE[sug.acao];
  const today = useMemo(() => logs.filter((l) => l.exerciseId === ex.id && l.date === date && !l.warmup), [logs, ex.id, date]);
  const bySet = (n: number) => today.find((l) => l.set === n);
  const save = async (l: SetLog) => { await actions.logSet.mutateAsync(l); if (ex.descansoS > 0 && l.set < ex.series) onRest(ex.descansoS); };
  const isForce = ex.tipo === "forca", done = today.length >= (isForce ? ex.series : 1);
  const presc = isForce ? `${ex.series} × ${ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`}${ex.repsNota ? ` ${ex.repsNota}` : ""}` : ex.prescricao;
  return (
    <>
      <article className={`glass relative overflow-hidden rounded-3xl p-4 sm:p-5 ${done ? "border-emerald/30" : ""}`} style={{ animation: "fin-rise .55s both", animationDelay: `${index * 70}ms` }} data-testid="exercicio">
        <span aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ background: tone.c }} />
        <div className="relative flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-semibold">{ex.nome}</h3><p className="text-xs text-muted-foreground">{ex.grupo}{ex.grupo ? " · " : ""}{ex.equip === "maquina" ? "máquina" : ex.equip === "halter" ? "halter" : ex.equip === "polia" ? "polia" : ex.equip === "corpo" ? "peso do corpo" : "livre"}</p></div>
          <div className="text-right"><p className="font-display text-lg font-semibold tabular-nums">{presc}</p><p className="text-[0.7rem] text-muted-foreground">{ex.descansoS ? `descanso ${ex.descansoS} s` : ""}{ex.rir && isForce ? ` · RIR ${ex.rir}` : ""}</p></div>
          {done && <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald/20 text-emerald" aria-label="Exercício concluído"><Check size={15} /></span>}
        </div>

        {isForce && <div className="relative mt-3 rounded-2xl border p-3" style={{ borderColor: `color-mix(in oklab, ${tone.c} 40%, transparent)`, background: `color-mix(in oklab, ${tone.c} 9%, transparent)` }} data-testid="sugestao" data-acao={sug.acao}>
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: tone.c }}>{sug.acao === "aumentar" ? <TrendingUp size={15} /> : sug.acao === "interromper" || sug.acao === "reduzir" ? <AlertTriangle size={15} /> : <Flame size={15} />}<span className="text-[0.65rem] font-bold uppercase tracking-wider opacity-80">{tone.label}</span>{sug.titulo}</p>
          <p className="mt-1 text-xs text-foreground/80">{sug.motivo}</p>
          {sug.ultima && <p className="mt-1.5 text-[0.7rem] text-muted-foreground">Última vez ({dateBR(sug.ultima.date)}): {fmtKg(sug.ultima.load)} — {sug.ultima.reps.join(", ")} repetições</p>}
        </div>}

        {isForce ? <ul className="relative mt-3 space-y-2">{Array.from({ length: ex.series }, (_, i) => i + 1).map((n) => <SetRow key={`${n}-${bySet(n)?.id ?? "novo"}`} ex={ex} n={n} saved={bySet(n)} date={date} week={week} preload={sug.cargaAlvo} onSave={save} onDelete={(id) => actions.deleteSet.mutate(id)} />)}</ul>
          : <button type="button" onClick={() => void actions.logSet.mutateAsync({ exerciseId: ex.id, exerciseName: ex.nome, date, week, set: 1, load: null, reps: 1, rir: null, warmup: false, flags: [] }).catch((e) => toast.error((e as Error).message))} disabled={done} className={`relative mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${done ? "border-emerald/40 bg-emerald/10 text-emerald" : "border-white/15 hover:bg-white/10"}`} data-testid="marcar-feito"><Check size={15} /> {done ? "Feito" : "Marcar como feito"}</button>}

        {ex.instrucoes && <><button type="button" onClick={() => setHelp((v) => !v)} className="relative mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronDown size={12} className={help ? "rotate-180" : ""} /> Como executar</button>{help && <p className="relative mt-1 text-xs leading-relaxed text-foreground/80">{ex.instrucoes}</p>}</>}
      </article>
    </>
  );
}

export function TodayTab({ program, startDate, logs, actions }: { program: Program; startDate: string; logs: SetLog[]; actions: ReturnType<typeof useProgramActions> }) {
  const now = new Date(), todayIso = isoOf(now), dow = now.getDay();
  const [sel, setSel] = useState(program.dias.find((d) => d.dia === dow)?.dia ?? program.dias[0]!.dia);
  const [rest, setRest] = useState({ id: 0, s: 0 });
  const monday = addDays(todayIso, -((dow + 6) % 7)), dateOf = (dia: number) => addDays(monday, (dia + 6) % 7);
  const day: ProgDay = program.dias.find((d) => d.dia === sel) ?? program.dias[0]!, date = dateOf(day.dia), week = Math.max(1, weekOf(startDate, date)), fase = faseDaSemana(program, week);
  const warmKey = `orion:aquecimento:${date}:${day.id}`, [warm, setWarm] = useState<number[]>([]);
  useEffect(() => setRest((r) => ({ id: r.id + 1, s: 0 })), [sel]); // o descanso de um dia não vale para outro
  useEffect(() => { try { setWarm(JSON.parse(ls.get(warmKey) ?? "[]") as number[]); } catch { setWarm([]); } }, [warmKey]);
  const toggleWarm = (i: number) => setWarm((w) => { const n = w.includes(i) ? w.filter((x) => x !== i) : [...w, i]; ls.set(warmKey, JSON.stringify(n)); return n; });
  const doneCount = day.exercicios.filter((e) => logs.some((l) => l.exerciseId === e.id && l.date === date && !l.warmup && (e.tipo !== "forca" || logs.filter((x) => x.exerciseId === e.id && x.date === date && !x.warmup).length >= e.series))).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dia da semana">
        {program.dias.map((d) => { const on = d.dia === sel, isToday = d.dia === dow; return (
          <button key={d.id} role="tab" aria-selected={on} onClick={() => setSel(d.dia)} data-testid={`dia-${d.dia}`} className={`relative rounded-2xl border px-3.5 py-2 text-left text-xs transition ${on ? "border-cyan/60 bg-cyan/15 text-cyan shadow-[0_0_24px_-8px_var(--cyan)]" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
            <span className="block font-semibold">{dayName(d.dia).slice(0, 3)}{isToday ? " · hoje" : ""}</span><span className="block opacity-80">{d.titulo}</span>
          </button>); })}
      </div>

      <section className="glass relative overflow-hidden rounded-3xl p-5" style={{ animation: "fin-rise .5s both" }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="mono-caps">{dayName(day.dia)} · semana {week}{fase ? ` · ${fase.objetivo}` : ""}</p><h2 className="mt-1 font-serif text-4xl leading-none">{day.titulo}</h2>{day.foco && <p className="mt-1 text-sm text-muted-foreground">{day.foco}</p>}</div>
          {day.tipo === "forca" && <p className="text-sm tabular-nums text-muted-foreground"><b className="text-foreground">{doneCount}</b> de {day.exercicios.length} exercícios</p>}
        </div>
        {fase && <p className="mt-3 rounded-xl border border-violet/30 bg-violet/10 px-3 py-2 text-xs"><b className="text-violet">Semana {week}: {fase.objetivo}.</b> {fase.orientacao}.{week <= 2 ? " Cargas conservadoras e RIR 3–4." : ""}</p>}
        {day.meta && <p className="mt-2 text-xs text-muted-foreground">Meta do dia: {day.meta}</p>}
        {day.nota && <p className="mt-2 text-xs text-muted-foreground">{day.nota}</p>}
      </section>

      {day.aquecimento.length > 0 && <section className="glass rounded-3xl p-5" data-testid="aquecimento">
        <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.14em]"><Flame size={14} className="text-amber" /> Aquecimento <span className="text-[0.65rem] font-normal normal-case tracking-normal text-muted-foreground">(não conta como série efetiva)</span></h3>
        <ul className="space-y-1.5">{day.aquecimento.map((a, i) => <li key={a}><button type="button" onClick={() => toggleWarm(i)} aria-pressed={warm.includes(i)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition hover:bg-white/[0.04]"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${warm.includes(i) ? "border-emerald bg-emerald/25 text-emerald" : "border-white/20"}`}>{warm.includes(i) && <Check size={11} />}</span><span className={warm.includes(i) ? "text-muted-foreground line-through" : ""}>{a}</span></button></li>)}</ul>
        <p className="mt-2 text-[0.7rem] text-muted-foreground">Na primeira série de cada exercício, use uma carga menor se ainda não conhece a máquina.</p>
      </section>}

      {rest.s > 0 && <div className="sticky top-3 z-20"><RestTimer seconds={rest.s} runId={rest.id} /></div>}

      {day.tipo === "descanso" ? <p className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">Dia de recuperação. {day.titulo.includes("caminhada") ? "Uma caminhada leve é bem-vinda, se estiver disposta." : "Descanse."}</p>
        : <div className="space-y-4">{day.exercicios.map((ex, i) => <ExerciseCard key={ex.id} ex={ex} logs={logs} date={date} week={week} actions={actions} index={i} onRest={(s) => setRest((r) => ({ id: r.id + 1, s }))} />)}</div>}
      {day.cardio && <p className="glass rounded-3xl p-4 text-sm"><b>Cardio do dia:</b> {day.cardio}. <span className="text-muted-foreground">Em intensidade em que dá para conversar. Se sentir fraqueza, tontura ou mal-estar, interrompa.</span></p>}
    </div>
  );
}
