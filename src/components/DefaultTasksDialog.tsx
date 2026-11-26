import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ListChecks, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { backdropProps } from "@/lib/backdrop";
import { cleanTemplate } from "@/lib/default-tasks";
import { clientsWithoutTasks, createDefaultTasks, useDefaultTemplate, useSaveDefaultTemplate } from "@/lib/data/client-default-tasks";

/** Tarefas que todo cliente novo ganha (e que dá para editar depois, cliente a cliente, como qualquer tarefa). */
export function DefaultTasksDialog({ clientIds, onClose }: { clientIds: string[]; onClose: () => void }) {
  const tpl = useDefaultTemplate(), save = useSaveDefaultTemplate(), qc = useQueryClient();
  const [titles, setTitles] = useState<string[]>([]), [auto, setAuto] = useState(true), [ready, setReady] = useState(false), [applying, setApplying] = useState(false);
  useEffect(() => { if (tpl.data && !ready) { setTitles(tpl.data.titles); setAuto(tpl.data.auto); setReady(true); } }, [tpl.data, ready]);
  const set = (i: number, v: string) => setTitles((l) => l.map((x, k) => (k === i ? v : x)));
  const move = (i: number, d: -1 | 1) => setTitles((l) => { const j = i + d; if (j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const clean = cleanTemplate(titles);
  const doSave = (then?: () => void) => save.mutate({ titles, auto }, { onSuccess: () => { toast.success("Tarefas padrão salvas"); then?.(); }, onError: (e) => toast.error((e as Error).message) });
  const applyToExisting = async () => {
    setApplying(true);
    try {
      const ids = await clientsWithoutTasks(clientIds);
      if (!ids.length) { toast.message("Todos os clientes já têm tarefas."); return; }
      if (!window.confirm(`Criar as ${clean.length} tarefas padrão em ${ids.length} ${ids.length === 1 ? "cliente que ainda não tem" : "clientes que ainda não têm"} nenhuma tarefa?`)) return;
      let n = 0; for (const id of ids) n += await createDefaultTasks(id, { force: true });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`${n} tarefas criadas em ${ids.length} clientes`);
    } catch (e) { toast.error((e as Error).message); } finally { setApplying(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/70 p-4 backdrop-blur-sm" {...backdropProps(onClose)} data-testid="tarefas-padrao">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tarefas padrão dos clientes" className="glass w-full max-w-lg space-y-4 rounded-3xl p-6 animate-rise">
        <div className="flex items-start gap-3">
          <span className="icon-tile h-10 w-10 shrink-0 !rounded-2xl"><ListChecks size={18} /></span>
          <div className="mr-auto"><h3 className="font-display text-lg font-semibold">Tarefas padrão dos clientes</h3><p className="text-xs text-muted-foreground">Todo cliente novo já nasce com estas tarefas, na ordem. Depois você edita, apaga ou acrescenta em cada cliente.</p></div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        {!ready ? <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-cyan" /></div> : (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} data-testid="padrao-auto" /> Criar automaticamente quando eu cadastrar um cliente</label>
            <ol className="space-y-2" data-testid="padrao-lista">
              {titles.map((t, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan/50 text-[0.7rem] text-cyan">{i + 1}</span>
                  <input value={t} onChange={(e) => set(i, e.target.value)} maxLength={200} aria-label={`Tarefa ${i + 1}`} className="min-w-0 flex-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan" />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === titles.length - 1} aria-label="Descer" className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown size={15} /></button>
                  <button type="button" onClick={() => setTitles((l) => l.filter((_, k) => k !== i))} aria-label="Remover" className="text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                </li>))}
            </ol>
            <button type="button" onClick={() => setTitles((l) => [...l, ""])} data-testid="padrao-adicionar" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cyan"><Plus size={14} /> Adicionar tarefa</button>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <button type="button" onClick={() => void applyToExisting()} disabled={applying || clean.length === 0} data-testid="padrao-aplicar" className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-cyan/60 hover:text-cyan disabled:opacity-40">{applying ? "Criando…" : "Criar nos clientes que ainda não têm tarefas"}</button>
              <span className="grow" />
              <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Fechar</button>
              <button type="button" onClick={() => doSave(onClose)} disabled={save.isPending} data-testid="padrao-salvar" className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{save.isPending ? "Salvando…" : "Salvar"}</button>
            </div>
            <p className="text-[0.68rem] text-muted-foreground">Ao aplicar nos clientes que já existem, só entram os que não têm nenhuma tarefa. Salve antes para valer a lista nova.</p>
          </>
        )}
      </div>
    </div>
  );
}
