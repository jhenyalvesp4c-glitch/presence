import { useShownPath } from "@/lib/shown-path";
import { Link } from "@tanstack/react-router";
import { Brain, Briefcase, Heart, Home, ListChecks, Wallet } from "lucide-react";
import { NavBadge } from "@/components/NavBadge";
import { useNavBadges } from "@/lib/data/nav-badges";
import type { Badge } from "@/lib/nav-badges";

const items = [
  { Icon: Briefcase, label: "Trabalho", to: "/trabalho", match: ["/trabalho", "/projetos", "/demandas"], c: "violet" },
  { Icon: Home, label: "Início", to: "/assistente", match: ["/assistente"], c: "cyan" },
  { Icon: ListChecks, label: "Tarefas", to: "/tarefas", match: ["/tarefas", "/calendario", "/planejamento"], c: "cyan" },
  { Icon: Wallet, label: "Finanças", to: "/financeiro", match: ["/financeiro"], c: "emerald" },
  { Icon: Heart, label: "Saúde", to: "/saude", badgeOf: "/habitos", match: ["/saude", "/hoje", "/habitos", "/dieta", "/medidas", "/treino", "/programa"], c: "emerald" },
  { Icon: Brain, label: "Orion", to: "/cerebro", match: ["/cerebro"], c: "violet" },
] as const;

/** Barra de navegação de baixo, só no celular: os 5 lugares principais, como num aplicativo. */
export function MobileTabBar() {
  const path = useShownPath(), badges = useNavBadges() as Record<string, Badge | undefined>;
  return (
    <nav aria-label="Navegação principal" data-testid="barra-inferior"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[oklch(0.13_0.03_265/0.92)] pb-[var(--sab)] backdrop-blur-2xl md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-6">
        {items.map((it) => {
          const { Icon, label, to, match, c } = it, badge = badges[("badgeOf" in it ? it.badgeOf : to) as string];
          const on = match.some((m) => path === m || path.startsWith(`${m}/`));
          return (
            <li key={label}>
              <Link to={to} aria-label={label} aria-current={on ? "page" : undefined} style={{ ["--glow" as string]: `var(--${c})` }}
                className={`relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[0.62rem] font-medium transition active:scale-95 ${on ? "text-[var(--glow)]" : "text-muted-foreground"}`}>
                {on && <span aria-hidden className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-[var(--glow)] shadow-[0_0_12px_var(--glow)]" />}
                <span className={`grid h-8 w-12 place-items-center rounded-full transition ${on ? "bg-[color-mix(in_oklab,var(--glow)_14%,transparent)]" : ""}`}><Icon size={21} strokeWidth={on ? 2.2 : 1.8} /><NavBadge badge={badge} className="right-0 top-0" /></span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
