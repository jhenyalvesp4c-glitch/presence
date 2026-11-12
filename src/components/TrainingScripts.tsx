import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { backdropProps } from "@/lib/backdrop";
import { toast } from "sonner";
import { useCategories, useToggleTask } from "@/lib/data/tasks";
import { useDeleteTraining, useSaveTraining, useTrainings } from "@/lib/data/trainings";
import { sortTrainings, trainingStatus, type Training, type TrainingDraft } from "@/lib/trainings";
import { todayIso } from "@/lib/dates";
import { useDbState } from "@/lib/data/use-db-state";
import { loadLibrary, saveLibrary } from "@/lib/data/training-library";
import {
  addFolder, folderNames, mediaOf, withMedia, type MediaFile, moveBlock, removeBlock, removeExample, removeFolder, removeScript, renameFolder, seedLibrary, setShowItem, upsertBlock, upsertExample, upsertScript,
  type Block, type Example, type Pin, type Script, type Visual,
} from "@/lib/training-library";
import { BlockEditor, ExampleEditor, ScriptEditor } from "./training-editors";
import { TrainingPresenter } from "./training-presenter";
import { TrainingGenerator } from "./training-generator";
import { MediaViewer } from "./media-viewer";
import { toPending } from "@/lib/brain-files";
import { uploadFiles } from "@/lib/data/brain";
import { primePaths, primeVisuals } from "./training-images";
import { visualSrc } from "./training-images";
import {
  ArrowRight, Paperclip, FolderPlus, FolderOpen, Folder as FolderIcon, ChevronRight, Wand2, Mic, CalendarDays, Check, ChevronDown, Clock, Copy, GraduationCap, Lightbulb, MessageCircleQuestion,
  Play, Plus, RotateCcw, Search, Sparkles, Square, Target, Users, X, ImageIcon, Maximize2, MapPin, Pencil, Trash2, CalendarPlus, ThumbsUp, ArrowDown, ArrowUp, CheckCircle2,
} from "lucide-react";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function TrainingScripts({ projectId }: { projectId: string }) {
  const [lib, setLib, ready] = useDbState(`training-library-${projectId}`, seedLibrary(), () => loadLibrary(projectId), (p, n) => saveLibrary(projectId, p, n));
  const { scripts, examples } = lib;
  // Imagens enviadas pela usuária (Storage): busca os endereços e redesenha quando chegarem.
  useEffect(() => {
    const vs = scripts.flatMap((sc) => sc.blocks.flatMap((b) => b.visuals ?? [])).concat(examples.flatMap((e) => (e.visual ? [e.visual] : [])));
    const media = scripts.flatMap((sc) => sc.blocks.flatMap((b) => Object.values(b.media ?? {}).flat().map((f) => f.path)));
    Promise.all([primeVisuals(vs), primePaths(media)]).then(([a, b]) => { if (a || b) setTick((t) => t + 1); }).catch(() => undefined);
  }, [scripts, examples]);
  const [selId, setSelId] = useState("s1");
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [openB, setOpenB] = useState<Record<string, boolean>>({ b3: true });
  const lesson = false; // o antigo "modo aula" virou a apresentação em slides
  const [presenting, setPresenting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [folderForm, setFolderForm] = useState<{ from: string | null; name: string } | null>(null);
  const [, setTick] = useState(0);
  const [viewer, setViewer] = useState<{ title: string; files: MediaFile[] } | null>(null);
  const [attachTo, setAttachTo] = useState<{ block: string; i: number } | null>(null);
  const itemInput = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todos");
  const [hl, setHl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ block: string; text: string } | null>(null);
  const [zoom, setZoom] = useState<Visual | null>(null);
  const [editing, setEditing] = useState<Training | "new" | null>(null);
  const [editScript, setEditScript] = useState<Script | "new" | null>(null);
  const [editBlock, setEditBlock] = useState<Block | "new" | null>(null);
  const [editExample, setEditExample] = useState<Example | "new" | null>(null);
  const [editItem, setEditItem] = useState<{ block: string; i: number; text: string } | null>(null);

  // Turmas: salvas de verdade, como compromissos do calendário.
  const today = todayIso();
  const trainingsQ = useTrainings();
  const catsQ = useCategories();
  const compId = (catsQ.data ?? []).find((c) => c.slug === "comp")?.id;
  const saveT = useSaveTraining(compId, projectId);
  const delT = useDeleteTraining();
  const toggleT = useToggleTask();
  const turmas = useMemo(() => sortTrainings(trainingsQ.data ?? [], today), [trainingsQ.data, today]);
  const lastClassOf = (s: Script) => {
    const past = turmas.filter((t) => t.scriptKey === s.id && t.date <= today).map((t) => t.date).sort();
    return past.length ? ddmm(past[past.length - 1]!) : "—";
  };
  const saveTraining = (draft: TrainingDraft, existing?: Training) =>
    saveT.mutate({ draft, existing }, {
      onSuccess: () => { toast.success(existing ? "Turma atualizada" : "Turma agendada · já está no Calendário"); setEditing(null); },
      onError: (e) => toast.error(`Não consegui salvar a turma: ${e.message}`),
    });
  const removeTraining = (t: Training) => {
    if (!window.confirm(`Excluir a turma "${t.group}"? Ela sai do Calendário também.`)) return;
    delT.mutate(t, { onSuccess: () => { toast.success("Turma excluída"); setEditing(null); }, onError: (e) => toast.error(`Não consegui excluir: ${e.message}`) });
  };

  const sel: Script | undefined = scripts.find((s) => s.id === selId) ?? scripts[0];
  const items = (sel?.blocks ?? []).flatMap((b) => b.show.map((_, i) => `${b.id}:${i}`));
  const doneCount = items.filter((k) => shown[k]).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const totalMin = (sel?.blocks ?? []).reduce((a, b) => a + b.minutes, 0);
  const cats = ["Todos", ...Array.from(new Set(examples.map((e) => e.cat)))];
  const exFiltered = useMemo(() => examples.filter((e) =>
    (cat === "Todos" || e.cat === cat) && (e.title + e.situation + e.text).toLowerCase().includes(q.toLowerCase())), [examples, cat, q]);

  const toggle = (k: string) => setShown((s) => ({ ...s, [k]: !s[k] }));
  const attachToItem = async (files: File[]) => {
    const t = attachTo; setAttachTo(null);
    if (!t || !files.length || !sel) return;
    const { added, rejected } = await toPending(files, []).catch((e) => ({ added: [], rejected: [(e as Error).message] }));
    if (rejected.length) toast.error(rejected.join(" · "));
    if (!added.length) return;
    try {
      const up = await uploadFiles("treinamentos", added.map((p) => ({ name: p.name, mime: p.mime, blob: p.blob })));
      setLib((l) => {
        const bl = l.scripts.find((x) => x.id === sel.id)?.blocks.find((x) => x.id === t.block);
        return bl ? upsertBlock(l, sel.id, withMedia(bl, t.i, [...mediaOf(bl, t.i), ...up])) : l;
      });
      toast.success(up.length > 1 ? "Arquivos anexados ao passo" : "Arquivo anexado ao passo");
    } catch (e) { toast.error(`Não consegui anexar: ${(e as Error).message}`); }
  };
  const ScriptCard = ({ sc }: { sc: Script }) => {
    const on = sc.id === sel?.id;
    const its = sc.blocks.flatMap((b) => b.show.map((_, i) => `${b.id}:${i}`));
    const p = its.length ? Math.round((its.filter((k) => shown[k]).length / its.length) * 100) : 0;
    return (
      <button onClick={() => setSelId(sc.id)} style={tint(sc.color)} data-testid="roteiro-card"
        className={`accent-card block w-full !rounded-2xl p-3 text-left transition ${on ? "!border-[color-mix(in_oklab,var(--glow)_70%,transparent)] shadow-[0_0_30px_-10px_var(--glow)]" : ""}`}>
        <span className="line-clamp-2 break-words text-sm font-semibold">{sc.title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[0.68rem] text-muted-foreground"><Users size={10} /> <span className="truncate">{sc.audience || "—"}</span></span>
        <span className="mt-2 flex items-center gap-2 text-[0.62rem] text-muted-foreground">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-[var(--glow)] transition-all" style={{ width: `${p}%` }} /></span>
          {sc.blocks.length} blocos
        </span>
      </button>
    );
  };
  const reset = () => setShown((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !items.includes(k))));
  const copy = (e: Example) => { navigator.clipboard?.writeText(e.text).catch(() => {}); setCopied(e.id); setTimeout(() => setCopied(null), 1200); };
  const focusExample = (id: string) => {
    setHl(id); setCat("Todos"); setQ("");
    setTimeout(() => document.getElementById(`ex-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    setTimeout(() => setHl((h) => (h === id ? null : h)), 2200);
  };
  const addItem = () => {
    if (sel && adding?.text.trim()) setLib((l) => setShowItem(l, sel.id, adding.block, Number.MAX_SAFE_INTEGER, adding.text));
    setAdding(null);
  };
  const saveItem = () => {
    if (!sel || !editItem) return;
    if (editItem.text.trim()) setLib((l) => setShowItem(l, sel.id, editItem.block, editItem.i, editItem.text));
    setEditItem(null);
  };
  const deleteItem = (bid: string, i: number) => {
    if (!sel) return;
    setLib((l) => setShowItem(l, sel.id, bid, i, null));
    // os itens de baixo sobem uma posição; o "já mostrado" acompanha
    setShown((sh) => {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(sh)) {
        const [b, n] = k.split(":"); const idx = Number(n);
        if (b !== bid) out[k] = v; else if (idx < i) out[k] = v; else if (idx > i) out[`${b}:${idx - 1}`] = v;
      }
      return out;
    });
  };
  const saveScript = (sc: Script) => {
    setLib((l) => upsertScript(l, sc));
    if (editScript === "new") { setSelId(sc.id); toast.success("Roteiro criado"); } else toast.success("Roteiro salvo");
    setEditScript(null);
  };
  const deleteScript = (sc: Script) => {
    if (!window.confirm(`Excluir o roteiro "${sc.title}" com todos os blocos? As turmas já agendadas continuam no calendário.`)) return;
    setLib((l) => removeScript(l, sc.id));
    setEditScript(null); toast.success("Roteiro excluído");
  };
  const saveBlock = (b: Block) => {
    if (!sel) return;
    setLib((l) => upsertBlock(l, sel.id, b));
    if (editBlock === "new") setOpenB((o) => ({ ...o, [b.id]: true }));
    setEditBlock(null); toast.success(editBlock === "new" ? "Bloco criado" : "Bloco salvo");
  };
  const deleteBlock = (b: Block) => {
    if (!sel || !window.confirm(`Excluir o bloco "${b.title}"?`)) return;
    setLib((l) => removeBlock(l, sel.id, b.id));
    setEditBlock(null); toast.success("Bloco excluído");
  };
  const saveExample = (e: Example) => {
    setLib((l) => upsertExample(l, e));
    setEditExample(null); toast.success(editExample === "new" ? "Exemplo criado" : "Exemplo salvo");
  };
  const deleteExample = (e: Example) => {
    if (!window.confirm(`Excluir o exemplo "${e.title}"? Ele sai também dos blocos que o usam.`)) return;
    setLib((l) => removeExample(l, e.id));
    setEditExample(null); toast.success("Exemplo excluído");
  };

  const stats = [
    { l: "Roteiros", v: scripts.length, c: "cyan", I: GraduationCap },
    { l: "Exemplos", v: examples.length, c: "violet", I: Sparkles },
    { l: "Próximas turmas", v: turmas.filter((t) => trainingStatus(t, today) === "proxima").length, c: "amber", I: CalendarDays },
    { l: "Pessoas treinadas", v: turmas.filter((t) => t.done).reduce((a, t) => a + t.people, 0), c: "emerald", I: Users },
  ];

  return (
    <div className="space-y-4">
      <p className="mono-caps flex items-center gap-2 !text-[0.6rem]"><Sparkles size={10} /> {ready ? "Tudo aqui pode ser editado e excluído · salva sozinho" : "Carregando…"}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className="accent-card flex items-center gap-3 !rounded-2xl p-4 animate-rise" style={{ ...tint(s.c), animationDelay: `${i * 0.05}s` }}>
            <span className="icon-tile h-11 w-11 shrink-0"><s.I size={18} /></span>
            <div><p className="font-display text-2xl font-bold tabular-nums">{s.v}</p><p className="text-[0.7rem] text-muted-foreground">{s.l}</p></div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
        {/* roteiros + turmas */}
        <aside className="space-y-4">
          <div className="glass rounded-3xl p-4 animate-rise">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Roteiros</h2>
              <button onClick={() => setEditScript("new")} className="flex items-center gap-1 rounded-full border border-cyan/60 px-3 py-1 text-xs text-cyan transition hover:bg-cyan/10"><Plus size={12} /> Novo</button>
            </div>
            <button onClick={() => setGenerating(true)} data-testid="criar-com-ia"
              className="group relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-brand px-3 py-2.5 text-xs font-semibold text-primary-foreground shadow-[0_0_28px_-8px_var(--violet)] transition hover:scale-[1.02] hover:shadow-[0_0_36px_-4px_var(--violet)]">
              <span aria-hidden className="absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-white/30 transition duration-700 group-hover:left-[150%]" />
              <Wand2 size={14} className="relative" /> <span className="relative">Criar roteiro com o Presence</span>
            </button>
            <div className="mt-3 flex items-center gap-2">
              <p className="mono-caps mr-auto !text-[0.58rem]">Pastas</p>
              <button onClick={() => setFolderForm({ from: null, name: "" })} data-testid="nova-pasta-roteiro" className="flex items-center gap-1 text-[0.7rem] text-muted-foreground transition hover:text-cyan"><FolderPlus size={12} /> Nova pasta</button>
            </div>
            {folderForm && (
              <form onSubmit={(e) => { e.preventDefault(); const n = folderForm.name.trim(); if (n) { setLib((l) => (folderForm.from ? renameFolder(l, folderForm.from, n) : addFolder(l, n))); } setFolderForm(null); }} className="mt-2 flex items-center gap-2 rounded-xl border border-cyan/60 px-3 py-1.5">
                <FolderIcon size={13} className="text-cyan" />
                <input autoFocus value={folderForm.name} onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })} onBlur={() => setFolderForm(null)} onKeyDown={(e) => e.key === "Escape" && setFolderForm(null)} maxLength={60} placeholder="Nome da pasta" data-testid="nome-pasta-roteiro" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
              </form>
            )}
            <div className="mt-2 space-y-2">
              {scripts.length === 0 && folderNames(lib).length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nenhum roteiro. Crie um com o Presence ou em "Novo".</p>}
              {[...folderNames(lib), ""].map((fname) => {
                const list = scripts.filter((sc) => (sc.folder ?? "") === fname);
                if (fname === "" && (list.length === 0 || folderNames(lib).length === 0)) {
                  return list.map((sc) => <ScriptCard key={sc.id} sc={sc} />);
                }
                const closed = !!collapsed[fname || "__none__"];
                return (
                  <div key={fname || "__none__"} data-testid={`pasta-${fname || "sem-pasta"}`} className="rounded-2xl border border-border/70 bg-secondary/15">
                    <div className="group/f flex items-center gap-1 pr-1.5">
                      <button onClick={() => setCollapsed((c) => ({ ...c, [fname || "__none__"]: !closed }))} aria-expanded={!closed} className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left">
                        <ChevronRight size={13} className={`shrink-0 text-muted-foreground transition-transform ${closed ? "" : "rotate-90"}`} />
                        {closed ? <FolderIcon size={15} className="shrink-0 text-amber" /> : <FolderOpen size={15} className="shrink-0 text-amber" />}
                        <span className="min-w-0 flex-1 truncate text-[0.8rem] font-medium">{fname || "Sem pasta"}</span>
                        <span className="rounded-full border border-border px-1.5 text-[0.6rem] tabular-nums text-muted-foreground">{list.length}</span>
                      </button>
                      {fname && (
                        <span className="flex opacity-0 transition focus-within:opacity-100 group-hover/f:opacity-100 [@media(hover:none)]:opacity-100">
                          <button onClick={() => setFolderForm({ from: fname, name: fname })} aria-label={`Renomear pasta ${fname}`} title="Renomear" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil size={11} /></button>
                          <button onClick={() => { if (window.confirm(list.length ? `Excluir a pasta "${fname}"? Os ${list.length} roteiro(s) dela vão para "Sem pasta".` : `Excluir a pasta "${fname}"?`)) setLib((l) => removeFolder(l, fname)); }} aria-label={`Excluir pasta ${fname}`} title="Excluir pasta" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-pink"><Trash2 size={11} /></button>
                        </span>
                      )}
                    </div>
                    {!closed && <div className="space-y-2 px-2 pb-2">{list.map((sc) => <ScriptCard key={sc.id} sc={sc} />)}{list.length === 0 && <p className="px-2 pb-1 text-[0.65rem] text-muted-foreground">Pasta vazia. Crie um roteiro e escolha esta pasta.</p>}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-3xl p-4 animate-rise" style={{ animationDelay: ".05s" }}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold"><CalendarDays size={15} className="text-amber" /> Turmas</h3>
              <button onClick={() => setEditing("new")} className="flex items-center gap-1 rounded-full border border-amber/60 px-3 py-1 text-xs text-amber transition hover:bg-amber/10"><CalendarPlus size={12} /> Agendar</button>
            </div>
            <p className="mt-1 text-[0.65rem] leading-snug text-muted-foreground">Entram no Calendário e no seu dia automaticamente.</p>
            <div className="mt-3 space-y-1.5">
              {trainingsQ.isLoading && <p className="py-4 text-center text-xs text-muted-foreground">Carregando turmas…</p>}
              {!trainingsQ.isLoading && turmas.length === 0 && (
                <button onClick={() => setEditing("new")} className="w-full rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground transition hover:border-amber/60 hover:text-foreground">
                  Nenhuma turma agendada ainda.<br /><span className="text-amber">Agendar a primeira</span>
                </button>
              )}
              {turmas.map((t) => {
                const st = trainingStatus(t, today);
                return (
                  <div key={t.id} className="group flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-xs transition hover:bg-secondary/60">
                    <button onClick={() => setEditing(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Editar turma ${t.group}`}>
                      <span className={`grid h-10 w-12 shrink-0 place-items-center rounded-lg border text-center text-[0.7rem] font-semibold leading-tight tabular-nums ${st === "proxima" ? "border-amber/60 text-amber" : st === "passou" ? "border-pink/50 text-pink" : "border-border text-muted-foreground"}`}>
                        <span>{ddmm(t.date)}{t.time && <span className="block text-[0.58rem] font-normal">{t.time}</span>}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${t.done ? "text-muted-foreground" : ""}`}>{t.group}</span>
                        <span className="block truncate text-[0.65rem] text-muted-foreground">{t.scriptTitle || "Sem roteiro"} · {t.people} pessoas</span>
                        {st === "passou" && <span className="block text-[0.6rem] text-pink">Já passou · marque como feita</span>}
                      </span>
                    </button>
                    <button onClick={() => toggleT.mutate({ id: t.taskId, done: !t.done })} aria-label={t.done ? "Desmarcar turma feita" : "Marcar turma como feita"} title={t.done ? "Feita" : "Marcar como feita"}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${t.done ? "border-emerald bg-emerald/20 text-emerald" : "border-muted-foreground/40 text-transparent hover:border-emerald hover:text-emerald/60"}`}>
                      <Check size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* roteiro selecionado */}
        {!sel ? (
          <section className="glass grid place-items-center rounded-3xl p-10 text-center animate-rise">
            <div>
              <GraduationCap size={28} className="mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Nenhum roteiro ainda.</p>
              <button onClick={() => setEditScript("new")} className="mt-3 rounded-xl bg-gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground">Criar roteiro</button>
            </div>
          </section>
        ) : (
        <section className="glass rounded-3xl p-5 animate-rise" style={{ ...tint(sel.color), animationDelay: ".05s" }}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl shadow-[0_0_24px_-6px_var(--glow)]"><GraduationCap size={22} /></span>
            <div className="mr-auto min-w-0">
              <h3 className="font-display text-xl font-semibold">{sel.title}</h3>
              <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users size={11} /> {sel.audience}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {totalMin} min</span>
                <span>Última turma: {lastClassOf(sel)}</span>
              </p>
            </div>
            <button onClick={() => setEditScript(sel)} aria-label="Editar roteiro" title="Editar roteiro" className="glass grid h-8 w-8 place-items-center rounded-xl text-muted-foreground transition hover:text-foreground"><Pencil size={13} /></button>
            <button onClick={() => deleteScript(sel)} aria-label="Excluir roteiro" title="Excluir roteiro" className="glass grid h-8 w-8 place-items-center rounded-xl text-muted-foreground transition hover:text-pink"><Trash2 size={13} /></button>
            <button onClick={reset} className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"><RotateCcw size={12} /> Reiniciar</button>
            <button onClick={() => setPresenting(true)} data-testid="apresentar" title="Apresentar em slides (tela cheia)"
              className="group relative flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-brand px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--glow)] transition hover:scale-105 hover:shadow-[0_0_34px_-4px_var(--glow)]">
              <span aria-hidden className="absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-white/30 transition duration-700 group-hover:left-[150%]" />
              <Play size={12} className="relative" /> <span className="relative">Apresentar</span>
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><Target size={14} className="text-[var(--glow)]" /> Objetivo</p>
            <p className="mt-1 text-[0.8rem] text-muted-foreground">{sel.goal || "Sem objetivo definido."}</p>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{lesson ? "Marque o que já mostrou para a turma" : "Itens mostrados"}</span>
              <span className="font-semibold tabular-nums">{doneCount}/{items.length} · {pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-brand transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {pct === 100 && <p className="mt-2 text-xs text-emerald">Tudo mostrado! Nada ficou de fora ✦</p>}
          </div>

          <ol className="relative mt-5 space-y-3 border-l border-border/80 pl-5">
            {sel.blocks.map((b, bi) => {
              const isOpen = !!openB[b.id];
              const bDone = b.show.filter((_, i) => shown[`${b.id}:${i}`]).length;
              const complete = b.show.length > 0 && bDone === b.show.length;
              return (
                <li key={b.id} className="relative">
                  <span className={`absolute -left-[31px] top-3 grid h-5 w-5 place-items-center rounded-full border text-[0.6rem] ${complete ? "border-emerald bg-emerald/20 text-emerald" : "border-[var(--glow)] bg-background text-[var(--glow)]"}`}>
                    {complete ? <Check size={10} /> : bi + 1}
                  </span>
                  <div className="rounded-2xl border border-border bg-card/40">
                    <div className="group/b flex items-center gap-1 pr-2">
                      <button onClick={() => setOpenB((o) => ({ ...o, [b.id]: !o[b.id] }))} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{b.title}</span>
                          <span className="text-[0.68rem] text-muted-foreground">{b.minutes} min · {bDone}/{b.show.length} mostrados{b.examples.length ? ` · ${b.examples.length} exemplo(s)` : ""}</span>
                        </span>
                        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                      </button>
                      {!lesson && (
                        <span className="flex items-center opacity-60 transition group-hover/b:opacity-100">
                          <button onClick={() => setLib((l) => moveBlock(l, sel.id, b.id, -1))} disabled={bi === 0} aria-label="Subir bloco" title="Subir" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30"><ArrowUp size={12} /></button>
                          <button onClick={() => setLib((l) => moveBlock(l, sel.id, b.id, 1))} disabled={bi === sel.blocks.length - 1} aria-label="Descer bloco" title="Descer" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30"><ArrowDown size={12} /></button>
                          <button onClick={() => setEditBlock(b)} aria-label={`Editar bloco ${b.title}`} title="Editar bloco" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Pencil size={12} /></button>
                          <button onClick={() => deleteBlock(b)} aria-label={`Excluir bloco ${b.title}`} title="Excluir bloco" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-pink"><Trash2 size={12} /></button>
                        </span>
                      )}
                    </div>
                    {isOpen && (
                      <div className="space-y-3 border-t border-border px-3 pb-3 pt-2 animate-rise">
                        <div>
                          <p className="mono-caps !text-[0.58rem]">O que mostrar</p>
                          <ul className="mt-1.5 space-y-1.5">
                            {b.show.map((s, i) => {
                              const k = `${b.id}:${i}`; const ok = !!shown[k];
                              return (
                                <li key={k} className="group/i flex items-center gap-1">
                                  {editItem?.block === b.id && editItem.i === i ? (
                                    <form onSubmit={(e) => { e.preventDefault(); saveItem(); }} className="flex flex-1 items-center gap-2 rounded-lg border border-cyan/50 px-2 py-1">
                                      <input autoFocus value={editItem.text} onChange={(e) => setEditItem({ ...editItem, text: e.target.value })} onBlur={saveItem}
                                        onKeyDown={(e) => e.key === "Escape" && setEditItem(null)} aria-label="Editar item" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
                                    </form>
                                  ) : (
                                    <>
                                      <button onClick={() => toggle(k)} className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-[0.8rem] transition hover:bg-secondary/50 ${lesson ? "py-1.5 text-sm" : ""}`}>
                                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${ok ? "border-emerald bg-emerald/20 text-emerald" : "border-muted-foreground/50"}`}>{ok && <Check size={11} />}</span>
                                        <span className={ok ? "text-muted-foreground line-through" : ""}>{s}</span>
                                      </button>
                                      {mediaOf(b, i).length > 0 && (
                                        <button onClick={() => setViewer({ title: s, files: mediaOf(b, i) })} aria-label={`Ver arquivos de ${s}`} data-testid="ver-arquivos-passo" className="flex shrink-0 items-center gap-1 rounded-full border border-cyan/50 bg-cyan/10 px-2 py-0.5 text-[0.65rem] font-semibold text-cyan transition hover:scale-105 hover:bg-cyan/20"><ImageIcon size={11} /> {mediaOf(b, i).length}</button>
                                      )}
                                      {!lesson && (
                                        <span className="flex opacity-0 transition focus-within:opacity-100 group-hover/i:opacity-100 [@media(hover:none)]:opacity-100">
                                          <button onClick={() => { setAttachTo({ block: b.id, i }); itemInput.current?.click(); }} aria-label={`Anexar arquivo a ${s}`} title="Anexar imagem, PDF ou arquivo (vira botão na apresentação)" data-testid="anexar-passo" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-cyan"><Paperclip size={11} /></button>
                                          <button onClick={() => setEditItem({ block: b.id, i, text: s })} aria-label={`Editar item ${s}`} title="Editar" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil size={11} /></button>
                                          <button onClick={() => deleteItem(b.id, i)} aria-label={`Excluir item ${s}`} title="Excluir" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-pink"><Trash2 size={11} /></button>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          {adding?.block === b.id ? (
                            <form onSubmit={(e) => { e.preventDefault(); addItem(); }} className="mt-1.5 flex items-center gap-2 rounded-lg border border-cyan/50 px-2 py-1">
                              <input autoFocus value={adding.text} onChange={(e) => setAdding({ block: b.id, text: e.target.value })} onBlur={addItem} placeholder="O que mais mostrar?" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
                            </form>
                          ) : (
                            <button onClick={() => setAdding({ block: b.id, text: "" })} className="mt-1 flex items-center gap-1 px-1.5 text-[0.7rem] text-muted-foreground hover:text-cyan"><Plus size={11} /> Adicionar item</button>
                          )}
                        </div>

                        {b.say ? (
                          <div className="rounded-xl border border-violet/40 bg-violet/5 p-3">
                            <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold"><Mic size={13} className="text-violet" /> O que falar</p>
                            <p className="mt-1.5 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-foreground/90">{b.say}</p>
                          </div>
                        ) : null}

                        {b.visuals?.length ? <VisualGuide visuals={b.visuals} onZoom={setZoom} /> : null}

                        {b.why?.length ? (
                          <div className="rounded-xl border border-emerald/40 bg-emerald/5 p-3">
                            <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold"><ThumbsUp size={13} className="text-emerald" /> Por que isso ajuda no dia a dia</p>
                            <ul className="mt-2 space-y-1.5">
                              {b.why.map((w, wi) => (
                                <li key={wi} className="flex gap-2 text-[0.75rem] leading-snug"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald" /> {w}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {b.scenario && (
                          <div className="rounded-xl border border-border p-3">
                            <p className="mono-caps !text-[0.58rem]">Situação para contar</p>
                            <p className="mt-1 text-[0.8rem] font-medium leading-snug">{b.scenario.situation}</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                              <div className="rounded-lg border border-pink/40 bg-pink/5 p-2 text-[0.72rem] leading-snug"><b className="text-pink">{b.scenario.beforeLabel || "Antes"}</b><br />{b.scenario.before}</div>
                              <span className="grid place-items-center text-muted-foreground"><ArrowRight size={14} className="hidden sm:block" /><ArrowDown size={14} className="sm:hidden" /></span>
                              <div className="rounded-lg border border-emerald/40 bg-emerald/5 p-2 text-[0.72rem] leading-snug"><b className="text-emerald">{b.scenario.afterLabel || "Depois"}</b><br />{b.scenario.after}</div>
                            </div>
                          </div>
                        )}

                        {b.examples.length > 0 && (
                          <div>
                            <p className="mono-caps !text-[0.58rem]">Exemplos para usar</p>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {b.examples.map((id) => {
                                const e = examples.find((x) => x.id === id); if (!e) return null;
                                return (
                                  <button key={id} onClick={() => focusExample(id)} className="tag flex items-center gap-1 transition hover:shadow-[0_0_14px_-4px_var(--glow)]" style={tint(e.color)}>
                                    <Sparkles size={10} /> {e.title} <ArrowRight size={10} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {b.tip && (
                          <p className="flex gap-2 rounded-xl border border-amber/40 bg-amber/5 p-2.5 text-[0.75rem] leading-snug">
                            <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber" /> <span><b>Dica:</b> {b.tip}</span>
                          </p>
                        )}

                        {b.faq?.map((f, fi) => (
                          <div key={fi} className="rounded-xl border border-border p-2.5 text-[0.75rem]">
                            <p className="flex items-center gap-1.5 font-medium"><MessageCircleQuestion size={13} className="text-cyan" /> {f.q}</p>
                            <p className="mt-1 pl-5 text-muted-foreground">{f.a}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {!lesson && (
            <button onClick={() => setEditBlock("new")} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-2.5 text-xs text-muted-foreground transition hover:border-[var(--glow)] hover:text-foreground">
              <Plus size={12} /> Adicionar bloco
            </button>
          )}
        </section>
        )}

        {/* banco de exemplos */}
        <aside className="glass flex flex-col rounded-3xl p-4 animate-rise xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start" style={{ animationDelay: ".1s" }}>
          <div className="flex items-start gap-3">
            <span className="icon-tile h-10 w-10 shrink-0 !rounded-2xl" style={tint("violet")}><Sparkles size={18} /></span>
            <div className="mr-auto">
              <h3 className="font-display text-lg font-semibold">Banco de exemplos</h3>
              <p className="text-[0.7rem] leading-snug text-muted-foreground">Bons exemplos prontos para quando a equipe perguntar.</p>
            </div>
            <button onClick={() => setEditExample("new")} className="flex shrink-0 items-center gap-1 rounded-full border border-violet/60 px-3 py-1 text-xs text-violet transition hover:bg-violet/10"><Plus size={12} /> Novo</button>
          </div>
          <label className="glass mt-3 flex items-center gap-2 rounded-xl px-3 py-2">
            <Search size={13} className="text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar exemplo…" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
            {q && <button onClick={() => setQ("")}><X size={11} /></button>}
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] transition ${cat === c ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-border text-muted-foreground hover:text-foreground"}`}>{c}</button>
            ))}
          </div>
          <div className="mt-3 space-y-2.5 overflow-y-auto pr-1">
            {exFiltered.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhum exemplo encontrado.</p>}
            {exFiltered.map((e) => (
              <div key={e.id} id={`ex-${e.id}`} style={tint(e.color)}
                className={`accent-card !rounded-2xl p-3 transition ${hl === e.id ? "!border-[color-mix(in_oklab,var(--glow)_80%,transparent)] shadow-[0_0_30px_-6px_var(--glow)]" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.title}</span>
                  <span className="tag !text-[0.58rem]">{e.cat}</span>
                  <button onClick={() => setEditExample(e)} aria-label={`Editar exemplo ${e.title}`} title="Editar" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Pencil size={11} /></button>
                  <button onClick={() => deleteExample(e)} aria-label={`Excluir exemplo ${e.title}`} title="Excluir" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-pink"><Trash2 size={11} /></button>
                </div>
                {e.situation && <p className="mt-1.5 text-[0.7rem] text-muted-foreground"><b className="text-foreground/80">Situação:</b> {e.situation}</p>}
                <div className="mt-2 rounded-lg bg-secondary/50 p-2 text-[0.72rem] leading-snug">{e.text}</div>
                {e.visual && visualSrc(e.visual) && (
                  <button onClick={() => setZoom(e.visual!)} className="group relative mt-2 block w-full overflow-hidden rounded-lg border border-border">
                    <img src={visualSrc(e.visual)} alt={e.visual.caption} loading="lazy" width={1536} height={960} className="aspect-[16/7] w-full object-cover object-right transition group-hover:scale-105" />
                    <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[0.6rem] backdrop-blur"><ImageIcon size={10} /> Ver imagem</span>
                  </button>
                )}
                <button onClick={() => copy(e)} className="mt-2 flex items-center gap-1 text-[0.68rem] text-muted-foreground transition hover:text-[var(--glow)]">
                  {copied === e.id ? <><Check size={11} className="text-emerald" /> Copiado</> : <><Copy size={11} /> Copiar exemplo</>}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
      {generating && <TrainingGenerator folders={folderNames(lib)} onClose={() => setGenerating(false)} onOpen={(id) => setSelId(id)} onPresent={() => setPresenting(true)}
        onCreate={(script, exs) => { setLib((l) => { let n = { ...l, examples: [...l.examples, ...exs] }; if (script.folder) n = addFolder(n, script.folder); return upsertScript(n, script); }); setSelId(script.id); }} />}
      <input ref={itemInput} type="file" multiple hidden data-testid="passo-arquivo-lista" onChange={(e) => { void attachToItem([...(e.target.files ?? [])]); e.target.value = ""; }} />
      {viewer && !presenting && <MediaViewer title={viewer.title} files={viewer.files} onClose={() => setViewer(null)} />}
      {presenting && sel && <TrainingPresenter script={sel} examples={examples} shown={shown} onToggle={toggle} onClose={() => setPresenting(false)} />}
      {zoom && <Lightbox visual={zoom} onClose={() => setZoom(null)} />}
      {editScript && (
        <ScriptEditor folders={folderNames(lib)} initial={editScript === "new" ? undefined : editScript} onClose={() => setEditScript(null)} onSave={saveScript}
          onDelete={editScript === "new" ? undefined : () => deleteScript(editScript)} />
      )}
      {editBlock && sel && (
        <BlockEditor initial={editBlock === "new" ? undefined : editBlock} color={sel.color} examples={examples} onClose={() => setEditBlock(null)} onSave={saveBlock}
          onDelete={editBlock === "new" ? undefined : () => deleteBlock(editBlock)} />
      )}
      {editExample && (
        <ExampleEditor initial={editExample === "new" ? undefined : editExample} categories={cats.filter((c) => c !== "Todos")} onClose={() => setEditExample(null)} onSave={saveExample}
          onDelete={editExample === "new" ? undefined : () => deleteExample(editExample)} />
      )}
      {editing && (
        <TrainingForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? undefined : editing} scripts={scripts} defaultScript={sel}
          saving={saveT.isPending || delT.isPending} onClose={() => setEditing(null)}
          onSave={(d) => saveTraining(d, editing === "new" ? undefined : editing)}
          onDelete={editing === "new" ? undefined : () => removeTraining(editing)}
          onOpenScript={(id) => { setSelId(id); setEditing(null); }} />
      )}
    </div>
  );
}

function PinDot({ n, pin, active, onHover }: { n: number; pin: Pin; active: boolean; onHover: (n: number | null) => void }) {
  return (
    <button type="button" onMouseEnter={() => onHover(n)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(n)} onBlur={() => onHover(null)}
      aria-label={`${n}. ${pin.label}`} style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
      className={`absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-brand text-[0.7rem] font-bold text-primary-foreground ring-2 ring-background transition ${active ? "scale-125 shadow-[0_0_20px_2px_var(--cyan)]" : "shadow-[0_0_12px_-2px_var(--cyan)]"}`}>
      {n}
    </button>
  );
}

function PinLegend({ pins, active, onHover, large }: { pins: Pin[]; active: number | null; onHover: (n: number | null) => void; large?: boolean }) {
  return (
    <ol className="space-y-1.5">
      {pins.map((p, i) => (
        <li key={i} onMouseEnter={() => onHover(i + 1)} onMouseLeave={() => onHover(null)}
          className={`flex gap-2 rounded-lg p-1.5 transition ${active === i + 1 ? "bg-cyan/10" : ""} ${large ? "text-sm" : "text-[0.75rem]"}`}>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-brand text-[0.62rem] font-bold text-primary-foreground">{i + 1}</span>
          <span className="leading-snug"><b>{p.label}.</b> <span className="text-muted-foreground">{p.text}</span></span>
        </li>
      ))}
    </ol>
  );
}

function VisualGuide({ visuals, onZoom }: { visuals: Visual[]; onZoom: (v: Visual) => void }) {
  const [idx, setIdx] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const v = visuals[idx] ?? visuals[0]!;
  return (
    <div className="rounded-xl border border-cyan/40 bg-cyan/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto flex items-center gap-1.5 text-[0.8rem] font-semibold"><ImageIcon size={13} className="text-cyan" /> Imagem de apoio</p>
        {visuals.length > 1 && visuals.map((x, i) => (
          <button key={i} onClick={() => { setIdx(i); setActive(null); }}
            className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] transition ${i === idx ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {i + 1}. {x.title}
          </button>
        ))}
      </div>
      <div className="relative mt-2 overflow-hidden rounded-lg border border-border">
        <img src={visualSrc(v)} alt={v.caption} loading="lazy" width={1536} height={960} className="block w-full" />
        {v.pins.map((p, i) => <PinDot key={i} n={i + 1} pin={p} active={active === i + 1} onHover={setActive} />)}
        <button onClick={() => onZoom(v)} className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[0.65rem] backdrop-blur transition hover:text-cyan">
          <Maximize2 size={11} /> Ampliar
        </button>
      </div>
      <p className="mt-1.5 text-[0.68rem] italic text-muted-foreground">{v.caption}</p>
      <div className="mt-2"><PinLegend pins={v.pins} active={active} onHover={setActive} /></div>
    </div>
  );
}

function Lightbox({ visual, onClose }: { visual: Visual; onClose: () => void }) {
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={visual.title} {...backdropProps(onClose)}
      className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-md animate-rise">
      <div onClick={(e) => e.stopPropagation()} className="glass scroll-neon grid max-h-[92dvh] w-full max-w-7xl gap-4 overflow-auto rounded-3xl p-4 lg:grid-cols-[1fr_320px]">
        <div className="relative self-start overflow-hidden rounded-xl border border-border">
          <img src={visualSrc(visual)} alt={visual.caption} width={1536} height={960} className="block w-full" />
          {visual.pins.map((p, i) => <PinDot key={i} n={i + 1} pin={p} active={active === i + 1} onHover={setActive} />)}
        </div>
        <div>
          <div className="flex items-start gap-2">
            <div className="mr-auto">
              <h3 className="font-display text-lg font-semibold">{visual.title}</h3>
              <p className="text-xs text-muted-foreground">{visual.caption}</p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="mt-3"><PinLegend pins={visual.pins} active={active} onHover={setActive} large /></div>
        </div>
      </div>
    </div>
  );
}


function TrainingForm({ initial, scripts, defaultScript, saving, onClose, onSave, onDelete, onOpenScript }: {
  initial?: Training | undefined; scripts: Script[]; defaultScript?: Script | undefined; saving: boolean;
  onClose: () => void; onSave: (d: TrainingDraft) => void; onDelete?: (() => void) | undefined; onOpenScript: (id: string) => void;
}) {
  const [f, setF] = useState<TrainingDraft>(() => initial ?? {
    group: "", people: 0, scriptKey: defaultScript?.id ?? "", scriptTitle: defaultScript?.title ?? "", date: todayIso(), time: "", end: "", place: "", notes: "",
  });
  const set = <K extends keyof TrainingDraft>(k: K, v: TrainingDraft[K]) => setF((x) => ({ ...x, [k]: v }));
  const known = scripts.some((s) => s.id === f.scriptKey);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const field = "glass w-full rounded-xl px-3 py-2 text-sm outline-none focus:border-amber/60";
  const label = "mb-1 block text-[0.7rem] text-muted-foreground";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.group.trim()) { toast.error("Dê um nome para a turma."); return; }
    if (!f.date) { toast.error("Escolha a data."); return; }
    if (f.time && f.end && f.end <= f.time) { toast.error("O fim precisa ser depois do início."); return; }
    onSave(f);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label={initial ? "Editar turma" : "Agendar turma"} {...backdropProps(onClose)}
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-md animate-rise">
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={tint("amber")} className="glass scroll-neon max-h-[92dvh] w-full max-w-lg space-y-3 overflow-auto rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <span className="icon-tile h-10 w-10 shrink-0 !rounded-2xl"><CalendarDays size={18} /></span>
          <div className="mr-auto">
            <h3 className="font-display text-lg font-semibold">{initial ? "Editar turma" : "Agendar turma"}</h3>
            <p className="text-[0.7rem] text-muted-foreground">Vai para o Calendário e aparece quando você perguntar o que tem no dia.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={16} /></button>
        </div>

        <label className="block"><span className={label}>Turma / polo</span>
          <input autoFocus value={f.group} onChange={(e) => set("group", e.target.value)} maxLength={120} placeholder="Ex.: Turma Niterói" className={field} />
        </label>
        <label className="block"><span className={label}>Roteiro</span>
          <div className="flex gap-2">
            <select value={f.scriptKey} onChange={(e) => { const s = scripts.find((x) => x.id === e.target.value); set("scriptKey", e.target.value); set("scriptTitle", s?.title ?? ""); }} className={`${field} bg-background`}>
              {!known && <option value={f.scriptKey}>{f.scriptTitle || "Sem roteiro"}</option>}
              {scripts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            {known && <button type="button" onClick={() => onOpenScript(f.scriptKey)} className="glass shrink-0 rounded-xl px-3 text-xs text-muted-foreground hover:text-amber">Abrir</button>}
          </div>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-3 block sm:col-span-1"><span className={label}>Data</span>
            <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={field} required />
          </label>
          <label className="block"><span className={label}>Início</span>
            <input type="time" value={f.time ?? ""} onChange={(e) => set("time", e.target.value)} className={field} />
          </label>
          <label className="block"><span className={label}>Fim</span>
            <input type="time" value={f.end ?? ""} onChange={(e) => set("end", e.target.value)} disabled={!f.time} className={`${field} disabled:opacity-50`} />
          </label>
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <label className="block"><span className={label}><MapPin size={10} className="inline" /> Local</span>
            <input value={f.place ?? ""} onChange={(e) => set("place", e.target.value)} maxLength={200} placeholder="Online, Google Meet, Polo Santos…" className={field} />
          </label>
          <label className="block"><span className={label}><Users size={10} className="inline" /> Pessoas</span>
            <input type="number" min={0} max={1000} value={f.people || ""} onChange={(e) => set("people", Number(e.target.value) || 0)} placeholder="0" className={field} />
          </label>
        </div>
        <label className="block"><span className={label}>Observações</span>
          <textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} maxLength={1500} rows={3} placeholder="Ex.: levar lead de teste, pedir para todos entrarem antes com login…" className={`${field} resize-none`} />
        </label>

        <div className="flex items-center gap-2 pt-1">
          {onDelete && <button type="button" onClick={onDelete} disabled={saving} className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs text-pink transition hover:bg-pink/10"><Trash2 size={13} /> Excluir</button>}
          <button type="button" onClick={onClose} className="ml-auto rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:scale-105 disabled:opacity-60">
            {initial ? <><Pencil size={12} /> Salvar</> : <><CalendarPlus size={12} /> Agendar</>}
          </button>
        </div>
      </form>
    </div>
  );
}
