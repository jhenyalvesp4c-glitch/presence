import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { backdropProps } from "@/lib/backdrop";
import { MeetingsPage } from "@/components/meetings/MeetingsPage";
import { useMeetings } from "@/lib/data/meetings";
import { DocsLibrary } from "@/components/DocsLibrary";
import { ClientsView } from "@/components/ClientsView";
import { useClients } from "@/lib/data/clients";
import type { Project } from "@/lib/projects";
import { nextCode, type DType, type Demand, type Hist, type Priority, type PoloExec, type Status } from "@/lib/demands";
import { loadDemands, loadProjectState, loadProjects, saveDemands, saveDossiers, saveNotesDb, type ProjectState } from "@/lib/data/project-data";
import { useDbState } from "@/lib/data/use-db-state";
import {
  DEFAULT_LABEL, LABEL_PRESETS, defaultProjectId, dossierColor, gender,
  type Dossier, type DossierLabel, type DossierState,
} from "@/lib/dossiers";
import {
  NOTE_COLORS, addNote, deleteNote, editNote, noteDossierName, unlinkDossier,
  type Note, type NoteDraft,
} from "@/lib/notes";
import {
  calendarItems, clearLegacyAppointments, takeLegacyAppointments, type AppointmentDraft, type CalItem,
} from "@/lib/appointments";
import { importAppointments, unlinkDossierAppointments, useDeleteCalendarItem, useSaveAppointment } from "@/lib/data/appointments";
import { addDemandAsTask, useCategories, useDemandTasks, useTasks, useToggleTask } from "@/lib/data/tasks";
import { useQueryClient } from "@tanstack/react-query";
import { FinBackdrop, Tilt } from "@/components/finance/fx";
import { applyMerges, findMergeGroups, mergeGroup, type MergeGroup } from "@/lib/demand-merge";
import type { CheckItem } from "@/lib/demands";
import { Ring, useCountUp } from "@/components/finance/charts";
import { toast } from "sonner";
import { DemandCalendar } from "@/components/demand-calendar";
import { DemandMaterials, NewDemandMaterials } from "@/components/demand-materials";
import { EMPTY_MATERIALS, deleteMaterials, materialsKey, moveMaterials, putMaterials, type Materials } from "@/lib/demand-materials";
import { createPortal } from "react-dom";
import { DictateButton, appendSpoken } from "@/components/DictateButton";
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Atom, Hourglass, ListChecks, Play, RotateCcw, Users, Calendar, Check, CheckCircle2, CheckSquare, ChevronDown, ChevronRight, Circle, Clock, FileText,
  Filter, Folder, FolderOpen, Globe, Hexagon, History, LayoutGrid, Layers, List, Loader, MapPin,
  Mic, MessageSquare, MoreHorizontal, Network, Pencil, Plus, Search, Send, SquareCheck, StickyNote, Table2, Trash2, X,
} from "lucide-react";

