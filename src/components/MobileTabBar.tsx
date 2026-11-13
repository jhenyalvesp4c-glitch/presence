import { Link, useRouterState } from "@tanstack/react-router";
import { Brain, ClipboardList, Heart, Home, ListChecks } from "lucide-react";

const items = [
  { Icon: Home, label: "Início", to: "/assistente", match: ["/assistente"], c: "cyan" },
  { Icon: ListChecks, label: "Tarefas", to: "/tarefas", match: ["/tarefas", "/calendario", "/planejamento"], c: "cyan" },
  { Icon: ClipboardList, label: "Demandas", to: "/projetos", match: ["/projetos", "/demandas"], c: "violet" },
  { Icon: Heart, label: "Saúde", to: "/saude", match: ["/saude", "/hoje", "/habitos", "/dieta", "/medidas", "/treino"], c: "emerald" },
  { Icon: Brain, label: "Orion", to: "/cerebro", match: ["/cerebro"], c: "violet" },
] as const;

/** Barra de navegação de baixo, só no celular: os 5 lugares principais, como num aplicativo. */
export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Navegação principal" data-testid="barra-inferior"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[oklch(0.13_0.03_265/0.92)] pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ Icon, label, to, match, c }) => {
          const on = match.some((m) => path === m || path.startsWith(`${m}/`));
          return (
            <li key={label}>
              <Link to={to} aria-label={label} aria-current={on ? "page" : undefined} style={{ ["--glow" as string]: `var(--${c})` }}
                className={`relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[0.62rem] font-medium transition active:scale-95 ${on ? "text-[var(--glow)]" : "text-muted-foreground"}`}>
                {on && <span aria-hidden className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-[var(--glow)] shadow-[0_0_12px_var(--glow)]" />}
                <span className={`grid h-8 w-12 place-items-center rounded-full transition ${on ? "bg-[color-mix(in_oklab,var(--glow)_14%,transparent)]" : ""}`}><Icon size={21} strokeWidth={on ? 2.2 : 1.8} /></span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
