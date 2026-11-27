import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Circle, Layers, LayoutGrid, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { ClientsView } from "@/components/ClientsView";
import { TaskEditDialog } from "@/components/TaskEditDialog";
import { TaskFilePicker, TaskThumbs, useTaskFiles } from "@/components/TaskFiles";
import { useAllClients, useMainProjectId } from "@/lib/data/clients";
import { ensureClientCategory, ensureWorkCategory, nextClientOrder, useCategories, useCreateTask, useDeleteTask, useTasks, useToggleTask, useUpdateTask } from "@/lib/data/tasks";
import { defaultProjectId } from "@/lib/dossiers";
import type { Task } from "@/lib/types";
import { BUCKET_LABEL, bucketOf, chipCounts, isWorkTask, matchesChip, matchesPolo, matchesSearch, sortQueue, type Bucket, type Chip, type PoloFilter } from "@/lib/work-queue";

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const CHIPS: [Chip, string, string][] = [["pendentes", "Pendentes", "text-cyan border-cyan/50"], ["atrasadas", "Atrasadas", "text-rose-400 border-rose-400/50"], ["hoje", "Para hoje", "text-amber border-amber/50"], ["semdata", "Sem data", "text-muted-foreground border-white/25"], ["feitas", "Feitas", "text-emerald border-emerald/50"]];
const RAIL: Record<Bucket, string> = { atrasadas: "var(--rose, oklch(0.72 0.18 10))", hoje: "var(--amber)", proximas: "var(--cyan)", semdata: "var(--violet)", feitas: "var(--emerald)" };

