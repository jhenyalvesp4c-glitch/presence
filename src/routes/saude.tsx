import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight, Heart, Home, ClipboardList, ListChecks, CalendarDays,
  BarChart3, Dumbbell, Utensils, UserRound,
} from "lucide-react";
import treinoAsset from "@/assets/treino.jpg";
import dietaAsset from "@/assets/dieta.jpg";
import medidasAsset from "@/assets/medidas.jpg";
import { HealthTabs } from "@/components/health-tabs";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NovaFichaTreino } from "@/components/health-workout-builder";
import { DietBuilder } from "@/components/health-diet-builder";
import { NovaFichaMedidas } from "@/components/health-measurement-builder";

const treino = treinoAsset;
const dieta = dietaAsset;
const medidas = medidasAsset;

type Ficha = "treino" | "dieta" | "medidas";
const fichaTitle: Record<Ficha, string> = { treino: "Ficha de treino", dieta: "Ficha de dieta", medidas: "Ficha de peso e medidas" };

export const Route = createFileRoute("/saude")({
  head: () => ({
    meta: [
      { title: "Presence Saúde — Fichas de treino, dieta e medidas" },
      { name: "description", content: "Monte fichas de treino, dieta e peso e medidas em um painel futurista." },
      { property: "og:title", content: "Presence Saúde — Fichas de treino, dieta e medidas" },
      { property: "og:description", content: "Organize sua rotina e acompanhe sua evolução." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const cards = [
  { tone: "violet", img: treino, icon: Dumbbell, tag: "01 · Performance", title: "Ficha de Treino",
    desc: "Monte sua rotina de treinos, acompanhe seu desempenho e evolua ainda mais.", cta: "Criar ficha de treino" },
  { tone: "emerald", img: dieta, icon: Utensils, tag: "02 · Nutrição", title: "Ficha de Dieta",
    desc: "Planeje sua alimentação, controle suas calorias e mantenha o foco.", cta: "Criar ficha de dieta" },
  { tone: "cyan", img: medidas, icon: UserRound, tag: "03 · Evolução", title: "Ficha de Peso e Medidas",
    desc: "Registre seu peso, medidas corporais e acompanhe sua evolução com fotos.", cta: "Criar ficha de peso e medidas" },
] as const;

const nav = [
  { Icon: Home, label: "Início", to: "/assistente" },
  { Icon: ClipboardList, label: "Projetos", to: "/projetos" },
  { Icon: ListChecks, label: "Tarefas", to: "/tarefas" },
  { Icon: CalendarDays, label: "Planejamento", to: "/planejamento" },
  { Icon: BarChart3, label: "Progresso", to: "/progresso" },
  { Icon: Heart, label: "Saúde", to: "/saude" },
] as const;

function Index() {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  return (
    <div className="health-area relative min-h-screen overflow-hidden bg-background font-body text-foreground">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />

      <aside className="glass-h fixed inset-y-3 left-0 z-20 hidden w-[60px] flex-col items-center justify-between rounded-3xl py-6 md:flex">
        <div className="flex flex-col items-center gap-3">
          {nav.map(({ Icon, label, to }) => (
            <Button asChild variant="ghost" size="icon" key={label} title={label} className={`h-11 w-11 rounded-2xl ${to === "/saude" ? "bg-primary/15 text-primary shadow-glow" : "text-muted-foreground"}`}>
              <Link to={to} aria-label={label} aria-current={to === "/saude" ? "page" : undefined}><Icon className="h-5 w-5" /></Link>
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="icon" title="Minha conta (em breve)" aria-label="Minha conta (em breve)" className="h-11 w-11 text-muted-foreground"><UserRound /></Button>
      </aside>

      <main className="relative z-10 px-5 py-6 md:pl-[88px] md:pr-5">
        <HealthTabs active="saude" />

        <header className="mb-10 flex items-center gap-5">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
            <Heart className="h-7 w-7 text-primary-foreground" fill="currentColor" />
            <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 [animation-duration:3s]" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-normal text-primary">Módulo · Bem-estar</p>
            <h1 className="font-display-h text-4xl font-semibold tracking-normal md:text-5xl">
              Saúde<span className="text-primary">.</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Cuide do seu corpo, evolua seus hábitos, alcance seus objetivos.</p>
          </div>
        </header>

        <section className="glass-h relative rounded-[2rem] p-6 md:p-10">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="font-display-h text-2xl font-medium md:text-3xl">
                Escolha o tipo de ficha <span className="text-gradient-h">que deseja montar</span>
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Organize sua rotina, acompanhe seu progresso e mantenha o foco em um só lugar.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-normal text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Sistema ativo
            </div>
          </div>

           <div className="grid gap-5 lg:grid-cols-3">
            {cards.map((c) => (
              <Button variant="unstyled" size="unstyled" type="button" key={c.title} data-tone={c.tone}
                onClick={() => setFicha(c.tone === "emerald" ? "dieta" : c.tone === "cyan" ? "medidas" : "treino")}
                aria-label={c.cta}
                className="health-sheet-card tone group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card/60 transition-all duration-500 hover:-translate-y-1.5 hover:border-[var(--tone)] hover:shadow-[0_30px_80px_-30px_var(--tone)] focus-visible:outline-2 focus-visible:outline-primary">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={c.img} alt={c.title} width={1024} height={768} loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
                  <span className="glass-h absolute left-4 top-4 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-normal text-[var(--tone)]">
                    {c.tag}
                  </span>
                </div>
                <div className="relative -mt-4 flex flex-1 flex-col p-6">
                  <div className="mb-3 flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--tone)]/40 bg-[var(--tone)]/10 text-[var(--tone)] backdrop-blur">
                      <c.icon className="h-5 w-5" />
                    </div>
                    <h3 className="min-w-0 flex-1 font-display-h text-xl font-medium">{c.title}</h3>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1" />
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
                </div>
              </Button>
            ))}
          </div>
        </section>
      </main>

      <Dialog open={ficha !== null} onOpenChange={(o) => !o && setFicha(null)}>
        <DialogContent className="health-area block h-[92vh] w-[96vw] max-w-[1400px] overflow-y-auto rounded-[2rem] border-primary/20 bg-background p-0 text-foreground shadow-glow sm:max-w-[1400px]">
          <DialogDescription className="sr-only">Dados da ficha de saúde</DialogDescription>
          <DialogTitle className="sr-only">{ficha ? fichaTitle[ficha] : "Ficha"}</DialogTitle>
          {ficha === "treino" && <NovaFichaTreino embedded onCancel={() => setFicha(null)} />}
          {ficha === "dieta" && <DietBuilder embedded onCancel={() => setFicha(null)} />}
          {ficha === "medidas" && <NovaFichaMedidas embedded onCancel={() => setFicha(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
