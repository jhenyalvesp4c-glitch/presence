import { Link, useRouterState } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { Brain, CalendarCheck, Calendar, ClipboardList, Heart, Home, ListChecks, ListTodo, Settings, Sprout } from "lucide-react";

/** Telas que já desenham a própria barra lateral (assistente, PlanShell). Nas demais, a barra global aparece. */
const OWN_RAIL = ["/assistente", "/planejamento", "/projetos", "/tarefas", "/cerebro", "/organizar"];
export const hasOwnRail = (path: string) => path === "/" || path === "/treino" || OWN_RAIL.some((p) => path === p || path.startsWith(`${p}/`));

const items = [
  { Icon: Home, label: "Início", c: "cyan", to: "/assistente" },
  { Icon: CalendarCheck, label: "Planejamento", c: "cyan", to: "/planejamento" },
  { Icon: ClipboardList, label: "Demandas", c: "violet", to: "/projetos" },
  { Icon: ListChecks, label: "Tarefas", c: "cyan", to: "/tarefas" },
  { Icon: ListTodo, label: "Listas", c: "emerald", to: "/listas" },
  { Icon: Calendar, label: "Calendário", c: "cyan", to: "/calendario" },
  { Icon: Sprout, label: "Hábitos", c: "emerald", to: "/habitos" },
  { Icon: Heart, label: "Saúde", c: "emerald", to: "/saude" },
  { Icon: Brain, label: "Segundo cérebro", c: "violet", to: "/cerebro" },
  { Icon: Settings, label: "Configurações", c: "cyan", to: "/configuracoes" },
] as const;

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;

/** Botões flutuantes à esquerda, presentes em todas as telas (menos nas que já têm a sua). */
export function GlobalRail() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (hasOwnRail(path)) return null;
  const on = (to: string) => path === to || path.startsWith(`${to}/`) || (to === "/saude" && ["/hoje", "/dieta", "/medidas", "/treino"].some((p) => path.startsWith(p)));
  return (
    <aside data-testid="barra-lateral" className="fixed bottom-0 left-0 top-0 z-30 hidden w-16 flex-col items-center justify-center gap-1.5 pl-3 md:flex">
      {items.map(({ Icon, label, c, to }, i) => {
        const active = on(to);
        return (
          <div key={label} className="rail-float" style={{ animationDelay: `${(i % 5) * 0.7}s` }}>
            <Link to={to} aria-label={label} style={tint(c)}
              className={`group relative grid h-10 w-10 place-items-center rounded-full transition duration-500 hover:-translate-y-0.5 hover:scale-[1.14] ${active ? "bg-[color-mix(in_oklab,var(--glow)_14%,transparent)] text-[color:var(--glow)]" : "text-muted-foreground/55 hover:text-[color:var(--glow)]"}`}>
              <span aria-hidden className={`rail-halo transition-opacity duration-500 ${active ? "opacity-75" : "opacity-0 group-hover:opacity-100"}`} />
              <span aria-hidden className={`rail-ring transition-opacity duration-700 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
              <Icon size={19} className="relative z-10 transition duration-500 group-hover:-rotate-6" />
              <span aria-hidden className="rail-label -translate-x-1.5 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">{label}</span>
            </Link>
          </div>
        );
      })}
      <div className="absolute bottom-24 left-3"><AccountMenu /></div>
    </aside>
  );
}

/** Reserva espaço à esquerda nas telas que recebem a barra global, para ela não cobrir o conteúdo. */
export function useRailPad(): string {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return hasOwnRail(path) ? "" : "md:pl-16";
}
