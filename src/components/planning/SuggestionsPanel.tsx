import { Brain, Check, Lightbulb, X } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/PlanShell";
import { DEFAULT_PLAN_SETTINGS, useDecideSuggestion, usePlanSettings, useSavePlanSettings, useSuggestions } from "@/lib/data/planning";

/** O Orion aprendendo com você: sugestões para aceitar ou ignorar (nada muda sozinho) e o que ele já percebeu. */
export function SuggestionsPanel() {
  const sug = useSuggestions(), st = usePlanSettings(), decide = useDecideSuggestion(), save = useSavePlanSettings();
  const settings = st.data ?? DEFAULT_PLAN_SETTINGS, novas = sug.data?.novas ?? [], resumo = sug.data?.resumo ?? [];
  return (
    <Panel c="violet" style={{ animationDelay: ".6s" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold"><Brain size={20} className="text-violet" /> O Orion aprende com você</h2>
        <button role="switch" aria-checked={settings.learn} aria-label="Aprender com o meu uso" title="Aprender com o meu uso" data-testid="aprender-liga" onClick={() => save.mutate({ ...settings, learn: !settings.learn })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings.learn ? "bg-violet" : "bg-secondary"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-background transition-all ${settings.learn ? "left-6" : "left-1"}`} /></button>
      </div>
      {!settings.learn ? <p className="text-sm text-muted-foreground">O aprendizado está desligado: o Orion não registra o que você faz nem sugere nada.</p> : (
        <>
          {novas.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="sem-sugestoes">Ainda estou conhecendo o seu ritmo. Conforme você conclui, adia e muda as atividades do dia, eu passo a sugerir ajustes aqui.</p> : (
            <ul className="space-y-3" data-testid="sugestoes">
              {novas.map((s) => (
                <li key={s.id} className="rounded-xl border border-violet/30 bg-violet/[0.06] p-3.5">
                  <p className="flex items-start gap-2 text-sm font-semibold"><Lightbulb size={16} className="mt-0.5 shrink-0 text-violet" />{s.title}</p>
                  <p className="mt-1 pl-6 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
                  <div className="mt-2.5 flex gap-2 pl-6">
                    <button onClick={() => decide.mutate({ s, accept: true, current: settings }, { onSuccess: () => toast.success("Combinado! Já uso isso nos próximos planos."), onError: (e) => toast.error(e.message) })} className="inline-flex items-center gap-1.5 rounded-full bg-violet/20 px-3 py-1.5 text-xs font-semibold text-violet hover:bg-violet/30"><Check size={13} /> Aceitar</button>
                    <button onClick={() => decide.mutate({ s, accept: false, current: settings })} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"><X size={13} /> Ignorar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {resumo.length > 0 && <div className="mt-4 border-t border-border pt-3"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que já percebi</p><ul className="space-y-1 text-xs text-muted-foreground">{resumo.map((t) => <li key={t}>• {t}</li>)}</ul></div>}
        </>
      )}
    </Panel>
  );
}
