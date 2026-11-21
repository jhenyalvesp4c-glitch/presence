/** Treino do dia: aquecimento, cada exercício com a meta, a sugestão de progressão e o registro série a série com cronômetro de descanso. */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, Flame, Loader2, Pause, Play, Timer, Trash2, TrendingUp, X } from "lucide-react";

import { createPortal } from "react-dom";

import { Ring } from "@/components/finance/charts";
import { backdropProps } from "@/lib/backdrop";
import { mediaFor } from "@/lib/exercise-media";

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
    <div className="ex-card flex items-center gap-3 px-4 py-2.5" style={{ "--rail": "var(--cyan)" } as React.CSSProperties} role="timer" aria-label={`Descanso: ${left} segundos`} data-testid="descanso">
      <Timer size={14} className="text-cyan" />
      <span className="font-mono text-xl font-semibold tabular-nums text-cyan drop-shadow-[0_0_10px_var(--cyan)]">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
      <span className="h-px flex-1 overflow-hidden bg-white/10"><span className="block h-full bg-gradient-to-r from-cyan to-violet shadow-[0_0_10px_var(--cyan)] transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} /></span>
      <span className="mono-caps !text-[0.6rem]">descanso</span>
      <button type="button" onClick={() => setPaused((v) => !v)} aria-label={paused ? "Retomar" : "Pausar"} className="text-muted-foreground transition hover:text-foreground">{paused ? <Play size={14} /> : <Pause size={14} />}</button>
      <button type="button" onClick={() => setLeft(0)} className="text-[0.7rem] text-muted-foreground transition hover:text-foreground">Pular</button>
    </div>
  );
}

