import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import {
  BarChart3, Book, Brain, Calendar, CalendarCheck, ClipboardList, Coffee, Dumbbell, Heart, Home, Laptop, Layers, ListChecks, Moon,
  Settings, ShowerHead, Sprout, Star, Sun, Utensils, LayoutGrid, Activity as ActivityIcon,
} from "lucide-react";
import type { IconKey } from "@/lib/plan-data";
import { AccountMenu } from "@/components/auth/AccountMenu";

export const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
export const colorVar = (c: string) => (c === "amber" ? "oklch(0.8 0.15 75)" : c === "rose" ? "oklch(0.7 0.18 10)" : `var(--${c})`);

export const icons: Record<IconKey, typeof Home> = {
  sun: Sun, laptop: Laptop, food: Utensils, layers: Layers, dumbbell: Dumbbell, shower: ShowerHead, book: Book,
  moon: Moon, star: Star, coffee: Coffee, calendar: Calendar, sprout: Sprout,
};

const rail = [
  { Icon: Home, label: "Início", c: "cyan", to: "/assistente" as const },
  { Icon: CalendarCheck, label: "Planejamento", c: "cyan", to: "/planejamento" as const },
  { Icon: ClipboardList, label: "Demandas", c: "violet", to: "/projetos" as const },
  { Icon: ListChecks, label: "Tarefas", c: "cyan", to: "/tarefas" as const },
  { Icon: BarChart3, label: "Progresso", c: "violet" },
  { Icon: Heart, label: "Saúde", c: "emerald", to: "/saude" as const },
  { Icon: Settings, label: "Configurações", c: "cyan", to: "/configuracoes" as const },
  { Icon: Brain, label: "Segundo cérebro", c: "violet", to: "/cerebro" as const },
];

const nav = [
  { Icon: LayoutGrid, t: "Resumo" }, { Icon: Calendar, t: "Calendário" }, { Icon: BarChart3, t: "Hábitos" },
  { Icon: Heart, t: "Saúde" }, { Icon: ActivityIcon, t: "Análise" },
];

export function PlanShell({ children, active = 1 }: { children: ReactNode; active?: number }) {
  return (
    <div className="min-h-screen p-3 [background:radial-gradient(60%_50%_at_50%_20%,color-mix(in_oklab,var(--violet)_7%,transparent),transparent_70%),var(--background)]">
      <div className="mx-auto flex w-full max-w-[1680px] items-stretch gap-4">
        <aside className="sticky top-3 z-30 hidden h-[calc(100vh-1.5rem)] w-16 shrink-0 flex-col items-center justify-center gap-1.5 md:flex">
          {rail.map(({ Icon, label, c, to }, i) => {
            const on = i === active;
            const cls = `group relative grid h-10 w-10 place-items-center rounded-full transition duration-500 hover:-translate-y-0.5 hover:scale-[1.14] ${on ? "bg-[color-mix(in_oklab,var(--glow)_14%,transparent)] text-[color:var(--glow)]" : "text-muted-foreground/55 hover:text-[color:var(--glow)]"}`;
            const inner = (
              <>
                <span aria-hidden className={`rail-halo transition-opacity duration-500 ${on ? "opacity-75" : "opacity-0 group-hover:opacity-100"}`} />
                <span aria-hidden className={`rail-ring transition-opacity duration-700 ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                <Icon size={19} className="relative z-10 transition duration-500 group-hover:-rotate-6" />
                <span aria-hidden className="rail-label -translate-x-1.5 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">{label}</span>
              </>
            );
            return (
              <div key={label} className="rail-float" style={{ animationDelay: `${(i % 5) * 0.7}s` }}>
                {to ? <Link to={to} aria-label={label} className={cls} style={tint(c)}>{inner}</Link>
                  : <button type="button" aria-label={label} className={cls} style={tint(c)}>{inner}</button>}
              </div>
            );
          })}
          <div className="absolute bottom-24 left-3"><AccountMenu /></div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5 pb-4">
          <header className="glass flex items-center justify-between gap-4 rounded-3xl px-6 py-3.5 animate-rise">
            <Link to="/assistente" className="flex items-center gap-4">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan shadow-[0_0_12px_var(--cyan)] animate-pulse-ring" />
              <span className="font-display text-xl font-semibold tracking-[0.35em] text-cyan">PRESENCE</span>
              <span className="tag hidden !px-4 !py-1.5 sm:inline" style={tint("violet")}>Assistente pessoal</span>
            </Link>
            <nav className="hidden items-center gap-1 rounded-full border border-border px-2 py-1 xl:flex">
              {nav.map(({ Icon, t }) => (
                <span key={t} className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground">
                  <Icon size={15} /> {t}
                </span>
              ))}
            </nav>
            <span className="flex items-center gap-3 text-sm">
              <span className="h-8 w-8 rounded-full bg-gradient-brand shadow-[0_0_18px_-2px_var(--cyan)]" />
              <span className="hidden sm:inline">Olá, Jheny</span>
            </span>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Panel({ children, className = "", c = "cyan", style }: { children: ReactNode; className?: string; c?: string; style?: CSSProperties }) {
  return (
    <section className={`glass relative rounded-3xl border-[color-mix(in_oklab,var(--glow)_28%,transparent)] p-5 animate-rise ${className}`} style={{ ...tint(c), ...style }}>
      {children}
    </section>
  );
}
