import { Link } from "@tanstack/react-router";
import { CalendarDays, ChartNoAxesColumn, LayoutGrid, TrendingUp, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { HealthTabs, type HealthTabKey } from "@/components/health-tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import treinoAsset from "@/assets/treino.jpg";
import dietaAsset from "@/assets/dieta.jpg";
import medidasAsset from "@/assets/medidas.jpg";

const treino = treinoAsset;
const dieta = dietaAsset;
const medidas = medidasAsset;

const sections = {
  resumo: { title: "Resumo", icon: LayoutGrid },
  calendario: { title: "Calendário", icon: CalendarDays },
  habitos: { title: "Hábitos", icon: ChartNoAxesColumn },
  analise: { title: "Análise", icon: TrendingUp },
};
const shortcuts = [
  { title: "Treinos", image: treino, to: "/treino/exercicios" },
  { title: "Dieta", image: dieta, to: "/dieta/nova" },
  { title: "Peso e medidas", image: medidas, to: "/medidas/nova" },
] as const;

export function WorkspaceSection({ section }: { section: Exclude<HealthTabKey, "saude"> }) {
  const { title, icon: Icon } = sections[section];
  const [date, setDate] = useState<Date>();
  return (
    <div className="health-area relative min-h-screen overflow-hidden bg-background font-body text-foreground">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <main className="relative z-10 mx-auto max-w-7xl px-5 py-6 md:px-10">
        <HealthTabs active={section} />
        <header className="mb-10 flex items-center gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow"><Icon className="h-7 w-7 text-primary-foreground" /></div>
          <h1 className="font-display-h text-4xl font-semibold">{title}<span className="text-primary">.</span></h1>
        </header>
        {section === "resumo" ? (
          <div className="grid gap-5 md:grid-cols-3">
            {shortcuts.map(item => <Link key={item.title} to={item.to} className="group overflow-hidden rounded-3xl border border-border bg-card/60 transition hover:border-primary/50">
              <img src={item.image} alt={item.title} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between p-6"><h2 className="font-display-h text-xl">{item.title}</h2><ArrowUpRight className="h-5 w-5 text-primary" /></div>
            </Link>)}
          </div>
        ) : section === "calendario" ? (
          <section className="grid gap-8 border-y border-border py-8 md:grid-cols-[320px_1fr]">
            <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-lg border border-border bg-card/50" />
            <div><h2 className="font-display-h text-xl">{date ? date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : "Agenda"}</h2><p className="mt-4 text-sm text-muted-foreground">Nenhuma atividade agendada.</p></div>
          </section>
        ) : (
          <section className="border-y border-border py-12">
            <Icon className="mb-5 h-8 w-8 text-primary" />
            <h2 className="font-display-h text-xl">{section === "habitos" ? "Nenhum hábito registrado" : "Nenhuma medição registrada"}</h2>
            <Button asChild variant="outline" className="mt-6 rounded-full border-primary/40 bg-primary/10 text-primary">
              <Link to={section === "habitos" ? "/saude" : "/medidas/nova"}>{section === "habitos" ? "Saúde" : "Registrar peso e medidas"}<ArrowUpRight /></Link>
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}