/** Página principal: tudo o que você precisa fazer (dos polos e geral) numa fila só, ou olhando polo por polo. */
export function WorkPage() {
  const [vista, setVista] = useState<"fila" | "polos">(() => { try { return localStorage.getItem("trabalho.vista") === "polos" ? "polos" : "fila"; } catch { return "fila"; } });
  const pick = (v: "fila" | "polos") => { setVista(v); try { localStorage.setItem("trabalho.vista", v); } catch { /* sem armazenamento */ } };
  const mainProject = useMainProjectId(defaultProjectId()).data;
  return (
    <div className="space-y-5" data-testid="trabalho">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="mono-caps">Meu trabalho</p><h1 className="font-serif text-4xl leading-none md:text-5xl">O que fazer <span className="text-gradient italic">agora</span></h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">As tarefas dos polos e as gerais, juntas. Filtre pelo que precisa de você hoje, ou olhe polo por polo.</p></div>
        <div className="glass flex rounded-xl p-1" role="group" aria-label="Como ver">
          {([["fila", "Fila de trabalho", Layers], ["polos", "Por polo", LayoutGrid]] as const).map(([k, l, I]) => (
            <button key={k} onClick={() => pick(k)} aria-pressed={vista === k} data-testid={`vista-${k}`} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition ${vista === k ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:text-foreground"}`}><I size={14} /> {l}</button>))}
        </div>
      </header>
      {vista === "fila" ? <Queue /> : mainProject ? <ClientsView projectId={mainProject} /> : null}
    </div>
  );
}

function Queue() {
  const qc = useQueryClient(), tasksQ = useTasks(), cats = useCategories().data ?? [], clientsQ = useAllClients(), clients = clientsQ.data ?? [];
  const create = useCreateTask(), toggle = useToggleTask(), update = useUpdateTask(), del = useDeleteTask(), files = useTaskFiles();
  const [chip, setChip] = useState<Chip>("pendentes"), [polo, setPolo] = useState<PoloFilter>("todos"), [q, setQ] = useState("");
  const [title, setTitle] = useState(""), [newPolo, setNewPolo] = useState<string>("geral"), [date, setDate] = useState(""), [editing, setEditing] = useState<Task | null>(null);
  const hoje = todayIso();
  const workCats = useMemo(() => new Set(cats.filter((c) => c.slug === "trab" || c.slug === "demandas" || c.slug === "clientes").map((c) => c.id)), [cats]);
  const name = useMemo(() => new Map(clients.map((c) => [c.id, c.name] as const)), [clients]);
  const all = useMemo(() => (tasksQ.data ?? []).filter((t) => isWorkTask(t, workCats)), [tasksQ.data, workCats]);
  const scoped = useMemo(() => all.filter((t) => matchesPolo(t, polo) && matchesSearch(t, q, t.client_id ? name.get(t.client_id) : "Geral")), [all, polo, q, name]);
  const counts = useMemo(() => chipCounts(scoped, hoje), [scoped, hoje]);
  const list = useMemo(() => sortQueue(scoped.filter((t) => matchesChip(t, chip, hoje)), hoje), [scoped, chip, hoje]);
  const groups = useMemo(() => { const m = new Map<Bucket, Task[]>(); for (const t of list) { const b = bucketOf(t, hoje); (m.get(b) ?? m.set(b, []).get(b)!).push(t); } return [...m.entries()]; }, [list, hoje]);
  const catName = (id?: string | null) => cats.find((c) => c.id === id)?.name;

  const add = async () => {
    if (!title.trim() || create.isPending || files.busy) return;
    let attachments: Awaited<ReturnType<typeof files.upload>> = [];
    try { attachments = await files.upload(); } catch (e) { toast.error(`Não consegui enviar o arquivo: ${(e as Error).message}`); return; }
    const isPolo = newPolo !== "geral";
    const category_id = await (isPolo ? ensureClientCategory() : ensureWorkCategory()).catch(() => null);
    const client_order = isPolo ? await nextClientOrder(newPolo).catch(() => null) : null;
    create.mutate({ title: title.trim(), category_id, due_date: date || null, due_time: null, ...(isPolo ? { client_id: newPolo } : {}), ...(client_order !== null ? { client_order } : {}), ...(attachments.length ? { attachments } : {}) },
      { onSuccess: () => { setTitle(""); setDate(""); files.clear(); void qc.invalidateQueries({ queryKey: ["categories"] }); toast.success(isPolo ? `Tarefa criada em ${name.get(newPolo) ?? "polo"}` : "Tarefa geral criada"); }, onError: (e) => toast.error((e as Error).message) });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); void add(); }} onPaste={files.onPaste} onDrop={files.onDrop} onDragOver={files.onDragOver} className="glass space-y-2.5 rounded-3xl p-4" data-testid="trabalho-nova">
        <div className="flex flex-wrap gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito? (ex.: Criar usuário da Jenny)" aria-label="Nova tarefa" maxLength={200} className="min-w-[14rem] flex-1 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm outline-none focus:border-cyan" />
          <select value={newPolo} onChange={(e) => setNewPolo(e.target.value)} aria-label="De qual polo?" data-testid="trabalho-polo" className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:border-cyan">
            <option value="geral" className="bg-popover">Geral (sem polo)</option>
            {clients.map((c) => <option key={c.id} value={c.id} className="bg-popover">{c.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none [color-scheme:dark] focus:border-cyan" />
          <button type="submit" disabled={!title.trim() || create.isPending || files.busy} data-testid="trabalho-criar" className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus size={15} /> {files.busy ? "Enviando…" : "Criar"}</button>
        </div>
        <TaskFilePicker files={files} />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar" data-testid="trabalho-filtros">
          {CHIPS.map(([k, l, cls]) => <button key={k} onClick={() => setChip(k)} aria-pressed={chip === k} data-testid={`fila-${k}`} className={`rounded-full border px-3 py-1.5 text-xs transition ${chip === k ? `bg-white/10 ${cls}` : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{l} <b className="tabular-nums">{counts[k]}</b></button>)}
        </div>
        <span className="grow" />
        <select value={polo} onChange={(e) => setPolo(e.target.value)} aria-label="Filtrar por polo" data-testid="fila-polo" className="glass rounded-xl px-3 py-2 text-xs outline-none">
          <option value="todos" className="bg-popover">Todos os polos e geral</option>
          <option value="geral" className="bg-popover">Só geral</option>
          {clients.map((c) => <option key={c.id} value={c.id} className="bg-popover">{c.name}</option>)}
        </select>
        <label className="glass flex min-w-[180px] items-center gap-2 rounded-xl px-3 py-2"><Search size={13} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar" className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground" /></label>
      </div>

      {tasksQ.isPending ? <p className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Carregando…</p> : list.length === 0 ? (
        <p className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground" data-testid="fila-vazia">{all.length === 0 ? "Nenhuma tarefa de trabalho ainda. Crie a primeira acima." : "Nada nesse filtro. 🎉"}</p>
      ) : (
        <div className="space-y-5" data-testid="fila-lista">
          {groups.map(([b, rows]) => (
            <section key={b} data-testid={`fila-grupo-${b}`}>
              <h2 className="mb-2 flex items-center gap-2 font-display text-base font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: RAIL[b], boxShadow: `0 0 8px ${RAIL[b]}` }} />{BUCKET_LABEL[b]} <span className="text-xs font-normal text-muted-foreground">{rows.length}</span></h2>
              <ul className="grid gap-2.5 lg:grid-cols-2">
                {rows.map((t) => (
                  <li key={t.id} className="ex-card flex items-start gap-3 p-3" style={{ "--rail": RAIL[b] } as React.CSSProperties} data-testid="fila-item">
                    <button type="button" onClick={() => toggle.mutate({ id: t.id, done: !t.done }, { onError: (e) => toast.error(e.message) })} aria-label={t.done ? "Reabrir" : "Concluir"} className="mt-0.5 shrink-0 text-muted-foreground transition hover:text-cyan">{t.done ? <CheckCircle2 size={20} className="text-emerald" /> : <Circle size={20} />}</button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold leading-snug ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.68rem]">
                        {t.client_id ? <span className="flex items-center gap-1 rounded-full border border-cyan/40 bg-cyan/10 px-2 py-0.5 text-cyan" data-testid="fila-polo-chip"><Building2 size={10} />{name.get(t.client_id) ?? "Polo"}</span> : <span className="flex items-center gap-1 rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 text-violet" data-testid="fila-geral-chip"><Users size={10} />Geral</span>}
                        {t.due_date && <span className={`rounded-full border px-2 py-0.5 ${b === "atrasadas" ? "border-rose-400/50 bg-rose-400/10 text-rose-300" : b === "hoje" ? "border-amber/50 bg-amber/10 text-amber" : "border-white/15 text-muted-foreground"}`}>{b === "hoje" ? "hoje" : dm(t.due_date)}{t.due_time ? ` ${t.due_time.slice(0, 5)}` : ""}</span>}
                        {catName(t.category_id) && !t.client_id && <span className="text-muted-foreground">{catName(t.category_id)}</span>}
                      </p>
                      <TaskThumbs files={t.attachments ?? []} title={t.title} />
                    </div>
                    <button type="button" onClick={() => setEditing(t)} aria-label={`Editar ${t.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                    <button type="button" onClick={() => { if (window.confirm(`Excluir a tarefa "${t.title}"?`)) del.mutate(t.id, { onSuccess: () => toast.success("Tarefa excluída"), onError: (e) => toast.error(e.message) }); }} aria-label={`Excluir ${t.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                  </li>))}
              </ul>
            </section>))}
        </div>
      )}
      {editing && (
        <TaskEditDialog task={editing} categories={cats} clients={clients} saving={update.isPending} onClose={() => setEditing(null)}
          onSave={(patch) => update.mutate({ id: editing.id, patch }, { onSuccess: () => { setEditing(null); toast.success("Tarefa atualizada"); }, onError: (e) => toast.error(e.message) })}
          onDelete={() => { if (window.confirm(`Excluir a tarefa "${editing.title}"?`)) del.mutate(editing.id, { onSuccess: () => { setEditing(null); toast.success("Tarefa excluída"); }, onError: (e) => toast.error(e.message) }); }} />
      )}
    </div>
  );
}
