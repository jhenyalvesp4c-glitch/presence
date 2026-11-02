import { Link } from "@tanstack/react-router";
import { Sun, Dumbbell, Utensils, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const tabs = [
  { key: "hoje", label: "Hoje", to: "/hoje", icon: Sun },
  { key: "treino", label: "Treino", to: "/saude/treino", icon: Dumbbell },
  { key: "dieta", label: "Dieta", to: "/saude/dieta", icon: Utensils },
  { key: "progresso", label: "Progresso", to: "/progresso", icon: TrendingUp },
] as const;
export type SheetTab = (typeof tabs)[number]["key"];
export function HealthSheetTabs({ active }: { active: SheetTab }) {
  return <div className="mb-8 flex justify-center"><nav aria-label="Fichas de saúde" className="glass-h flex w-full max-w-lg gap-1 rounded-full p-1.5">
    {tabs.map(tab => <Button key={tab.key} asChild variant="ghost" className={`h-11 min-w-0 flex-1 gap-2 rounded-full px-2 text-xs sm:text-sm ${active === tab.key ? "bg-gradient-primary text-primary-foreground shadow-glow hover:text-primary-foreground" : "text-muted-foreground"}`}><Link to={tab.to} aria-current={active === tab.key ? "page" : undefined}><tab.icon className="hidden sm:block" />{tab.label}</Link></Button>)}
  </nav></div>;
}