import { useState } from "react";
import { CalendarDays, Dumbbell, Heart, Layers, ListChecks, Pencil, Repeat, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Panel, tint } from "@/components/PlanShell";
import { DEFAULT_PLAN_SETTINGS, usePlanSettings, useSavePlanSettings, type PlanSettings } from "@/lib/data/planning";
import { SOURCE_LABEL, type SourceId } from "@/lib/planning/engine";
import { RoutineEditor } from "./RoutineEditor";

const ICON: Record<SourceId, typeof Heart> = { calendario: CalendarDays, tarefas: ListChecks, habitos: Repeat, saude: Dumbbell, financeiro: Wallet, demandas: Layers, rotina: Heart };
const HINT: Record<SourceId, string> = {
  calendario: "compromissos de hoje, com hora de sair", tarefas: "com horário e as sem horário, nas vagas livres", habitos: "os que você ainda não fez hoje", saude: "treino do dia e refeições da dieta",
  financeiro: "fatura que vence e contas do dia", demandas: "com prazo para hoje", rotina: "o seu dia padrão (editável)",
};
const ORDER: SourceId[] = ["calendario", "tarefas", "habitos", "saude", "financeiro", "demandas", "rotina"];

/** Fontes do plano: liga e desliga cada área e mostra quantos itens ela trouxe. */
export function SourcesPanel({ counts }: { counts: Partial<Record<SourceId, number>> }) {
  const q = usePlanSettings(), save = useSavePlanSettings(), [rotina, setRotina] = useState(false);
  const st: PlanSettings = q.data ?? DEFAULT_PLAN_SETTINGS;
  const update = (patch: Partial<PlanSettings>) => save.mutate({ ...st, ...patch }, { onError: (e) => toast.error(`Não consegui salvar: ${e.message}`) });
  return (
    <Panel c="cyan" style={{ animationDelay: ".54s" }}>
      <h2 className="mb-1 flex items-center gap-2.5 font-display text-lg font-semibold"><Layers size={20} className="text-cyan" /> Fontes do plano</h2>
      <p className="mb-3 text-xs text-muted-foreground">Só o que estiver ligado entra no seu dia. Tudo vem dos seus dados de verdade.</p>
      <ul className="space-y-2" data-testid="fontes">
        {ORDER.map((id) => { const I = ICON[id], on = st.sources[id], n = counts[id] ?? 0; return (
          <li key={id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5" data-testid={`fonte-${id}`}>
            <span className="icon-tile h-9 w-9 shrink-0 !rounded-xl" style={tint(on ? "violet" : "cyan")}><I size={16} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{SOURCE_LABEL[id]} {on && <span className="ml-1 rounded-full bg-cyan/15 px-2 py-0.5 text-[0.68rem] font-medium text-cyan" data-testid={`fonte-${id}-n`}>{n}</span>}</span><span className="block truncate text-xs text-muted-foreground">{HINT[id]}</span></span>
            {id === "rotina" && <button onClick={() => setRotina(true)} aria-label="Editar minha rotina" data-testid="editar-rotina" className="rounded-full border border-border p-2 text-muted-foreground hover:border-cyan/50 hover:text-cyan"><Pencil size={14} /></button>}
            <button role="switch" aria-checked={on} aria-label={`${on ? "Desligar" : "Ligar"} ${SOURCE_LABEL[id]}`} onClick={() => update({ sources: { ...st.sources, [id]: !on } })} data-testid={`fonte-${id}-liga`}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-cyan shadow-[0_0_14px_-3px_var(--cyan)]" : "bg-secondary"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-background transition-all ${on ? "left-6" : "left-1"}`} /></button>
          </li>); })}
      </ul>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-xs">
        <label className="block">Começa às<input type="time" value={st.dayStart} onChange={(e) => e.target.value && update({ dayStart: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background/40 px-2 py-1.5 text-sm" /></label>
        <label className="block">Termina às<input type="time" value={st.dayEnd} onChange={(e) => e.target.value && update({ dayEnd: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background/40 px-2 py-1.5 text-sm" /></label>
        <label className="block">Trajeto (min)<input type="number" min={0} max={240} step={5} value={st.travelMin} onChange={(e) => update({ travelMin: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded-lg border border-border bg-background/40 px-2 py-1.5 text-sm" /></label>
      </div>
      {rotina && <RoutineEditor onClose={() => setRotina(false)} />}
    </Panel>
  );
}