export const Route = createFileRoute("/demandas")({
  validateSearch: (s: Record<string, unknown>): { projeto?: string | undefined; aba?: string | undefined; secao?: string | undefined } => ({
    projeto: typeof s["projeto"] === "string" ? (s["projeto"] as string) : undefined,
    aba: ["notas", "docs", "dossies", "agenda", "reunioes", "clientes"].includes(String(s["aba"])) ? String(s["aba"]) : undefined,
    secao: ["lib", "tre", "cli", "pla"].includes(String(s["secao"])) ? String(s["secao"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Demandas · P4C" },
      { name: "description", content: "Kanban do projeto P4C com demandas gerais, por polo e multipolo, e painel de detalhes de cada demanda." },
      { property: "og:title", content: "Demandas · P4C" },
      { property: "og:description", content: "Demandas gerais, por polo e multipolo com acompanhamento individual de cada polo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Demandas,
});

/* ---------------- tipos ---------------- */

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const statusMeta: Record<Status, { label: string; color: string; poloLabel: string }> = {
  todo: { label: "A fazer", color: "amber", poloLabel: "Não iniciado" },
  doing: { label: "Em andamento", color: "cyan", poloLabel: "Em andamento" },
  done: { label: "Concluídas", color: "emerald", poloLabel: "Concluído" },
};
const prio: Record<Priority, { label: string; color: string }> = {
  alta: { label: "Alta", color: "pink" }, media: { label: "Média", color: "amber" }, baixa: { label: "Baixa", color: "emerald" },
};
const typeBase: Record<DType, { color: string; icon: typeof Globe; prefix: string }> = {
  geral: { color: "cyan", icon: Globe, prefix: "G" },
  polo: { color: "violet", icon: MapPin, prefix: "P" },
  multi: { color: "emerald", icon: Network, prefix: "M" },
};
/** Os textos seguem o nome que o projeto dá aos dossiês (Polos, Clientes, Turmas…). */
const LabelCtx = createContext<DossierLabel>(DEFAULT_LABEL);
const useLabel = () => useContext(LabelCtx);
/** Lápis e lixeira dos cartões: abrir para editar e excluir (com confirmação). */
type Actions = { edit: (id: string) => void; del: (id: string) => void; selecting: boolean; picked: Set<string>; toggle: (id: string) => void; move: (id: string, s: Status) => void };
const ActionsCtx = createContext<Actions>({ edit: () => {}, del: () => {}, selecting: false, picked: new Set(), toggle: () => {}, move: () => {} });
const DRAG = "text/orion-demanda";
function CardActions({ id, status, pos = "right-1.5 top-1.5" }: { id: string; status?: Status; pos?: string }) {
  const a = useContext(ActionsCtx);
  if (a.selecting) {
    const on = a.picked.has(id);
    return (
      <span className={`absolute ${pos} z-10`}>
        <button onClick={(e) => { e.stopPropagation(); a.toggle(id); }} role="checkbox" aria-checked={on} aria-label={`Selecionar ${id}`}
          className={`grid h-5 w-5 place-items-center rounded-md border transition ${on ? "border-cyan bg-cyan text-background" : "border-border bg-background/70 text-transparent hover:border-cyan"}`}>
          <Check size={12} />
        </button>
      </span>
    );
  }
  return (
    <span className={`absolute ${pos} z-10 flex gap-0.5 opacity-100 transition md:opacity-0 md:group-hover/card:opacity-100 md:focus-within:opacity-100`}>
      {status === "todo" && <button onClick={(e) => { e.stopPropagation(); a.move(id, "doing"); }} aria-label={`Iniciar ${id}`} title="Iniciar (em andamento)" data-testid="card-iniciar" className="rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur transition hover:text-amber"><Play size={11} /></button>}
      {status && status !== "done" && <button onClick={(e) => { e.stopPropagation(); a.move(id, "done"); }} aria-label={`Concluir ${id}`} title="Concluir" data-testid="card-concluir" className="rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur transition hover:text-emerald"><CheckCircle2 size={11} /></button>}
      {status === "done" && <button onClick={(e) => { e.stopPropagation(); a.move(id, "todo"); }} aria-label={`Reabrir ${id}`} title="Reabrir (a fazer)" data-testid="card-reabrir" className="rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur transition hover:text-cyan"><RotateCcw size={11} /></button>}
      <button onClick={(e) => { e.stopPropagation(); a.edit(id); }} aria-label={`Editar ${id}`} title="Editar" className="rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur transition hover:text-cyan"><Pencil size={11} /></button>
      <button onClick={(e) => { e.stopPropagation(); a.del(id); }} aria-label={`Excluir ${id}`} title="Excluir" className="rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur transition hover:text-destructive"><Trash2 size={11} /></button>
    </span>
  );
}
type TypeMeta = { label: string; short: string; sub: string; color: string; icon: typeof Globe; prefix: string };
const useTM = () => typeMetaFor(useLabel());
function typeMetaFor(L: DossierLabel): Record<DType, TypeMeta> {
  const g = gender(L);
  const sing = L.singular.toLowerCase();
  const plur = L.plural.toLowerCase();
  return {
    geral: { ...typeBase.geral, label: "Demandas gerais", short: "Geral", sub: `Sem vínculo com ${plur}` },
    polo: { ...typeBase.polo, label: `Demandas por ${sing}`, short: `${g.um} ${sing}`, sub: `Destinadas a ${g.um.toLowerCase()} único ${sing}`.replace("único", g.um === "Uma" ? "única" : "único") },
    multi: { ...typeBase.multi, label: `Demandas multi${sing}`, short: `${g.varios} ${plur}`, sub: `Execução individual por ${sing}` },
  };
}
const STATUSES: Status[] = ["todo", "doing", "done"];
const multiStatus = (p: PoloExec[]): Status => (!p.length ? "todo" : p.every((x) => x.status === "done") ? "done" : p.some((x) => x.status !== "todo") ? "doing" : "todo");
const today = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/* ---------------- página ---------------- */
function Demandas() {
  const { projeto, aba: abaUrl, secao: secaoUrl } = Route.useSearch();
  // Projeto atual: o do `?projeto=` se existir no banco; senão o padrão (P4C).
  const [known, setKnown] = useState<Project[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadProjects().then((l) => alive && setKnown(l)).catch(() => alive && setKnown([]));
    return () => { alive = false; };
  }, []);
  const pid: string | null = known === null ? null : projeto && known.some((p) => p.id === projeto) ? projeto : defaultProjectId();
  const project = known?.find((x) => x.id === pid);
  // Dossiês (polos no P4C) e notas do projeto: no banco.
  const [st, setSt, stReady] = useDbState<ProjectState>(
    pid, { ds: { label: DEFAULT_LABEL, dossiers: [] }, notes: [] },
    () => loadProjectState(pid!),
    async (prev, next) => {
      if (prev.ds !== next.ds) await saveDossiers(pid!, prev.ds, next.ds);
      if (prev.notes !== next.notes) await saveNotesDb(pid!, prev.notes, next.notes);
    },
  );
  const ds = st.ds;
  const notes = st.notes;
  const changeDs = (n: DossierState) => setSt((s) => ({ ...s, ds: n }));
  const L = ds.label;
  const names = ds.dossiers.map((x) => x.name);
  const tm = typeMetaFor(L);
  const [items, setItems, itemsReady] = useDbState<Demand[]>(pid, [], () => loadDemands(pid!), (p, n) => saveDemands(pid!, p, n));
  const ready = pid !== null && stReady && itemsReady;
  const [tab, setTab] = useState<"overview" | DType | "notas" | "docs" | "dossies" | "agenda" | "reunioes" | "clientes">((abaUrl as "docs" | undefined) ?? (secaoUrl === "cli" ? "clientes" : "overview"));
  useEffect(() => { if (abaUrl) setTab(abaUrl as "docs"); }, [abaUrl, secaoUrl]);
  const [view, setView] = useState<"kanban" | "lista" | "matriz">("kanban");
  const [prioF, setPrioF] = useState<"todas" | Priority>("todas");
  const [typeF, setTypeF] = useState<"todos" | DType>("todos");
  const [statusF, setStatusF] = useState<"todos" | "pend" | Status>("todos");
  const [poloF, setPoloF] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState<{ type: DType; status: Status } | null>(null);
  const [editOnOpen, setEditOnOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  // Notas: salvas no banco por projeto; cada uma pode estar ligada a um dossiê ou ser geral.
  const changeNotes = (f: (n: Note[]) => Note[]) => setSt((s) => ({ ...s, notes: f(s.notes) }));
  const [noteEdit, setNoteEdit] = useState<Note | "new" | null>(null);
  const saveNote = (d: NoteDraft) => {
    if (noteEdit === "new") changeNotes((xs) => addNote(xs, d, today()));
    else if (noteEdit) changeNotes((xs) => editNote(xs, noteEdit.id, d));
    setNoteEdit(null);
  };
  const removeNote = (n: Note) => {
    if (!window.confirm(`Excluir a nota "${n.text.slice(0, 40) || "Nota vazia"}"?`)) return;
    changeNotes((xs) => deleteNote(xs, n.id));
  };
  // Calendário: compromissos salvos por projeto; cada um pode estar ligado a um dossiê ou ser geral.
  // Ficam no banco como tarefas da categoria Compromissos, por isso entram no "Organize/Planeje meu dia".
  const qc = useQueryClient(), navigate = useNavigate();
  const tasksQ = useTasks();
  const demandTasks = useDemandTasks(pid);
  const catsQ = useCategories();
  const compId = (catsQ.data ?? []).find((c) => c.slug === "comp")?.id;
  const appts = useMemo(() => calendarItems(tasksQ.data ?? [], compId), [tasksQ.data, compId]);
  const saveApptM = useSaveAppointment(compId, pid ?? defaultProjectId());
  const delTask = useDeleteCalendarItem();
  const toggleTask = useToggleTask();
  // Compromissos antigos que estavam só neste navegador sobem para o banco uma única vez.
  useEffect(() => {
    if (!compId || !pid) return;
    const legacy = takeLegacyAppointments(pid);
    if (!legacy.length) return;
    clearLegacyAppointments(pid);
    importAppointments(legacy, compId, pid).then(() => qc.invalidateQueries({ queryKey: ["tasks"] })).catch((e: Error) => toast.error(`Não consegui salvar os compromissos antigos: ${e.message}`));
  }, [compId, pid]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveAppt = (draft: AppointmentDraft, id?: string) =>
    saveApptM.mutate({ draft, id }, { onSuccess: () => toast.success(id ? "Compromisso atualizado" : "Compromisso marcado"), onError: (e) => toast.error(`Não consegui salvar: ${e.message}`) });
  const removeAppt = (a: CalItem) => {
    if (!window.confirm(`Excluir ${a.kind === "compromisso" ? "o compromisso" : "a tarefa"} "${a.title}"?`)) return;
    delTask.mutate(a.id, { onError: (e) => toast.error(`Não consegui excluir: ${e.message}`) });
  };
  const toggleAppt = (a: CalItem) => toggleTask.mutate({ id: a.id, done: !a.done }, { onError: (e) => toast.error(e.message) });
  const noteProps = { notes, dossiers: ds.dossiers, onNew: () => setNoteEdit("new" as const), onEdit: setNoteEdit, onDelete: removeNote };

  const sel = items.find((i) => i.id === selId) ?? null;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setSelId(null); setNewOpen(null); setNoteEdit(null); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const filtered = useMemo(() => items.filter((i) => {
    if (prioF !== "todas" && i.priority !== prioF) return false;
    if (typeF !== "todos" && i.type !== typeF) return false;
    // Com um dossiê escolhido, "pendente" vale para a execução daquele dossiê.
    const st = poloF ? (i.polo === poloF ? i.status : i.polos?.find((p) => p.name === poloF)?.status ?? i.status) : i.status;
    if (statusF === "pend" ? st === "done" : statusF !== "todos" && i.status !== statusF) return false;
    if (poloF && i.polo !== poloF && !i.polos?.some((p) => p.name === poloF)) return false;
    if (q && !`${i.id} ${i.title} ${i.polo ?? ""} ${i.polos?.map((p) => p.name).join(" ") ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, prioF, typeF, statusF, poloF, q]);

  const update = (id: string, fn: (d: Demand) => Demand) =>
    setItems((xs) => xs.map((x) => {
      if (x.id !== id) return x;
      const n = fn(x);
      return n.type === "multi" && n.polos ? { ...n, status: multiStatus(n.polos) } : n;
    }));

  const sing = L.singular.toLowerCase();
  const setStatus = (id: string, s: Status) => update(id, (d) => ({
    ...d, status: s,
    polos: d.polos?.map((p) => (s === "done" ? { ...p, status: "done", date: p.date ?? today() } : s === "todo" ? { ...p, status: "todo", date: undefined } : p)),
    history: [...d.history, { d: today(), text: `Status alterado para ${statusMeta[s].label.replace(/s$/, "")}`, s }],
  }));
  /** Arrastar o cartão para outra coluna (ou tocar em Iniciar/Concluir no cartão): muda o status sem abrir a demanda. */
  const moveCard = (id: string, s: Status) => {
    const cur = items.find((x) => x.id === id);
    if (!cur || cur.status === s) return;
    setStatus(id, s);
    toast.success(`${id} · ${statusMeta[s].label}`, { duration: 3000, action: { label: "Desfazer", onClick: () => setStatus(id, cur.status) } });
  };
  const cyclePolo = (id: string, name: string) => update(id, (d) => {
    const cur = d.polos!.find((p) => p.name === name)!;
    const nx: Status = cur.status === "todo" ? "doing" : cur.status === "doing" ? "done" : "todo";
    return {
      ...d,
      polos: d.polos!.map((p) => (p.name === name ? { ...p, status: nx, date: nx === "done" ? today() : undefined } : p)),
      history: [...d.history, { d: today(), text: nx === "done" ? `Concluído em ${name}.` : nx === "doing" ? `Iniciado em ${name}.` : `${name} reaberto.`, s: nx }],
    };
  });
  /** Clique numa célula da matriz: avança o status daquele dossiê (ou da demanda, se for de um único dossiê). */
  const cycleCell = (id: string, name: string) => {
    const d = items.find((x) => x.id === id);
    if (!d) return;
    if (d.polos) cyclePolo(id, name);
    else setStatus(id, d.status === "todo" ? "doing" : d.status === "doing" ? "done" : "todo");
  };
  const addPolos = (id: string, add: string[]) => update(id, (d) => {
    const have = new Set(d.polos?.map((p) => p.name));
    const fresh = add.filter((n) => !have.has(n));
    if (!fresh.length) return d;
    return {
      ...d, polos: [...(d.polos ?? []), ...fresh.map((name) => ({ name, status: "todo" as Status }))],
      history: [...d.history, { d: today(), text: `${fresh.length} ${fresh.length === 1 ? sing : L.plural.toLowerCase()} adicionado${fresh.length === 1 ? "" : "s"}: ${fresh.join(", ")}.`, s: "todo" }],
    };
  });
  const setPoloNote = (id: string, name: string, note: string) => update(id, (d) => ({ ...d, polos: d.polos?.map((p) => (p.name === name ? { ...p, note } : p)) }));
  const dropMaterials = (codes: Iterable<string>) => { if (pid) for (const c of codes) deleteMaterials(materialsKey(pid, c)).catch(() => undefined); };
  /** Põe a demanda também na lista de Tarefas (categoria "Demandas"); só uma vez por demanda. */
  const addToTasks = async (d: Demand) => {
    if (!pid) return;
    try {
      const r = await addDemandAsTask(pid, d);
      void qc.invalidateQueries({ queryKey: ["tasks"] }); void qc.invalidateQueries({ queryKey: ["categories"] }); void qc.invalidateQueries({ queryKey: ["demand-tasks"] });
      toast.success(r.created ? "Adicionada às Tarefas, na categoria Demandas" : "Essa demanda já está nas Tarefas", { action: { label: "Ver tarefas", onClick: () => void navigate({ to: "/tarefas" }) } });
    } catch (e) { toast.error(`Não consegui adicionar às Tarefas: ${(e as Error).message}`); }
  };
  const createDemand = (f: { type: DType; title: string; desc: string; priority: Priority; deadline: string; targets: string[]; status: Status; materials: Materials; checklist?: string[]; addTask?: boolean }) => {
    const multi = f.type === "multi";
    const d: Demand = {
      id: nextCode(items, f.type), type: f.type, title: f.title, desc: f.desc || "Sem descrição.", priority: f.priority, status: f.status,
      deadline: f.deadline || "—", polo: f.type === "polo" ? f.targets[0] : undefined,
      polos: multi ? f.targets.map((name) => ({ name, status: "todo" as Status })) : undefined,
      ...(f.checklist?.length ? { checklist: f.checklist.map((text) => ({ text: text.slice(0, 500), done: false })) } : {}),
      history: [{ d: today(), text: multi ? `Demanda criada para ${f.targets.length} ${f.targets.length === 1 ? sing : L.plural.toLowerCase()}` : "Demanda criada", s: "todo" }], notes: [],
    };
    setItems((xs) => [d, ...xs]);
    if (pid && (f.materials.body.trim() || f.materials.files.length)) {
      putMaterials(materialsKey(pid, d.id), f.materials).catch((e: Error) => toast.error(`Não consegui guardar os anexos: ${e.message}`));
    }
    if (pid && f.addTask) void addToTasks(d);
    setNewOpen(null);
    setTab("overview"); setTypeF((cur) => (cur === "todos" || cur === f.type ? cur : "todos"));
    setSelId(d.id);
  };
  const [mergeOpen, setMergeOpen] = useState(false);
  const mergeGroups = useMemo(() => findMergeGroups(items), [items]);
  const doMerge = async (groups: MergeGroup[]) => {
    setMergeOpen(false);
    try {
      if (pid) for (const g of groups) await moveMaterials(pid, g.items[0]!.id, g.items.slice(1).map((x) => x.id));
      setItems((xs) => applyMerges(xs, groups));
      setSelId((c) => (c && groups.some((g) => g.items.slice(1).some((x) => x.id === c)) ? null : c));
      toast.success(`${groups.length} ${groups.length === 1 ? "grupo juntado" : "grupos juntados"}: o checklist está dentro da demanda`);
    } catch (e) { toast.error(`Não consegui juntar: ${(e as Error).message}`); }
  };
  const remove = (id: string) => { dropMaterials([id]); setItems((xs) => xs.filter((x) => x.id !== id)); setSelId((c) => (c === id ? null : c)); };
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };
  const deletePicked = () => {
    if (!picked.size) return;
    if (!window.confirm(`Excluir ${picked.size} demanda${picked.size === 1 ? "" : "s"}? Isso não pode ser desfeito.`)) return;
    dropMaterials(picked);
    setItems((xs) => xs.filter((x) => !picked.has(x.id)));
    setSelId((c) => (c && picked.has(c) ? null : c));
    stopSelecting();
  };
  const openCard = (id: string) => { if (selecting) { toggle(id); return; } setEditOnOpen(false); setSelId(id); };
  const editCard = (id: string) => { setEditOnOpen(true); setSelId(id); };
  const deleteCard = (id: string) => {
    const d = items.find((x) => x.id === id);
    if (d && window.confirm(`Excluir a demanda "${d.title}"?`)) remove(id);
  };
  /** Ação em massa nas demandas que estão na tela (aba atual e filtros). */
  const bulk = (kind: "reset" | "done" | "delete") => {
    const ids = new Set(boardItems(tab).map((d) => d.id));
    if (!ids.size) return;
    const verb = kind === "delete" ? "Apagar" : kind === "done" ? "Marcar como concluídas" : "Zerar (voltar para A fazer)";
    if (!window.confirm(`${verb} ${ids.size} demanda${ids.size === 1 ? "" : "s"}? ${kind === "delete" ? "Isso não pode ser desfeito." : ""}`.trim())) return;
    setBulkOpen(false);
    if (kind === "delete") { dropMaterials(ids); setItems((xs) => xs.filter((x) => !ids.has(x.id))); setSelId((c) => (c && ids.has(c) ? null : c)); return; }
    const st: Status = kind === "done" ? "done" : "todo";
    setItems((xs) => xs.map((d) => (!ids.has(d.id) ? d : {
      ...d, status: st,
      polos: d.polos?.map((p) => ({ ...p, status: st, date: st === "done" ? p.date ?? today() : undefined })),
      history: [...d.history, { d: today(), text: kind === "done" ? "Marcada como concluída (ação em massa)" : "Zerada: voltou para A fazer (ação em massa)", s: st }],
    })));
  };

  // Cadastro de dossiês: renomear e excluir se refletem nas demandas.
  const renameDossier = (o: string, n: string) => {
    setItems((xs) => xs.map((d) => ({ ...d, polo: d.polo === o ? n : d.polo, polos: d.polos?.map((p) => (p.name === o ? { ...p, name: n } : p)) })));
    setPoloF((f) => (f === o ? n : f));
  };
  const removeDossier = (name: string) => {
    setItems((xs) => xs.map((d) => {
      const polos = d.polos?.filter((p) => p.name !== name);
      return { ...d, polo: d.polo === name ? undefined : d.polo, polos, status: d.type === "multi" && polos ? multiStatus(polos) : d.status };
    }));
    setPoloF((f) => (f === name ? null : f));
    const gone = ds.dossiers.find((x) => x.name === name);
    if (gone) { changeNotes((xs) => unlinkDossier(xs, gone.id)); unlinkDossierAppointments(pid ?? defaultProjectId(), gone.id).then(() => qc.invalidateQueries({ queryKey: ["tasks"] })).catch(() => {}); }
  };
  const usage = (name: string) => items.filter((d) => d.polo === name || d.polos?.some((p) => p.name === name)).length;

  const count = (t: DType, s?: Status) => items.filter((i) => i.type === t && (!s || i.status === s)).length;
  const pend = items.filter((i) => i.status !== "done").length;
  const done = items.length - pend;

  const clientsQ = useClients(pid ?? defaultProjectId());
  const meetingsQ = useMeetings(), meetingCount = (meetingsQ.data ?? []).filter((m) => m.dossierProject === (pid ?? defaultProjectId())).length;
  const tabs = [
    { k: "overview" as const, label: "Visão geral", sub: "Todos os tipos", icon: LayoutGrid, color: "cyan", n: items.length },
    { k: "agenda" as const, label: "Calendário", sub: "Compromissos", icon: Calendar, color: "emerald", n: appts.length },
    { k: "dossies" as const, label: L.plural, sub: "Cadastro", icon: Folder, color: "pink", n: ds.dossiers.length },
    { k: "docs" as const, label: "Documentação", sub: "Biblioteca", icon: FolderOpen, color: "violet", n: 19 },
    { k: "reunioes" as const, label: "Reuniões", sub: "Atas e decisões", icon: Mic, color: "violet", n: meetingCount },
    { k: "clientes" as const, label: "Clientes", sub: "Carteira e fichas", icon: Users, color: "amber", n: clientsQ.data?.length ?? 0 },
  ];
  const filterBar = tab !== "notas" && tab !== "clientes" && tab !== "docs" && tab !== "dossies" && tab !== "agenda" && tab !== "reunioes";
  const boardItems = (t: typeof tab) => filtered.filter((i) => t === "overview" || i.type === t);

  return (
    <LabelCtx.Provider value={L}>
    <ActionsCtx.Provider value={{ edit: editCard, del: deleteCard, selecting, picked, toggle, move: moveCard }}>
    <div className="rail-bleed relative min-h-screen overflow-x-clip">
      <FinBackdrop />
      <BgFx />
      <div className={`relative mx-auto max-w-[1500px] px-4 py-4 transition-[padding] duration-500 max-md:pb-40 md:px-8 md:py-6 ${sel ? "xl:pr-[500px]" : ""}`}>
        {/* topo */}
        <header className="fin-frame glass relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[2rem] p-4 animate-rise md:gap-6 md:p-6" style={{ boxShadow: "inset 0 1px 0 oklch(1 0 0 / 7%), 0 40px 100px -56px var(--cyan)" }} data-testid="topo-projeto">
          <div aria-hidden className="fin-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,#000,transparent_70%)]" />
          <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[var(--cyan)] opacity-20 blur-3xl" /><span aria-hidden className="pointer-events-none absolute -bottom-28 right-10 h-64 w-64 rounded-full bg-[var(--violet)] opacity-20 blur-3xl" />
          <div className="flex items-center gap-3 md:gap-5">
            <Link to="/projetos" className="icon-tile h-11 w-11 md:h-9 md:w-9 transition hover:scale-105" style={tint("cyan")} aria-label="Voltar aos projetos" title="Voltar aos projetos"><ArrowLeft size={15} /></Link>
            <div className="max-md:hidden"><HexLogo /></div>
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-5xl"><span className="text-gradient">{project?.name ?? "P4C"}</span><span className="glow-text" style={tint(project?.color ?? "cyan")}>.</span></h1>
              <p className="mono-caps !tracking-[0.4em] max-md:hidden">Projeto</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald"><span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-emerald shadow-[0_0_8px_var(--emerald)]" /> Ativo</p>
            </div>
            <div className="ml-2 hidden max-w-xs border-l border-border pl-5 md:block">
              <p className="text-sm text-foreground/90">Juntos por {L.plural.toLowerCase()} mais fortes.</p>
              <p className="text-xs text-muted-foreground">Gestão de demandas, {L.plural.toLowerCase()} e execuções com organização, clareza e foco.</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-4 md:w-auto">
            <button onClick={() => setNewOpen({ type: "geral", status: "todo" })} data-testid="nova-demanda" disabled={!ready}
              className="disabled:opacity-50 max-md:hidden flex items-center gap-2 rounded-2xl border border-cyan/60 bg-cyan/10 px-4 py-3 text-sm font-medium text-cyan shadow-[0_0_30px_-8px_var(--cyan)] transition hover:bg-cyan/20">
              <Plus size={16} /> Nova demanda
            </button>
            <div className="relative grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 md:w-auto" data-testid="kpis">
              {[{ v: pend, l: "pendentes", c: "amber", p: items.length ? (pend / items.length) * 100 : 0 }, { v: done, l: "concluídas", c: "emerald", p: items.length ? (done / items.length) * 100 : 0 }, { v: notes.length, l: "anotações", c: "violet", p: Math.min(100, notes.length * 10) }, { v: ds.dossiers.length, l: L.plural.toLowerCase(), c: "cyan", p: Math.min(100, ds.dossiers.length * 4) }].map((s2, i) => <Kpi key={s2.l} {...s2} i={i} />)}
            </div>
          </div>
          <div className="relative flex w-full items-center gap-3 border-t border-white/10 pt-3 text-xs text-muted-foreground" data-testid="execucao-geral">
            <span className="mono-caps !text-[0.62rem]">Execução geral</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full transition-[width] duration-1000" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%`, background: "linear-gradient(90deg, var(--emerald), var(--cyan), var(--violet))", boxShadow: "0 0 14px var(--cyan)" }} /></span>
            <span className="font-mono tabular-nums text-foreground">{items.length ? Math.round((done / items.length) * 100) : 0}%</span>
            <span className="max-md:hidden">{done} de {items.length} demandas</span>
          </div>
        </header>

        {/* abas de tipo */}
        <nav className="mt-4 animate-rise max-md:sticky max-md:top-0 max-md:z-30 max-md:-mx-4 max-md:flex max-md:snap-x max-md:gap-2 max-md:overflow-x-auto max-md:border-b max-md:border-white/5 max-md:bg-background/95 max-md:px-4 max-md:py-2.5 max-md:backdrop-blur-xl max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden md:mt-6 md:grid md:grid-cols-3 md:gap-3" style={{ animationDelay: ".05s" }} data-testid="abas-demandas">
          {tabs.map((t) => {
            const on = tab === t.k;
            return (
              <button key={t.k} onClick={(e) => { setTab(t.k); e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }} style={tint(t.color)}
                className={`accent-card card-sheen group flex items-center gap-3 !rounded-2xl p-3 text-left max-md:shrink-0 max-md:snap-center max-md:gap-2 max-md:!rounded-full max-md:!py-2 max-md:!pl-2 max-md:!pr-3 ${on ? "!border-[color-mix(in_oklab,var(--glow)_70%,transparent)] shadow-[0_0_40px_-12px_var(--glow)]" : "opacity-80 hover:opacity-100"}`}>
                <span className={`icon-tile h-10 w-10 shrink-0 !rounded-full transition max-md:!h-8 max-md:!w-8 group-hover:rotate-12 ${on ? "shadow-[0_0_20px_-4px_var(--glow)]" : ""}`}><t.icon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold max-md:whitespace-nowrap">{t.label}</span>
                  <span className="block truncate text-[0.65rem] text-muted-foreground max-md:hidden">{t.sub}</span>
                </span>
                <CountTag n={t.n} />
                {on && <span className="absolute inset-x-6 bottom-0 h-px bg-[var(--glow)] shadow-[0_0_12px_var(--glow)]" />}
              </button>
            );
          })}
        </nav>

        {filterBar && (
          <div className="relative z-30 mt-3 flex flex-wrap items-center gap-2 animate-rise md:mt-4" style={{ animationDelay: ".1s" }}>
            <label className="glass order-first flex w-full items-center gap-2 rounded-xl px-3.5 py-3 md:hidden">
              <Search size={15} className="text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar demanda, ${sing} ou código…`} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Limpar busca"><X size={14} /></button>}
            </label>
            <div className="glass flex rounded-xl p-1 max-md:w-full">
              {([["kanban", "Kanban", LayoutGrid], ["lista", "Lista", List], ["matriz", "Matriz", Table2]] as const).map(([k, l, I]) => (
                <button key={k} onClick={() => setView(k)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition max-md:flex-1 max-md:justify-center max-md:py-2.5 max-md:text-sm ${view === k ? "bg-cyan/15 text-cyan shadow-[0_0_16px_-6px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}><I size={13} /> {l}</button>
              ))}
            </div>
            <div className="contents max-md:flex max-md:w-full max-md:gap-2 max-md:overflow-x-auto max-md:pb-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden">
            {tab === "overview" && <Pick label="Tipo" value={typeF} onChange={(v) => setTypeF(v as typeof typeF)} options={[["todos", "Todos"], ["geral", tm.geral.short], ["polo", tm.polo.short], ["multi", tm.multi.short]]} />}
            <Pick label="Prioridade" value={prioF} onChange={(v) => setPrioF(v as typeof prioF)} options={[["todas", "Todas"], ["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]]} />
            <Pick label="Status" value={statusF} onChange={(v) => setStatusF(v as typeof statusF)} options={[["todos", "Todos"], ["pend", "Só pendentes"], ["todo", "A fazer"], ["doing", "Em andamento"], ["done", "Concluídas"]]} />
            <Pick label={L.singular} value={poloF ?? ""} onChange={(v) => setPoloF(v || null)} options={[["", "Todos"], ...names.map((n): [string, string] => [n, n])]} />
            </div>
            {poloF && <button onClick={() => setPoloF(null)} className="tag flex items-center gap-1" style={tint(dossierColor(names, poloF))}><MapPin size={10} /> {poloF} <X size={10} /></button>}
            <button onClick={() => (selecting ? stopSelecting() : (setSelecting(true), setSelId(null)))} data-testid="selecionar" className={`glass max-md:hidden flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition hover:border-cyan/40 ${selecting ? "border-cyan/60 text-cyan" : ""}`}><CheckSquare size={13} /> {selecting ? "Cancelar seleção" : "Selecionar"}</button>
            <div className="relative max-md:hidden">
              <button onClick={() => setBulkOpen((o) => !o)} data-testid="acoes-massa" className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition hover:border-cyan/40"><Layers size={13} /> Ações em massa <ChevronDown size={12} className={`transition ${bulkOpen ? "rotate-180" : ""}`} /></button>
              {bulkOpen && (
                <div className="glass absolute left-0 top-full z-30 mt-2 w-72 rounded-xl p-1 animate-in fade-in zoom-in-95">
                  <p className="px-2 py-1.5 text-[0.65rem] text-muted-foreground">Vale para as <b className="text-foreground">{boardItems(tab).length}</b> demandas que estão na tela agora (respeita aba e filtros).</p>
                  <button onClick={() => bulk("reset")} data-testid="massa-zerar" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-secondary"><History size={13} className="text-amber" /> Zerar: voltar tudo para “A fazer”</button>
                  <button onClick={() => bulk("done")} data-testid="massa-concluir" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-secondary"><CheckCircle2 size={13} className="text-emerald" /> Marcar tudo como concluído</button>
                  <button onClick={() => bulk("delete")} data-testid="massa-apagar" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-destructive hover:bg-secondary"><Trash2 size={13} /> Apagar tudo</button>
                </div>
              )}
            </div>
            <label className="glass ml-auto flex min-w-[220px] flex-1 items-center gap-2 rounded-xl px-3 py-2 max-md:hidden sm:max-w-sm">
              <Search size={14} className="text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar demanda, ${sing} ou código…`} className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
              {q && <button onClick={() => setQ("")}><X size={12} /></button>}
            </label>
          </div>
        )}

        <main className="mt-5">
          {!ready ? (
            <div className="glass grid place-items-center gap-3 rounded-3xl p-16 text-sm text-muted-foreground animate-rise" data-testid="carregando">
              <Loader size={22} className="animate-[spin_3s_linear_infinite] text-cyan" /> Carregando suas demandas…
            </div>
          ) : tab === "reunioes" ? (
            <MeetingsPage embedded projectId={pid ?? defaultProjectId()} />
          ) : tab === "clientes" ? (
            <ClientsView projectId={pid ?? defaultProjectId()} />
          ) : tab === "docs" ? (
            <DocsLibrary projectId={pid ?? defaultProjectId()} initialSection={secaoUrl as "lib" | "tre" | "cli" | "pla" | undefined} onOpenClients={() => setTab("clientes")} />
          ) : tab === "agenda" ? (
            <DemandCalendar items={appts} dossiers={ds.dossiers} label={L} onSave={saveAppt} onDelete={removeAppt} onToggle={toggleAppt} saving={saveApptM.isPending} />
          ) : tab === "notas" ? (
            <NotesBoard {...noteProps} />
          ) : tab === "dossies" ? (
            <DossierManager state={ds} onChange={changeDs} usage={usage} onRename={renameDossier} onRemove={removeDossier} />
          ) : view === "lista" ? (
            <ListView items={boardItems(tab)} selId={selId} onOpen={openCard} />
          ) : view === "matriz" ? (
            <Matrix items={boardItems(tab)} names={names} selId={selId} onOpen={openCard} onCell={cycleCell} />
          ) : tab === "overview" ? (
            <div className="grid gap-4 2xl:grid-cols-[1fr_270px]">
              <section className="fin-frame glass glass-clear relative overflow-hidden rounded-3xl p-4 animate-rise max-md:rounded-2xl max-md:p-3">
                <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[var(--violet)] opacity-20 blur-3xl" style={{ animation: "fin-aurora 20s ease-in-out infinite" }} />
                <div aria-hidden className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-[var(--cyan)] opacity-[0.14] blur-3xl" style={{ animation: "fin-aurora 24s ease-in-out infinite reverse" }} />
                <div className="relative mb-4 flex flex-wrap items-center gap-3">
                  <span className="relative grid h-9 w-9 place-items-center"><span aria-hidden className="absolute inset-0 rounded-full border border-cyan/50" style={{ animation: "pulse-ring 2.6s ease-out infinite" }} /><span className="icon-tile h-9 w-9 !rounded-full shadow-[0_0_22px_-6px_var(--cyan)]" style={tint("cyan")}><Layers size={16} /></span></span>
                  <h2 className="font-display text-lg font-semibold">Demandas por tipo</h2>
                  <span className="tag" style={tint("violet")}>{typeF === "todos" ? "3 categorias" : tm[typeF].short} · {filtered.length} demandas</span>
                  {mergeGroups.length > 0 && <button onClick={() => setMergeOpen(true)} data-testid="juntar-demandas" className="tag inline-flex items-center gap-1 transition hover:-translate-y-0.5 hover:brightness-125 active:scale-95" style={tint("cyan")}><CheckSquare size={11} /> Juntar do mesmo {L.singular.toLowerCase()} ({mergeGroups.length})</button>}
                  {filtered.length > 0 && <span className="ml-auto flex items-center gap-2.5" data-testid="resumo-geral"><Ring pct={Math.round((filtered.filter((x) => x.status === "done").length / filtered.length) * 100)} color="var(--emerald)" size={44} thickness={5}><span className="text-[0.6rem] font-semibold tabular-nums">{Math.round((filtered.filter((x) => x.status === "done").length / filtered.length) * 100)}%</span></Ring><span className="hidden text-[0.68rem] leading-tight text-muted-foreground sm:block">concluído<br />no total</span></span>}
                </div>
                <div className={`grid items-start gap-4 max-md:-mx-4 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:gap-3 max-md:overflow-x-auto max-md:px-4 max-md:pb-2 max-md:pt-2 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden ${typeF !== "todos" ? "lg:grid-cols-1" : sel ? "lg:grid-cols-1 2xl:grid-cols-3" : "lg:grid-cols-3"}`} data-testid="carrossel-tipos">
                  {(["geral", "polo", "multi"] as DType[]).filter((t) => typeF === "todos" || t === typeF).map((t) => (
                    <TypeBoard key={t} type={t} items={filtered.filter((i) => i.type === t)} selId={selId} onOpen={openCard} onCreate={() => setNewOpen({ type: t, status: "todo" })} />
                  ))}
                </div>
              </section>
              <PolosPanel items={items} state={ds} active={poloF} onPick={(p) => setPoloF(p === poloF ? null : p)} onChange={changeDs} usage={usage} onRename={renameDossier} onRemove={removeDossier} />
            </div>
          ) : (
            <FullBoard type={tab} items={filtered.filter((i) => i.type === tab)} selId={selId} onOpen={openCard} onCreate={(s) => setNewOpen({ type: tab, status: s })} />
          )}
        </main>

        {ready && tab === "overview" && <NotesStrip {...noteProps} onMore={() => setTab("notas")} />}
      </div>

      {mergeOpen && <MergeDialog groups={mergeGroups} label={L.singular.toLowerCase()} onCancel={() => setMergeOpen(false)} onConfirm={(g) => void doMerge(g)} />}

      <DetailPanel
        key={`${sel?.id ?? "none"}-${editOnOpen}`} demand={sel} autoEdit={editOnOpen} storageKey={pid && sel ? materialsKey(pid, sel.id) : null} dossiers={names} onClose={() => setSelId(null)}
        onStatus={(s) => sel && setStatus(sel.id, s)} onPolo={(p) => sel && cyclePolo(sel.id, p)}
        onAddPolos={(a) => sel && addPolos(sel.id, a)} onPoloNote={(p, t) => sel && setPoloNote(sel.id, p, t)}
        onEdit={(patch) => sel && update(sel.id, (d) => ({ ...d, ...patch }))}
        onNote={(t) => sel && update(sel.id, (d) => ({ ...d, notes: [...d.notes, t], history: [...d.history, { d: today(), text: "Observação adicionada", s: d.status }] }))}
        onDelete={() => sel && remove(sel.id)}
        inTasks={!!sel && !!demandTasks.data?.has(sel.id)} onAddTask={() => { if (!sel) return; if (demandTasks.data?.has(sel.id)) void navigate({ to: "/tarefas" }); else void addToTasks(sel); }}
      />
      {ready && !sel && !newOpen && !noteEdit && (tab === "overview" || tab === "geral" || tab === "polo" || tab === "multi") && (
        <button onClick={() => setNewOpen({ type: tab === "overview" ? (typeF === "todos" ? "geral" : typeF) : tab, status: "todo" })} data-testid="nova-demanda-fab" aria-label="Nova demanda"
          className="fixed lift-c right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-[0_12px_32px_-6px_var(--cyan)] transition active:scale-95 md:hidden"><Plus size={24} /></button>
      )}
      {selecting && (
        <div className="glass fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 shadow-lg animate-rise">
          <span className="text-xs"><b>{picked.size}</b> selecionada{picked.size === 1 ? "" : "s"}</span>
          <button onClick={() => setPicked(new Set(boardItems(tab).map((d) => d.id)))} className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">Selecionar todas da tela</button>
          <button onClick={deletePicked} disabled={!picked.size} data-testid="excluir-selecionadas" className="flex items-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/25 disabled:opacity-40"><Trash2 size={13} /> Excluir</button>
          <button onClick={stopSelecting} aria-label="Cancelar seleção" className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
        </div>
      )}
      {newOpen && <NewDemandDialog start={newOpen} dossiers={names} onClose={() => setNewOpen(null)} onCreate={createDemand} />}
      {noteEdit && <NoteDialog note={noteEdit === "new" ? null : noteEdit} dossiers={ds.dossiers} onClose={() => setNoteEdit(null)} onSave={saveNote} />}
    </div>
    </ActionsCtx.Provider>
    </LabelCtx.Provider>
  );
}

/* ---------------- nova demanda ---------------- */
/** Seletor de dossiês: um só (radio) ou vários, com "Selecionar todos", "Todos, menos…", busca e contador. */
function TargetPicker({ names, value, onChange, single }: { names: string[]; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  const L = useLabel();
  const g = gender(L);
  const [q, setQ] = useState("");
  const [except, setExcept] = useState(false);
  const shown = names.filter((n) => n.toLowerCase().includes(q.toLowerCase()));
  const toggle = (n: string) => onChange(single ? [n] : value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);
  if (!names.length) return <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Nenhum cadastrado ainda. Cadastre na aba “{L.plural}”.</p>;
  return (
    <div className="rounded-xl border border-border bg-secondary/25 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2 py-1">
          <Search size={12} className="text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${L.singular.toLowerCase()}…`} className="w-full bg-transparent text-xs outline-none" />
        </label>
        {!single && (
          <>
            <button type="button" onClick={() => { onChange([...new Set([...value, ...shown])]); setExcept(false); }} className="tag" style={tint("cyan")}>{q ? "Selecionar resultados" : `Selecionar ${g.todos.toLowerCase()}`}</button>
            <button type="button" onClick={() => { onChange(names); setExcept(true); }} className="tag" style={tint("violet")}>{g.todos}, menos…</button>
            <button type="button" onClick={() => { onChange([]); setExcept(false); }} className="tag" style={tint("amber")}>Limpar</button>
          </>
        )}
      </div>
      {except && !single && <p className="mt-2 text-[0.65rem] text-violet">{g.todos} marcados: desmarque {g.um.toLowerCase() === "uma" ? "as" : "os"} que ficam de fora.</p>}
      <div className="scroll-neon mt-2 grid max-h-48 gap-1.5 overflow-y-auto pr-1.5 sm:grid-cols-2">
        {shown.map((n) => {
          const on = value.includes(n);
          return (
            <label key={n} className={`group/opt flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan/50 ${on ? "border-cyan/60 bg-cyan/10 text-cyan shadow-[0_0_16px_-8px_var(--cyan)]" : "border-border bg-secondary/20 hover:border-cyan/30 hover:bg-secondary/50"}`}>
              <input type={single ? "radio" : "checkbox"} name="alvo" checked={on} onChange={() => toggle(n)} className="sr-only" />
              <span className={`grid h-4 w-4 shrink-0 place-items-center border transition ${single ? "rounded-full" : "rounded-md"} ${on ? "border-cyan bg-cyan text-background" : "border-muted-foreground/40"}`}>{on && <Check size={11} strokeWidth={3} />}</span>
              <span className="truncate">{n}</span>
            </label>
          );
        })}
        {!shown.length && <p className="p-2 text-xs text-muted-foreground">Nada encontrado.</p>}
      </div>
      {!single && <p className="mt-2 text-right text-[0.65rem] text-muted-foreground" data-testid="contador"><b className="text-foreground">{value.length}</b> de {names.length} selecionados</p>}
    </div>
  );
}

function NewDemandDialog({ start, dossiers, onClose, onCreate }: {
  start: { type: DType; status: Status }; dossiers: string[]; onClose: () => void;
  onCreate: (f: { type: DType; title: string; desc: string; priority: Priority; deadline: string; targets: string[]; status: Status; materials: Materials; checklist?: string[]; addTask?: boolean }) => void;
}) {
  const [materials, setMaterials] = useState<Materials>(EMPTY_MATERIALS);
  const tm = useTM();
  const [type, setType] = useState<DType>(start.type);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState(""), [steps, setSteps] = useState(""), [asTask, setAsTask] = useState(false);
  const [priority, setPriority] = useState<Priority>("media");
  const [date, setDate] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const needs = type !== "geral";
  const ok = title.trim().length > 0 && (!needs || targets.length > 0);
  const deadline = date ? date.split("-").reverse().slice(0, 2).join("/") : "";
  const pick = (t: DType) => { setType(t); setTargets((x) => (t === "polo" ? x.slice(0, 1) : t === "geral" ? [] : x)); };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 p-3 backdrop-blur-sm animate-in fade-in max-sm:place-items-end max-sm:p-0 sm:p-4" {...backdropProps(onClose)}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (ok) onCreate({ type, title: title.trim(), desc: desc.trim(), priority, deadline, targets: needs ? targets : [], status: start.status, materials, checklist: steps.split("\n").map((x) => x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean), addTask: asTask }); }}
        className="glass relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl animate-in zoom-in-95 max-sm:max-h-[94dvh] max-sm:rounded-b-none max-sm:pb-[var(--sab)]" role="dialog" aria-label="Nova demanda">
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden" />
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <span className="icon-tile h-10 w-10" style={tint("cyan")}><Plus size={18} /></span>
          <h2 className="flex-1 font-display text-xl font-bold">Nova demanda</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="scroll-neon min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mono-caps">Título</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" data-testid="demanda-titulo"
              className="mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:border-cyan/60" />
          </label>
          <label className="block">
            <span className="mono-caps">Descrição</span>
            <div className="relative"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Detalhes (opcional) — ou toque no microfone e fale"
              className="mt-1 w-full resize-none rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan/60 pr-12" /><DictateButton onText={(t) => setDesc((x) => appendSpoken(x, t, "\n"))} label="Detalhes" /></div>
            <div className="relative">
              <span className="mono-caps flex items-center gap-1.5"><CheckSquare size={11} /> Checklist <span className="normal-case tracking-normal text-muted-foreground">(um passo por linha, opcional)</span></span>
              <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} placeholder={"Tudo o que precisa ser feito, um passo por linha\nex.: Criar o usuário Maria no polo Niterói\n       Fazer o disparo do template renegociação"} data-testid="nova-checklist"
                className="mt-1 w-full resize-y rounded-xl border border-border bg-secondary/40 px-3 py-2 pr-12 text-sm outline-none focus:border-cyan/60" />
              <DictateButton onText={(t) => setSteps((x) => appendSpoken(x, t, "\n"))} label="Checklist" className="right-2 top-8" />
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs transition hover:border-violet/50" data-testid="nova-como-tarefa">
              <input type="checkbox" checked={asTask} onChange={(e) => setAsTask(e.target.checked)} className="h-4 w-4 accent-[var(--violet)]" />
              <ListChecks size={14} className="text-violet" /><span className="min-w-0 flex-1"><b className="font-medium text-foreground">Adicionar também às Tarefas</b><span className="block text-[0.65rem] text-muted-foreground">Cria uma tarefa na categoria “Demandas”, com o prazo e a prioridade desta demanda.</span></span>
            </label>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mono-caps">Prioridade</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan/60 [&>option]:bg-popover">
                {(Object.keys(prio) as Priority[]).map((p) => <option key={p} value={p}>{prio[p].label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mono-caps">Prazo</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan/60 [color-scheme:dark]" />
            </label>
          </div>

          <div>
            <p className="mono-caps mb-2">Para quem?</p>
            <div className="grid grid-cols-3 gap-2">
              {(["geral", "polo", "multi"] as DType[]).map((t) => (
                <button key={t} type="button" onClick={() => pick(t)} style={tint(tm[t].color)} data-testid={`alvo-${t}`}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs transition ${type === t ? "border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_14%,transparent)] text-[var(--glow)] shadow-[0_0_20px_-6px_var(--glow)]" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {(() => { const I = tm[t].icon; return <I size={18} />; })()}
                  <span className="font-medium">{tm[t].short}</span>
                </button>
              ))}
            </div>
          </div>
          {needs && <TargetPicker names={dossiers} value={targets} onChange={setTargets} single={type === "polo"} />}
          <NewDemandMaterials value={materials} onChange={setMaterials} />
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm transition hover:border-cyan/40">Cancelar</button>
          <button disabled={!ok} data-testid="criar-demanda" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan/60 bg-cyan/10 py-2.5 text-sm text-cyan shadow-[0_0_24px_-8px_var(--cyan)] transition hover:bg-cyan/20 disabled:opacity-40">
            <Check size={15} /> {type === "multi" && targets.length ? `Criar para ${targets.length} ${targets.length === 1 ? "selecionado" : "selecionados"}` : "Criar demanda"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- cadastro de dossiês ---------------- */
type DossierActions = Pick<Parameters<typeof DossierManager>[0], "state" | "onChange" | "usage" | "onRename" | "onRemove">;
/** Adicionar, editar e excluir dossiês (usado no cadastro e no painel lateral). */
function useDossierEditor({ state, onChange, usage, onRename, onRemove }: DossierActions) {
  const L = state.label;
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string; desc: string } | null>(null);
  const taken = (n: string, except?: string) => state.dossiers.some((x) => x.id !== except && x.name.trim().toLowerCase() === n.trim().toLowerCase());
  const dup = () => `Já existe ${gender(L).um.toLowerCase()} ${L.singular.toLowerCase()} com esse nome.`;
  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (taken(n)) return setErr(dup());
    onChange({ ...state, dossiers: [...state.dossiers, { id: `d${Date.now()}`, name: n, desc: desc.trim() }] });
    setName(""); setDesc(""); setErr("");
  };
  const save = () => {
    if (!edit) return;
    const n = edit.name.trim();
    const old = state.dossiers.find((x) => x.id === edit.id);
    if (!old || !n) return;
    if (taken(n, edit.id)) return setErr(dup());
    if (old.name !== n) onRename(old.name, n);
    onChange({ ...state, dossiers: state.dossiers.map((x): Dossier => (x.id === edit.id ? { ...x, name: n, desc: edit.desc.trim() } : x)) });
    setEdit(null); setErr("");
  };
  const del = (x: Dossier) => {
    const u = usage(x.name);
    const msg = u ? `Excluir "${x.name}"? Ele é usado em ${u} demanda${u === 1 ? "" : "s"} e será removido delas.` : `Excluir "${x.name}"?`;
    if (!window.confirm(msg)) return;
    onRemove(x.name);
    onChange({ ...state, dossiers: state.dossiers.filter((d) => d.id !== x.id) });
  };
  return { name, setName, desc, setDesc, err, setErr, edit, setEdit, add, save, del };
}

function DossierManager({ state, onChange, usage, onRename, onRemove }: {
  state: DossierState; onChange: (s: DossierState) => void; usage: (name: string) => number;
  onRename: (o: string, n: string) => void; onRemove: (name: string) => void;
}) {
  const L = state.label;
  const { name, setName, desc, setDesc, err, setErr, edit, setEdit, add, save, del } = useDossierEditor({ state, onChange, usage, onRename, onRemove });
  return (
    <section className="glass space-y-5 rounded-3xl p-5 animate-rise" style={tint("pink")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="icon-tile h-11 w-11 !rounded-full"><Folder size={20} /></span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">{L.plural} ({state.dossiers.length})</h2>
          <p className="text-xs text-muted-foreground">Cadastro de {L.plural.toLowerCase()} deste projeto. Eles aparecem ao criar uma demanda.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/25 p-4">
        <p className="mono-caps">Como chamar os dossiês neste projeto</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {LABEL_PRESETS.map((p) => (
            <button key={p.plural} type="button" onClick={() => onChange({ ...state, label: p })} style={tint("cyan")}
              className={`tag ${L.plural === p.plural ? "!border-[var(--glow)] !bg-[color-mix(in_oklab,var(--glow)_18%,transparent)]" : "opacity-70"}`}>{p.plural}</button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Singular
            <input value={L.singular} onChange={(e) => onChange({ ...state, label: { ...L, singular: e.target.value } })} className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-2 py-1.5 text-sm text-foreground outline-none" />
          </label>
          <label className="text-xs text-muted-foreground">Plural
            <input value={L.plural} onChange={(e) => onChange({ ...state, label: { ...L, plural: e.target.value } })} className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-2 py-1.5 text-sm text-foreground outline-none" />
          </label>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="rounded-2xl border border-border bg-secondary/25 p-4">
        <p className="mono-caps">Adicionar {L.singular.toLowerCase()}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Nome" data-testid="dossie-nome" className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição (opcional)" className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
          <button disabled={!name.trim()} data-testid="dossie-add" className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan/60 bg-cyan/10 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/20 disabled:opacity-40"><Plus size={14} /> Adicionar</button>
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </form>

      <div className="divide-y divide-border rounded-2xl border border-border">
        {state.dossiers.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            {edit?.id === x.id ? (
              <>
                <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="min-w-[120px] flex-1 rounded-lg border border-border bg-secondary/40 px-2 py-1 text-sm outline-none" />
                <input value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} placeholder="Descrição" className="min-w-[160px] flex-[2] rounded-lg border border-border bg-secondary/40 px-2 py-1 text-sm outline-none" />
                <button onClick={save} className="rounded-lg border border-emerald/50 px-2 py-1 text-xs text-emerald" aria-label="Salvar"><Check size={13} /></button>
                <button onClick={() => { setEdit(null); setErr(""); }} className="rounded-lg border border-border px-2 py-1 text-xs" aria-label="Cancelar"><X size={13} /></button>
              </>
            ) : (
              <>
                <FolderOpen size={15} className="text-[var(--glow)]" />
                <span className="min-w-[120px] font-medium">{x.name}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{x.desc || "—"}</span>
                <span className="font-mono text-[0.6rem] text-muted-foreground">{usage(x.name)} demanda{usage(x.name) === 1 ? "" : "s"}</span>
                <button onClick={() => setEdit({ id: x.id, name: x.name, desc: x.desc })} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-cyan" aria-label={`Editar ${x.name}`}><Pencil size={14} /></button>
                <button onClick={() => del(x)} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-destructive" aria-label={`Excluir ${x.name}`}><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
        {!state.dossiers.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cadastrado. Adicione o primeiro acima.</p>}
      </div>
    </section>
  );
}

/* ---------------- matriz ---------------- */
function Matrix({ items, names, selId, onOpen, onCell }: { items: Demand[]; names: string[]; selId: string | null; onOpen: (id: string) => void; onCell: (id: string, name: string) => void }) {
  const L = useLabel();
  const rows = items.filter((d) => d.polo || d.polos);
  const cellOf = (d: Demand, n: string): Status | null => (d.polos ? d.polos.find((p) => p.name === n)?.status ?? null : d.polo === n ? d.status : null);
  return (
    <section className="glass overflow-hidden rounded-3xl animate-rise">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 text-xs text-muted-foreground">
        <span>Demandas × {L.plural.toLowerCase()}. Toque numa célula para avançar o status.</span>
        <span className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald" /> Feito</span>
          <span className="flex items-center gap-1"><Loader size={13} className="text-amber" /> Em andamento</span>
          <span className="flex items-center gap-1"><Circle size={13} /> A fazer</span>
        </span>
      </div>
      <div className="scroll-neon overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-xs" data-testid="matriz">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-56 min-w-56 bg-card px-4 py-2 text-left mono-caps">Demanda</th>
              {names.map((n) => <th key={n} className="h-28 w-9 min-w-9 px-0 align-bottom font-normal text-muted-foreground"><span className="inline-block pb-2 [writing-mode:vertical-rl] rotate-180">{n}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={`border-t border-border/60 ${selId === d.id ? "bg-cyan/10" : ""}`}>
                <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-normal">
                  <button onClick={() => onOpen(d.id)} className="block w-52 truncate text-left transition hover:text-cyan"><span className="mr-1.5 font-mono text-[0.6rem] text-muted-foreground">{d.id}</span>{d.title}</button>
                </th>
                {names.map((n) => {
                  const s = cellOf(d, n);
                  return (
                    <td key={n} className="p-0 text-center">
                      {s ? (
                        <button onClick={() => onCell(d.id, n)} className="grid h-9 w-9 place-items-center transition hover:bg-secondary/60" aria-label={`${d.title} em ${n}: ${statusMeta[s].poloLabel}`} data-status={s}>
                          {s === "done" ? <CheckCircle2 size={16} className="text-emerald" /> : s === "doing" ? <Loader size={16} className="animate-[spin_3s_linear_infinite] text-amber" /> : <Circle size={16} className="text-muted-foreground/60" />}
                        </button>
                      ) : <span className="block text-muted-foreground/20">·</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={names.length + 1} className="p-8 text-center text-sm text-muted-foreground">Nenhuma demanda com {L.singular.toLowerCase()} para mostrar.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- efeitos de fundo ---------------- */
/** Número que sobe até o valor, dentro de um anel de progresso (cartão inclinável). */
function Kpi({ v, l, c, p, i }: { v: number; l: string; c: string; p: number; i: number }) {
  const n = Math.round(useCountUp(v));
  return (
    <Tilt max={7} className="rounded-2xl"><div className="glass flex items-center gap-3 rounded-2xl px-3.5 py-2.5" style={{ ...tint(c), animation: "fin-rise .6s both", animationDelay: `${i * 80}ms` }} data-testid={`kpi-${l}`}>
      <Ring pct={p} color={`var(--${c})`} size={46} thickness={5}><span className="font-display text-sm font-bold tabular-nums" style={{ color: `var(--${c})` }}>{n}</span></Ring>
      <p className="text-[0.62rem] uppercase leading-tight tracking-wider text-muted-foreground">{l}</p>
    </div></Tilt>
  );
}
function CountTag({ n }: { n: number }) { return <span className="tag !text-[0.65rem] !tracking-normal tabular-nums">{Math.round(useCountUp(n, 700))}</span>; }

function BgFx() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <svg className="absolute left-1/3 top-10 h-48 w-[60%] opacity-40" viewBox="0 0 600 120" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M0 ${60 + i * 4} C 150 ${10 + i * 12}, 300 ${110 - i * 10}, 600 ${50 + i * 6}`} fill="none" stroke={`var(--${i % 2 ? "violet" : "cyan"})`} strokeWidth=".6" strokeDasharray="4 6">
            <animate attributeName="stroke-dashoffset" from="0" to={i % 2 ? "-200" : "200"} dur={`${8 + i * 2}s`} repeatCount="indefinite" />
          </path>
        ))}
      </svg>
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className="absolute h-0.5 w-0.5 animate-pulse-ring rounded-full bg-cyan shadow-[0_0_6px_var(--cyan)]"
          style={{ left: `${(i * 47) % 100}%`, top: `${(i * 31) % 100}%`, animationDelay: `${(i % 7) * 0.4}s` }} />
      ))}
    </div>
  );
}

function HexLogo() {
  return (
    <div className="relative grid h-20 w-20 place-items-center">
      <Hexagon size={84} strokeWidth={0.8} className="absolute text-cyan/50 animate-[spin_24s_linear_infinite]" />
      <Hexagon size={70} strokeWidth={0.6} className="absolute text-violet/50 animate-[spin_18s_linear_infinite_reverse]" />
      <span aria-hidden className="absolute h-14 w-14 rounded-2xl border border-cyan/40" style={{ animation: "demand-ping 2.6s ease-out infinite" }} />
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-[0_0_40px_-4px_var(--cyan)] animate-float">
        <Layers size={20} />
      </div>
    </div>
  );
}

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="glass relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs max-md:shrink-0 max-md:py-2.5 max-md:text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none bg-transparent pr-5 font-medium outline-none [&>option]:bg-popover">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 text-muted-foreground" />
    </label>
  );
}

/* ---------------- quadros ---------------- */
function progress(d: Demand) {
  if (d.checklist?.length && !d.polos?.length) return Math.round((d.checklist.filter((c) => c.done).length / d.checklist.length) * 100);
  if (!d.polos?.length) return d.status === "done" ? 100 : d.status === "doing" ? 50 : 0;
  return Math.round((d.polos.filter((p) => p.status === "done").length / d.polos.length) * 100);
}

const SHORT: Record<Status, string> = { todo: "A fazer", doing: "Andamento", done: "Feitas" };
/** Seletor de status só no celular: mostra uma coluna por vez (a fazer, em andamento, concluídas). */
function StatusTabs({ value, onChange, items }: { value: Status; onChange: (s: Status) => void; items: Demand[] }) {
  return (
    <div className="mt-3 flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 md:hidden" role="tablist" data-testid="status-abas">
      {STATUSES.map((s) => {
        const on = value === s, n = items.filter((i) => i.status === s).length;
        return (
          <button key={s} type="button" role="tab" aria-selected={on} onClick={() => onChange(s)} style={tint(statusMeta[s].color)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[0.72rem] font-medium transition ${on ? "bg-[color-mix(in_oklab,var(--glow)_18%,transparent)] text-[var(--glow)] shadow-[0_0_18px_-8px_var(--glow)]" : "text-muted-foreground"}`}>
            <span className="truncate">{SHORT[s]}</span><span className="font-mono text-[0.65rem] opacity-80">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
const firstStatus = (items: Demand[]): Status => STATUSES.find((s) => items.some((i) => i.status === s)) ?? STATUSES[0]!;

function TypeBoard({ type, items, selId, onOpen, onCreate }: { type: DType; items: Demand[]; selId: string | null; onOpen: (id: string) => void; onCreate: () => void }) {
  const m = useTM()[type];
  const [st, setSt] = useState<Status>(() => firstStatus(items)), [over, setOver] = useState<Status | null>(null), act = useContext(ActionsCtx);
  return (
    <div className="ex-card ex-glass flex flex-col p-3 transition duration-300 hover:-translate-y-0.5 max-md:w-[88%] max-md:shrink-0 max-md:snap-center" style={{ ...tint(m.color), "--rail": "var(--glow)" } as CSSProperties}>
      <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--glow)] to-transparent shadow-[0_0_14px_var(--glow)]" />
      <div className="flex items-center gap-3 px-1">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center"><span aria-hidden className="absolute inset-0 rounded-full border border-[var(--glow)]/45" style={{ animation: "pulse-ring 2.8s ease-out infinite" }} /><span className="icon-tile h-11 w-11 !rounded-full shadow-[0_0_24px_-6px_var(--glow)]"><m.icon size={20} /></span></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold">{m.label}</h3>
          <p className="text-[0.68rem] text-muted-foreground">{m.sub}</p>
        </div>
        <span className="tag !text-xs !tracking-normal">{items.length}</span>
      </div>
      {items.length > 0 && <div className="mx-1 mt-2.5 h-1 overflow-hidden rounded-full bg-white/10" title={`${Math.round((items.filter((x) => x.status === "done").length / items.length) * 100)}% concluído`}><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.round((items.filter((x) => x.status === "done").length / items.length) * 100))}%`, background: "linear-gradient(90deg, var(--glow), var(--emerald))", boxShadow: "0 0 10px var(--glow)" }} /></div>}
      <StatusTabs value={st} onChange={setSt} items={items} />
      <div className="mt-3 md:grid md:grid-cols-3 md:gap-2">
        {STATUSES.map((s) => {
          const col = items.filter((i) => i.status === s);
          return (
            <div key={s} className={`min-w-0 rounded-xl transition ${over === s ? "bg-[color-mix(in_oklab,var(--glow)_14%,transparent)] ring-2 ring-[var(--glow)]" : ""} ${s === st ? "" : "max-md:hidden"}`} style={tint(statusMeta[s].color)}
              onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== s) setOver(s); } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === s ? null : o)); }}
              onDrop={(e) => { const id = e.dataTransfer.getData(DRAG); setOver(null); if (id) { e.preventDefault(); act.move(id, s); } }}>
              <div className="mb-2 flex items-center justify-between rounded-full max-md:hidden border border-[color-mix(in_oklab,var(--glow)_40%,transparent)] bg-[color-mix(in_oklab,var(--glow)_12%,transparent)] px-2.5 py-1 text-[0.62rem] text-[var(--glow)] shadow-[inset_0_1px_0_rgba(255,255,255,.1)] backdrop-blur">
                <span className="truncate">{statusMeta[s].label}</span><span className="font-mono">{col.length}</span>
              </div>
              <div className="max-h-[26rem] space-y-2 overflow-y-auto overscroll-contain pr-1 max-md:max-h-[55dvh] max-md:space-y-2.5" data-testid={`coluna-${type}-${s}`}>
                {col.map((d, i) => <MiniCard key={d.id} d={d} active={selId === d.id} onClick={() => onOpen(d.id)} delay={i} />)}
                {!col.length && <div className="grid place-items-center gap-1 rounded-xl border border-dashed border-white/15 py-3 text-center text-[0.6rem] text-muted-foreground/70"><span aria-hidden className="relative grid h-6 w-6 place-items-center"><span className="absolute inset-0 rounded-full border border-[var(--glow)]/40" style={{ animation: "pulse-ring 3s ease-out infinite" }} /><span className="h-1.5 w-1.5 rounded-full bg-[var(--glow)] shadow-[0_0_10px_var(--glow)]" /></span>vazio</div>}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={onCreate} className="group/add mt-4 flex items-center justify-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--glow)_35%,transparent)] bg-white/[0.03] py-2 text-xs text-[var(--glow)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-[color-mix(in_oklab,var(--glow)_12%,transparent)] hover:shadow-[0_0_26px_-8px_var(--glow)] active:scale-95">
        <Plus size={13} className="transition duration-300 group-hover/add:rotate-90" /> Nova {m.label.toLowerCase().replace("demandas", "demanda").replace("gerais", "geral")}
      </button>
    </div>
  );
}

function MiniCard({ d, active, onClick, delay }: { d: Demand; active: boolean; onClick: () => void; delay: number }) {
  const L = useLabel();
  return (
    <div className="group/card relative cursor-grab active:cursor-grabbing" draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG, d.id); e.dataTransfer.effectAllowed = "move"; e.currentTarget.style.opacity = ".5"; }} onDragEnd={(e) => { e.currentTarget.style.opacity = ""; }}>
    <button onClick={onClick} style={{ ...tint(typeBase[d.type].color), animationDelay: `${delay * 0.05}s` }}
      className={`group card-sheen relative w-full overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--glow)_11%,transparent),rgba(255,255,255,.02)_60%)] p-2 pl-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-md transition duration-300 animate-rise active:scale-[0.98] max-md:rounded-2xl max-md:p-3.5 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--glow)_50%,transparent)] hover:shadow-[0_8px_24px_-12px_var(--glow)] ${active ? "border-[var(--glow)] shadow-[0_0_24px_-6px_var(--glow)]" : "border-border"}`}>
      <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--glow)] shadow-[0_0_8px_var(--glow)]" />
      {active && <span className="scanline absolute inset-0" />}
      <p className="font-mono text-[0.55rem] text-muted-foreground max-md:text-[0.65rem]">{d.id}</p>
      <p className="mt-0.5 line-clamp-4 break-words text-[0.74rem] font-medium leading-snug max-md:text-[0.95rem]">{d.title}</p>
      <span className="tag mt-1.5 inline-flex items-center gap-1 !px-1.5 !py-0 !text-[0.5rem]" style={tint(prio[d.priority].color)}>{d.priority === "alta" && d.status !== "done" && <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 rounded-full bg-[var(--glow)]" style={{ animation: "demand-ping 1.6s ease-out infinite" }} /><span className="h-1.5 w-1.5 rounded-full bg-[var(--glow)]" /></span>}{prio[d.priority].label}</span>
      <p className="mt-1.5 flex items-start gap-1 break-words text-[0.6rem] leading-tight text-muted-foreground max-md:text-xs [&>svg]:mt-px [&>svg]:shrink-0">
        {d.type === "geral" ? <><Calendar size={9} /> {d.deadline}</> : d.type === "polo" ? <><MapPin size={9} /> {d.polo}</> : <><Network size={9} /> {d.polos!.length} {L.plural.toLowerCase()} · {progress(d)}%</>}
      </p>
      {!!d.checklist?.length && (() => { const n = d.checklist!.length, k = d.checklist!.filter((c) => c.done).length; return (
        <span className="mt-1.5 flex items-center gap-1.5" data-testid="card-checklist">
          <CheckSquare size={9} className="shrink-0 text-[var(--glow)]" />
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[var(--glow)] transition-all duration-500" style={{ width: `${(k / n) * 100}%`, boxShadow: "0 0 8px var(--glow)" }} /></span>
          <span className="font-mono text-[0.55rem] text-muted-foreground max-md:text-xs">{k}/{n}</span>
        </span>); })()}
      {(() => { const w = (d.checklist ?? []).filter((c) => c.wait && !c.done); return w.length ? (
        <span className="mt-1 flex items-center gap-1 text-[0.58rem] text-amber max-md:text-xs" data-testid="card-aguardando" title={w.map((c) => `• ${c.text}${c.wait?.from ? ` — aguardando ${c.wait.from}` : ""}${c.wait?.note ? `: ${c.wait.note}` : ""}`).join("\n")}>
          <Hourglass size={9} className="shrink-0 animate-pulse" /> {w.length} aguardando retorno
        </span>) : null; })()}
    </button>
    <CardActions id={d.id} status={d.status} />
    </div>
  );
}

function FullBoard({ type, items, selId, onOpen, onCreate }: { type: DType; items: Demand[]; selId: string | null; onOpen: (id: string) => void; onCreate: (s: Status) => void }) {
  const m = useTM()[type];
  const L = useLabel();
  const [st, setSt] = useState<Status>(() => firstStatus(items)), [over, setOver] = useState<Status | null>(null), act = useContext(ActionsCtx);
  return (
    <section className="fin-frame glass glass-clear relative overflow-hidden rounded-3xl p-5 animate-rise max-md:rounded-2xl max-md:p-3" style={tint(m.color)}>
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: "var(--glow)" }} />
      <div className="relative mb-5 flex flex-wrap items-center gap-4">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full border border-[var(--glow)]/50" style={{ animation: "pulse-ring 2.6s ease-out infinite" }} />
          <span className="icon-tile h-12 w-12 !rounded-full shadow-[0_0_28px_-6px_var(--glow)]"><m.icon size={21} /></span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-sm uppercase tracking-[0.3em]">{m.label} ({items.length})</h2>
          <p className="text-xs text-muted-foreground">{type === "multi" ? `Uma demanda principal com execução individual por ${L.singular.toLowerCase()}.` : m.sub + "."}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">{STATUSES.map((s, i) => { const n = items.filter((x) => x.status === s).length; return (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border bg-white/[0.04] px-2.5 py-1 text-[0.68rem] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.08]" style={{ ...tint(statusMeta[s].color), borderColor: "color-mix(in oklab, var(--glow) 35%, transparent)", animation: `fin-rise .5s ${0.08 + i * 0.06}s both` }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--glow)] shadow-[0_0_8px_var(--glow)]" /><b className="tabular-nums">{n}</b><span className="text-muted-foreground">{statusMeta[s].label.toLowerCase()}</span>
            </span>); })}</div>
        </div>
        {items.length > 0 && <div className="flex items-center gap-3" data-testid={`resumo-${type}`}>
          <Ring pct={Math.round((items.filter((x) => x.status === "done").length / items.length) * 100)} color="var(--emerald)" size={64} thickness={6}><span className="text-[0.7rem] font-semibold tabular-nums">{Math.round((items.filter((x) => x.status === "done").length / items.length) * 100)}%</span></Ring>
          <p className="hidden text-[0.68rem] leading-tight text-muted-foreground sm:block">concluído<br />de {items.length} demanda{items.length === 1 ? "" : "s"}</p>
        </div>}
      </div>
      <StatusTabs value={st} onChange={setSt} items={items} />
      <div className="mt-3 grid gap-4 md:mt-0 md:grid-cols-3">
        {STATUSES.map((s) => {
          const col = items.filter((i) => i.status === s);
          return (
            <div key={s} className={`ex-card ex-glass flex min-h-[200px] flex-col p-3 transition ${over === s ? "ring-2 ring-[var(--glow)] brightness-125" : ""} ${s === st ? "" : "max-md:hidden"}`} style={{ ...tint(statusMeta[s].color), "--rail": "var(--glow)" } as React.CSSProperties}
              onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== s) setOver(s); } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === s ? null : o)); }}
              onDrop={(e) => { const id = e.dataTransfer.getData(DRAG); setOver(null); if (id) { e.preventDefault(); act.move(id, s); } }}>
              <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--glow)] to-transparent shadow-[0_0_14px_var(--glow)]" />
              <div className="flex items-center gap-2 px-1 pb-3 max-md:hidden">
                <span className="h-2.5 w-2.5 animate-pulse-ring rounded-full bg-[var(--glow)] shadow-[0_0_10px_var(--glow)]" />
                <h3 className="font-display font-semibold">{statusMeta[s].label}</h3>
                <span className="tag ml-auto !text-xs !tracking-normal">{col.length}</span>
              </div>
              <div className="max-h-[36rem] flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
                {col.map((d, i) => <BigCard key={d.id} d={d} active={selId === d.id} onClick={() => onOpen(d.id)} delay={i} />)}
                {!col.length && <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-8 text-center" data-testid={`vazio-${type}-${s}`}>
                  <span className="relative grid h-12 w-12 place-items-center" aria-hidden><span className="absolute inset-0 rounded-full border border-[var(--glow)]/40" style={{ animation: "pulse-ring 3s ease-out infinite" }} /><span className="h-2.5 w-2.5 rounded-full bg-[var(--glow)] shadow-[0_0_14px_var(--glow)]" /></span>
                  <p className="text-xs text-muted-foreground">{s === "todo" ? "Nada a fazer por aqui" : s === "doing" ? "Nada em andamento" : "Nada concluído ainda"}</p>
                </div>}
              </div>
              <button onClick={() => onCreate(s)} className="group/add mt-3 flex items-center justify-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--glow)_35%,transparent)] bg-white/[0.03] py-2 text-xs text-[var(--glow)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-[color-mix(in_oklab,var(--glow)_12%,transparent)] hover:shadow-[0_0_26px_-8px_var(--glow)] active:scale-95">
                <Plus size={13} className="transition duration-300 group-hover/add:rotate-90" /> Adicionar demanda
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BigCard({ d, active, onClick, delay }: { d: Demand; active: boolean; onClick: () => void; delay: number }) {
  const L = useLabel();
  const pct = progress(d);
  const dn = d.polos?.filter((p) => p.status === "done").length ?? 0;
  return (
    <div className="group/card relative cursor-grab active:cursor-grabbing" draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG, d.id); e.dataTransfer.effectAllowed = "move"; e.currentTarget.style.opacity = ".5"; }} onDragEnd={(e) => { e.currentTarget.style.opacity = ""; }}>
    <button onClick={onClick} style={{ ...tint(prio[d.priority].color), animationDelay: `${delay * 0.06}s` }}
      className={`group card-sheen relative w-full overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--glow)_11%,transparent),rgba(255,255,255,.02)_60%)] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-md transition duration-300 animate-rise hover:-translate-y-1 hover:shadow-[0_16px_36px_-14px_var(--glow)] active:scale-[0.99] ${active ? "border-cyan shadow-[0_0_30px_-6px_var(--cyan)]" : "border-white/12 hover:border-[color-mix(in_oklab,var(--glow)_55%,transparent)]"}`}>
      <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-[var(--glow)] shadow-[0_0_8px_var(--glow)]" />
      {active && <span className="scanline absolute inset-0" />}
      <p className="font-mono text-[0.6rem] tracking-[0.2em] text-muted-foreground">{d.id}</p>
      <div className="flex items-start gap-2">
        <p className="flex-1 font-medium leading-snug">{d.title}</p>
        <ChevronRight size={16} className="mt-1 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-cyan" />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {d.polos ? <><Network size={13} /> {d.polos.length} {L.plural.toLowerCase()}</> : d.polo ? <><MapPin size={13} /> {d.polo}</> : <><Calendar size={13} /> {d.deadline}</>}
        <span className="tag !tracking-normal !normal-case !text-[0.65rem]">{prio[d.priority].label}</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pct === 100 ? "var(--emerald)" : "var(--gradient-brand)", boxShadow: "0 0 10px var(--cyan)" }} />
        </div>
        {d.polos && <span>{dn}/{d.polos.length}</span>}
        <span className="font-mono">{pct}%</span>
      </div>
    </button>
    <CardActions id={d.id} status={d.status} pos="right-9 top-3" />
    </div>
  );
}

function ListView({ items, selId, onOpen }: { items: Demand[]; selId: string | null; onOpen: (id: string) => void }) {
  const tm = useTM();
  return (
    <section className="glass overflow-hidden rounded-3xl animate-rise">
      <div className="grid grid-cols-[90px_1fr_130px_110px_90px_80px_56px] gap-3 border-b border-border px-5 py-3 mono-caps max-md:hidden">
        <span>Código</span><span>Demanda</span><span>Tipo</span><span>Status</span><span>Prazo</span><span>Progresso</span><span />
      </div>
      {items.map((d, i) => (
        <div key={d.id} className="group/card relative">
        <button onClick={() => onOpen(d.id)} style={{ animationDelay: `${i * 0.03}s` }}
          className={`grid w-full grid-cols-2 gap-3 border-b border-border/60 px-5 py-3 text-left text-sm transition animate-rise hover:bg-secondary/50 md:grid-cols-[90px_1fr_130px_110px_90px_80px_56px] ${selId === d.id ? "bg-cyan/10" : ""}`}>
          <span className="font-mono text-xs text-muted-foreground">{d.id}</span>
          <span className="truncate font-medium max-md:col-span-2 max-md:whitespace-normal">{d.title}</span>
          <span className="text-xs" style={{ color: `var(--${tm[d.type].color})` }}>{tm[d.type].short}</span>
          <span className="text-xs" style={{ color: `var(--${statusMeta[d.status].color})` }}>{statusMeta[d.status].label}</span>
          <span className="text-xs text-muted-foreground">{d.deadline}</span>
          <span className="font-mono text-xs">{progress(d)}%</span>
          <span className="max-md:hidden" />
        </button>
        <CardActions id={d.id} status={d.status} pos="right-4 top-1/2 -translate-y-1/2" />
        </div>
      ))}
      {!items.length && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma demanda encontrada.</p>}
    </section>
  );
}

function PolosPanel({ items, state, active, onPick, onChange, usage, onRename, onRemove }: {
  items: Demand[]; state: DossierState; active: string | null; onPick: (p: string) => void;
  onChange: (s: DossierState) => void; usage: (name: string) => number; onRename: (o: string, n: string) => void; onRemove: (name: string) => void;
}) {
  const L = state.label;
  const names = state.dossiers.map((x) => x.name);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const ed = useDossierEditor({ state, onChange, usage, onRename, onRemove });
  const stat = (p: string) => {
    const e = items.flatMap((i) => (i.polo === p ? [i.status] : i.polos?.filter((x) => x.name === p).map((x) => x.status) ?? []));
    return { d: e.filter((s) => s === "done").length, t: e.length };
  };
  return (
    <aside className="glass rounded-3xl p-4 animate-rise" style={{ animationDelay: ".1s" }}>
      <div className="flex items-center gap-2">
        <Folder size={16} className="text-cyan" />
        <h3 className="flex-1 font-display font-semibold">{L.plural}</h3>
        <button onClick={() => { setAdding((a) => !a); ed.setErr(""); }} data-testid="painel-novo" className="tag flex items-center gap-1" style={tint("cyan")}><Plus size={10} /> Novo</button>
      </div>
      <p className="text-[0.68rem] text-muted-foreground">Clique para filtrar. Passe o mouse para editar.</p>
      {adding && (
        <form onSubmit={(e) => { e.preventDefault(); ed.add(); }} className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/25 p-2">
          <input autoFocus value={ed.name} onChange={(e) => { ed.setName(e.target.value); ed.setErr(""); }} placeholder={`Nome d${gender(L).um === "Uma" ? "a" : "o"} ${L.singular.toLowerCase()}`} data-testid="painel-nome" className="w-full rounded-lg border border-border bg-secondary/40 px-2 py-1.5 text-xs outline-none focus:border-cyan/60" />
          <input value={ed.desc} onChange={(e) => ed.setDesc(e.target.value)} placeholder="Descrição (opcional)" className="w-full rounded-lg border border-border bg-secondary/40 px-2 py-1.5 text-xs outline-none focus:border-cyan/60" />
          {ed.err && <p className="text-[0.65rem] text-destructive">{ed.err}</p>}
          <div className="flex gap-2">
            <button disabled={!ed.name.trim()} data-testid="painel-salvar" className="flex-1 rounded-lg border border-cyan/60 bg-cyan/10 py-1.5 text-xs text-cyan transition hover:bg-cyan/20 disabled:opacity-40">Adicionar</button>
            <button type="button" onClick={() => { setAdding(false); ed.setErr(""); }} className="rounded-lg border border-border px-3 text-xs">Cancelar</button>
          </div>
        </form>
      )}
      <label className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-1.5">
        <Search size={12} className="text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${L.singular.toLowerCase()}…`} className="w-full bg-transparent text-xs outline-none" />
      </label>
      <div className="scroll-neon mt-3 grid max-h-40 grid-cols-2 gap-x-2 gap-y-0.5 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-5 2xl:max-h-[520px] 2xl:grid-cols-1" data-testid="lista-dossies">
        {state.dossiers.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())).map((x) => {
          const p = x.name;
          const s = stat(p);
          if (ed.edit?.id === x.id) {
            return (
              <form key={x.id} onSubmit={(e) => { e.preventDefault(); ed.save(); }} className="col-span-full space-y-1.5 rounded-lg border border-cyan/40 bg-secondary/30 p-2">
                <input autoFocus value={ed.edit.name} onChange={(e) => ed.setEdit({ ...ed.edit!, name: e.target.value })} className="w-full rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs outline-none" />
                <input value={ed.edit.desc} onChange={(e) => ed.setEdit({ ...ed.edit!, desc: e.target.value })} placeholder="Descrição" className="w-full rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs outline-none" />
                {ed.err && <p className="text-[0.65rem] text-destructive">{ed.err}</p>}
                <div className="flex gap-1.5">
                  <button className="flex-1 rounded-md border border-emerald/50 py-1 text-[0.65rem] text-emerald">Salvar</button>
                  <button type="button" onClick={() => { ed.setEdit(null); ed.setErr(""); }} className="rounded-md border border-border px-2 text-[0.65rem]">Cancelar</button>
                </div>
              </form>
            );
          }
          return (
            <div key={x.id} style={tint(dossierColor(names, p))} className={`group relative flex items-center rounded-xl transition-all duration-300 hover:translate-x-0.5 hover:bg-secondary/50 ${active === p ? "bg-[color-mix(in_oklab,var(--glow)_12%,transparent)] shadow-[inset_2px_0_0_var(--glow)]" : ""}`}>
              <button onClick={() => onPick(p)} title={x.desc || undefined} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--glow)] shadow-[0_0_8px_var(--glow)] transition-transform duration-300 group-hover:scale-125" />
                <span className="flex-1 truncate text-left font-medium">{p}</span>
                <span className="font-mono text-[0.6rem] text-muted-foreground transition-opacity duration-200 group-hover:opacity-0">{s.d}/{s.t}</span>
              </button>
              <div className="absolute right-1.5 flex items-center gap-0.5 opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 focus-within:opacity-100 focus-within:translate-x-0">
                <button onClick={() => ed.setEdit({ id: x.id, name: x.name, desc: x.desc })} aria-label={`Editar ${p}`} className="rounded-md p-1 text-muted-foreground transition hover:scale-110 hover:bg-cyan/10 hover:text-cyan"><Pencil size={11} /></button>
                <button onClick={() => ed.del(x)} aria-label={`Excluir ${p}`} className="rounded-md p-1 text-muted-foreground transition hover:scale-110 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={11} /></button>
              </div>
            </div>
          );
        })}
        {!state.dossiers.length && <p className="col-span-full p-3 text-center text-xs text-muted-foreground">Nenhum cadastrado. Use “Novo”.</p>}
      </div>
      <div className="relative mt-4 hidden overflow-hidden rounded-2xl border border-border p-4 2xl:block">
        <Atom size={34} className="mb-2 animate-[spin_12s_linear_infinite] text-cyan drop-shadow-[0_0_10px_var(--cyan)]" />
        <p className="text-xs leading-relaxed text-muted-foreground">Grandes resultados são construídos com organização, foco e trabalho em equipe.</p>
        <p className="mt-2 mono-caps">— P4C</p>
      </div>
    </aside>
  );
}

/* ---------------- notas ---------------- */
type NotesProps = {
  notes: Note[]; dossiers: Dossier[]; onNew: () => void; onEdit: (n: Note) => void; onDelete: (n: Note) => void;
};

/** Etiqueta da nota: nome do dossiê ou "Geral". */
function NoteTag({ n, dossiers }: { n: Note; dossiers: Dossier[] }) {
  const name = noteDossierName(n, dossiers);
  return name
    ? <span className="tag inline-flex items-center gap-1" style={tint(dossierColor(dossiers.map((d) => d.name), name))}><MapPin size={9} /> {name}</span>
    : <span className="tag inline-flex items-center gap-1"><Globe size={9} /> Geral</span>;
}

/** Lápis e lixeira de uma nota. */
function NoteActions({ n, onEdit, onDelete }: { n: Note; onEdit: (n: Note) => void; onDelete: (n: Note) => void }) {
  return (
    <span className="flex gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
      <button onClick={(e) => { e.stopPropagation(); onEdit(n); }} aria-label="Editar nota" title="Editar" className="rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur transition hover:text-cyan"><Pencil size={11} /></button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(n); }} aria-label="Excluir nota" title="Excluir" className="rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur transition hover:text-destructive"><Trash2 size={11} /></button>
    </span>
  );
}

function NotesStrip({ notes, dossiers, onNew, onEdit, onDelete, onMore }: NotesProps & { onMore: () => void }) {
  return (
    <section className="glass mt-4 rounded-3xl p-4 animate-rise">
      <div className="mb-3 flex items-center gap-3">
        <span className="icon-tile h-8 w-8" style={tint("violet")}><StickyNote size={14} /></span>
        <div className="flex-1"><h3 className="font-display font-semibold">Anotações</h3><p className="text-[0.68rem] text-muted-foreground">Lembretes e informações importantes.</p></div>
        <button onClick={onNew} data-testid="nova-nota" className="tag flex items-center gap-1" style={tint("cyan")}><Plus size={10} /> Nova nota</button>
        {notes.length > 3 && <button onClick={onMore} className="tag flex items-center gap-1">Ver todas ({notes.length}) <ChevronRight size={10} /></button>}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {notes.slice(0, 3).map((n) => (
          <div key={n.id} onClick={() => onEdit(n)} className="accent-card group relative cursor-pointer !rounded-2xl p-3" style={tint(n.color)}>
            <span className="absolute right-2 top-2"><NoteActions n={n} onEdit={onEdit} onDelete={onDelete} /></span>
            <p className="font-mono text-xs text-[var(--glow)]">{n.date}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{n.text || "Nota vazia"}</p>
            <div className="mt-2"><NoteTag n={n} dossiers={dossiers} /></div>
          </div>
        ))}
        {!notes.length && (
          <button onClick={onNew} className="col-span-full rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-cyan">
            Nenhuma nota ainda. Clique para criar a primeira.
          </button>
        )}
      </div>
    </section>
  );
}

function NotesBoard({ notes, dossiers, onNew, onEdit, onDelete }: NotesProps) {
  const L = useLabel();
  // Filtro: todas, só gerais, ou de um dossiê.
  const [f, setF] = useState<string>("todas");
  const shown = notes.filter((n) => {
    const linked = noteDossierName(n, dossiers) ? n.dossierId : undefined;
    return f === "todas" || (f === "geral" ? !linked : linked === f);
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono-caps">Mostrar</span>
        <select value={f} onChange={(e) => setF(e.target.value)} aria-label="Filtrar notas"
          className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs outline-none focus:border-cyan/60 [&>option]:bg-popover">
          <option value="todas">Todas as notas</option>
          <option value="geral">Gerais (sem {L.singular.toLowerCase()})</option>
          {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{shown.length} nota{shown.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        <button onClick={onNew} data-testid="nova-nota-quadro"
          className="grid min-h-36 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-cyan">
          <span className="flex items-center gap-1"><Plus size={13} /> Nova nota</span>
        </button>
        {shown.map((n, i) => (
          <div key={n.id} onClick={() => onEdit(n)} style={{ ...tint(n.color), transform: `rotate(${(i % 3) - 1}deg)` }}
            className="group relative min-h-36 cursor-pointer rounded-md p-3 pt-5 transition hover:!rotate-0 hover:-translate-y-1 animate-rise">
            <div className="absolute inset-0 rounded-md bg-[color-mix(in_oklab,var(--glow)_22%,var(--card))] shadow-[0_14px_30px_-14px_var(--glow)]" />
            <span className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[-3deg] rounded-sm bg-foreground/15 backdrop-blur" />
            <span className="absolute right-1.5 top-1.5 z-10"><NoteActions n={n} onEdit={onEdit} onDelete={onDelete} /></span>
            <div className="relative">
              <p className="font-mono text-[0.6rem] text-[var(--glow)]">{n.date}</p>
              <p className="mt-1 line-clamp-5 whitespace-pre-wrap text-sm">{n.text || "Nota vazia"}</p>
              <div className="mt-2"><NoteTag n={n} dossiers={dossiers} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Criar ou editar uma nota: texto, cor e (opcional) o dossiê ligado. */
function NoteDialog({ note, dossiers, onClose, onSave }: {
  note: Note | null; dossiers: Dossier[]; onClose: () => void; onSave: (d: NoteDraft) => void;
}) {
  const L = useLabel();
  const [text, setText] = useState(note?.text ?? "");
  const [color, setColor] = useState<string>(note?.color ?? NOTE_COLORS[0]);
  const [dossierId, setDossierId] = useState<string>(note?.dossierId && dossiers.some((d) => d.id === note.dossierId) ? note.dossierId : "");
  const ok = text.trim().length > 0;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 p-3 backdrop-blur-sm animate-in fade-in max-sm:place-items-end max-sm:p-0 sm:p-4" {...backdropProps(onClose)}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ text, color, dossierId: dossierId || undefined }); }}
        className="glass relative flex w-full max-w-lg flex-col overflow-hidden rounded-3xl animate-in zoom-in-95 max-sm:rounded-b-none max-sm:pb-[var(--sab)]" role="dialog" aria-label={note ? "Editar nota" : "Nova nota"}>
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="icon-tile h-10 w-10" style={tint(color)}><StickyNote size={18} /></span>
          <h2 className="flex-1 font-display text-xl font-bold">{note ? "Editar nota" : "Nova nota"}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mono-caps">Nota</span>
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Escreva o lembrete…" data-testid="nota-texto"
              className="mt-1 w-full resize-none rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
          </label>
          <label className="block">
            <span className="mono-caps">Vincular a {L.singular.toLowerCase()}</span>
            <select value={dossierId} onChange={(e) => setDossierId(e.target.value)} data-testid="nota-dossie"
              className="mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan/60 [&>option]:bg-popover">
              <option value="">Nenhum (nota geral)</option>
              {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <div>
            <span className="mono-caps">Cor</span>
            <div className="mt-2 flex gap-2">
              {NOTE_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Cor ${c}`} aria-pressed={color === c}
                  className={`h-6 w-6 rounded-full transition ${color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"}`}
                  style={{ background: `var(--${c})` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm transition hover:border-cyan/40">Cancelar</button>
          <button disabled={!ok} data-testid="salvar-nota" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan/60 bg-cyan/10 py-2.5 text-sm text-cyan shadow-[0_0_24px_-8px_var(--cyan)] transition hover:bg-cyan/20 disabled:opacity-40">
            <Check size={15} /> {note ? "Salvar alterações" : "Criar nota"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- painel lateral ---------------- */
/** Confirma juntar as demandas do mesmo dossiê: mostra o que vira o quê antes de mexer. */
function MergeDialog({ groups, label, onCancel, onConfirm }: { groups: MergeGroup[]; label: string; onCancel: () => void; onConfirm: (g: MergeGroup[]) => void }) {
  const [on, setOn] = useState<Set<string>>(() => new Set(groups.map((g) => g.dossier)));
  const chosen = groups.filter((g) => on.has(g.dossier));
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onCancel]);
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/70 p-3 backdrop-blur-md" onClick={onCancel} data-testid="juntar-dialogo">
      <div role="dialog" aria-label="Juntar demandas" onClick={(e) => e.stopPropagation()} className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[oklch(0.14_0.035_265/0.92)] shadow-[0_40px_120px_-30px_var(--cyan)] backdrop-blur-2xl" style={{ animation: "vp-in .45s cubic-bezier(.2,.8,.2,1) both" }}>
        <header className="flex items-start gap-3 px-6 pb-3 pt-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan/15 text-cyan"><CheckSquare size={20} /></span>
          <div className="min-w-0 flex-1"><p className="mono-caps !text-[0.6rem]">Organizar</p><h2 className="font-serif text-2xl"><span className="text-gradient">Juntar demandas do mesmo {label}</span></h2>
            <p className="mt-1 text-xs text-muted-foreground">Cada grupo vira uma demanda só, com um checklist dos passos para você ir riscando. O texto, as observações, o histórico e os anexos das demandas absorvidas vêm junto.</p></div>
          <button onClick={onCancel} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:rotate-90 hover:text-foreground"><X size={16} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-4">
          {groups.map((g) => { const m = mergeGroup(g); const sel = on.has(g.dossier); return (
            <label key={g.dossier} className={`block cursor-pointer rounded-2xl border p-3 transition ${sel ? "border-cyan/50 bg-cyan/[0.07]" : "border-white/10 bg-white/[0.03] opacity-70"}`}>
              <span className="flex items-center gap-2.5">
                <input type="checkbox" checked={sel} onChange={() => setOn((s) => { const n = new Set(s); if (n.has(g.dossier)) n.delete(g.dossier); else n.add(g.dossier); return n; })} className="h-4 w-4 accent-[var(--cyan)]" />
                <MapPin size={14} className="text-cyan" /><span className="font-medium">{g.dossier}</span><span className="tag ml-auto">{g.items.length} demandas → 1</span>
              </span>
              <ul className="mt-2 space-y-1 pl-6 text-xs">
                {m.merged.checklist!.filter((c) => !c.text.startsWith("   ")).map((c, i) => <li key={i} className="flex gap-2 text-muted-foreground"><Circle size={12} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{c.text}</span></li>)}
              </ul>
            </label>); })}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-3">
          <button onClick={onCancel} className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs transition hover:border-cyan/40 active:scale-95">Cancelar</button>
          <button disabled={!chosen.length} onClick={() => onConfirm(chosen)} data-testid="juntar-confirmar" className="rounded-full border border-cyan/50 bg-cyan/15 px-5 py-1.5 text-xs font-medium text-cyan transition hover:-translate-y-0.5 hover:bg-cyan/25 active:scale-95 disabled:opacity-40">Juntar {chosen.length ? `(${chosen.length})` : ""}</button>
        </footer>
      </div>
    </div>, document.body);
}

/** Checklist da demanda: marcar (risca), adicionar, tirar, limpar o que foi feito e marcar passos como "Aguardando retorno" (de quem + observação). */
function ChecklistBlock({ items, onChange }: { items: CheckItem[]; onChange: (next: CheckItem[]) => void }) {
  const [text, setText] = useState(""), [waitFor, setWaitFor] = useState<number | null>(null), [from, setFrom] = useState(""), [note, setNote] = useState("");
  const done = items.filter((c) => c.done).length, pct = items.length ? Math.round((done / items.length) * 100) : 0, waiting = items.filter((c) => c.wait && !c.done).length;
  const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  /** Tira o "aguardando" repetido que a pessoa digitou no campo "de quem" e encurta. */
  const waitWho = (v: string) => v.replace(/^\s*aguardando(\s+retorno)?(\s+d[eao]s?)?\s*/i, "").trim().slice(0, 40);
  const startWait = (i: number) => { const w = items[i]?.wait; setWaitFor(i); setFrom(w?.from ?? ""); setNote(w?.note ?? ""); };
  const saveWait = () => { if (waitFor === null) return; onChange(items.map((c, k) => (k === waitFor ? { ...c, wait: { from: from.trim().slice(0, 120), note: note.trim().slice(0, 1000), since: c.wait?.since || todayIso() } } : c))); setWaitFor(null); };
  const since = (iso: string) => { if (!iso) return ""; const d = Math.round((new Date(`${todayIso()}T12:00:00`).getTime() - new Date(`${iso}T12:00:00`).getTime()) / 864e5); return d <= 0 ? "desde hoje" : d === 1 ? "desde ontem" : `há ${d} dias`; };
  return (
    <Block title="Checklist" right={items.length ? <span className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="checklist-contagem">{waiting > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2 py-0.5 text-amber" title="Passos aguardando retorno"><Hourglass size={11} /> {waiting}</span>}<span><b className="text-foreground">{done}</b> de <b className="text-foreground">{items.length}</b> · {pct}%</span></span> : <CheckSquare size={14} className="text-muted-foreground" />}>
      {!!items.length && (
        <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--cyan),var(--emerald))", boxShadow: "0 0 12px var(--cyan)" }} />
        </div>
      )}
      <ul className="space-y-1.5" data-testid="checklist">
        {items.map((c, i) => (
          <li key={i} className={`group rounded-xl border px-2.5 py-2 transition ${c.wait && !c.done ? "border-amber/40 bg-amber/[0.06]" : "border-white/10 bg-white/[0.03] hover:border-cyan/40 hover:bg-white/[0.06]"}`}>
            <div className="flex items-start gap-2.5">
              <button onClick={() => onChange(items.map((x, k) => (k === i ? { ...x, done: !x.done, wait: !x.done ? undefined : x.wait } : x)))} aria-label={c.done ? "Desmarcar" : "Marcar como feito"} aria-pressed={c.done} className="mt-0.5 shrink-0 transition active:scale-90">
                {c.done ? <CheckCircle2 size={18} className="text-emerald drop-shadow-[0_0_6px_var(--emerald)]" /> : <Circle size={18} className="text-muted-foreground transition group-hover:text-cyan" />}
              </button>
              <span className={`min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-xs leading-snug transition ${c.done ? "text-muted-foreground line-through decoration-emerald/60" : "text-foreground"}`}>{c.text}</span>
              {!c.done && !c.wait && <button onClick={() => startWait(i)} aria-label="Marcar como aguardando retorno" title="Aguardando retorno" data-testid="aguardar" className="shrink-0 text-muted-foreground/70 transition hover:scale-110 hover:text-amber"><Hourglass size={14} /></button>}
              <button onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Tirar do checklist" className="shrink-0 text-muted-foreground opacity-0 transition hover:text-pink group-hover:opacity-100 max-md:opacity-100"><X size={13} /></button>
            </div>
            {c.wait && !c.done && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[1.65rem]" data-testid="passo-aguardando">
                <span className="group/w relative min-w-0 max-w-full">
                  <button type="button" onClick={() => startWait(i)} className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber/50 bg-amber/15 px-2.5 py-0.5 text-[0.68rem] font-medium text-amber transition hover:bg-amber/25"><Hourglass size={10} className="shrink-0 animate-pulse" /><span className="truncate">Aguardando{waitWho(c.wait.from) ? ` ${waitWho(c.wait.from)}` : ""}</span></button>
                  <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-64 max-w-[80vw] translate-y-1 rounded-xl border border-amber/40 bg-[oklch(0.15_0.04_265/0.96)] p-3 text-left text-xs opacity-0 shadow-[0_18px_50px_-20px_var(--amber)] backdrop-blur-xl transition duration-200 group-hover/w:translate-y-0 group-hover/w:opacity-100">
                    <b className="flex items-center gap-1.5 text-amber"><Hourglass size={11} /> Aguardando retorno{waitWho(c.wait.from) ? ` de ${waitWho(c.wait.from)}` : ""}</b>
                    <span className="mt-1 block whitespace-pre-wrap break-words text-foreground/90">{c.wait.note || "Sem observação."}</span>
                    {c.wait.since && <span className="mt-1.5 block font-mono text-[0.65rem] text-muted-foreground">{since(c.wait.since)}</span>}
                  </span>
                </span>
                <button onClick={() => onChange(items.map((x, k) => (k === i ? { ...x, wait: undefined } : x)))} aria-label="Recebi o retorno" title="Recebi o retorno" data-testid="recebi" className="shrink-0 rounded-full border border-emerald/40 px-2 py-0.5 text-[0.65rem] text-emerald transition hover:bg-emerald/15 active:scale-95">Recebi</button>
              </div>
            )}
            {waitFor === i && (
              <form onSubmit={(e) => { e.preventDefault(); saveWait(); }} className="mt-2 space-y-1.5 rounded-lg border border-amber/30 bg-black/25 p-2" style={{ animation: "fin-rise .25s both" }}>
                <input autoFocus value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Aguardando retorno de quem? (ex.: Daniel)" className="w-full rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs outline-none focus:border-amber/60" data-testid="aguardando-de" />
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Observação: o que falta (ex.: planilha da base, aprovação do template…)" className="w-full resize-y rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs outline-none focus:border-amber/60" data-testid="aguardando-nota" />
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setWaitFor(null)} className="px-2 text-[0.7rem] text-muted-foreground hover:text-foreground">Cancelar</button><button type="submit" className="rounded-full border border-amber/50 bg-amber/15 px-3 py-0.5 text-[0.7rem] font-medium text-amber transition hover:bg-amber/25 active:scale-95" data-testid="aguardando-salvar">Marcar como aguardando</button></div>
              </form>
            )}
          </li>
        ))}
        {!items.length && <li className="text-xs text-muted-foreground">Sem passos ainda. Adicione abaixo, ou peça ao Orion para juntar demandas do mesmo dossiê.</li>}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) { onChange([...items, { text: t.slice(0, 500), done: false }]); setText(""); } }} className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Adicionar passo…" data-testid="checklist-novo" className="flex-1 bg-transparent text-xs outline-none" />
        <button className="text-cyan transition hover:scale-110" aria-label="Adicionar passo"><Plus size={14} /></button>
      </form>
      {done > 0 && <button onClick={() => onChange(items.filter((c) => !c.done))} className="mt-2 text-[0.65rem] text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline">Limpar os {done} já feitos</button>}
    </Block>
  );
}

function DetailPanel({ demand: d, autoEdit, storageKey, dossiers, onClose, onStatus, onPolo, onAddPolos, onPoloNote, onEdit, onNote, onDelete, inTasks, onAddTask }: {
  inTasks?: boolean; onAddTask?: () => void;
  demand: Demand | null; autoEdit: boolean; storageKey: string | null; dossiers: string[]; onClose: () => void; onStatus: (s: Status) => void; onPolo: (p: string) => void;
  onAddPolos: (names: string[]) => void; onPoloNote: (p: string, t: string) => void;
  onEdit: (p: Partial<Demand>) => void; onNote: (t: string) => void; onDelete: () => void;
}) {
  const L = useLabel();
  const tmeta = useTM();
  const sing = L.singular.toLowerCase();
  const plur = L.plural.toLowerCase();
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [histOpen, setHistOpen] = useState(true);
  const [editing, setEditing] = useState(autoEdit);
  const [note, setNote] = useState("");
  const [menu, setMenu] = useState(false);
  if (!d) return null;
  const m = tmeta[d.type];
  const pct = progress(d);
  const doneN = d.polos?.filter((p) => p.status === "done").length ?? 0;
  const nextPolo = d.polos?.find((p) => p.status === "doing") ?? d.polos?.find((p) => p.status === "todo");

  return (
    <>
      <div {...backdropProps(onClose)} className="fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px] animate-in fade-in xl:hidden" />
      <aside style={tint(m.color)}
        className="fixed bottom-3 right-3 top-3 z-50 flex w-[min(470px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl max-md:!inset-x-0 max-md:!bottom-0 max-md:!right-0 max-md:!top-12 max-md:!w-full max-md:!rounded-b-none animate-[vp-in_.4s_ease_both] border border-[color-mix(in_oklab,var(--glow)_35%,transparent)] bg-[linear-gradient(170deg,oklch(0.19_0.045_262/0.96),oklch(0.13_0.03_262/0.97))] shadow-[0_0_80px_-20px_var(--glow)] backdrop-blur-2xl animate-in slide-in-from-right-12 fade-in duration-500">
        <div aria-hidden className="relative z-10 mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_30%_0%,color-mix(in_oklab,var(--glow)_22%,transparent),transparent)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[var(--glow)] to-transparent opacity-70" />

        <div className="scroll-neon relative flex-1 space-y-4 overflow-y-auto p-5">
          {/* cabeçalho */}
          <div className="flex gap-4">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--glow)_40%,transparent)] bg-[color-mix(in_oklab,var(--glow)_14%,transparent)] text-[var(--glow)] shadow-[0_0_30px_-8px_var(--glow)]">
              <FolderOpen size={30} className="animate-float" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="tag !text-[0.6rem]">{m.label.replace("Demandas", "Demanda").replace(/s$/, "")}</span>
              {editing ? (
                <input autoFocus value={d.title} onChange={(e) => onEdit({ title: e.target.value })} className="mt-2 w-full rounded-lg border border-border bg-secondary/60 px-2 py-1 font-display text-lg font-bold outline-none" />
              ) : <h2 className="mt-2 font-display text-xl font-bold leading-tight">{d.title}</h2>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{d.id}</span>·<span>Prioridade:</span>
                {editing ? (
                  <select value={d.priority} onChange={(e) => onEdit({ priority: e.target.value as Priority })} className="rounded bg-secondary px-1 [&>option]:bg-popover">
                    {(Object.keys(prio) as Priority[]).map((p) => <option key={p} value={p}>{prio[p].label}</option>)}
                  </select>
                ) : <span className="tag !normal-case !tracking-normal" style={tint(prio[d.priority].color)}>{prio[d.priority].label}</span>}
              </div>
            </div>
            <button onClick={onClose} className="self-start rounded-full p-1.5 text-muted-foreground transition hover:rotate-90 hover:bg-secondary hover:text-foreground" aria-label="Fechar"><X size={18} /></button>
          </div>
          {editing ? (
            <div className="relative"><textarea value={d.desc} onChange={(e) => onEdit({ desc: e.target.value })} rows={3} className="w-full rounded-xl border border-border bg-secondary/60 p-2 pr-12 text-sm outline-none" /><DictateButton onText={(t) => onEdit({ desc: appendSpoken(d.desc, t, "\n") })} label="Descrição" /></div>
          ) : <p className="text-sm leading-relaxed text-muted-foreground">{d.desc}</p>}

          {/* meta */}
          <div className="grid grid-cols-3 gap-2">
            <Meta icon={Calendar} label="Prazo">{editing ? <input value={d.deadline} onChange={(e) => onEdit({ deadline: e.target.value })} className="w-full bg-transparent outline-none" /> : d.deadline}</Meta>
            <Meta icon={d.polos ? Network : MapPin} label={d.polos ? L.plural : L.singular}>{d.polos ? d.polos.length : editing && d.type === "polo" ? (
              <select value={d.polo ?? ""} onChange={(e) => onEdit({ polo: e.target.value })} className="w-full bg-transparent outline-none [&>option]:bg-popover">
                {!d.polo && <option value="">—</option>}{dossiers.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : d.polo ?? "—"}</Meta>
            <Meta icon={Clock} label="Atualização">{d.history.at(-1)?.d ?? "—"}</Meta>
          </div>

          <DemandMaterials storageKey={storageKey} />

          {/* status */}
          <Block title="Status">
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => onStatus(s)} style={tint(statusMeta[s].color)}
                  className={`rounded-xl border py-2 text-xs transition ${d.status === s ? "border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_15%,transparent)] text-[var(--glow)] shadow-[0_0_20px_-6px_var(--glow)]" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {statusMeta[s].label.replace(/s$/, "")}
                </button>
              ))}
            </div>
            {d.polos && <p className="mt-2 text-[0.65rem] text-muted-foreground">Em demandas para vários, o status é calculado pelo andamento de cada um.</p>}
          </Block>

          {/* progresso */}
          <Block title="Progresso geral" right={d.polos ? <span className="text-xs text-muted-foreground"><b className="text-foreground">{doneN}</b> de <b className="text-foreground">{d.polos.length}</b> {plur} concluídos</span> : null}>
            <div className="flex items-center gap-3">
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--cyan),var(--emerald))", boxShadow: "0 0 14px var(--cyan)" }} />
                <span className="absolute inset-0 animate-[shimmer_2.5s_linear_infinite] bg-[linear-gradient(90deg,transparent,oklch(1_0_0/.25),transparent)] bg-[length:40%_100%] bg-no-repeat" />
              </div>
              <span className="font-mono text-sm">{pct}%</span>
            </div>
          </Block>

          {/* polos */}
          {d.polos && (
            <Block title={`Execução por ${sing}`} right={<button onClick={() => { setAdding((a) => !a); setToAdd([]); }} data-testid="add-dossies" className="tag flex items-center gap-1" style={tint("cyan")}><Plus size={10} /> Adicionar {plur}</button>}>
              {adding && (
                <div className="mb-3 space-y-2">
                  <TargetPicker names={dossiers.filter((n) => !d.polos!.some((p) => p.name === n))} value={toAdd} onChange={setToAdd} />
                  <button disabled={!toAdd.length} onClick={() => { onAddPolos(toAdd); setAdding(false); setToAdd([]); }} className="w-full rounded-xl border border-cyan/60 bg-cyan/10 py-2 text-xs text-cyan transition hover:bg-cyan/20 disabled:opacity-40">Adicionar {toAdd.length || ""} à demanda</button>
                </div>
              )}
              <div className="divide-y divide-border">
                {d.polos.map((p) => {
                  const sm = statusMeta[p.status];
                  return (
                    <div key={p.name} style={tint(sm.color)}>
                      <div className="group flex w-full items-center gap-3 py-2.5 text-left text-sm transition hover:bg-secondary/30">
                        <button onClick={() => onPolo(p.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          {p.status === "done" ? <CheckCircle2 size={20} className="shrink-0 text-emerald drop-shadow-[0_0_6px_var(--emerald)]" />
                            : p.status === "doing" ? <Loader size={20} className="shrink-0 animate-[spin_3s_linear_infinite] text-amber" />
                            : <Circle size={20} className="shrink-0 text-muted-foreground" />}
                          <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                          <span className="hidden items-center gap-1 text-[0.65rem] text-muted-foreground sm:flex">
                            {p.status === "done" ? <><Calendar size={11} /> Concluído em {p.date}</> : p.status === "doing" ? <><Clock size={11} /> Em andamento</> : <><Clock size={11} /> Pendente</>}
                          </span>
                        </button>
                        <button onClick={() => setNoteOpen((x) => (x === p.name ? null : p.name))} aria-label={`Observação de ${p.name}`} className={`transition hover:text-cyan ${p.note ? "text-cyan" : "text-muted-foreground"}`}><FileText size={14} /></button>
                        <button onClick={() => onPolo(p.name)} className="w-24 rounded-full border px-2 py-0.5 text-center text-[0.65rem] transition hover:scale-105"
                          style={{ color: p.status === "todo" ? "var(--color-muted-foreground)" : `var(--${p.status === "doing" ? "amber" : "emerald"})`, borderColor: "currentColor", background: p.status === "todo" ? "transparent" : "color-mix(in oklab, currentColor 12%, transparent)" }}>
                          {sm.poloLabel}
                        </button>
                      </div>
                      {(noteOpen === p.name || p.note) && (
                        <input value={p.note ?? ""} onChange={(e) => onPoloNote(p.name, e.target.value)} placeholder={`Observação de ${p.name}…`}
                          className="mb-2 w-full rounded-lg border border-border bg-secondary/40 px-2 py-1 text-xs outline-none focus:border-cyan/60" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[0.65rem]">
                <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-2"><p className="mono-caps !text-emerald">Concluído</p><p className="mt-1">{d.polos.filter((p) => p.status === "done").map((p) => p.name).join(", ") || "—"}</p></div>
                <div className="rounded-xl border border-amber/30 bg-amber/5 p-2"><p className="mono-caps !text-amber">Falta</p><p className="mt-1">{d.polos.filter((p) => p.status !== "done").map((p) => p.name).join(", ") || "Nada 🎉"}</p></div>
              </div>
              <p className="mt-2 text-[0.6rem] text-muted-foreground">Toque em um item para avançar o status dele; o ícone ao lado guarda uma observação só dele.</p>
            </Block>
          )}

          {/* tarefas */}
          {onAddTask && (
            <button type="button" onClick={onAddTask} data-testid="adicionar-tarefa" className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 active:scale-[.99] ${inTasks ? "border-emerald/40 bg-emerald/[0.07]" : "border-violet/40 bg-violet/[0.07] hover:bg-violet/[0.12]"}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${inTasks ? "bg-emerald/15 text-emerald" : "bg-violet/15 text-violet"}`}>{inTasks ? <CheckCircle2 size={18} /> : <ListChecks size={18} />}</span>
              <span className="min-w-0 flex-1"><b className="block font-medium">{inTasks ? "Já está nas Tarefas" : "Adicionar às Tarefas"}</b><span className="text-xs text-muted-foreground">{inTasks ? "Categoria “Demandas”. Toque para ver na lista de Tarefas." : "Cria uma tarefa na categoria “Demandas”, com o prazo e a prioridade desta demanda."}</span></span>
              <ArrowRight size={15} className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
            </button>
          )}

          {/* checklist */}
          <ChecklistBlock items={d.checklist ?? []} onChange={(checklist) => onEdit({ checklist })} />

          {/* observações */}
          <Block title="Observações" right={<MessageSquare size={14} className="text-muted-foreground" />}>
            <div className="space-y-2">
              {d.notes.map((n, i) => <p key={i} className="rounded-xl border-l-2 border-violet bg-violet/5 px-3 py-2 text-xs">{n}</p>)}
              {!d.notes.length && <p className="text-xs text-muted-foreground">Sem observações ainda.</p>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) { onNote(note.trim()); setNote(""); } }} className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-1.5">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicionar observação…" className="flex-1 bg-transparent text-xs outline-none" />
              <button className="text-cyan transition hover:scale-110"><Send size={13} /></button>
            </form>
          </Block>

          {/* histórico */}
          <div className="rounded-2xl border border-border bg-secondary/25 p-4">
            <button onClick={() => setHistOpen((o) => !o)} className="flex w-full items-center gap-2">
              <History size={16} /><span className="flex-1 text-left font-medium">Histórico de atualizações</span>
              <ChevronDown size={15} className={`transition ${histOpen ? "rotate-180" : ""}`} />
            </button>
            {histOpen && (
              <ol className="relative mt-3 space-y-3 border-l border-border pl-4 animate-in fade-in slide-in-from-top-1">
                {[...d.history].reverse().map((h, i) => (
                  <li key={i} className="relative text-xs">
                    <span className="absolute -left-[22px] top-0.5 grid h-3 w-3 place-items-center rounded-full" style={{ background: `var(--${statusMeta[h.s].color})`, boxShadow: `0 0 8px var(--${statusMeta[h.s].color})` }} />
                    <span className="font-mono text-muted-foreground">{h.d}</span> — {h.text}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* ações */}
        <div className="relative flex gap-2 border-t border-border p-4">
          {d.polos ? (
            <button disabled={!nextPolo} onClick={() => nextPolo && onPolo(nextPolo.name)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan/60 bg-cyan/10 py-2.5 text-sm text-cyan shadow-[0_0_24px_-8px_var(--cyan)] transition hover:bg-cyan/20 disabled:opacity-40">
              <Check size={15} /> {nextPolo ? `Avançar ${nextPolo.name}` : "Todos concluídos"}
            </button>
          ) : (
            <button disabled={d.status === "done"} onClick={() => onStatus(d.status === "todo" ? "doing" : "done")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan/60 bg-cyan/10 py-2.5 text-sm text-cyan shadow-[0_0_24px_-8px_var(--cyan)] transition hover:bg-cyan/20 disabled:opacity-40">
              <SquareCheck size={15} /> {d.status === "todo" ? "Iniciar demanda" : d.status === "doing" ? "Marcar como concluída" : "Concluída"}
            </button>
          )}
          <button onClick={() => setEditing((e) => !e)} className="flex items-center gap-2 rounded-xl border border-border px-4 text-sm transition hover:border-cyan/40">
            {editing ? <><Check size={14} /> Salvar</> : <><Pencil size={14} /> Editar</>}
          </button>
          <div className="relative">
            <button onClick={() => setMenu((x) => !x)} className="grid h-full place-items-center rounded-xl border border-border px-3 transition hover:border-cyan/40"><MoreHorizontal size={16} /></button>
            {menu && (
              <div className="glass absolute bottom-full right-0 mb-2 w-44 rounded-xl p-1 animate-in fade-in zoom-in-95">
                <button onClick={() => { onStatus("todo"); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-secondary"><Filter size={12} /> Reabrir demanda</button>
                <button onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-destructive hover:bg-secondary"><Trash2 size={12} /> Excluir</button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function Meta({ icon: I, label, children }: { icon: typeof Calendar; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-2.5">
      <p className="mono-caps flex items-center gap-1 !text-[0.5rem]"><I size={10} /> {label}</p>
      <div className="mt-1 truncate text-sm font-medium">{children}</div>
    </div>
  );
}

function Block({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-secondary/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-medium">{title}</h3>{right}</div>
      {children}
    </section>
  );
}
