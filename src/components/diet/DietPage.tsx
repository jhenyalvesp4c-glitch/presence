/** Preparar a dieta: usar a ficha pronta ou enviar a sua. Depois de salva, tudo fica na tela de Saúde (Hoje · Treino · Dieta · Progresso). */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, Utensils } from "lucide-react";

import { FinBackdrop, HeroPanel, LiveDot, OrbitArt } from "@/components/finance/fx";
import { DietImport } from "@/components/diet/DietImport";
import { useDiet, useDietActions } from "@/lib/data/diet-plan";
import { isoOf } from "@/lib/program";
import type { DietPlan } from "@/lib/diet-plan";
import { DIET_RECOMP } from "@/lib/diet-recomp";

export function DietPage() {
  const q = useDiet(), navigate = useNavigate(), actions = useDietActions(q.data?.id);
  const [importing, setImporting] = useState(false), [start, setStart] = useState(isoOf(new Date()));
  useEffect(() => { if (q.data) void navigate({ to: "/saude/dieta", replace: true }); }, [q.data, navigate]);
  const create = async (plan: DietPlan, startDate: string) => {
    try { await actions.create.mutateAsync({ plan, startDate }); setImporting(false); toast.success("Dieta salva", { description: "Está em Saúde: Hoje, Dieta e Progresso." }); void navigate({ to: "/saude/dieta" }); }
    catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); }
  };
  if (q.isLoading || q.data) return <main className="grid min-h-[60vh] place-items-center"><span className="mono-caps animate-pulse">Abrindo a dieta…</span></main>;
  return (
    <main className="relative mx-auto min-h-screen max-w-6xl px-4 pb-40 pt-6 md:py-10 md:pl-24" data-testid="dieta-setup"><FinBackdrop />
      <HeroPanel glow="var(--emerald)"><div className="grid items-center gap-6 lg:grid-cols-[1.3fr_0.7fr]"><div>
        <p className="mono-caps flex items-center gap-3">Saúde · Plano alimentar <LiveDot color="var(--emerald)" label="pronto para começar" /></p>
        <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">Sua <span className="text-gradient inline-block pr-3 italic">dieta</span></h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">Coloque a sua ficha aqui e o Orion monta tudo na tela de Saúde: refeições de hoje, proteína do dia, água, trocas, comparação entre as opções e o acompanhamento semanal.</p>
        <button onClick={() => setImporting(true)} className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/10 px-5 py-3 text-sm font-medium text-emerald hover:bg-emerald/20" data-testid="enviar-dieta"><FileUp size={16} /> Enviar minha ficha (prints, PDF ou texto)</button></div>
        <div className="mx-auto"><OrbitArt size={200}><Utensils size={34} className="text-emerald drop-shadow-[0_0_14px_var(--emerald)]" /></OrbitArt></div></div></HeroPanel>
      <section className="glass mt-5 rounded-3xl p-5 sm:p-6" style={{ animation: "fin-rise .6s both" }}>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Sparkles size={18} className="text-emerald" /> Ficha pronta: Recomposição corporal</h2>
        <p className="mt-1 text-sm text-muted-foreground">A ficha que você me enviou: opção A (2 refeições) e opção B (3 refeições), proteína de 115–130 g/dia, trocas por grupos, hidratação, intestino e acompanhamento semanal.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs text-muted-foreground">Começa em<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm" data-testid="dieta-inicio" /></label>
          <button onClick={() => void create(DIET_RECOMP(), start)} disabled={actions.create.isPending} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2.5 text-sm font-medium text-emerald hover:bg-emerald/25 disabled:opacity-50" data-testid="usar-dieta-pronta">{actions.create.isPending && <Loader2 size={15} className="animate-spin" />} Usar esta ficha</button></div></section>
      {importing && <DietImport onClose={() => setImporting(false)} onSave={create} saving={actions.create.isPending} />}
    </main>
  );
}
