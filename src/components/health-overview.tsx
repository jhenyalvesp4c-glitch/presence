import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sun, Dumbbell, Utensils, ScanLine, ArrowUpRight, Moon, Check, Pencil, Flame, Ruler } from "lucide-react";
import { HealthTabs } from "@/components/health-tabs";
import { HealthSheetTabs, type SheetTab } from "@/components/health-sheet-tabs";
import { useHealthPreview } from "@/components/health-preview-provider";
import { HealthLoading } from "@/components/health-loading";
import { Button } from "@/components/ui/button";
import { measurementLabels, workoutsForDate } from "@/lib/health-preview";
import bodyAsset from "@/assets/hoje-corpo.jpg";
import workoutImageAsset from "@/assets/treino.jpg";

const body = bodyAsset;
const workoutImage = workoutImageAsset;

function Action({ to, children }: { to: "/treino/nova" | "/treino/exercicios" | "/dieta/nova" | "/medidas/nova" | "/progresso"; children: string }) {
  return <Button asChild variant="ghost" size="sm" className="shrink-0 rounded-full text-muted-foreground"><Link to={to}>{children}<ArrowUpRight /></Link></Button>;
}
export function HealthOverview({ tab }: { tab: SheetTab }) {
  const { workout, diet, measurements, ready, doneKeys: done, toggleDone: toggle } = useHealthPreview();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const todayWorkouts = now ? workoutsForDate(workout, now) : [];
  const sessions = tab === "treino" ? workout?.sessoes ?? [] : todayWorkouts;
  const title = { hoje: "Hoje", treino: "Seus treinos", dieta: "Sua alimentação", progresso: "Seu progresso" }[tab];
  const showWorkout = tab === "hoje" || tab === "treino";
  const showDiet = tab === "hoje" || tab === "dieta";
  const showBody = tab === "hoje" || tab === "progresso";
  if (!ready) return <HealthLoading />;
  return <div className="health-area relative min-h-screen overflow-hidden bg-background font-body text-foreground">
    <div className="aurora pointer-events-none absolute inset-0" /><div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
    <main className="relative z-10 mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-12">
      <HealthTabs active="saude" />
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow"><Sun className="h-7 w-7 text-primary-foreground" /></div><div><p className="mb-1 font-mono text-[10px] uppercase text-primary">Saúde · Sua rotina</p><h1 className="font-display-h text-4xl font-semibold sm:text-5xl">{title}<span className="text-primary">.</span></h1></div></div>
        <p className="font-mono text-xs capitalize text-muted-foreground">{now?.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) ?? "Sua rotina de bem-estar"}</p>
      </header>
      <section aria-label="Resumo do dia" className="mb-8 grid grid-cols-3 border-y border-border py-6">
        {[{ label: "Treino de hoje", value: workout ? todayWorkouts.map(s => s.nome).join(" + ") || "Descanso" : "—", unit: "", icon: Dumbbell }, { label: "Meta diária", value: diet?.macros.calories || "—", unit: "kcal", icon: Flame }, { label: "Peso atual", value: measurements?.peso || "—", unit: "kg", icon: Ruler }].map(stat => <div key={stat.label} className="min-w-0 px-2 first:pl-0 sm:px-6"><p className="mb-3 flex items-center gap-2 text-[10px] text-muted-foreground sm:text-xs"><stat.icon className="hidden h-3.5 w-3.5 text-primary sm:block" />{stat.label}</p><p className="break-words font-display-h text-lg font-medium sm:text-3xl">{stat.value}<span className="ml-1 text-xs text-muted-foreground">{stat.unit}</span></p></div>)}
      </section>
      <HealthSheetTabs active={tab} />
      <div className={`grid items-start gap-6 ${tab === "hoje" ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,.9fr)]" : "lg:grid-cols-2"}`}>
        {showWorkout && <section className="min-w-0" aria-label="Treino de hoje">
          <div className="mb-5 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-display-h text-lg"><Dumbbell className="h-4 w-4 text-primary" />{tab === "hoje" ? "Treino de hoje" : "Ficha de treino"}</h2><Action to={workout ? "/treino/exercicios" : "/treino/nova"}>{workout ? "Editar" : "Criar ficha"}</Action></div>
          <div className="group relative mb-5 overflow-hidden rounded-lg border border-border"><img src={workoutImage} alt="Halteres em uma plataforma futurista" width={1024} height={768} className="aspect-[16/10] w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" /><div className="absolute bottom-5 left-5 right-5"><p className="mb-1 font-mono text-[10px] uppercase text-primary">Performance</p><p className="break-words font-display-h text-2xl">{workout?.nome || "Seu próximo treino"}</p></div></div>
          {sessions.length ? sessions.map(session => <div key={session.id} className="mb-6"><div className="mb-4 flex items-center justify-between"><h3 className="break-words font-display-h text-xl">{session.nome}</h3><span className="text-xs text-muted-foreground">{session.exercicios.length} exercícios</span></div><p className="mb-3 text-xs text-primary">{session.dias.join(" · ") || "Sem dias definidos"}</p><ul className="divide-y divide-border">{session.exercicios.map((exercise, index) => <li key={exercise.nome} className="flex items-center gap-3 py-4"><span className="font-mono text-xs text-primary/60">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className={`break-words text-sm ${done.includes(`ex-${session.id}-${index}`) ? "text-muted-foreground line-through" : ""}`}>{exercise.nome}</p><p className="mt-1 text-xs text-muted-foreground">{exercise.grupo}</p></div><Button variant="outline" size="icon" className="shrink-0 rounded-full bg-card/40" aria-label={`Concluir ${exercise.nome}`} aria-pressed={done.includes(`ex-${session.id}-${index}`)} onClick={() => toggle(`ex-${session.id}-${index}`)}><Check className={done.includes(`ex-${session.id}-${index}`) ? "text-primary" : "text-muted-foreground/30"} /></Button></li>)}</ul></div>) : <div className="border-y border-border py-6"><Moon className="mb-3 h-6 w-6 text-primary" /><h3 className="font-display-h text-xl">{workout ? "Dia de descanso" : "Nenhum treino definido"}</h3><p className="mt-2 text-sm text-muted-foreground">{workout ? "Não há sessão marcada para hoje." : "Sua ficha de treino aparecerá aqui."}</p></div>}
        </section>}
        {showDiet && <section className="min-w-0" aria-label="Plano alimentar de hoje"><div className="mb-5 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-display-h text-lg"><Utensils className="h-4 w-4 text-primary" />Plano alimentar{tab === "hoje" ? " de hoje" : ""}</h2><Action to="/dieta/nova">{diet ? "Editar" : "Criar ficha"}</Action></div>
          <div className="border-y border-border py-5"><p className="break-words font-display-h text-xl">{diet?.name || "Sua alimentação"}</p><p className="mt-3 font-display-h text-4xl text-primary">{diet?.macros.calories || "—"}<span className="ml-2 text-xs text-muted-foreground">kcal / dia</span></p><p className="mt-3 text-xs text-muted-foreground">{diet?.goal || "Nenhum plano definido"}</p><div className="mt-5 grid grid-cols-3 gap-2">{[{ key: "protein", label: "Proteína" }, { key: "carbs", label: "Carboidrato" }, { key: "fat", label: "Gordura" }].map(macro => <div key={macro.key}><p className="font-display-h text-lg">{diet?.macros[macro.key as "protein" | "carbs" | "fat"] || "—"}<span className="ml-1 text-xs text-muted-foreground">g</span></p><p className="mt-1 text-[10px] text-muted-foreground">{macro.label}</p></div>)}</div></div>
          <div className="mt-2">{diet?.meals.length ? [...diet.meals].sort((a,b) => a.time.localeCompare(b.time)).map(meal => <article key={meal.id} className="flex gap-3 border-b border-border py-5"><span className="pt-1 font-mono text-[10px] text-primary">{meal.time}</span><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{meal.name}</h3><p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">{meal.foods.join(" · ") || "Nenhum alimento adicionado"}</p></div><Button variant="outline" size="icon" className="shrink-0 rounded-full bg-card/40" aria-label={`Concluir ${meal.name}`} aria-pressed={done.includes(`meal-${meal.id}`)} onClick={() => toggle(`meal-${meal.id}`)}><Check className={done.includes(`meal-${meal.id}`) ? "text-primary" : "text-muted-foreground/30"} /></Button></article>) : <p className="py-6 text-sm text-muted-foreground">Nenhuma refeição definida.</p>}</div>
          {diet?.notes && <p className="mt-5 break-words text-xs leading-relaxed text-muted-foreground">{diet.notes}</p>}
        </section>}
        {showBody && <section className="min-w-0" aria-label="Corpo e medidas atuais"><div className="mb-5 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-display-h text-lg"><ScanLine className="h-4 w-4 text-primary" />Corpo & medidas</h2><Action to={tab === "hoje" ? "/progresso" : "/medidas/nova"}>{tab === "hoje" ? "Ver evolução" : "Registrar"}</Action></div>
          <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-card/40"><img src={body} alt="Desenho feminino holográfico de corpo inteiro" width={768} height={1024} loading="lazy" className="aspect-[3/4] w-full object-contain" /><div className="absolute left-4 right-4 top-4 flex items-start justify-between"><div><p className="font-mono text-[9px] uppercase text-primary">Peso atual</p><p className="mt-1 font-display-h text-3xl">{measurements?.peso || "—"}<span className="ml-1 text-xs text-muted-foreground">kg</span></p></div><ScanLine className="h-5 w-5 text-primary" /></div><div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] text-muted-foreground"><span>{measurements?.altura ? `${measurements.altura} m` : "Altura não informada"}</span><span>{measurements?.data ? measurements.data.split("-").reverse().join("/") : "Sem medição"}</span></div></div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4">{Object.entries(measurementLabels).map(([key,label]) => <div key={key} className="flex justify-between gap-2 border-b border-border py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xs font-medium">{measurements?.valores[key] || "—"}<span className="ml-1 text-muted-foreground">cm</span></dd></div>)}</dl>
          {tab === "progresso" && measurements && <><p className="mt-5 break-words text-sm text-muted-foreground">{measurements.obs}</p><div className="mt-5 grid grid-cols-2 gap-3">{Object.entries(measurements.fotos).map(([label,src]) => <figure key={label}><img src={src} alt={label} className="aspect-[3/4] w-full rounded-lg object-cover" /><figcaption className="mt-2 text-xs text-muted-foreground">{label}</figcaption></figure>)}</div></>}
        </section>}
      </div>
      <footer className="mt-10 flex items-center justify-between border-t border-border pt-5"><span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />Sua rotina, em equilíbrio.</span><Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link to="/saude"><Pencil />Fichas</Link></Button></footer>
    </main>
  </div>;
}