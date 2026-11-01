import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsLibrary } from "@/components/DocsLibrary";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft, Atom, Calendar, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, FileText,
  Filter, Folder, FolderOpen, Globe, Hexagon, History, LayoutGrid, Layers, List, Loader, MapPin,
  MessageSquare, MoreHorizontal, Network, Pencil, Plus, Search, Send, SquareCheck, StickyNote, Trash2, X,
} from "lucide-react";

export const Route = createFileRoute("/demandas")({
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
type Status = "todo" | "doing" | "done";
type Priority = "alta" | "media" | "baixa";
type DType = "geral" | "polo" | "multi";
type PoloExec = { name: string; status: Status; date?: string | undefined };
type Hist = { d: string; text: string; s: Status };
type Demand = {
  id: string; type: DType; title: string; desc: string; priority: Priority; status: Status;
  deadline: string; polo?: string | undefined; polos?: PoloExec[] | undefined; history: Hist[]; notes: string[];
};
type Note = { id: number; text: string; date: string; tag: string; color: string };

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const statusMeta: Record<Status, { label: string; color: string; poloLabel: string }> = {
  todo: { label: "A fazer", color: "amber", poloLabel: "Não iniciado" },
  doing: { label: "Em andamento", color: "cyan", poloLabel: "Em andamento" },
  done: { label: "Concluídas", color: "emerald", poloLabel: "Concluído" },
};
const prio: Record<Priority, { label: string; color: string }> = {
  alta: { label: "Alta", color: "pink" }, media: { label: "Média", color: "amber" }, baixa: { label: "Baixa", color: "emerald" },
};
const typeMeta: Record<DType, { label: string; short: string; sub: string; color: string; icon: typeof Globe; prefix: string }> = {
  geral: { label: "Demandas gerais", short: "Geral", sub: "Sem vínculo com polos", color: "cyan", icon: Globe, prefix: "G" },
  polo: { label: "Demandas por polo", short: "Um polo", sub: "Destinadas a um único polo", color: "violet", icon: MapPin, prefix: "P" },
  multi: { label: "Demandas multipolo", short: "Vários polos", sub: "Execução individual por polo", color: "emerald", icon: Network, prefix: "M" },
};
const STATUSES: Status[] = ["todo", "doing", "done"];
const POLOS = ["Alagoinhas", "Barra da Tijuca", "BH Centro", "Cachoeiro", "Caxias RJ", "Floresta", "Fortaleza", "Itanhaém", "Juiz de Fora", "Lauro", "Maceió", "Niterói", "Petrolina", "Santos", "São Vicente", "Volta Redonda"];
const poloColor = (p: string) => ["cyan", "pink", "violet", "amber", "emerald"][POLOS.indexOf(p) % 5] ?? "cyan";

const ps = (list: [string, Status, string?][]): PoloExec[] => list.map(([name, status, date]) => ({ name, status, date }));
const multiStatus = (p: PoloExec[]): Status => (p.every((x) => x.status === "done") ? "done" : p.some((x) => x.status !== "todo") ? "doing" : "todo");
const today = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const seed: Demand[] = [
  { id: "#G024", type: "geral", title: "Criar tutorial de uso do sistema", desc: "Gravar e documentar um passo a passo do sistema para novos colaboradores.", priority: "media", status: "todo", deadline: "12/11", history: [{ d: "28/10", text: "Demanda criada", s: "todo" }], notes: ["Usar a identidade visual nova."] },
  { id: "#G018", type: "geral", title: "Revisar mensagens padrão", desc: "Revisar todas as mensagens automáticas de atendimento.", priority: "alta", status: "todo", deadline: "10/11", history: [{ d: "26/10", text: "Demanda criada", s: "todo" }], notes: [] },
  { id: "#G012", type: "geral", title: "Atualizar landing page", desc: "Novo texto de apresentação e depoimentos na página principal.", priority: "alta", status: "doing", deadline: "14/11", history: [{ d: "20/10", text: "Demanda criada", s: "todo" }, { d: "27/10", text: "Layout aprovado", s: "doing" }], notes: ["Aguardando fotos novas."] },
  { id: "#G010", type: "geral", title: "Analisar relatórios mensais", desc: "Consolidar indicadores do mês e preparar apresentação.", priority: "media", status: "doing", deadline: "13/11", history: [{ d: "22/10", text: "Coleta de dados iniciada", s: "doing" }], notes: [] },
  { id: "#G009", type: "geral", title: "Configurar integração API", desc: "Conectar o CRM ao sistema de agendamento.", priority: "baixa", status: "done", deadline: "05/11", history: [{ d: "15/10", text: "Iniciada", s: "doing" }, { d: "02/11", text: "Integração validada", s: "done" }], notes: [] },
  { id: "#P034", type: "polo", polo: "Niterói", title: "Corrigir fluxo Niterói", desc: "Ajustar o fluxo de triagem que está duplicando cadastros.", priority: "alta", status: "todo", deadline: "11/11", history: [{ d: "29/10", text: "Problema reportado pelo polo", s: "todo" }], notes: [] },
  { id: "#P032", type: "polo", polo: "BH Centro", title: "Criar template BH Centro", desc: "Template de boas-vindas personalizado para BH Centro.", priority: "media", status: "todo", deadline: "15/11", history: [{ d: "30/10", text: "Demanda criada", s: "todo" }], notes: [] },
  { id: "#P028", type: "polo", polo: "Santos", title: "Verificar leads Santos", desc: "Conferir origem dos leads da última campanha.", priority: "baixa", status: "todo", deadline: "18/11", history: [{ d: "30/10", text: "Demanda criada", s: "todo" }], notes: [] },
  { id: "#P027", type: "polo", polo: "Fortaleza", title: "Ajustar permissões", desc: "Liberar acesso de coordenação para a nova equipe.", priority: "alta", status: "doing", deadline: "13/11", history: [{ d: "25/10", text: "Levantamento de acessos", s: "doing" }], notes: [] },
  { id: "#P025", type: "polo", polo: "Caxias RJ", title: "Revisar campanhas RJ", desc: "Revisar textos e públicos das campanhas ativas.", priority: "media", status: "doing", deadline: "16/11", history: [{ d: "24/10", text: "Revisão iniciada", s: "doing" }], notes: [] },
  { id: "#P021", type: "polo", polo: "Barra da Tijuca", title: "Ajustar formulários", desc: "Novos campos obrigatórios no formulário de inscrição.", priority: "media", status: "done", deadline: "08/11", history: [{ d: "18/10", text: "Iniciada", s: "doing" }, { d: "01/11", text: "Publicado", s: "done" }], notes: [] },
  { id: "#P018", type: "polo", polo: "Niterói", title: "Configurar bot", desc: "Respostas rápidas do bot de WhatsApp.", priority: "baixa", status: "done", deadline: "08/11", history: [{ d: "31/10", text: "Bot ativo", s: "done" }], notes: [] },
  { id: "#M003", type: "multi", title: "Atualizar configurações de polos", desc: "Padronizar horários, contatos e regras de cada polo no sistema.", priority: "alta", status: "todo", deadline: "20/11",
    polos: ps([["Alagoinhas", "todo"], ["Cachoeiro", "todo"], ["Floresta", "todo"], ["Petrolina", "todo"], ["Santos", "todo"], ["São Vicente", "todo"]]), history: [{ d: "31/10", text: "Demanda criada para 6 polos", s: "todo" }], notes: [] },
  { id: "#M024", type: "multi", title: "Criar templates para os polos", desc: "Criar e configurar os templates de atendimento nos polos: Barra da Tijuca, Lauro, Niterói e Maceió.", priority: "alta", status: "doing", deadline: "15/11",
    polos: ps([["Barra da Tijuca", "done", "30/10"], ["Lauro", "done", "30/10"], ["Niterói", "doing"], ["Maceió", "todo"]]),
    history: [{ d: "30/10", text: "Templates configurados no polo Barra da Tijuca.", s: "done" }, { d: "30/10", text: "Templates configurados no polo Lauro.", s: "done" }, { d: "31/10", text: "Iniciado no polo Niterói.", s: "doing" }], notes: ["Maceió depende da aprovação do coordenador."] },
  { id: "#M025", type: "multi", title: "Habilitar assinatura do usuário", desc: "Ativar assinatura digital nos contratos de cada polo.", priority: "media", status: "doing", deadline: "22/11",
    polos: ps([["Alagoinhas", "done", "28/10"], ["BH Centro", "done", "29/10"], ["Caxias RJ", "done", "31/10"], ["Fortaleza", "doing"], ["Itanhaém", "todo"], ["Juiz de Fora", "todo"], ["Santos", "todo"], ["Volta Redonda", "todo"]]),
    history: [{ d: "28/10", text: "Concluído em Alagoinhas", s: "done" }, { d: "29/10", text: "Concluído em BH Centro", s: "done" }, { d: "31/10", text: "Concluído em Caxias RJ", s: "done" }], notes: [] },
  { id: "#M010", type: "multi", title: "Verificar criação de contas", desc: "Auditar contas criadas no último trimestre.", priority: "baixa", status: "doing", deadline: "25/11",
    polos: ps([["Niterói", "doing"], ["Petrolina", "todo"], ["Floresta", "done", "27/10"]]), history: [{ d: "27/10", text: "Concluído em Floresta", s: "done" }], notes: [] },
  { id: "#M018", type: "multi", title: "Padronizar mensagens de atendimento", desc: "Mesma linguagem de atendimento em todos os polos.", priority: "baixa", status: "done", deadline: "05/11",
    polos: ps([["Lauro", "done", "20/10"], ["Maceió", "done", "22/10"], ["Niterói", "done", "24/10"], ["Santos", "done", "25/10"], ["São Vicente", "done", "28/10"]]), history: [{ d: "28/10", text: "Todos os polos concluídos", s: "done" }], notes: [] },
];

/* ---------------- página ---------------- */
function Demandas() {
  const [items, setItems] = useState(seed);
  const [tab, setTab] = useState<"overview" | DType | "notas" | "docs">("overview");
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [prioF, setPrioF] = useState<"todas" | Priority>("todas");
  const [statusF, setStatusF] = useState<"todos" | Status>("todos");
  const [poloF, setPoloF] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([
    { id: 1, text: "Tefé vai virar polo de Itanhaém", date: "30/09", tag: "Geral", color: "violet" },
    { id: 2, text: "Reforçar treinamento BH Centro", date: "28/09", tag: "Polo", color: "cyan" },
    { id: 3, text: "Revisar documentação API", date: "25/09", tag: "Geral", color: "emerald" },
  ]);

  const sel = items.find((i) => i.id === selId) ?? null;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSelId(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const filtered = useMemo(() => items.filter((i) => {
    if (prioF !== "todas" && i.priority !== prioF) return false;
    if (statusF !== "todos" && i.status !== statusF) return false;
    if (poloF && i.polo !== poloF && !i.polos?.some((p) => p.name === poloF)) return false;
    if (q && !`${i.id} ${i.title} ${i.polo ?? ""} ${i.polos?.map((p) => p.name).join(" ") ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, prioF, statusF, poloF, q]);

  const update = (id: string, fn: (d: Demand) => Demand) =>
    setItems((xs) => xs.map((x) => {
      if (x.id !== id) return x;
      const n = fn(x);
      return n.type === "multi" && n.polos ? { ...n, status: multiStatus(n.polos) } : n;
    }));

  const setStatus = (id: string, s: Status) => update(id, (d) => ({
    ...d, status: s,
    polos: d.polos?.map((p) => (s === "done" ? { ...p, status: "done", date: p.date ?? today() } : s === "todo" ? { ...p, status: "todo", date: undefined } : p)),
    history: [...d.history, { d: today(), text: `Status alterado para ${statusMeta[s].label.replace(/s$/, "")}`, s }],
  }));
  const cyclePolo = (id: string, name: string) => update(id, (d) => {
    const cur = d.polos!.find((p) => p.name === name)!;
    const nx: Status = cur.status === "todo" ? "doing" : cur.status === "doing" ? "done" : "todo";
    return {
      ...d,
      polos: d.polos!.map((p) => (p.name === name ? { ...p, status: nx, date: nx === "done" ? today() : undefined } : p)),
      history: [...d.history, { d: today(), text: nx === "done" ? `Concluído no polo ${name}.` : nx === "doing" ? `Iniciado no polo ${name}.` : `Polo ${name} reaberto.`, s: nx }],
    };
  });
  const create = (type: DType, status: Status = "todo") => {
    const n = items.filter((i) => i.type === type).length + 40;
    const d: Demand = {
      id: `#${typeMeta[type].prefix}0${n}`, type, title: "Nova demanda", desc: "Descreva o que precisa ser feito.", priority: "media", status,
      deadline: "30/11", polo: type === "polo" ? "Niterói" : undefined,
      polos: type === "multi" ? ps([["Niterói", "todo"], ["Santos", "todo"], ["Maceió", "todo"]]) : undefined,
      history: [{ d: today(), text: "Demanda criada", s: "todo" }], notes: [],
    };
    setItems((xs) => [d, ...xs]);
    setSelId(d.id);
  };
  const remove = (id: string) => { setItems((xs) => xs.filter((x) => x.id !== id)); setSelId(null); };

  const count = (t: DType, s?: Status) => items.filter((i) => i.type === t && (!s || i.status === s)).length;
  const pend = items.filter((i) => i.status !== "done").length;
  const done = items.length - pend;

  const tabs = [
    { k: "overview" as const, label: "Visão geral", sub: "Todos os tipos", icon: LayoutGrid, color: "cyan", n: items.length },
    ...(["geral", "polo", "multi"] as DType[]).map((t) => ({ k: t, label: typeMeta[t].short, sub: typeMeta[t].sub, icon: typeMeta[t].icon, color: typeMeta[t].color, n: count(t) })),
    { k: "docs" as const, label: "Documentação", sub: "Biblioteca", icon: FolderOpen, color: "violet", n: 19 },
    { k: "notas" as const, label: "Notas", sub: "Lembretes", icon: StickyNote, color: "amber", n: notes.length },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <BgFx />
      <div className={`relative mx-auto max-w-[1500px] px-4 py-6 transition-[padding] duration-500 md:px-8 ${sel ? "xl:pr-[500px]" : ""}`}>
        {/* topo */}
        <header className="flex flex-wrap items-center justify-between gap-6 animate-rise">
          <div className="flex items-center gap-5">
            <Link to="/" className="icon-tile h-9 w-9 transition hover:scale-105" style={tint("cyan")} aria-label="Voltar"><ArrowLeft size={15} /></Link>
            <HexLogo />
            <div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight">P4C<span className="glow-text" style={tint("cyan")}>.</span></h1>
              <p className="mono-caps !tracking-[0.4em]">Projeto</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald"><span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-emerald shadow-[0_0_8px_var(--emerald)]" /> Ativo</p>
            </div>
            <div className="ml-2 hidden max-w-xs border-l border-border pl-5 md:block">
              <p className="text-sm text-foreground/90">Juntos por polos mais fortes.</p>
              <p className="text-xs text-muted-foreground">Gestão de demandas, polos e execuções com organização, clareza e foco.</p>
            </div>
          </div>
          <div className="glass grid grid-cols-4 divide-x divide-border rounded-2xl py-3">
            {[{ v: pend, l: "pendentes", c: "amber" }, { v: done, l: "concluídas", c: "emerald" }, { v: notes.length, l: "anotações", c: "violet" }, { v: POLOS.length, l: "polos", c: "cyan" }].map((s) => (
              <div key={s.l} className="px-5 text-center" style={tint(s.c)}>
                <p className="font-display text-3xl font-bold glow-text tabular-nums">{s.v}</p>
                <p className="text-[0.65rem] text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </header>

        {/* abas de tipo */}
        <nav className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 animate-rise" style={{ animationDelay: ".05s" }}>
          {tabs.map((t) => {
            const on = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)} style={tint(t.color)}
                className={`accent-card group flex items-center gap-3 !rounded-2xl p-3 text-left ${on ? "!border-[color-mix(in_oklab,var(--glow)_70%,transparent)] shadow-[0_0_40px_-12px_var(--glow)]" : "opacity-80 hover:opacity-100"}`}>
                <span className={`icon-tile h-10 w-10 shrink-0 !rounded-full transition group-hover:rotate-12 ${on ? "shadow-[0_0_20px_-4px_var(--glow)]" : ""}`}><t.icon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t.label}</span>
                  <span className="block truncate text-[0.65rem] text-muted-foreground">{t.sub}</span>
                </span>
                <span className="tag !text-[0.65rem] !tracking-normal">{t.n}</span>
                {on && <span className="absolute inset-x-6 bottom-0 h-px bg-[var(--glow)] shadow-[0_0_12px_var(--glow)]" />}
              </button>
            );
          })}
        </nav>

        {tab !== "notas" && tab !== "docs" && (
          <div className="mt-4 flex flex-wrap items-center gap-2 animate-rise" style={{ animationDelay: ".1s" }}>
            <div className="glass flex rounded-xl p-1">
              {([["kanban", "Kanban", LayoutGrid], ["lista", "Lista", List]] as const).map(([k, l, I]) => (
                <button key={k} onClick={() => setView(k)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${view === k ? "bg-cyan/15 text-cyan shadow-[0_0_16px_-6px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}><I size={13} /> {l}</button>
              ))}
            </div>
            <Pick label="Prioridade" value={prioF} onChange={(v) => setPrioF(v as typeof prioF)} options={[["todas", "Todas"], ["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]]} />
            <Pick label="Status" value={statusF} onChange={(v) => setStatusF(v as typeof statusF)} options={[["todos", "Todos"], ["todo", "A fazer"], ["doing", "Em andamento"], ["done", "Concluídas"]]} />
            {poloF && <button onClick={() => setPoloF(null)} className="tag flex items-center gap-1" style={tint(poloColor(poloF))}><MapPin size={10} /> {poloF} <X size={10} /></button>}
            <label className="glass ml-auto flex min-w-[220px] flex-1 items-center gap-2 rounded-xl px-3 py-2 sm:max-w-sm">
              <Search size={14} className="text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar demanda, polo ou código…" className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
              {q && <button onClick={() => setQ("")}><X size={12} /></button>}
            </label>
          </div>
        )}

        <main className="mt-5">
          {tab === "docs" ? (
            <DocsLibrary />
          ) : tab === "notas" ? (
            <NotesBoard notes={notes} setNotes={setNotes} />
          ) : view === "lista" ? (
            <ListView items={filtered.filter((i) => tab === "overview" || i.type === tab)} selId={selId} onOpen={setSelId} />
          ) : tab === "overview" ? (
            <div className="grid gap-4 2xl:grid-cols-[1fr_270px]">
              <section className="glass relative overflow-hidden rounded-3xl p-4 animate-rise">
                <div className="mb-4 flex items-center gap-3">
                  <span className="icon-tile h-8 w-8" style={tint("cyan")}><Layers size={15} /></span>
                  <h2 className="font-display text-lg font-semibold">Demandas por tipo</h2>
                  <span className="tag" style={tint("violet")}>3 categorias · {filtered.length} demandas</span>
                </div>
                <div className={`grid gap-4 ${sel ? "lg:grid-cols-1 2xl:grid-cols-3" : "lg:grid-cols-3"}`}>
                  {(["geral", "polo", "multi"] as DType[]).map((t) => (
                    <TypeBoard key={t} type={t} items={filtered.filter((i) => i.type === t)} selId={selId} onOpen={setSelId} onCreate={() => create(t)} />
                  ))}
                </div>
              </section>
              <PolosPanel items={items} active={poloF} onPick={(p) => setPoloF(p === poloF ? null : p)} />
            </div>
          ) : (
            <FullBoard type={tab} items={filtered.filter((i) => i.type === tab)} selId={selId} onOpen={setSelId} onCreate={(s) => create(tab, s)} />
          )}
        </main>

        {tab === "overview" && <NotesStrip notes={notes} onMore={() => setTab("notas")} />}
      </div>

      <DetailPanel
        key={sel?.id ?? "none"} demand={sel} onClose={() => setSelId(null)}
        onStatus={(s) => sel && setStatus(sel.id, s)} onPolo={(p) => sel && cyclePolo(sel.id, p)}
        onEdit={(patch) => sel && update(sel.id, (d) => ({ ...d, ...patch }))}
        onNote={(t) => sel && update(sel.id, (d) => ({ ...d, notes: [...d.notes, t], history: [...d.history, { d: today(), text: "Observação adicionada", s: d.status }] }))}
        onDelete={() => sel && remove(sel.id)}
      />
    </div>
  );
}

/* ---------------- efeitos de fundo ---------------- */
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
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-[0_0_40px_-4px_var(--cyan)] animate-float">
        <Layers size={20} />
      </div>
    </div>
  );
}

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="glass relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs">
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
  if (!d.polos) return d.status === "done" ? 100 : d.status === "doing" ? 50 : 0;
  return Math.round((d.polos.filter((p) => p.status === "done").length / d.polos.length) * 100);
}

function TypeBoard({ type, items, selId, onOpen, onCreate }: { type: DType; items: Demand[]; selId: string | null; onOpen: (id: string) => void; onCreate: () => void }) {
  const m = typeMeta[type];
  return (
    <div className="accent-card flex flex-col p-3" style={tint(m.color)}>
      <div className="flex items-center gap-3 px-1">
        <span className="icon-tile h-11 w-11 !rounded-full shadow-[0_0_24px_-6px_var(--glow)]"><m.icon size={20} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold">{m.label}</h3>
          <p className="text-[0.68rem] text-muted-foreground">{m.sub}</p>
        </div>
        <span className="tag !text-xs !tracking-normal">{items.length}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {STATUSES.map((s) => {
          const col = items.filter((i) => i.status === s);
          return (
            <div key={s} className="min-w-0" style={tint(statusMeta[s].color)}>
              <div className="mb-2 flex items-center justify-between rounded-full border border-[color-mix(in_oklab,var(--glow)_35%,transparent)] bg-[color-mix(in_oklab,var(--glow)_10%,transparent)] px-2 py-1 text-[0.6rem] text-[var(--glow)]">
                <span className="truncate">{statusMeta[s].label}</span><span className="font-mono">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((d, i) => <MiniCard key={d.id} d={d} active={selId === d.id} onClick={() => onOpen(d.id)} delay={i} />)}
                {!col.length && <div className="rounded-xl border border-dashed border-border py-5 text-center text-[0.6rem] text-muted-foreground/60">vazio</div>}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={onCreate} className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--glow)_35%,transparent)] py-2 text-xs text-[var(--glow)] transition hover:bg-[color-mix(in_oklab,var(--glow)_10%,transparent)] hover:shadow-[0_0_24px_-8px_var(--glow)]">
        <Plus size={13} /> Nova {m.label.toLowerCase().replace("demandas", "demanda")}
      </button>
    </div>
  );
}

function MiniCard({ d, active, onClick, delay }: { d: Demand; active: boolean; onClick: () => void; delay: number }) {
  return (
    <button onClick={onClick} style={{ ...tint(typeMeta[d.type].color), animationDelay: `${delay * 0.05}s` }}
      className={`group relative w-full overflow-hidden rounded-xl border bg-secondary/40 p-2 text-left transition animate-rise hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--glow)_50%,transparent)] hover:shadow-[0_8px_24px_-12px_var(--glow)] ${active ? "border-[var(--glow)] shadow-[0_0_24px_-6px_var(--glow)]" : "border-border"}`}>
      {active && <span className="scanline absolute inset-0" />}
      <p className="font-mono text-[0.55rem] text-muted-foreground">{d.id}</p>
      <p className="mt-0.5 line-clamp-2 text-[0.72rem] font-medium leading-snug">{d.title}</p>
      <span className="tag mt-1.5 inline-block !px-1.5 !py-0 !text-[0.5rem]" style={tint(prio[d.priority].color)}>{prio[d.priority].label}</span>
      <p className="mt-1.5 flex items-center gap-1 truncate text-[0.55rem] text-muted-foreground">
        {d.type === "geral" ? <><Calendar size={9} /> {d.deadline}</> : d.type === "polo" ? <><MapPin size={9} /> {d.polo}</> : <><Network size={9} /> {d.polos!.length} polos · {progress(d)}%</>}
      </p>
    </button>
  );
}

function FullBoard({ type, items, selId, onOpen, onCreate }: { type: DType; items: Demand[]; selId: string | null; onOpen: (id: string) => void; onCreate: (s: Status) => void }) {
  const m = typeMeta[type];
  return (
    <section className="glass relative overflow-hidden rounded-3xl p-5 animate-rise" style={tint(m.color)}>
      <div className="mb-5 flex items-center gap-3">
        <span className="icon-tile h-11 w-11 !rounded-full shadow-[0_0_24px_-6px_var(--glow)]"><m.icon size={20} /></span>
        <div>
          <h2 className="font-mono text-sm uppercase tracking-[0.3em]">{m.label} ({items.length})</h2>
          <p className="text-xs text-muted-foreground">{type === "multi" ? "Uma demanda principal com execução individual por polo." : m.sub + "."}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {STATUSES.map((s) => {
          const col = items.filter((i) => i.status === s);
          return (
            <div key={s} className="accent-card flex min-h-[420px] flex-col p-3" style={tint(statusMeta[s].color)}>
              <div className="flex items-center gap-2 px-1 pb-3">
                <span className="h-2.5 w-2.5 animate-pulse-ring rounded-full bg-[var(--glow)] shadow-[0_0_10px_var(--glow)]" />
                <h3 className="font-display font-semibold">{statusMeta[s].label}</h3>
                <span className="tag ml-auto !text-xs !tracking-normal">{col.length}</span>
              </div>
              <div className="flex-1 space-y-3">
                {col.map((d, i) => <BigCard key={d.id} d={d} active={selId === d.id} onClick={() => onOpen(d.id)} delay={i} />)}
              </div>
              <button onClick={() => onCreate(s)} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs text-cyan transition hover:border-cyan/40 hover:bg-cyan/5">
                <Plus size={13} /> Adicionar demanda
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BigCard({ d, active, onClick, delay }: { d: Demand; active: boolean; onClick: () => void; delay: number }) {
  const pct = progress(d);
  const dn = d.polos?.filter((p) => p.status === "done").length ?? 0;
  return (
    <button onClick={onClick} style={{ ...tint(prio[d.priority].color), animationDelay: `${delay * 0.06}s` }}
      className={`group relative w-full overflow-hidden rounded-2xl border bg-secondary/40 p-4 text-left transition animate-rise hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-14px_var(--cyan)] ${active ? "border-cyan shadow-[0_0_30px_-6px_var(--cyan)]" : "border-border hover:border-cyan/40"}`}>
      <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-[var(--glow)] shadow-[0_0_8px_var(--glow)]" />
      {active && <span className="scanline absolute inset-0" />}
      <p className="font-mono text-[0.6rem] tracking-[0.2em] text-muted-foreground">{d.id}</p>
      <div className="flex items-start gap-2">
        <p className="flex-1 font-medium leading-snug">{d.title}</p>
        <ChevronRight size={16} className="mt-1 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-cyan" />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {d.polos ? <><Network size={13} /> {d.polos.length} polos</> : d.polo ? <><MapPin size={13} /> {d.polo}</> : <><Calendar size={13} /> {d.deadline}</>}
        <span className="tag !tracking-normal !normal-case !text-[0.65rem]">{prio[d.priority].label}</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pct === 100 ? "var(--emerald)" : "var(--gradient-brand)", boxShadow: "0 0 10px var(--cyan)" }} />
        </div>
        {d.polos && <span>{dn}/{d.polos.length}</span>}
        <span className="font-mono">{pct}%</span>
      </div>
    </button>
  );
}

function ListView({ items, selId, onOpen }: { items: Demand[]; selId: string | null; onOpen: (id: string) => void }) {
  return (
    <section className="glass overflow-hidden rounded-3xl animate-rise">
      <div className="grid grid-cols-[90px_1fr_130px_110px_90px_80px] gap-3 border-b border-border px-5 py-3 mono-caps max-md:hidden">
        <span>Código</span><span>Demanda</span><span>Tipo</span><span>Status</span><span>Prazo</span><span>Progresso</span>
      </div>
      {items.map((d, i) => (
        <button key={d.id} onClick={() => onOpen(d.id)} style={{ animationDelay: `${i * 0.03}s` }}
          className={`grid w-full grid-cols-2 gap-3 border-b border-border/60 px-5 py-3 text-left text-sm transition animate-rise hover:bg-secondary/50 md:grid-cols-[90px_1fr_130px_110px_90px_80px] ${selId === d.id ? "bg-cyan/10" : ""}`}>
          <span className="font-mono text-xs text-muted-foreground">{d.id}</span>
          <span className="truncate font-medium">{d.title}</span>
          <span className="text-xs" style={{ color: `var(--${typeMeta[d.type].color})` }}>{typeMeta[d.type].short}</span>
          <span className="text-xs" style={{ color: `var(--${statusMeta[d.status].color})` }}>{statusMeta[d.status].label}</span>
          <span className="text-xs text-muted-foreground">{d.deadline}</span>
          <span className="font-mono text-xs">{progress(d)}%</span>
        </button>
      ))}
      {!items.length && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma demanda encontrada.</p>}
    </section>
  );
}

function PolosPanel({ items, active, onPick }: { items: Demand[]; active: string | null; onPick: (p: string) => void }) {
  const [q, setQ] = useState("");
  const stat = (p: string) => {
    const e = items.flatMap((i) => (i.polo === p ? [i.status] : i.polos?.filter((x) => x.name === p).map((x) => x.status) ?? []));
    return { d: e.filter((s) => s === "done").length, t: e.length };
  };
  return (
    <aside className="glass rounded-3xl p-4 animate-rise" style={{ animationDelay: ".1s" }}>
      <div className="flex items-center gap-2">
        <Folder size={16} className="text-cyan" />
        <h3 className="font-display font-semibold">Polos</h3>
      </div>
      <p className="text-[0.68rem] text-muted-foreground">Clique para filtrar o Kanban.</p>
      <label className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-1.5">
        <Search size={12} className="text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar polo…" className="w-full bg-transparent text-xs outline-none" />
      </label>
      <div className="mt-3 max-h-[520px] space-y-0.5 overflow-y-auto pr-1">
        {POLOS.filter((p) => p.toLowerCase().includes(q.toLowerCase())).map((p) => {
          const s = stat(p);
          return (
            <button key={p} onClick={() => onPick(p)} style={tint(poloColor(p))}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-secondary/60 ${active === p ? "bg-[color-mix(in_oklab,var(--glow)_14%,transparent)]" : ""}`}>
              <FolderOpen size={14} className="text-[var(--glow)]" />
              <span className="flex-1 truncate text-left">{p}</span>
              <span className="font-mono text-[0.6rem] text-muted-foreground">{s.d}/{s.t}</span>
              <ChevronRight size={12} className="text-muted-foreground" />
            </button>
          );
        })}
      </div>
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-border p-4">
        <Atom size={34} className="mb-2 animate-[spin_12s_linear_infinite] text-cyan drop-shadow-[0_0_10px_var(--cyan)]" />
        <p className="text-xs leading-relaxed text-muted-foreground">Grandes resultados são construídos com organização, foco e trabalho em equipe.</p>
        <p className="mt-2 mono-caps">— P4C</p>
      </div>
    </aside>
  );
}

/* ---------------- notas ---------------- */
function NotesStrip({ notes, onMore }: { notes: Note[]; onMore: () => void }) {
  return (
    <section className="glass mt-4 rounded-3xl p-4 animate-rise">
      <div className="mb-3 flex items-center gap-3">
        <span className="icon-tile h-8 w-8" style={tint("violet")}><StickyNote size={14} /></span>
        <div className="flex-1"><h3 className="font-display font-semibold">Anotações</h3><p className="text-[0.68rem] text-muted-foreground">Lembretes e informações importantes.</p></div>
        <button onClick={onMore} className="tag flex items-center gap-1" style={tint("cyan")}><Plus size={10} /> Ver / criar</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {notes.slice(0, 3).map((n) => (
          <div key={n.id} className="accent-card !rounded-2xl p-3" style={tint(n.color)}>
            <p className="font-mono text-xs text-[var(--glow)]">{n.date}</p>
            <p className="mt-1 text-sm">{n.text || "Nota vazia"}</p>
            <span className="tag mt-2 inline-block">{n.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotesBoard({ notes, setNotes }: { notes: Note[]; setNotes: (f: (n: Note[]) => Note[]) => void }) {
  const colors = ["violet", "cyan", "emerald", "amber", "pink"];
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
      {notes.map((n, i) => (
        <div key={n.id} style={{ ...tint(n.color), transform: `rotate(${(i % 3) - 1}deg)` }}
          className="group relative min-h-36 rounded-md p-3 pt-5 transition hover:!rotate-0 hover:-translate-y-1 animate-rise"
        >
          <div className="absolute inset-0 rounded-md bg-[color-mix(in_oklab,var(--glow)_22%,var(--card))] shadow-[0_14px_30px_-14px_var(--glow)]" />
          <span className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[-3deg] rounded-sm bg-foreground/15 backdrop-blur" />
          <div className="relative">
            <p className="font-mono text-[0.6rem] text-[var(--glow)]">{n.date} · {n.tag}</p>
            <textarea value={n.text} onChange={(e) => setNotes((xs) => xs.map((x) => (x.id === n.id ? { ...x, text: e.target.value } : x)))}
              placeholder="Escreva…" rows={3} className="mt-1 w-full resize-none bg-transparent text-sm outline-none" />
            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
              {colors.map((c) => <button key={c} onClick={() => setNotes((xs) => xs.map((x) => (x.id === n.id ? { ...x, color: c } : x)))} className="h-3 w-3 rounded-full" style={{ background: `var(--${c})` }} />)}
              <button onClick={() => setNotes((xs) => xs.filter((x) => x.id !== n.id))} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => setNotes((xs) => [...xs, { id: Date.now(), text: "", date: today(), tag: "Geral", color: colors[xs.length % 5]! }])}
        className="grid min-h-36 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-cyan">
        <span className="flex items-center gap-1"><Plus size={13} /> Nova nota</span>
      </button>
    </div>
  );
}

/* ---------------- painel lateral ---------------- */
function DetailPanel({ demand: d, onClose, onStatus, onPolo, onEdit, onNote, onDelete }: {
  demand: Demand | null; onClose: () => void; onStatus: (s: Status) => void; onPolo: (p: string) => void;
  onEdit: (p: Partial<Demand>) => void; onNote: (t: string) => void; onDelete: () => void;
}) {
  const [histOpen, setHistOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [menu, setMenu] = useState(false);
  if (!d) return null;
  const m = typeMeta[d.type];
  const pct = progress(d);
  const doneN = d.polos?.filter((p) => p.status === "done").length ?? 0;
  const nextPolo = d.polos?.find((p) => p.status === "doing") ?? d.polos?.find((p) => p.status === "todo");

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px] animate-in fade-in xl:hidden" />
      <aside style={tint(m.color)}
        className="fixed bottom-3 right-3 top-3 z-50 flex w-[min(470px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-[color-mix(in_oklab,var(--glow)_35%,transparent)] bg-[linear-gradient(170deg,oklch(0.19_0.045_262/0.96),oklch(0.13_0.03_262/0.97))] shadow-[0_0_80px_-20px_var(--glow)] backdrop-blur-2xl animate-in slide-in-from-right-12 fade-in duration-500">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_30%_0%,color-mix(in_oklab,var(--glow)_22%,transparent),transparent)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[var(--glow)] to-transparent opacity-70" />

        <div className="relative flex-1 space-y-4 overflow-y-auto p-5">
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
            <textarea value={d.desc} onChange={(e) => onEdit({ desc: e.target.value })} rows={3} className="w-full rounded-xl border border-border bg-secondary/60 p-2 text-sm outline-none" />
          ) : <p className="text-sm leading-relaxed text-muted-foreground">{d.desc}</p>}

          {/* meta */}
          <div className="grid grid-cols-3 gap-2">
            <Meta icon={Calendar} label="Prazo">{editing ? <input value={d.deadline} onChange={(e) => onEdit({ deadline: e.target.value })} className="w-full bg-transparent outline-none" /> : d.deadline}</Meta>
            <Meta icon={d.polos ? Network : MapPin} label={d.polos ? "Polos" : "Polo"}>{d.polos ? d.polos.length : d.polo ?? "—"}</Meta>
            <Meta icon={Clock} label="Atualização">{d.history.at(-1)?.d ?? "—"}</Meta>
          </div>

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
            {d.polos && <p className="mt-2 text-[0.65rem] text-muted-foreground">Em multipolo, o status é calculado pelo andamento dos polos.</p>}
          </Block>

          {/* progresso */}
          <Block title="Progresso geral" right={d.polos ? <span className="text-xs text-muted-foreground"><b className="text-foreground">{doneN}</b> de <b className="text-foreground">{d.polos.length}</b> polos concluídos</span> : null}>
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
            <Block title="Execução por polo">
              <div className="divide-y divide-border">
                {d.polos.map((p) => {
                  const sm = statusMeta[p.status];
                  return (
                    <button key={p.name} onClick={() => onPolo(p.name)} style={tint(sm.color)} className="group flex w-full items-center gap-3 py-2.5 text-left text-sm transition hover:bg-secondary/30">
                      {p.status === "done" ? <CheckCircle2 size={20} className="text-emerald drop-shadow-[0_0_6px_var(--emerald)]" />
                        : p.status === "doing" ? <Loader size={20} className="animate-[spin_3s_linear_infinite] text-amber" />
                        : <Circle size={20} className="text-muted-foreground" />}
                      <span className="flex-1 font-medium">{p.name}</span>
                      <span className="hidden items-center gap-1 text-[0.65rem] text-muted-foreground sm:flex">
                        {p.status === "done" ? <><Calendar size={11} /> Concluído em {p.date}</> : p.status === "doing" ? <><Clock size={11} /> Em andamento</> : <><Clock size={11} /> Pendente</>}
                      </span>
                      <FileText size={14} className="text-muted-foreground" />
                      <span className="w-24 rounded-full border px-2 py-0.5 text-center text-[0.65rem] transition group-hover:scale-105"
                        style={{ color: p.status === "todo" ? "var(--color-muted-foreground)" : `var(--${p.status === "doing" ? "amber" : "emerald"})`, borderColor: "currentColor", background: p.status === "todo" ? "transparent" : "color-mix(in oklab, currentColor 12%, transparent)" }}>
                        {sm.poloLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[0.65rem]">
                <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-2"><p className="mono-caps !text-emerald">Concluído</p><p className="mt-1">{d.polos.filter((p) => p.status === "done").map((p) => p.name).join(", ") || "—"}</p></div>
                <div className="rounded-xl border border-amber/30 bg-amber/5 p-2"><p className="mono-caps !text-amber">Falta</p><p className="mt-1">{d.polos.filter((p) => p.status !== "done").map((p) => p.name).join(", ") || "Nada 🎉"}</p></div>
              </div>
              <p className="mt-2 text-[0.6rem] text-muted-foreground">Toque em um polo para avançar o status dele.</p>
            </Block>
          )}

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
