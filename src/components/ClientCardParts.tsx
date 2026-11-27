/** Ações rápidas dentro do card do cliente (sem abrir a ficha): concluir a etapa, criar tarefa e criar as tarefas padrão. */
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { toast } from "sonner";

import { createDefaultTasks } from "@/lib/data/client-default-tasks";
import { ensureClientCategory, nextClientOrder, useCreateTask, useToggleTask } from "@/lib/data/tasks";

const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

export function StepDoneButton({ taskId, title }: { taskId: string; title: string }) {
  const toggle = useToggleTask();
  return <button type="button" onClick={(e) => { stop(e); toggle.mutate({ id: taskId, done: true }, { onSuccess: () => toast.success("Etapa concluída"), onError: (er) => toast.error(er.message) }); }} disabled={toggle.isPending} aria-label={`Concluir: ${title}`} title="Concluir esta etapa" data-testid="cliente-etapa-concluir" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-emerald/60 text-emerald transition hover:bg-emerald/15 active:scale-90 disabled:opacity-50"><Check size={15} /></button>;
}

export function CreateDefaultButton({ clientId }: { clientId: string }) {
  const qc = useQueryClient(), [busy, setBusy] = useState(false);
  return <button type="button" disabled={busy} data-testid="cartao-criar-padrao" onClick={(e) => { stop(e); setBusy(true); void createDefaultTasks(clientId, { force: true }).then((n) => { void qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success(n ? `${n} tarefas padrão criadas` : "Nada novo para criar"); }).catch((er: Error) => toast.error(er.message)).finally(() => setBusy(false)); }} className="mt-1.5 rounded-full border border-cyan/50 px-3 py-1 text-[0.7rem] text-cyan transition hover:bg-cyan/10 disabled:opacity-50">{busy ? "Criando…" : "Criar as tarefas padrão"}</button>;
}

export function QuickTask({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false), [title, setTitle] = useState(""), create = useCreateTask(), qc = useQueryClient();
  const add = async () => {
    if (!title.trim() || create.isPending) return;
    const category_id = await ensureClientCategory().catch(() => null), client_order = await nextClientOrder(clientId).catch(() => null);
    create.mutate({ title: title.trim(), category_id, client_id: clientId, ...(client_order !== null ? { client_order } : {}) }, { onSuccess: () => { setTitle(""); setOpen(false); void qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Tarefa criada"); }, onError: (er) => toast.error(er.message) });
  };
  if (!open) return <button type="button" onClick={(e) => { stop(e); setOpen(true); }} data-testid="cartao-mais-tarefa" className="flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[0.68rem] text-muted-foreground transition hover:border-cyan/50 hover:text-cyan"><Plus size={11} /> tarefa</button>;
  return (
    <span className="flex w-full items-center gap-1.5" onClick={stop}>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); void add(); } if (e.key === "Escape") setOpen(false); }} placeholder="Nova tarefa…" aria-label="Nova tarefa rápida" maxLength={200} data-testid="cartao-tarefa-titulo" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-2.5 py-1 text-base outline-none focus:border-cyan/60 md:text-xs" />
      <button type="button" onClick={(e) => { stop(e); void add(); }} disabled={!title.trim() || create.isPending} className="rounded-full border border-cyan/60 px-2.5 py-1 text-[0.68rem] text-cyan disabled:opacity-40">Criar</button>
    </span>
  );
}
