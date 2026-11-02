import { Link } from "@tanstack/react-router";
import { LayoutGrid, CalendarDays, ChartNoAxesColumn, Heart, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHealthPreview } from "@/components/health-preview-provider";


const tabs = [
  { key: "resumo", label: "Resumo", to: "/resumo", icon: LayoutGrid },
  { key: "calendario", label: "Calendário", to: "/calendario", icon: CalendarDays },
  { key: "habitos", label: "Hábitos", to: "/habitos", icon: ChartNoAxesColumn },
  { key: "saude", label: "Saúde", to: "/saude", icon: Heart },
  { key: "analise", label: "Análise", to: "/analise", icon: TrendingUp },
] as const;

export type HealthTabKey = (typeof tabs)[number]["key"];

export function HealthTabs({ active }: { active: HealthTabKey }) {
  const { workout, diet, measurements } = useHealthPreview();
  return (
    <div className="mb-9 flex w-full justify-center sm:mb-10">
    <nav aria-label="Navegação principal" className="glass-h flex w-full max-w-full items-center gap-1 rounded-full p-1 sm:w-auto">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Button asChild variant="ghost" key={t.key}
            className={`relative h-12 min-w-0 flex-1 flex-col gap-1 overflow-hidden rounded-full px-1 text-[9px] font-medium transition-all sm:h-10 sm:flex-none sm:flex-row sm:gap-2 sm:px-5 sm:text-sm ${
              isActive
                ? "bg-gradient-primary text-primary-foreground shadow-glow hover:text-primary-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            }`}>
          <Link
            to={t.key === "saude" && (workout || diet || measurements) ? "/hoje" : t.to}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && <span className="health-shine absolute inset-0" />}
            <t.icon className="relative h-4 w-4" fill={t.key === "saude" && isActive ? "currentColor" : "none"} />
            <span className="relative">{t.label}</span>
          </Link>
          </Button>
        );
      })}
    </nav>
    </div>
  );
}
