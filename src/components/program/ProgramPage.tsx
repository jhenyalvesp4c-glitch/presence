/** Preparar o programa de treino: usar a ficha pronta ou enviar a sua. Depois de salva, tudo fica na tela de Saúde (Hoje · Treino · Dieta · Progresso). */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dumbbell, FileUp, Loader2, Sparkles } from "lucide-react";

import { FinBackdrop, HeroPanel, LiveDot, OrbitArt } from "@/components/finance/fx";
import { ImportDialog } from "@/components/program/ImportDialog";
import { useProgram, useProgramActions } from "@/lib/data/program";
import { isoOf, type Program } from "@/lib/program";
import { RECOMP_12 } from "@/lib/program-recomp";

export function ProgramPage() {
  const prog = useProgram(), navigate = useNavigate(), actions = useProgramActions(prog.data?.id);
  const [importing, setImporting] = useState(false), [start, setStart] = useState(isoOf(new Date()));
  // já existe programa: a tela única de Saúde é o lugar dele
  useEffect(() => { if (prog.data) void navigate({ to: "/hoje", replace: true }); }, [prog.data, navigate]);
  const create = async (program: Program, startDate: string) => {
    try { await actions.create.mutateAsync({ program, startDate }); setImporting(false); toast.success("Programa salvo", { description: "Está em Saúde: Hoje, Treino, Dieta e Progresso." }); void navigate({ to: "/hoje" }); }
    catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); }
  };
  if (prog.isLoading || prog.data) return <main className="grid min-h-[60vh] place-items-center"><span className="mono-caps animate-pulse">Abrindo o programa…</span></main>;
  return (
    <main className="relative mx-auto min-h-screen max-w-[1500px] px-4 pb-40 pt-6 md:py-10" data-testid="programa"><FinBackdrop />
      <HeroPanel glow="var(--violet)"><div className="grid items-center gap-6 lg:grid-cols-[1.3fr_0.7fr]"><div>
        <p className="mono-caps flex items-center gap-3">Saúde · Programa de treino <LiveDot color="var(--violet)" label="pronto para começar" /></p>
        <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">Seu <span className="text-gradient inline-block pr-3 italic">programa</span></h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">Coloque a sua ficha aqui e o Orion monta tudo na tela de Saúde: treino do dia, séries e cargas, quando progredir, avaliação semanal, medidas, fotos e a evolução.</p>
        <button onClick={() => setImporting(true)} className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-5 py-3 text-sm font-medium text-cyan hover:bg-cyan/20" data-testid="enviar-ficha"><FileUp size={16} /> Enviar minha ficha (prints, PDF ou texto)</button></div>
        <div className="mx-auto"><OrbitArt size={200}><Dumbbell size={34} className="text-violet drop-shadow-[0_0_14px_var(--violet)]" /></OrbitArt></div></div></HeroPanel>
      <section className="glass mt-5 rounded-3xl p-5 sm:p-6" style={{ animation: "fin-rise .6s both" }}>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Sparkles size={18} className="text-violet" /> Ficha pronta: Recomposição corporal — 12 semanas</h2>
        <p className="mt-1 text-sm text-muted-foreground">A ficha que você me enviou: 5 dias por semana (inferiores A e B, superiores A e B + glúteos, cardio + abdômen), progressão dupla, RIR, 12 semanas, aquecimento, cardio e metas do ciclo.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs text-muted-foreground">Começa em<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm" data-testid="inicio" /></label>
          <button onClick={() => void create(RECOMP_12(), start)} disabled={actions.create.isPending} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2.5 text-sm font-medium text-emerald hover:bg-emerald/25 disabled:opacity-50" data-testid="usar-recomposicao">{actions.create.isPending && <Loader2 size={15} className="animate-spin" />} Usar esta ficha</button></div></section>
      {importing && <ImportDialog onClose={() => setImporting(false)} onSave={create} saving={actions.create.isPending} />}
    </main>
  );
}
