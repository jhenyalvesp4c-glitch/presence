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


const nav = [
  { Icon: LayoutGrid, t: "Resumo" }, { Icon: Calendar, t: "Calendário" }, { Icon: BarChart3, t: "Hábitos" },
  { Icon: Heart, t: "Saúde" }, { Icon: ActivityIcon, t: "Análise" },
];

export function PlanShell({ children, backdrop }: { children: ReactNode; active?: number; backdrop?: ReactNode }) {
  return (
    <div className={`rail-bleed-p3 min-h-screen p-3 ${backdrop ? "relative isolate " : ""}[background:radial-gradient(60%_50%_at_50%_20%,color-mix(in_oklab,var(--violet)_7%,transparent),transparent_70%),var(--background)]`}>
      {backdrop}
      <div className="mx-auto flex w-full max-w-[1680px] items-stretch gap-4">

        <main className="flex min-w-0 flex-1 flex-col gap-5 pb-4">
          <header className="glass flex items-center justify-between gap-4 rounded-3xl px-6 py-3.5 animate-rise">
            <Link to="/assistente" className="flex items-center gap-4">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan shadow-[0_0_12px_var(--cyan)] animate-pulse-ring" />
              <span className="font-display text-xl font-semibold tracking-[0.35em] text-cyan">ORION</span>
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
