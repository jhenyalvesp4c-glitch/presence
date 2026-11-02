import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Sun, Dumbbell, Utensils, ScanLine, ArrowUpRight, Moon, Check, Flame, Ruler, Activity, Sparkles, Clock } from "lucide-react";
import { HealthTabs } from "@/components/health-tabs";
import { HealthSheetTabs } from "@/components/health-sheet-tabs";
import { useHealthPreview } from "@/components/health-preview-provider";
import { HealthLoading } from "@/components/health-loading";
import { Button } from "@/components/ui/button";
import { measurementLabels, workoutsForDate } from "@/lib/health-preview";
import bodyAsset from "@/assets/hoje-corpo.jpg";
import workoutImageAsset from "@/assets/treino.jpg";

function Ring({ value, size = 120, stroke = 9, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
    <svg width={size} height={size} className="-rotate-90">
      <defs><linearGradient id={`ring-${size}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--primary)" /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0.45} /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#ring-${size})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)", filter: "drop-shadow(0 0 6px var(--primary))" }} />
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
  </div>;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass-h group relative min-w-0 overflow-hidden rounded-3xl p-5 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-glow sm:p-6 ${className}`}>
    <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl transition-opacity duration-700 group-hover:opacity-100 opacity-60" />
    <div className="relative">{children}</div>
  </section>;
}

function PanelHead({ icon: Icon, title, to, label }: { icon: typeof Sun; title: string; to: "/treino/nova" | "/treino/exercicios" | "/dieta/nova" | "/progresso" | "/medidas/nova"; label: string }) {
  return <div className="mb-5 flex items-center justify-between gap-2">
    <h2 className="flex items-center gap-3 font-display-h text-lg"><span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/30 bg-primary/10"><Icon className="h-4 w-4 text-primary" /></span>{title}</h2>
    <Button asChild variant="ghost" size="sm" className="shrink-0 rounded-full text-muted-foreground"><Link to={to}>{label}<ArrowUpRight /></Link></Button>
  </div>;
}

export function HealthToday() {
  const { workout, diet, measurements, ready, doneKeys: done, toggleDone: toggle } = useHealthPreview();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const sessions = now ? workoutsForDate(workout, now) : [];
  const exKeys = sessions.flatMap(s => s.exercicios.map((_, i) => `ex-${s.id}-${i}`));
  const meals = diet ? [...diet.meals].sort((a, b) => a.time.localeCompare(b.time)) : [];
  const mealKeys = meals.map(m => `meal-${m.id}`);
  const exDone = exKeys.filter(k => done.includes(k)).length;
  const mealDone = mealKeys.filter(k => done.includes(k)).length;
  const total = exKeys.length + mealKeys.length;
  const dayProgress = total ? (exDone + mealDone) / total : 0;
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const nowHM = now ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "";
  const nextMeal = meals.find(m => m.time >= nowHM && !done.includes(`meal-${m.id}`));

  const peso = parseFloat((measurements?.peso || "").replace(",", "."));
  const altura = parseFloat((measurements?.altura || "").replace(",", "."));
  const imc = peso && altura ? peso / (altura > 3 ? (altura / 100) ** 2 : altura ** 2) : 0;
  const macros = [
    { key: "protein", label: "Proteína", kcal: 4 }, { key: "carbs", label: "Carboidrato", kcal: 4 }, { key: "fat", label: "Gordura", kcal: 9 },
  ] as const;
  const macroKcal = macros.map(m => (parseFloat(diet?.macros[m.key] || "0") || 0) * m.kcal);
  const macroTotal = macroKcal.reduce((a, b) => a + b, 0);

  if (!ready) return <HealthLoading />;
  return <div className="health-area relative min-h-screen overflow-hidden bg-background font-body text-foreground">
    <div className="aurora pointer-events-none absolute inset-0" /><div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
    <main className="relative z-10 mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-12">
      <HealthTabs active="saude" />

      {/* Hero */}
      <section className="glass-h relative mb-8 overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl motion-safe:animate-pulse" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow"><Sun className="h-7 w-7 text-primary-foreground motion-safe:animate-[spin_20s_linear_infinite]" /><span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 [animation-duration:3s]" /></div>
            <div>
              <p className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />{now?.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) ?? "Sua rotina"}</p>
              <h1 className="font-display-h text-4xl font-semibold sm:text-5xl">{greeting}<span className="text-primary">.</span></h1>
              <p className="mt-1 text-sm text-muted-foreground">{total ? `${exDone + mealDone} de ${total} metas concluídas hoje` : "Crie suas fichas para acompanhar o dia."}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Ring value={dayProgress} size={132} stroke={10}><div><p className="font-display-h text-3xl">{Math.round(dayProgress * 100)}<span className="text-sm text-muted-foreground">%</span></p><p className="font-mono text-[9px] uppercase text-muted-foreground">do dia</p></div></Ring>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[{ icon: Dumbbell, label: "Treino", value: `${exDone}/${exKeys.length}` }, { icon: Utensils, label: "Refeições", value: `${mealDone}/${mealKeys.length}` }, { icon: Clock, label: "Próxima", value: nextMeal?.time ?? "—" }].map(s => <div key={s.label} className="rounded-2xl border border-border bg-card/40 px-3 py-3 text-center sm:px-4"><s.icon className="mx-auto mb-2 h-4 w-4 text-primary" /><p className="font-display-h text-lg">{s.value}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <HealthSheetTabs active="hoje" />

      {/* Stats */}
      <section aria-label="Resumo do dia" className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Dumbbell, label: "Treino de hoje", value: workout ? sessions.map(s => s.nome).join(" + ") || "Descanso" : "—", unit: "", bar: exKeys.length ? exDone / exKeys.length : 0 },
          { icon: Flame, label: "Meta diária", value: diet?.macros.calories || "—", unit: "kcal", bar: mealKeys.length ? mealDone / mealKeys.length : 0 },
          { icon: Ruler, label: "Peso atual", value: measurements?.peso || "—", unit: "kg", bar: imc ? Math.min(1, imc / 40) : 0, extra: imc ? `IMC ${imc.toFixed(1)}` : "" },
        ].map(s => <Panel key={s.label} className="p-5">
          <p className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-2"><s.icon className="h-3.5 w-3.5 text-primary" />{s.label}</span>{s.extra && <span className="font-mono text-[10px] text-primary">{s.extra}</span>}</p>
          <p className="truncate font-display-h text-3xl font-medium">{s.value}<span className="ml-1 text-xs text-muted-foreground">{s.unit}</span></p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-gradient-primary shadow-glow transition-all duration-1000" style={{ width: `${s.bar * 100}%` }} /></div>
        </Panel>)}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,.85fr)]">
        {/* Workout */}
        <Panel>
          <PanelHead icon={Dumbbell} title="Treino de hoje" to={workout ? "/treino/exercicios" : "/treino/nova"} label={workout ? "Editar" : "Criar ficha"} />
          <div className="relative mb-5 overflow-hidden rounded-2xl border border-border"><img src={workoutImageAsset} alt="Halteres em uma plataforma futurista" width={1024} height={768} className="aspect-[16/9] w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" /><div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3"><div className="min-w-0"><p className="mb-1 font-mono text-[10px] uppercase text-primary">Performance</p><p className="truncate font-display-h text-2xl">{workout?.nome || "Seu próximo treino"}</p></div>{exKeys.length > 0 && <Ring value={exDone / exKeys.length} size={56} stroke={5}><span className="text-[10px] font-medium">{exDone}/{exKeys.length}</span></Ring>}</div></div>
          {sessions.length ? sessions.map(session => <div key={session.id} className="mb-4">
            <div className="mb-2 flex items-center justify-between"><h3 className="font-display-h text-lg">{session.nome}</h3><span className="text-xs text-muted-foreground">{session.exercicios.length} exercícios</span></div>
            <ul className="space-y-2">{session.exercicios.map((exercise, index) => { const k = `ex-${session.id}-${index}`, on = done.includes(k); return <li key={exercise.nome + index} className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-300 ${on ? "border-primary/40 bg-primary/10" : "border-border bg-card/30 hover:border-primary/30"}`}><span className="font-mono text-xs text-primary/70">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className={`break-words text-sm ${on ? "text-muted-foreground line-through" : ""}`}>{exercise.nome}</p><p className="text-xs text-muted-foreground">{exercise.grupo}</p></div><Button variant="outline" size="icon" className={`shrink-0 rounded-full ${on ? "border-primary bg-primary/20 shadow-glow" : "bg-card/40"}`} aria-label={`Concluir ${exercise.nome}`} aria-pressed={on} onClick={() => toggle(k)}><Check className={on ? "text-primary" : "text-muted-foreground/30"} /></Button></li>; })}</ul>
          </div>) : <div className="rounded-2xl border border-dashed border-border p-6 text-center"><Moon className="mx-auto mb-3 h-6 w-6 text-primary" /><h3 className="font-display-h text-xl">{workout ? "Dia de descanso" : "Nenhum treino definido"}</h3><p className="mt-2 text-sm text-muted-foreground">{workout ? "Não há sessão marcada para hoje." : "Sua ficha de treino aparecerá aqui."}</p></div>}
        </Panel>

        {/* Diet */}
        <Panel>
          <PanelHead icon={Utensils} title="Alimentação de hoje" to="/dieta/nova" label={diet ? "Editar" : "Criar ficha"} />
          <div className="mb-5 flex items-center gap-5 rounded-2xl border border-border bg-card/30 p-4">
            <Ring value={mealKeys.length ? mealDone / mealKeys.length : 0} size={104} stroke={8}><div><Flame className="mx-auto h-4 w-4 text-primary" /><p className="font-display-h text-xl">{diet?.macros.calories || "—"}</p><p className="text-[9px] text-muted-foreground">kcal</p></div></Ring>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="truncate font-display-h text-lg">{diet?.name || "Sua alimentação"}</p>
              {macros.map((m, i) => <div key={m.key}><div className="mb-1 flex justify-between text-[11px]"><span className="text-muted-foreground">{m.label}</span><span>{diet?.macros[m.key] || "—"}g</span></div><div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-gradient-primary transition-all duration-1000" style={{ width: `${macroTotal ? (macroKcal[i]! / macroTotal) * 100 : 0}%` }} /></div></div>)}
            </div>
          </div>
          {meals.length ? <ol className="relative ml-2 border-l border-primary/20">{meals.map(meal => { const k = `meal-${meal.id}`, on = done.includes(k), next = nextMeal?.id === meal.id; return <li key={meal.id} className="relative mb-3 pl-5">
            <span className={`absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full ${on ? "bg-primary shadow-glow" : next ? "bg-primary motion-safe:animate-pulse" : "bg-border"}`} />
            <article className={`flex gap-3 rounded-xl border p-3 transition-all ${on ? "border-primary/40 bg-primary/10" : next ? "border-primary/40 bg-card/40" : "border-border bg-card/20"}`}><div className="min-w-0 flex-1"><p className="font-mono text-[10px] text-primary">{meal.time}{next && " · próxima"}</p><h3 className={`break-words text-sm font-semibold ${on ? "line-through text-muted-foreground" : ""}`}>{meal.name}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{meal.foods.join(" · ") || "Nenhum alimento adicionado"}</p></div><Button variant="outline" size="icon" className={`shrink-0 rounded-full ${on ? "border-primary bg-primary/20 shadow-glow" : "bg-card/40"}`} aria-label={`Concluir ${meal.name}`} aria-pressed={on} onClick={() => toggle(k)}><Check className={on ? "text-primary" : "text-muted-foreground/30"} /></Button></article>
          </li>; })}</ol> : <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma refeição definida.</p>}
          {diet?.notes && <p className="mt-4 break-words text-xs text-muted-foreground">{diet.notes}</p>}
        </Panel>

        {/* Body */}
        <Panel>
          <PanelHead icon={ScanLine} title="Corpo & medidas" to="/medidas/nova" label="Registrar" />
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/40">
            <img src={bodyAsset} alt="Desenho feminino holográfico de corpo inteiro" width={768} height={1024} loading="lazy" className="aspect-[3/4] w-full object-contain" />
            <div className="pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/25 to-transparent motion-safe:animate-[health-scan_4s_ease-in-out_infinite]" />
            <div className="absolute left-4 right-4 top-4 flex items-start justify-between"><div><p className="font-mono text-[9px] uppercase text-primary">Peso atual</p><p className="font-display-h text-3xl">{measurements?.peso || "—"}<span className="ml-1 text-xs text-muted-foreground">kg</span></p></div><Activity className="h-5 w-5 text-primary motion-safe:animate-pulse" /></div>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] text-muted-foreground"><span>{measurements?.altura ? `${measurements.altura} m` : "Altura não informada"}</span><span>{measurements?.data ? measurements.data.split("-").reverse().join("/") : "Sem medição"}</span></div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2">{Object.entries(measurementLabels).map(([key, label]) => <div key={key} className="flex justify-between gap-2 rounded-lg border border-border bg-card/30 px-3 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xs font-medium">{measurements?.valores[key] || "—"}<span className="ml-1 text-muted-foreground">cm</span></dd></div>)}</dl>
        </Panel>
      </div>

      <footer className="mt-10 flex items-center justify-between border-t border-border pt-5"><span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Sparkles className="h-3 w-3 text-primary" />Sua rotina, em equilíbrio.</span><Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link to="/saude">Fichas<ArrowUpRight /></Link></Button></footer>
    </main>
  </div>;
}