function SetRow({ ex, n, saved, date, week, preload, onSave, onDelete }: { ex: ProgExercise; n: number; saved: SetLog | undefined; date: string; week: number; preload: number | null; onSave: (l: SetLog) => Promise<void>; onDelete: (id: string) => void }) {
  const [load, setLoad] = useState(saved?.load !== undefined && saved.load !== null ? String(saved.load).replace(".", ",") : preload !== null ? String(preload).replace(".", ",") : "");
  const [reps, setReps] = useState(saved?.reps !== undefined && saved.reps !== null ? String(saved.reps) : ""), [rir, setRir] = useState(saved?.rir !== undefined && saved.rir !== null ? String(saved.rir) : ""), [flags, setFlags] = useState<string[]>(saved?.flags ?? []);
  const [busy, setBusy] = useState(false), [more, setMore] = useState(false);
  const r = Math.round(Number(reps));
  const ok = reps.trim() !== "" && Number.isFinite(r) && r >= 0 && (parseKg(load) !== null || load.trim() === "");
  const save = async () => { if (!ok) return; setBusy(true); try { await onSave({ exerciseId: ex.id, exerciseName: ex.nome, date, week, set: n, load: parseKg(load), reps: r, rir: rir === "" ? null : Number(rir), warmup: false, flags }); } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); } setBusy(false); };
  const input = "w-full border-0 border-b bg-transparent px-1 py-1.5 text-center font-mono text-base tabular-nums outline-none transition placeholder:text-white/20 focus:border-cyan focus:shadow-[0_1px_0_0_var(--cyan)]";
  const line = saved ? "border-emerald/30" : "border-white/12";
  return (
    <li data-testid="serie">
      <div className="grid grid-cols-[1.75rem_1fr_1fr_3.25rem_5.5rem] items-end gap-3">
        <span className={`pb-2 text-center font-mono text-[0.7rem] ${saved ? "text-emerald" : "text-muted-foreground"}`}>{saved ? <Check size={13} className="mx-auto" style={{ animation: "ex-tick .45s both" }} /> : String(n).padStart(2, "0")}</span>
        <label className="sr-only" htmlFor={`c-${ex.id}-${n}`}>Carga da série {n}</label><input id={`c-${ex.id}-${n}`} inputMode="decimal" placeholder="—" value={load} onChange={(e) => setLoad(e.target.value)} className={`${input} ${line}`} data-testid="serie-carga" />
        <label className="sr-only" htmlFor={`r-${ex.id}-${n}`}>Repetições da série {n}</label><input id={`r-${ex.id}-${n}`} inputMode="numeric" placeholder={`${ex.repsMin}–${ex.repsMax}`} value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, "").slice(0, 3))} className={`${input} ${line}`} data-testid="serie-reps" />
        <select aria-label="Repetições em reserva" value={rir} onChange={(e) => setRir(e.target.value)} className={`${input} ${line} appearance-none text-sm`} data-testid="serie-rir"><option value="">RIR</option>{[4, 3, 2, 1, 0].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <span className="flex items-center justify-end gap-1.5 pb-0.5">
          <button type="button" onClick={() => setMore((v) => !v)} aria-label={`Dor, postura ou impulso na série ${n}`} aria-expanded={more} className={`transition ${flags.length ? "text-amber" : "text-white/25 hover:text-muted-foreground"}`}><AlertTriangle size={13} /></button>
          <button type="button" onClick={() => void save()} disabled={!ok || busy} aria-label={`Salvar série ${n}`} data-testid="serie-salvar" className={`grid h-8 w-8 place-items-center rounded-full border transition active:scale-90 disabled:opacity-25 ${saved ? "border-emerald/60 bg-emerald/15 text-emerald" : "border-cyan/40 text-cyan hover:bg-cyan/15 hover:shadow-[0_0_18px_-4px_var(--cyan)]"}`}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>
          {saved?.id && <button type="button" onClick={() => onDelete(saved.id!)} aria-label={`Apagar série ${n}`} className="text-white/25 transition hover:text-destructive"><Trash2 size={13} /></button>}
        </span>
      </div>
      {(more || flags.length > 0) && more && <div className="mt-2 flex flex-wrap gap-1.5 pl-[2.75rem]">{(["dor", "postura", "impulso"] as const).map((f) => <button key={f} type="button" aria-pressed={flags.includes(f)} onClick={() => setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))} className={`rounded-full border px-2.5 py-0.5 text-[0.68rem] transition ${flags.includes(f) ? "border-amber/60 bg-amber/15 text-amber" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{f === "dor" ? "Dor articular" : f === "postura" ? "Perdi a postura" : "Usei impulso"}</button>)}</div>}
    </li>
  );
}

/** Vídeo curto da execução: miniatura que repete sozinha (como um gif) e abre grande ao tocar. */
function ExecVideo({ src, nome }: { src: string; nome: string }) {
  const [big, setBig] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setBig(true)} aria-label={`Ver a execução de ${nome}`} data-testid="ver-execucao" className="group/vid relative block aspect-square w-full overflow-hidden rounded-2xl border border-white/10 transition hover:border-cyan/60 hover:shadow-[0_0_34px_-8px_var(--cyan)]">
        <video src={src} autoPlay loop muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 py-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-cyan"><Play size={10} fill="currentColor" /> ver execução</span>
      </button>
      {big && createPortal(
        <div className="fixed inset-0 z-[70] grid place-items-center bg-background/90 p-4 backdrop-blur-md" {...backdropProps(() => setBig(false))} data-testid="video-execucao">
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">Execução · {nome}</p>
            <video src={src} autoPlay loop muted playsInline controls className="w-full rounded-2xl border border-white/10 shadow-[0_0_60px_-20px_var(--cyan)]" />
            <button type="button" onClick={() => setBig(false)} aria-label="Fechar" className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-background"><X size={15} /></button>
          </div>
        </div>, document.body)}
    </>
  );
}

function ExerciseCard({ ex, logs, date, week, actions, onRest, index }: { ex: ProgExercise; logs: SetLog[]; date: string; week: number; actions: ReturnType<typeof useProgramActions>; onRest: (s: number) => void; index: number }) {
  const [help, setHelp] = useState(false);
  const before = useMemo(() => sessionsOf(logs.filter((l) => l.date < date), ex.id), [logs, date, ex.id]);
  const sug = useMemo(() => suggest(ex, before), [ex, before]), tone = TONE[sug.acao];
  const today = useMemo(() => logs.filter((l) => l.exerciseId === ex.id && l.date === date && !l.warmup), [logs, ex.id, date]);
  const bySet = (n: number) => today.find((l) => l.set === n);
  const save = async (l: SetLog) => { await actions.logSet.mutateAsync(l); if (ex.descansoS > 0 && l.set < ex.series) onRest(ex.descansoS); };
  const media = mediaFor(ex), isForce = ex.tipo === "forca", done = today.length >= (isForce ? ex.series : 1);
  const presc = isForce ? `${ex.series} × ${ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`}${ex.repsNota ? ` ${ex.repsNota}` : ""}` : ex.prescricao;
  const equip = ex.equip === "maquina" ? "máquina" : ex.equip === "halter" ? "halter" : ex.equip === "polia" ? "polia" : ex.equip === "corpo" ? "peso do corpo" : "livre";
  const SugIcon = sug.acao === "aumentar" ? TrendingUp : sug.acao === "interromper" || sug.acao === "reduzir" ? AlertTriangle : Flame;
  return (
    <article className="ex-card px-5 py-4 sm:px-6" style={{ "--rail": done ? "var(--emerald)" : tone.c, animation: "fin-rise .55s both", animationDelay: `${index * 70}ms` } as React.CSSProperties} data-testid="exercicio">
      {done && <span aria-hidden data-ex-fx className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-emerald/15 to-transparent" style={{ animation: "ex-sweep 1.6s ease-out 1 both" }} />}
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-[0.12] blur-3xl" style={{ background: done ? "var(--emerald)" : tone.c }} />
      <header className="relative flex items-start gap-3">
        <span className="pt-1 font-mono text-[0.7rem] tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1"><h3 className="font-display text-base font-semibold leading-snug tracking-tight">{ex.nome}</h3><p className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{ex.grupo}{ex.grupo ? " · " : ""}{equip}</p></div>
        <div className="text-right"><p className="font-mono text-base font-semibold tabular-nums">{presc}</p><p className="font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">{ex.descansoS ? `${ex.descansoS} s` : ""}{ex.rir && isForce ? ` · RIR ${ex.rir}` : ""}</p></div>
      </header>

      <div className={media ? "relative grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]" : "contents"}>
        <div className="min-w-0">
      {isForce && <div className="relative mt-3 border-l pl-3" style={{ borderColor: `color-mix(in oklab, ${tone.c} 55%, transparent)` }} data-testid="sugestao" data-acao={sug.acao}>
        <p className="flex items-center gap-1.5 text-[0.82rem] font-medium" style={{ color: tone.c }}><SugIcon size={13} /><span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] opacity-70">{tone.label}</span><span className="text-foreground/90">{sug.titulo}</span></p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{sug.motivo}</p>
        {sug.ultima && <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground/80">última {dateBR(sug.ultima.date)} · {fmtKg(sug.ultima.load)} · {sug.ultima.reps.join(" / ")} reps</p>}
      </div>}

      {isForce ? <div className="relative mt-4">
        <div className="mb-2 flex gap-1" aria-hidden>{Array.from({ length: ex.series }, (_, i) => <span key={i} className="h-[3px] flex-1 rounded-full transition-all duration-500" style={{ background: bySet(i + 1) ? "var(--emerald)" : "rgba(255,255,255,.1)", boxShadow: bySet(i + 1) ? "0 0 10px var(--emerald)" : undefined }} />)}</div>
        <div className="mb-1 grid grid-cols-[1.75rem_1fr_1fr_3.25rem_5.5rem] gap-3 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground/70" aria-hidden><span /><span className="text-center">kg</span><span className="text-center">reps</span><span className="text-center">rir</span><span /></div>
        <ul className="space-y-2.5">{Array.from({ length: ex.series }, (_, i) => i + 1).map((n) => <SetRow key={`${n}-${bySet(n)?.id ?? "novo"}`} ex={ex} n={n} saved={bySet(n)} date={date} week={week} preload={sug.cargaAlvo} onSave={save} onDelete={(id) => actions.deleteSet.mutate(id)} />)}</ul></div>
        : <button type="button" onClick={() => void actions.logSet.mutateAsync({ exerciseId: ex.id, exerciseName: ex.nome, date, week, set: 1, load: null, reps: 1, rir: null, warmup: false, flags: [] }).catch((e) => toast.error((e as Error).message))} disabled={done} className={`relative mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition active:scale-95 ${done ? "border-emerald/40 bg-emerald/10 text-emerald" : "border-white/15 hover:border-cyan/50 hover:text-cyan"}`} data-testid="marcar-feito"><Check size={14} /> {done ? "Feito" : "Marcar como feito"}</button>}

      {ex.instrucoes && <><button type="button" onClick={() => setHelp((v) => !v)} className="relative mt-3 flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground transition hover:text-foreground"><ChevronDown size={11} className={help ? "rotate-180" : ""} /> como executar</button>{help && <p className="relative mt-1.5 text-xs leading-relaxed text-foreground/75" style={{ animation: "fin-rise .3s both" }}>{ex.instrucoes}</p>}</>}
        </div>
        {media && <aside className="order-first mx-auto w-full max-w-[16rem] md:order-last md:mt-3 md:max-w-none"><ExecVideo src={media.src} nome={ex.nome} /></aside>}
      </div>
    </article>
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

      <section className="ex-card px-5 py-4 sm:px-6" style={{ "--rail": "var(--violet)", animation: "fin-rise .5s both" } as React.CSSProperties}>
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-violet opacity-[0.12] blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0"><p className="mono-caps !text-[0.62rem]">{dayName(day.dia)} · semana {week}{fase ? ` · ${fase.objetivo}` : ""}</p><h2 className="mt-1 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{day.titulo}</h2>{day.foco && <p className="mt-0.5 text-xs text-muted-foreground">{day.foco}</p>}</div>
          {day.tipo === "forca" && day.exercicios.length > 0 && <Ring pct={(doneCount / day.exercicios.length) * 100} color="var(--emerald)" size={56} thickness={4}><span className="font-mono text-[0.68rem] font-semibold tabular-nums">{doneCount}/{day.exercicios.length}</span></Ring>}
        </div>
        {(fase || day.meta || day.nota) && <details className="group relative mt-3"><summary className="flex cursor-pointer list-none items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"><ChevronDown size={11} className="transition group-open:rotate-180" /> orientações do dia</summary>
          <div className="mt-2 space-y-1.5 border-l border-violet/40 pl-3 text-xs leading-relaxed text-muted-foreground">{fase && <p><b className="text-violet">Semana {week}: {fase.objetivo}.</b> {fase.orientacao}.{week <= 2 ? " Cargas conservadoras e RIR 3–4." : ""}</p>}{day.meta && <p>Meta do dia: {day.meta}</p>}{day.nota && <p>{day.nota}</p>}</div></details>}
      </section>

      {day.aquecimento.length > 0 && <section className="relative px-1" data-testid="aquecimento">
        <div className="mb-2 flex items-center gap-2"><Flame size={12} className="text-amber" /><span className="mono-caps !text-[0.62rem]">Aquecimento</span><span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" /><span className="font-mono text-[0.62rem] text-muted-foreground">{warm.length}/{day.aquecimento.length}</span></div>
        <ul className="flex flex-wrap gap-2">{day.aquecimento.map((a, i) => <li key={a}><button type="button" onClick={() => toggleWarm(i)} aria-pressed={warm.includes(i)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition active:scale-95 ${warm.includes(i) ? "border-emerald/40 bg-emerald/10 text-muted-foreground line-through" : "border-white/10 hover:border-amber/40"}`}><span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${warm.includes(i) ? "border-emerald bg-emerald/30 text-emerald" : "border-white/25"}`}>{warm.includes(i) && <Check size={9} />}</span>{a}</button></li>)}</ul>
        <p className="mt-1.5 text-[0.65rem] text-muted-foreground/80">Não conta como série efetiva. Na primeira série de cada exercício, use uma carga menor se ainda não conhece a máquina.</p>
      </section>}

      {rest.s > 0 && <div className="sticky top-3 z-20"><RestTimer seconds={rest.s} runId={rest.id} /></div>}

      {day.tipo === "descanso" ? <p className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">Dia de recuperação. {day.titulo.includes("caminhada") ? "Uma caminhada leve é bem-vinda, se estiver disposta." : "Descanse."}</p>
        : <div className="space-y-3">{day.exercicios.map((ex, i) => <ExerciseCard key={ex.id} ex={ex} logs={logs} date={date} week={week} actions={actions} index={i} onRest={(s) => setRest((r) => ({ id: r.id + 1, s }))} />)}</div>}
      {day.cardio && <p className="ex-card px-5 py-4 text-sm" style={{ "--rail": "var(--amber)" } as React.CSSProperties}><b>Cardio do dia:</b> {day.cardio}. <span className="text-muted-foreground">Em intensidade em que dá para conversar. Se sentir fraqueza, tontura ou mal-estar, interrompa.</span></p>}
    </div>
  );
}
