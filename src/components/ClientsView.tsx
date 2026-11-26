/**
 * Documentação → Clientes: carteira real (banco), ligada aos dossiês, demandas e reuniões. Visual do Financeiro/Orion:
 * fundo animado, painel com moldura de luz, rosca de receita, radar de vencimentos, cartões 3D e anéis de progresso.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { MeetingResult } from "@/components/meetings/MeetingResult";
import { useMeeting } from "@/lib/data/meetings";
import { toast } from "sonner";
import { ClipboardCopy, Gavel, ListChecks, MessagesSquare, Mic } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { analysisToMarkdown } from "@/lib/meetings";
import { Building2, CalendarClock, Check, ClipboardList, Copy, Eye, EyeOff, Download, FileText, FlaskConical, FolderOpen, KeyRound, LayoutGrid, Link2, List, Loader2, Paperclip, Pencil, Plus, Rocket, Search, Send, Sparkles, Trash2, Users, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Donut, Meter, Money, Ring, Sparkline } from "@/components/finance/charts";
import { PortfolioHealth } from "@/components/PortfolioHealth";
import { portfolioHealth } from "@/lib/portfolio";
import { useQueryClient } from "@tanstack/react-query";
import { ensureClientCategory, useCategories, useCreateTask, useDeleteTask, useTasks, useToggleTask, useUpdateTask } from "@/lib/data/tasks";
import { TaskEditDialog } from "@/components/TaskEditDialog";
import { byAttention, clientSteps, clientTaskProgress, clientTaskStats, matchesAttention, type Attention } from "@/lib/client-progress";
import { RemindPicker } from "@/components/RemindPicker";
import { TaskFilePicker, TaskThumbs, useTaskFiles } from "@/components/TaskFiles";
import { beforeWords } from "@/lib/reminders";
import type { Task } from "@/lib/types";
import { applyDefaultToAll, useSetupSummaries } from "@/lib/data/client-setup";
import { loginsOfDossier, passwordOfAccess, removeAccessLogin, saveAccessLogin } from "@/lib/login-store";
import { FinBackdrop, HeroPanel, LiveDot, OrbitArt, SectionTitle, Tilt } from "@/components/finance/fx";
import { ClientsPreview } from "@/components/ClientsPreview";
import { SetupSummary } from "@/components/SetupGuide";
import { MAX_PENDING, readPending, sizeLabel, toPending, type Pending } from "@/lib/brain-files";
import { signedUrls } from "@/lib/data/brain";
import { useAllClients, useClientActions, useClientExtras, useClientLinks, useClients, useFreeMeetings, useProjectDossiers } from "@/lib/data/clients";
import { DOC_KINDS, STATUS_LABEL, STATUS_TONE, brl, dateBR, dueOf, quickAnswer, summarize, todayBR, type Client, type ClientStatus, type QuickAnswer } from "@/lib/clients";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const COLORS = ["violet", "cyan", "emerald", "amber", "pink"] as const;
const colorOf = (id: string) => COLORS[[...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length]!;
const ini = (n: string) => n.split(" ").filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || n.slice(0, 2).toUpperCase();
const cssColor = (tone: string) => `var(--${tone})`;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Tab = "docs" | "reun" | "dem" | "tar" | "ace" | "lin" | "imp";
const BLANK: Omit<Client, "id" | "projectId"> = { dossierId: null, name: "", segment: "", contactName: "", email: "", phone: "", docNumber: "", status: "ativo", plan: "", monthlyValue: 0, contractEnd: null, notes: "" };

function StatusTag({ s }: { s: ClientStatus }) { return <span className="tag whitespace-nowrap !py-0.5 !text-[0.7rem]" style={tint(STATUS_TONE[s])}>{STATUS_LABEL[s]}</span>; }
function Venc({ c }: { c: Client }) {
  const d = dueOf(c);
  if (d.days === null) return <span className="text-muted-foreground">sem data</span>;
  const cor = d.level === "late" ? "text-destructive" : d.level === "soon" ? "text-amber" : "";
  return <span className={cor}>{dateBR(c.contractEnd)} <small className="text-muted-foreground">· {d.days < 0 ? `venceu há ${-d.days} d` : d.days === 0 ? "vence hoje" : `em ${d.days} d`}</small></span>;
}

export function ClientsView({ projectId }: { projectId: string }) {
  const clientsQ = useClients(projectId), clients = clientsQ.data ?? [];
  const extrasQ = useClientExtras(projectId, clients), ex = extrasQ.data, linksQ = useClientLinks(projectId, clients), links = linksQ.data ?? {};
  const dossiers = useProjectDossiers(projectId).data ?? [], acts = useClientActions(projectId);
  const [filtro, setFiltro] = useState<"todos" | ClientStatus>("todos"), [q, setQ] = useState(""), [vista, setVista] = useState<"tab" | "cards" | "pas">("cards");
  const [importing, setImporting] = useState(false), [selId, setSelId] = useState<string | null>(null), [tab, setTab] = useState<Tab>("docs"), [form, setForm] = useState<{ edit: Client | null } | null>(null), [exemplo, setExemplo] = useState(false);
  const [ask, setAsk] = useState(""), [answer, setAnswer] = useState<QuickAnswer | null>(null), [active, setActive] = useState<string | null>(null);

  const docs = ex?.docs ?? [], demands = ex?.demands ?? [];
  const setupsQ = useSetupSummaries(), [painel, setPainel] = useState<"saude" | "receita">(() => { try { return localStorage.getItem("presence.clientes.painel") === "receita" ? "receita" : "saude"; } catch { return "saude"; } });
  const qc = useQueryClient(), [aplicando, setAplicando] = useState(false);
  const aplicarRoteiro = async () => {
    if (!clients.length) { toast.message("Cadastre clientes primeiro."); return; }
    if (!window.confirm(`Aplicar o roteiro de implantação padrão atual em ${clients.length} cliente(s)? Quem não tem recebe o roteiro; quem já tem o antigo passa para o novo, mantendo o andamento (status e anotações) dos passos que continuam. Passos antigos que ninguém mexeu são removidos; os que você marcou, anotou ou criou ficam.`)) return;
    setAplicando(true);
    try {
      const r = await applyDefaultToAll(clients.map((c) => c.id), projectId);
      await Promise.all([qc.invalidateQueries({ queryKey: ["client-setup"] }), qc.invalidateQueries({ queryKey: ["central"] })]);
      if (r.failed) toast.error(`${r.created + r.updated} cliente(s) atualizados; ${r.failed} falharam. Tente de novo.`); else toast.success(`Roteiro novo aplicado: ${r.created} criado(s), ${r.updated} atualizado(s).`);
    } finally { setAplicando(false); }
  };
  const trocar = (v: "saude" | "receita") => { setPainel(v); try { localStorage.setItem("presence.clientes.painel", v); } catch { /* sem armazenamento */ } };
  const sel = clients.find((c) => c.id === selId) ?? null;
  // tarefas de cada cliente: filtro "quem precisa de mim" (atrasadas, hoje, pendentes, sem tarefas, em dia)
  const allTasks = useTasks().data ?? [], [atencao, setAtencao] = useState<Attention>("todos");
  const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const stats = useMemo(() => new Map(clients.map((c) => [c.id, clientTaskStats(allTasks, c.id, hoje)] as const)), [clients, allTasks, hoje]);
  const baseList = (filtro: "todos" | ClientStatus) => clients.filter((c) => filtro === "todos" || c.status === filtro);
  const atencaoCount = (a: Attention) => baseList(filtro).filter((c) => matchesAttention(stats.get(c.id)!, a)).length;
  const shown = useMemo(() => { const n = norm(q.trim()); const list = clients.filter((c) => matchesAttention(stats.get(c.id)!, atencao) && (filtro === "todos" || c.status === filtro) && (!n || norm([c.name, c.contactName, c.segment, c.email, ...docs.filter((d) => d.clientId === c.id).map((d) => d.title)].join(" ")).includes(n))); return atencao === "todos" ? list : [...list].sort((a, b) => byAttention(stats.get(a.id)!, stats.get(b.id)!) || a.name.localeCompare(b.name, "pt-BR")); }, [clients, filtro, q, docs, atencao, stats]);
  const open = demands.filter((d) => d.status !== "done").length, sum = summarize(clients, open);
  const saude = useMemo(() => {
    const last: Record<string, string> = {}, bump = (id: string, d: string | null | undefined) => { if (d && (!last[id] || d > last[id]!)) last[id] = d; };
    (ex?.log ?? []).forEach((l) => bump(l.clientId, l.date)); (ex?.meetings ?? []).forEach((m) => bump(m.clientId, m.happenedOn));
    clients.forEach((c) => (links[c.id]?.meetings ?? []).forEach((m) => bump(c.id, m.happenedOn)));
    const od: Record<string, number> = {};
    clients.forEach((c) => { const dm = [...demands.filter((d) => d.clientId === c.id), ...(links[c.id]?.demands ?? []).filter((d) => !demands.some((x) => x.clientId === c.id && x.code === d.code))]; od[c.id] = dm.filter((d) => d.status !== "done").length; });
    return portfolioHealth({ clients, setups: setupsQ.data ?? [], lastContact: last, openDemands: od });
  }, [clients, ex, links, demands, setupsQ.data]);
  const dossierName = (id: string | null) => dossiers.find((d) => d.id === id)?.name;
  const slices = clients.filter((c) => c.status === "ativo" && c.monthlyValue > 0).map((c) => ({ id: c.id, name: c.name, color: cssColor(colorOf(c.id)), value: c.monthlyValue }));
  // o anel de cada cliente mostra quanto das tarefas criadas para ele já foi feito
  const taskProg = (id: string) => clientTaskProgress(allTasks, id);
  const perClient = (id: string) => { const dm = [...demands.filter((d) => d.clientId === id), ...(links[id]?.demands ?? []).filter((d) => !demands.some((x) => x.clientId === id && x.code === d.code))]; return { total: dm.length, done: dm.filter((d) => d.status === "done").length, pct: dm.length ? Math.round((dm.filter((d) => d.status === "done").length / dm.length) * 100) : 0 }; };

  const perguntar = (t: string) => { setAsk(t); const a = quickAnswer(t, { clients, docs, demands }); setAnswer(a ?? { title: "Ainda não sei responder isso por aqui", lines: ["Tente: vencimentos, demandas abertas, receita ou “contrato do <cliente>”. Para perguntas livres, use o assistente do Orion."] }); };
  const err = (e: unknown) => toast.error(`Não consegui salvar: ${(e as Error).message}`);

  if (clientsQ.isPending) return <div className="glass grid place-items-center gap-3 rounded-3xl p-16 text-sm text-muted-foreground"><Loader2 size={22} className="animate-spin text-cyan" /> Carregando seus clientes…</div>;
  if (exemplo) return <div className="space-y-3"><button onClick={() => setExemplo(false)} className="rounded-full border border-cyan/50 px-4 py-1.5 text-xs text-cyan hover:bg-cyan/10">← Voltar para os meus clientes</button><ClientsPreview /></div>;

  return (
    <div className="relative space-y-5" data-testid="clientes">
      <FinBackdrop />
      {clients.length === 0 ? (
        <HeroPanel glow="var(--violet)" data-testid="clientes-vazio">
          <div className="grid items-center gap-6 md:grid-cols-[1.2fr_auto]">
            <div>
              <SectionTitle kicker="Clientes" title="Sua carteira" accent="começa aqui" sub="Cadastre um cliente e ligue ao dossiê dele: demandas, reuniões, documentos e vencimentos ficam numa ficha só." />
              <div className="mt-5 flex flex-wrap gap-2.5">
                <button onClick={() => setForm({ edit: null })} data-testid="cliente-novo" className="flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2.5 text-sm font-semibold text-background shadow-[0_0_28px_-6px_var(--cyan)] transition active:scale-95"><Plus size={16} /> Cadastrar primeiro cliente</button>
                <button onClick={() => setImporting(true)} data-testid="clientes-importar" className="flex items-center gap-2 rounded-full border border-violet/50 px-5 py-2.5 text-sm text-violet transition hover:bg-violet/10"><Link2 size={15} /> Importar dos dossiês</button>
                <button onClick={() => setExemplo(true)} className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-muted-foreground transition hover:text-foreground"><FlaskConical size={15} /> Ver exemplo preenchido</button>
              </div>
            </div>
            <div className="hidden md:block"><OrbitArt size={230}><Users size={34} className="text-cyan" /></OrbitArt></div>
          </div>
        </HeroPanel>
      ) : (<>
        <HeroPanel glow="var(--cyan)" data-testid="clientes-hero">
          <div className="mb-3 flex justify-end"><div className="flex rounded-full border border-white/10 p-0.5 text-[0.68rem]" role="radiogroup" aria-label="Painel do topo">{([["saude", "Saúde da carteira"], ["receita", "Receita e vencimentos"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={painel === k} onClick={() => trocar(k)} data-testid={`painel-${k}`} className={`rounded-full px-3 py-1 transition ${painel === k ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>)}</div></div>
          {painel === "saude" && <PortfolioHealth p={saude} onPick={(id) => { setSelId(id); setTab("docs"); }} />}
          {painel === "receita" && <div className="grid items-center gap-6 lg:grid-cols-[1.25fr_auto_1fr]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5"><p className="mono-caps">Receita mensal dos clientes ativos</p><LiveDot label={`${sum.active} ativo${sum.active === 1 ? "" : "s"}`} /></div>
              <p className="mt-2 whitespace-nowrap font-display text-5xl font-semibold leading-none tracking-tight md:text-6xl"><span className="text-gradient"><Money value={sum.monthly} cents={false} /></span></p>
              <p className="mt-2 text-sm text-muted-foreground">{sum.total} cliente{sum.total === 1 ? "" : "s"} na carteira{sum.negotiating > 0 && <> · {brl(sum.negotiating)}/mês em negociação</>}</p>
              <div className="mt-5 grid grid-cols-3 gap-2.5">
                {[{ l: "Vencendo", v: sum.expiring, c: "var(--amber)", hint: "em até 30 dias" }, { l: "Demandas abertas", v: sum.openDemands, c: "var(--violet)", hint: "dos dossiês" }, { l: "Documentos", v: docs.length, c: "var(--cyan)", hint: "guardados" }].map((k, i) => (
                  <div key={k.l} className="rounded-2xl border bg-white/[0.03] px-3 py-2.5" style={{ borderColor: `color-mix(in oklab, ${k.c} 28%, transparent)`, animation: `fin-rise .6s ${0.15 + i * 0.07}s both` }}>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: k.c }}>{k.l}</p>
                    <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">{k.v}</p><p className="text-[0.65rem] text-muted-foreground">{k.hint}</p>
                  </div>))}
              </div>
            </div>
            {slices.length > 0 && <div className="flex justify-center"><Donut data={slices} size={190} thickness={22} active={active} onActive={setActive} center={(() => { const on = slices.find((s) => s.id === active); return on ? <div><p className="max-w-[7rem] truncate text-xs text-muted-foreground">{on.name}</p><p className="font-display text-base font-semibold tabular-nums">{brl(on.value)}</p></div> : <div><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">por cliente</p><p className="font-display text-lg font-semibold">{slices.length}</p></div>; })()} /></div>}
            <Radar clients={clients} onPick={(id) => { setSelId(id); setTab("docs"); }} />
          </div>}
        </HeroPanel>

        <form onSubmit={(e) => { e.preventDefault(); if (ask.trim()) perguntar(ask); }} className="glass flex items-center gap-2 rounded-full py-1 pl-4 pr-1 animate-rise">
          <Sparkles size={15} className="shrink-0 text-cyan" />
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Pergunte: “contratos que vencem em 30 dias”, “contrato da Alvorada”…" aria-label="Pergunte sobre seus clientes" data-testid="cliente-pergunta" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <button type="submit" aria-label="Perguntar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-r from-cyan to-violet text-background"><Send size={15} /></button>
        </form>
        {answer && (
          <div className="rounded-2xl border border-violet/30 bg-violet/10 p-4 text-sm" data-testid="cliente-resposta" style={{ animation: "fin-rise .35s both" }}>
            <div className="flex items-start gap-2"><b className="flex-1 font-display">{answer.title}</b><button onClick={() => setAnswer(null)} aria-label="Fechar resposta" className="text-muted-foreground hover:text-foreground"><X size={13} /></button></div>
            {answer.lines.map((l) => <p key={l} className="mt-1 text-xs text-muted-foreground">• {l}</p>)}
            <div className="mt-2 flex flex-wrap gap-2">{answer.clientId && <button onClick={() => { setSelId(answer.clientId ?? null); setTab("docs"); }} className="rounded-full border border-cyan/50 px-3 py-1 text-xs text-cyan hover:bg-cyan/10">Abrir ficha</button>}<Link to="/assistente" className="rounded-full border border-white/15 px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Perguntar ao assistente</Link></div>
          </div>)}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por situação">
            {([["todos", "Todos"], ["ativo", "Ativos"], ["neg", "Em negociação"], ["pausa", "Pausados"], ["encerrado", "Encerrados"]] as const).map(([k, l]) => <button key={k} onClick={() => setFiltro(k)} aria-pressed={filtro === k} className={`rounded-full border px-3.5 py-1.5 text-xs transition ${filtro === k ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{l}</button>)}
          </div>
          <span className="grow" />
          <label className="glass flex min-w-[200px] items-center gap-2 rounded-xl px-3 py-2"><Search size={13} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, contato, documento…" aria-label="Buscar" className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground" />{q && <button onClick={() => setQ("")} aria-label="Limpar"><X size={11} /></button>}</label>
          <div className="glass flex rounded-xl p-1">{([["cards", "Cards", LayoutGrid], ["tab", "Tabela", List], ["pas", "Pastas", FolderOpen]] as const).map(([k, l, I]) => <button key={k} onClick={() => setVista(k)} aria-pressed={vista === k} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${vista === k ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}><I size={13} /> {l}</button>)}</div>
          <button onClick={() => setImporting(true)} data-testid="clientes-importar" className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-muted-foreground transition hover:border-violet/50 hover:text-foreground"><Link2 size={14} /> Importar dos dossiês</button>
          <button onClick={aplicarRoteiro} disabled={aplicando} data-testid="clientes-aplicar-roteiro" title="Aplica o roteiro de implantação padrão atual em todos os clientes (mantém o andamento dos passos que continuam)" className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-muted-foreground transition hover:border-cyan/50 hover:text-foreground disabled:opacity-60">{aplicando ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Aplicar roteiro padrão em todos</button>
          <button onClick={() => setForm({ edit: null })} data-testid="cliente-novo" className="flex items-center gap-1.5 rounded-full border border-cyan/60 px-4 py-2 text-sm text-cyan shadow-[0_0_24px_-10px_var(--cyan)] transition hover:bg-cyan/10"><Plus size={15} /> Novo cliente</button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar pelas tarefas" data-testid="clientes-atencao">
          <span className="mr-1 text-xs text-muted-foreground">Quem precisa de você (tarefas):</span>
          {([["todos", "Todos", ""], ["atrasadas", "Atrasadas", "text-rose-400 border-rose-400/50"], ["hoje", "Para hoje", "text-amber border-amber/50"], ["pendentes", "Com pendentes", "text-cyan border-cyan/50"], ["sem", "Sem tarefas", "text-muted-foreground border-white/20"], ["emdia", "Em dia", "text-emerald border-emerald/50"]] as const).map(([k, l, cls]) => (
            <button key={k} onClick={() => setAtencao(atencao === k ? "todos" : k)} aria-pressed={atencao === k} data-testid={`atencao-${k}`}
              className={`rounded-full border px-3 py-1 text-xs transition ${atencao === k ? `bg-white/10 ${cls || "text-foreground border-white/30"}` : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{l} <b className="tabular-nums">{atencaoCount(k)}</b></button>))}
        </div>

        <div className={`grid gap-4 ${sel ? "xl:grid-cols-[minmax(0,1fr)_440px]" : ""}`}>
          <section className={vista === "cards" ? "" : "glass overflow-hidden rounded-3xl animate-rise"} data-testid="clientes-lista">
            {shown.length === 0 ? <p className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Nenhum cliente com esse filtro.</p> : vista === "cards" ? (
              <div className={`grid gap-4 sm:grid-cols-2 ${sel ? "" : "xl:grid-cols-3"}`}>{shown.map((c, i) => {
                const p = perClient(c.id), tone = colorOf(c.id), d = dueOf(c), nDocs = docs.filter((x) => x.clientId === c.id).length + (links[c.id]?.libDocs.length ?? 0);
                return (
                  <div key={c.id} style={{ animation: `fin-pop .55s ${Math.min(i, 8) * 0.06}s both` }}>
                    <Tilt max={9}>
                      <button onClick={() => { setSelId(c.id); setTab("docs"); }} data-testid={`cliente-${c.id}`} className={`ex-card block w-full p-4 text-left ${selId === c.id ? "ring-1 ring-cyan/60" : ""}`} style={{ "--rail": cssColor(tone) } as CSSProperties}>
                        <div className="flex items-start gap-3">
                          <span className="icon-tile h-11 w-11 shrink-0 !rounded-2xl text-sm font-bold shadow-[0_0_20px_-6px_var(--glow)]" style={tint(tone)}>{ini(c.name)}</span>
                          <div className="min-w-0 flex-1"><p className="truncate font-display text-base font-semibold">{c.name}</p><p className="truncate text-xs text-muted-foreground">{c.contactName || "sem contato"}{c.segment && ` · ${c.segment}`}</p><div className="mt-1.5 flex flex-wrap gap-1.5"><StatusTag s={c.status} />{dossierName(c.dossierId) && <span className="tag !py-0.5 !text-[0.7rem]" style={tint("violet")}><Link2 size={9} className="mr-1 inline" />{dossierName(c.dossierId)}</span>}</div></div>
                          <span title={taskProg(c.id).total ? `${taskProg(c.id).done} de ${taskProg(c.id).total} tarefas feitas` : "Nenhuma tarefa criada para este cliente"} data-testid="cliente-progresso"><Ring pct={taskProg(c.id).pct} color={cssColor(tone)} size={54} thickness={5}><span className="text-[0.62rem] font-semibold tabular-nums">{taskProg(c.id).total ? `${taskProg(c.id).pct}%` : "—"}</span></Ring></span>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3"><div><p className="mono-caps">Mensal</p><p className="font-display text-lg font-semibold tabular-nums">{c.monthlyValue ? brl(c.monthlyValue) : "—"}</p></div>
                          <div className="text-right text-xs"><p className="mono-caps">Fim do contrato</p><p className="tabular-nums"><Venc c={c} /></p></div></div>
                        <div className="mt-3"><Meter pct={d.days === null || d.days < 0 ? 100 : Math.max(4, 100 - Math.min(100, (d.days / 365) * 100))} color={d.level === "late" ? "var(--destructive)" : d.level === "soon" ? "var(--amber)" : cssColor(tone)} height={5} warn={false} /></div>
                        {(() => {
                          const st = stats.get(c.id)!, sp = clientSteps(allTasks, c.id);
                          const tone2 = sp.total === 0 ? "border-white/10 bg-white/[0.03]" : sp.current === 0 ? "border-emerald/50 bg-emerald/10" : st.overdue > 0 ? "border-rose-400/60 bg-rose-400/10" : "border-cyan/50 bg-cyan/10";
                          return (
                            <div className={`mt-3 rounded-xl border px-3 py-2 ${tone2}`} data-testid="cliente-etapa">
                              {sp.total === 0 ? <p className="text-[0.72rem] text-muted-foreground">Nenhuma etapa criada. Crie as tarefas deste cliente na ficha.</p> : sp.current === 0 ? (
                                <p className="text-[0.78rem] font-semibold text-emerald">✓ Todas as {sp.total} etapas feitas</p>
                              ) : (
                                <>
                                  <p className="flex items-center justify-between gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"><span>Etapa atual · {sp.current} de {sp.total}</span>{st.overdue > 0 && <span className="rounded-full bg-rose-400/20 px-2 py-0.5 normal-case tracking-normal text-rose-300">{st.overdue} {st.overdue === 1 ? "atrasada" : "atrasadas"}</span>}{st.today > 0 && <span className="rounded-full bg-amber/20 px-2 py-0.5 normal-case tracking-normal text-amber">{st.today} para hoje</span>}</p>
                                  <p className="mt-0.5 truncate text-sm font-semibold" title={sp.next!.title}>{sp.next!.title}</p>
                                  <p className="mt-1 flex items-center gap-0.5" aria-hidden>{sp.steps.map((x, k) => <i key={x.id} className={`h-1.5 flex-1 rounded-full ${x.done ? "bg-emerald" : k + 1 === sp.current ? "bg-cyan shadow-[0_0_8px_var(--cyan)]" : "bg-white/15"}`} />)}</p>
                                  {sp.missing.length > 1 && <p className="mt-1 truncate text-[0.66rem] text-muted-foreground" title={sp.missing.slice(1).map((x) => x.title).join(" · ")}>Depois: {sp.missing.slice(1, 3).map((x) => x.title).join(" · ")}{sp.missing.length > 3 ? ` · +${sp.missing.length - 3}` : ""}</p>}
                                </>
                              )}
                            </div>);
                        })()}
                        <p className="mt-2 flex gap-3 text-[0.68rem] text-muted-foreground"><span><FileText size={10} className="mr-1 inline" />{nDocs} docs</span><span><ClipboardList size={10} className="mr-1 inline" />{p.total - p.done} abertas</span></p>
                      </button>
                    </Tilt>
                  </div>);
              })}</div>
            ) : vista === "tab" ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-white/10 text-left">{["Cliente", "Situação", ...(sel ? [] : ["Plano", "Valor/mês"]), "Fim do contrato", ...(sel ? [] : ["Docs"])].map((h) => <th key={h} className="mono-caps whitespace-nowrap px-4 py-3 font-normal">{h}</th>)}</tr></thead>
                <tbody>{shown.map((c) => (
                  <tr key={c.id} onClick={() => { setSelId(c.id); setTab("docs"); }} onKeyDown={(e) => { if (e.key === "Enter") { setSelId(c.id); setTab("docs"); } }} tabIndex={0} data-testid={`cliente-${c.id}`} className={`cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.04] ${selId === c.id ? "bg-violet/10" : ""}`}>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="icon-tile h-9 w-9 shrink-0 !rounded-xl text-[0.7rem] font-bold" style={tint(colorOf(c.id))}>{ini(c.name)}</span><div className="min-w-0"><p className="truncate font-medium">{c.name}</p><p className="truncate text-xs text-muted-foreground">{c.contactName || "sem contato"}{c.segment && ` · ${c.segment}`}</p></div></div></td>
                    <td className="px-4 py-3"><StatusTag s={c.status} /></td>
                    {!sel && <><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{c.plan || "—"}</td><td className="px-4 py-3 tabular-nums">{c.monthlyValue ? brl(c.monthlyValue) : "—"}</td></>}
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums"><Venc c={c} /></td>
                    {!sel && <td className="px-4 py-3 tabular-nums text-muted-foreground">{docs.filter((x) => x.clientId === c.id).length}</td>}
                  </tr>))}</tbody></table></div>
            ) : (
              <div className="space-y-1 p-3">{shown.map((c) => <div key={c.id}>
                <button onClick={() => { setSelId(selId === c.id ? null : c.id); setTab("docs"); }} aria-expanded={selId === c.id} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]"><FolderOpen size={17} className="shrink-0 text-cyan" /><b className="min-w-0 flex-1 truncate font-medium">{c.name}</b><StatusTag s={c.status} /><span className="mono-caps">{docs.filter((x) => x.clientId === c.id).length} docs</span></button>
                {selId === c.id && <div className="ml-9 space-y-0.5 pb-2">{docs.filter((x) => x.clientId === c.id).map((d) => <div key={d.id} className="flex justify-between gap-3 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"><span className="flex min-w-0 items-center gap-2"><FileText size={12} className="shrink-0" /><span className="truncate">{d.title}</span></span><span className="mono-caps shrink-0">{d.kind}</span></div>)}</div>}</div>)}</div>
            )}
          </section>

          {sel && <Ficha key={sel.id} links={links[sel.id]} projectId={projectId} client={sel} tab={tab} setTab={setTab} onClose={() => setSelId(null)} onEdit={() => setForm({ edit: sel })} dossierName={dossierName(sel.dossierId)} acts={acts} extras={ex} err={err}
            onDelete={() => acts.remove.mutate(sel, { onSuccess: () => { setSelId(null); toast.success("Cliente apagado"); }, onError: err })} />}
        </div>
      </>)}

      {importing && <ImportDossiers dossiers={dossiers} existing={new Set(clients.map((c) => c.dossierId).filter((x): x is string => !!x))} onClose={() => setImporting(false)} onImport={(list) => acts.importDossiers.mutate(list, { onSuccess: (n) => { setImporting(false); toast.success(`${n} cliente${n === 1 ? "" : "s"} criado${n === 1 ? "" : "s"} a partir dos dossiês`); }, onError: err })} busy={acts.importDossiers.isPending} />}
      {form && <ClientForm key={form.edit?.id ?? "novo"} initial={form.edit} dossiers={dossiers} busy={acts.save.isPending} onClose={() => setForm(null)} onSave={(c) => acts.save.mutate(c, { onSuccess: (id) => { setForm(null); if (id) { setSelId(String(id)); setTab("docs"); } toast.success(c.id ? "Cliente atualizado" : "Cliente cadastrado"); }, onError: err })} />}
    </div>
  );
}

/** Cria clientes a partir dos dossiês do projeto (os que ainda não têm cliente), já ligados a eles. */
function ImportDossiers({ dossiers, existing, onClose, onImport, busy }: { dossiers: { id: string; name: string }[]; existing: Set<string>; onClose: () => void; onImport: (l: { id: string; name: string }[]) => void; busy: boolean }) {
  const free = dossiers.filter((d) => !existing.has(d.id)), [sel, setSel] = useState<Set<string>>(() => new Set(free.map((d) => d.id))), [q, setQ] = useState("");
  const shown = free.filter((d) => norm(d.name).includes(norm(q.trim())));
  const toggle = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[88dvh] max-w-lg overflow-hidden rounded-[2rem] border-white/10 bg-[oklch(0.14_0.035_265/0.9)] p-0 backdrop-blur-2xl" data-testid="clientes-importar-dialogo" aria-describedby={undefined}>
        <div className="flex max-h-[88dvh] flex-col px-6 pb-5 pt-6">
          <div className="mb-3 flex items-center gap-3"><span className="icon-tile h-10 w-10 shrink-0 !rounded-full" style={tint("violet")}><Link2 size={16} /></span><div><p className="mono-caps">Clientes</p><DialogTitle className="font-display text-lg font-semibold">Importar dos dossiês</DialogTitle></div></div>
          {free.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Todos os dossiês deste projeto já têm cliente.</p> : <>
            <p className="mb-3 text-xs text-muted-foreground">Cada dossiê marcado vira um cliente, já ligado a ele. Você completa contato, valor e contrato depois.</p>
            <div className="mb-2 flex items-center gap-2"><label className="glass flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-1.5"><Search size={12} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar dossiê…" aria-label="Buscar dossiê" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label><button onClick={() => setSel(new Set(shown.map((d) => d.id)))} className="text-xs text-cyan hover:underline">Marcar todos</button><button onClick={() => setSel(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Nenhum</button></div>
            <ul className="scroll-neon -mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">{shown.map((d) => <li key={d.id}><button onClick={() => toggle(d.id)} role="checkbox" aria-checked={sel.has(d.id)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.05]"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${sel.has(d.id) ? "border-cyan bg-cyan/20 text-cyan" : "border-white/25"}`}>{sel.has(d.id) && <Check size={12} />}</span><span className="min-w-0 flex-1 truncate text-sm">{d.name}</span></button></li>)}</ul>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4"><button onClick={onClose} disabled={busy} className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button><button onClick={() => onImport(free.filter((d) => sel.has(d.id)))} disabled={busy || sel.size === 0} data-testid="clientes-importar-ok" className="rounded-full bg-gradient-to-r from-cyan to-violet px-6 py-2.5 text-sm font-semibold text-background shadow-[0_0_30px_-8px_var(--cyan)] disabled:opacity-40">{busy ? "Criando…" : `Criar ${sel.size} cliente${sel.size === 1 ? "" : "s"}`}</button></div></>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Radar de vencimentos: próximos 120 dias numa linha, com um ponto por contrato. */
function Radar({ clients, onPick }: { clients: Client[]; onPick: (id: string) => void }) {
  const pts = clients.filter((c) => c.contractEnd && c.status !== "pausa" && c.status !== "encerrado").map((c) => ({ c, d: dueOf(c).days ?? 999 })).filter((x) => x.d <= 120).sort((a, b) => a.d - b.d);
  return (
    <div className="min-w-0" data-testid="clientes-radar">
      <p className="mono-caps mb-2">Radar de vencimentos · 120 dias</p>
      <div className="relative h-24 rounded-2xl border border-white/10 bg-black/20 px-3">
        <span aria-hidden className="absolute inset-x-3 top-1/2 h-px bg-gradient-to-r from-cyan/70 via-violet/50 to-transparent" />
        {[0, 30, 60, 90, 120].map((t) => <span key={t} className="absolute top-1/2 -translate-x-1/2 text-[0.55rem] text-muted-foreground" style={{ left: `calc(0.75rem + (100% - 1.5rem) * ${t / 120})`, marginTop: 10 }}>{t === 0 ? "hoje" : `${t}d`}</span>)}
        {pts.map(({ c, d }, i) => { const x = Math.max(0, Math.min(120, d)) / 120, cor = d < 0 ? "var(--destructive)" : d <= 30 ? "var(--amber)" : "var(--cyan)"; return (
          <button key={c.id} onClick={() => onPick(c.id)} title={`${c.name} · ${dateBR(c.contractEnd)}`} aria-label={`${c.name}, vence ${dateBR(c.contractEnd)}`} className="absolute -translate-x-1/2 -translate-y-1/2 transition hover:scale-125" style={{ left: `calc(0.75rem + (100% - 1.5rem) * ${x})`, top: i % 2 ? "30%" : "70%" }}>
            <span className="block h-3 w-3 rounded-full" style={{ background: cor, boxShadow: `0 0 12px ${cor}`, animation: d <= 30 ? "fin-pulse 1.8s ease-out infinite" : undefined }} /></button>); })}
        {pts.length === 0 && <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Nenhum vencimento nos próximos 120 dias</p>}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[0.65rem] text-muted-foreground"><Sparkline values={[3, 5, 4, 7, 6, 9, 8]} width={60} height={18} color="var(--cyan)" /><span>{pts.filter((x) => x.d <= 30).length} em até 30 dias</span></div>
    </div>
  );
}

type Acts = ReturnType<typeof useClientActions>;
function Ficha({ client: c, links, projectId: _pid, tab, setTab, onClose, onEdit, onDelete, dossierName, acts, extras, err }: { links: import("@/lib/data/clients").ClientLinks | undefined; projectId: string; client: Client; tab: Tab; setTab: (t: Tab) => void; onClose: () => void; onEdit: () => void; onDelete: () => void; dossierName: string | undefined; acts: Acts; extras: ReturnType<typeof useClientExtras>["data"]; err: (e: unknown) => void }) {
  const docs = (extras?.docs ?? []).filter((d) => d.clientId === c.id), log = (extras?.log ?? []).filter((l) => l.clientId === c.id), access = (extras?.access ?? []).filter((a) => a.clientId === c.id);
  const ownMeets = (extras?.meetings ?? []).filter((m) => m.clientId === c.id);
  const meets = [...ownMeets, ...(links?.meetings ?? []).filter((m) => !ownMeets.some((x) => x.id === m.id)).map((m) => ({ id: m.id, clientId: c.id, title: m.title, happenedOn: m.happenedOn, summary: m.summary || "do polo" }))];
  const ownDem = (extras?.demands ?? []).filter((d) => d.clientId === c.id);
  const dem = [...ownDem, ...(links?.demands ?? []).filter((d) => !ownDem.some((x) => x.code === d.code)).map((d) => ({ ...d, clientId: c.id }))];
  const [loginTick, setLoginTick] = useState(0);
  useEffect(() => { const h = () => setLoginTick((n) => n + 1); window.addEventListener("orion:logins", h); return () => window.removeEventListener("orion:logins", h); }, []);
  // os acessos criados aqui (id "a-…") já aparecem na lista de acessos; aqui ficam só os cadastrados na Documentação
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logins = useMemo(() => (dossierName ? loginsOfDossier(dossierName).filter((l) => !l.id.startsWith("a-")) : []), [dossierName, loginTick]);
  const tasksQ = useTasks(), clientTasks = useMemo(() => (tasksQ.data ?? []).filter((t) => t.client_id === c.id).sort((a, b) => Number(a.done) - Number(b.done) || `${a.due_date ?? "9"}${a.due_time ?? ""}`.localeCompare(`${b.due_date ?? "9"}${b.due_time ?? ""}`)), [tasksQ.data, c.id]);
  const [confirm, setConfirm] = useState(false), tone = colorOf(c.id);
  const tabs: [Tab, string, typeof FileText][] = [["imp", "Implantação", Rocket], ["docs", `Documentos (${docs.length + (links?.libDocs.length ?? 0)})`, FileText], ["reun", `Reuniões (${meets.length})`, CalendarClock], ["dem", `Demandas (${dem.filter((d) => d.status !== "done").length})`, ClipboardList], ["tar", `Tarefas (${clientTasks.filter((t) => !t.done).length})`, ListChecks], ["ace", `Acessos (${access.length + logins.length})`, KeyRound], ["lin", "Histórico", Sparkles]];
  return (
    <aside className="glass scroll-thin space-y-4 rounded-3xl p-5 animate-rise xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain" data-testid="cliente-ficha">
      <div className="flex items-start gap-3">
        <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl shadow-[0_0_24px_-6px_var(--glow)]" style={tint(tone)}><Building2 size={20} /></span>
        <div className="min-w-0 flex-1"><p className="mono-caps">Ficha do cliente</p><h3 className="font-display text-lg font-semibold leading-tight">{c.name}</h3><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusTag s={c.status} />{dossierName ? <span className="tag !py-0.5 !text-[0.7rem]" style={tint("violet")}><Link2 size={9} className="mr-1 inline" />Dossiê {dossierName}</span> : <button onClick={onEdit} data-testid="cliente-vincular-dossie" className="rounded-full border border-dashed border-violet/50 px-2.5 py-0.5 text-[0.68rem] text-violet transition hover:bg-violet/10">+ Vincular a um dossiê</button>}</div></div>
        <button onClick={onEdit} aria-label="Editar cliente" data-testid="cliente-editar" className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
        <button onClick={onClose} aria-label="Fechar ficha" className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {([["Contato", c.contactName], ["Segmento", c.segment], ["E-mail", c.email], ["Telefone", c.phone], ["CNPJ/CPF", c.docNumber], ["Plano", c.plan ? `${c.plan}${c.monthlyValue ? ` · ${brl(c.monthlyValue)}/mês` : ""}` : c.monthlyValue ? `${brl(c.monthlyValue)}/mês` : ""]] as const).map(([k, v]) => <div key={k} className="min-w-0"><dt className="mono-caps">{k}</dt><dd className="break-words font-medium">{v || <span className="text-muted-foreground">—</span>}</dd></div>)}
        <div className="col-span-2"><dt className="mono-caps">Fim do contrato</dt><dd className="font-medium tabular-nums"><Venc c={c} /></dd></div>
        {c.notes && <div className="col-span-2"><dt className="mono-caps">Observações</dt><dd className="whitespace-pre-wrap text-xs text-muted-foreground">{c.notes}</dd></div>}
      </dl>
      <div role="tablist" className="flex flex-wrap gap-x-1 border-b border-white/10">{tabs.map(([k, l, I]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition ${tab === k ? "border-cyan text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}><I size={12} /> {l}</button>)}</div>
      {tab === "imp" && <SetupSummary clientId={c.id} clientName={c.name} projectId={c.projectId} />}
      {tab === "docs" && <><DocsTab client={c} docs={docs} acts={acts} err={err} />{(links?.libDocs.length ?? 0) > 0 && <div className="mt-4 space-y-2" data-testid="cliente-docs-dossie"><p className="mono-caps">Da pasta do dossiê (Biblioteca)</p>{links!.libDocs.map((d) => <div key={d.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"><FileText size={14} className="shrink-0 text-cyan" /><div className="min-w-0 flex-1"><p className="truncate text-sm">{d.title}</p><p className="truncate text-xs text-muted-foreground">{d.kind}{d.folder && ` · ${d.folder}`}{d.updated && ` · ${d.updated}`}</p></div></div>)}</div>}</>}
      {tab === "reun" && <MeetingsTab client={c} meets={meets} acts={acts} err={err} />}
      {tab === "dem" && <div className="space-y-2">{!c.dossierId ? <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-muted-foreground">Vincule um dossiê a este cliente (botão de editar) e as demandas dele aparecem aqui.</p> : dem.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma demanda neste dossiê.</p> : dem.map((d) => <button key={d.code} onClick={() => acts.setDemand.mutate({ code: d.code, status: d.status === "done" ? "todo" : "done" }, { onError: err })} className="ex-card flex w-full items-center gap-3 p-3 text-left" style={{ "--rail": "var(--emerald)" } as CSSProperties}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${d.status === "done" ? "border-emerald bg-emerald/20 text-emerald" : "border-white/20"}`}>{d.status === "done" && <Check size={12} />}</span><div className="min-w-0"><p className={`truncate text-sm font-medium ${d.status === "done" ? "text-muted-foreground line-through" : ""}`}>{d.title}</p><p className="text-xs text-muted-foreground">{d.code}{d.deadline && ` · prazo ${d.deadline}`}</p></div></button>)}<Link to="/demandas" className="block text-center text-xs text-cyan hover:underline">Abrir todas as demandas</Link></div>}
      {tab === "tar" && <ClientTasks client={c} tasks={clientTasks} />}
      {tab === "ace" && <><AccessTab client={c} access={access} acts={acts} err={err} dossierName={dossierName} />{logins.length > 0 && <div className="mt-4 space-y-2" data-testid="cliente-logins-dossie"><p className="mono-caps">Logins do dossiê (Documentação)</p>{logins.map((l) => <div key={l.id} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--amber)" } as CSSProperties}><KeyRound size={14} className="shrink-0 text-amber" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{l.title}</p><p className="truncate font-mono text-xs text-muted-foreground">{l.user}{l.owner && ` · ${l.owner}`}</p><p className="truncate font-mono text-xs text-amber" data-testid="cliente-login-senha">Senha: {l.pass || "—"}</p></div><CopyPass user={l.user} pass={l.pass} /></div>)}<p className="text-[0.65rem] text-muted-foreground">As senhas ficam só neste navegador (não vão para o banco nem para a IA).</p></div>}</>}
      {tab === "lin" && <><LogTab client={c} log={log} acts={acts} err={err} />{(links?.records.length ?? 0) > 0 && <div className="mt-4 space-y-2" data-testid="cliente-registros-dossie"><p className="mono-caps">Registros e notas do dossiê</p>{links!.records.slice(0, 12).map((r) => <div key={r.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="mono-caps">{r.kind === "nota" ? "Nota" : "Registro"} · {r.kind === "nota" ? r.date : dateBR(r.date)}</p><p className="line-clamp-2 whitespace-pre-wrap text-sm">{r.text}</p></div>)}</div>}</>}
      <div className="border-t border-white/10 pt-3">{confirm ? <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Apagar o cliente, documentos e histórico? Não dá para desfazer.</span><button onClick={onDelete} data-testid="cliente-apagar-ok" className="rounded-full border border-destructive/60 px-3 py-1 text-destructive hover:bg-destructive/10">Apagar</button><button onClick={() => setConfirm(false)} className="rounded-full border border-white/15 px-3 py-1">Cancelar</button></div> : <button onClick={() => setConfirm(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"><Trash2 size={12} /> Apagar cliente</button>}</div>
          </aside>
  );
}

function DocsTab({ client, docs, acts, err }: { client: Client; docs: import("@/lib/clients").ClientDoc[]; acts: Acts; err: (e: unknown) => void }) {
  const [adding, setAdding] = useState(false), [title, setTitle] = useState(""), [kind, setKind] = useState<string>(DOC_KINDS[0]), [date, setDate] = useState(todayBR()), [files, setFiles] = useState<Pending[]>([]), [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null), [urls, setUrls] = useState<Record<string, { view: string; download: string }>>({});
  const pick = async (list: FileList | null) => { if (!list) return; const r = await toPending([...list], files, { maxFiles: MAX_PENDING, maxBytes: 25 * 1024 * 1024 }); setFiles((f) => [...f, ...r.added]); if (r.rejected.length) toast.error(r.rejected.join(" · ")); if (!title && r.added[0]) setTitle(r.added[0].name.replace(/\.[^.]+$/, "")); };
  const save = async () => {
    if (!title.trim()) return; setBusy(true);
    try { const read = files.length ? await readPending(files).catch(() => ({ summary: "" })) : { summary: "" }; await acts.addDoc.mutateAsync({ clientId: client.id, title, kind, docDate: date || null, files: files.map((p) => ({ name: p.name, mime: p.mime, blob: p.blob })), summary: read.summary }); setAdding(false); setTitle(""); setFiles([]); toast.success("Documento guardado", { description: files.length ? "O Orion leu o conteúdo para achar depois." : undefined }); } catch (e) { err(e); } finally { setBusy(false); }
  };
  const open = async (d: import("@/lib/clients").ClientDoc, a: import("@/lib/data/brain").Attachment) => { try { const u = urls[a.path] ?? (await signedUrls([a.path]))[a.path]; if (!u) throw new Error("arquivo não encontrado"); setUrls((o) => ({ ...o, [a.path]: u })); window.open(u.view, "_blank", "noopener"); } catch (e) { toast.error(`Não consegui abrir ${d.title}: ${(e as Error).message}`); } };
  return (
    <div className="space-y-2">
      {docs.length === 0 && !adding && <p className="py-4 text-center text-sm text-muted-foreground">Nenhum documento ainda. Anexe contratos, propostas, termos…</p>}
      {docs.map((d) => <div key={d.id} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--cyan)" } as CSSProperties}><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg" style={tint("cyan")}><FileText size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.title}</p><p className="truncate text-xs text-muted-foreground">{d.kind}{d.docDate && ` · ${dateBR(d.docDate)}`}{d.attachments.length > 0 && ` · ${d.attachments.map((a) => `${a.name} (${sizeLabel(a.size)})`).join(", ")}`}</p></div>
        {d.attachments[0] && <button onClick={() => void open(d, d.attachments[0]!)} aria-label={`Abrir ${d.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"><Download size={13} /></button>}
        <button onClick={() => { if (window.confirm(`Apagar "${d.title}"?`)) acts.removeDoc.mutate(d, { onError: err }); }} aria-label={`Apagar ${d.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button></div>)}
      {adding ? (
        <div className="space-y-2.5 rounded-2xl border border-cyan/30 bg-black/20 p-3" data-testid="cliente-doc-form">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do documento" aria-label="Nome do documento" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
          <div className="flex gap-2"><select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm">{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm" /></div>
          <input ref={input} type="file" multiple className="hidden" onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} data-testid="cliente-doc-arquivo" />
          <button onClick={() => input.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-2 text-xs text-muted-foreground hover:text-foreground"><Paperclip size={13} /> {files.length ? `${files.length} arquivo${files.length === 1 ? "" : "s"}: ${files.map((f) => f.name).join(", ")}` : "Escolher arquivos (PDF, imagem, planilha…)"}</button>
          <div className="flex gap-2"><button onClick={() => void save()} disabled={busy || !title.trim()} data-testid="cliente-doc-salvar" className="flex-1 rounded-full bg-gradient-to-r from-cyan to-violet py-2 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Guardando…" : "Guardar"}</button><button onClick={() => { setAdding(false); setFiles([]); }} className="rounded-full border border-white/15 px-4 text-sm">Cancelar</button></div>
        </div>
      ) : <button onClick={() => setAdding(true)} data-testid="cliente-doc-novo" className="flex w-full items-center justify-center gap-2 rounded-full border border-cyan/60 py-2 text-sm text-cyan transition hover:bg-cyan/10"><Paperclip size={14} /> Anexar documento</button>}
    </div>
  );
}

/** Reunião inteira (ata, decisões, quem faz o quê) numa janela flutuante, sem sair da ficha do cliente. */
function MeetingViewer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useMeeting(id), m = q.data;
  const a = m?.analysis;
  const chips = a ? [
    { I: Users, v: a.participantes.length, l: "participantes", c: "var(--cyan)" },
    { I: Gavel, v: a.decisoes.length, l: "decisões", c: "var(--violet)" },
    { I: ListChecks, v: a.acoes.length, l: "ações", c: "var(--emerald)" },
    { I: MessagesSquare, v: a.topicos.length || a.grupos.length, l: m?.mode === "grupo" ? "grupos" : "tópicos", c: "var(--amber)" },
  ] : [];
  const copiar = async () => { if (!a || !m) return; if (await copyText(analysisToMarkdown(a, m.happenedOn))) toast.success("Ata copiada"); else toast.error("Não consegui copiar."); };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-3xl gap-0 overflow-hidden rounded-[2rem] border-white/15 bg-[oklch(0.13_0.04_268/0.82)] p-0 shadow-[0_40px_120px_-30px_var(--violet)] backdrop-blur-2xl" data-testid="reuniao-janela" aria-describedby={undefined}>
        {/* fundo vivo da janela */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--violet)] opacity-30 blur-3xl" style={{ animation: "fin-aurora 18s ease-in-out infinite" }} />
          <span className="absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-[var(--cyan)] opacity-[0.16] blur-3xl" style={{ animation: "fin-aurora 22s ease-in-out infinite reverse" }} />
          <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "linear-gradient(rgba(140,200,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(140,200,255,.08) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "linear-gradient(180deg, black, transparent 70%)", WebkitMaskImage: "linear-gradient(180deg, black, transparent 70%)" }} />
          {Array.from({ length: 24 }, (_, i) => <span key={i} className="absolute rounded-full bg-white" style={{ left: `${(i * 41 + 7) % 100}%`, top: `${(i * 29 + 5) % 100}%`, width: 1 + (i % 2), height: 1 + (i % 2), opacity: 0.6, animation: `fin-twinkle ${3 + (i % 4)}s ease-in-out ${i % 5}s infinite` }} />)}
        </div>
        <div className="relative max-h-[92dvh] overflow-y-auto p-5 sm:p-7">
          <DialogHeader className="space-y-0 text-left">
            <div className="flex items-start gap-4">
              <span className="relative grid h-14 w-14 shrink-0 place-items-center">
                <span aria-hidden className="absolute inset-0 rounded-2xl border border-violet/50" style={{ animation: "pulse-ring 2.4s ease-out infinite" }} />
                <span className="icon-tile h-14 w-14 !rounded-2xl shadow-[0_0_30px_-6px_var(--violet)]" style={tint("violet")}><Mic size={22} /></span>
              </span>
              <div className="min-w-0 flex-1 pr-8">
                <p className="mono-caps flex flex-wrap items-center gap-2 !text-[0.62rem]">{m ? `${dateBR(m.happenedOn)} · ${m.mode === "grupo" ? "resumo de grupos" : "reunião"}` : "Reunião"}<LiveDot color="var(--emerald)" label="ata do Orion" /></p>
                <DialogTitle className="mt-1.5 font-display text-2xl font-semibold leading-tight sm:text-3xl"><span className="text-gradient">{m?.title ?? (q.isPending ? "Carregando…" : "Reunião não encontrada")}</span></DialogTitle>
              </div>
            </div>
            {chips.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{chips.map((c, i) => (
              <span key={c.l} className="group inline-flex items-center gap-2 rounded-full border bg-white/[0.04] px-3 py-1.5 text-xs backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.08]" style={{ borderColor: `color-mix(in oklab, ${c.c} 35%, transparent)`, animation: `fin-rise .5s ${0.1 + i * 0.06}s both` }}>
                <c.I size={13} className="transition group-hover:scale-125" style={{ color: c.c }} /><b className="tabular-nums">{c.v}</b><span className="text-muted-foreground">{c.l}</span>
              </span>))}</div>}
          </DialogHeader>
          <div className="mt-5 space-y-3">
            {q.isPending && <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-cyan" /></div>}
            {m && <MeetingResult a={m.analysis} selected={new Set()} sent={new Set()} onToggle={() => undefined} onSelectAll={() => undefined} readOnly />}
          </div>
          {m && <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 border-t border-white/10 pt-4">
            <button onClick={() => void copiar()} data-testid="reuniao-copiar" className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-5 py-2 text-sm text-cyan shadow-[0_0_26px_-10px_var(--cyan)] transition hover:-translate-y-0.5 hover:bg-cyan/20 active:scale-95"><ClipboardCopy size={14} /> Copiar ata</button>
            <Link to="/reunioes" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm text-muted-foreground transition hover:-translate-y-0.5 hover:border-violet/50 hover:text-foreground active:scale-95">Editar vínculo ou criar demandas</Link>
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MeetingsTab({ client, meets, acts, err }: { client: Client; meets: { id: string; title: string; happenedOn: string; summary: string }[]; acts: Acts; err: (e: unknown) => void }) {
  const free = useFreeMeetings().data ?? [], [pick, setPick] = useState(""), [view, setView] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {meets.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">Nenhuma reunião vinculada.</p>}
      {meets.map((m) => <div key={m.id} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--violet)" } as CSSProperties}><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg font-mono text-[0.6rem]" style={tint("violet")}>ATA</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.title}</p><p className="truncate text-xs text-muted-foreground">{dateBR(m.happenedOn)}{m.summary && ` · ${m.summary}`}</p></div><button onClick={() => setView(m.id)} data-testid={`reuniao-abrir-${m.id}`} className="shrink-0 text-[0.7rem] text-violet hover:underline">Abrir</button><button onClick={() => acts.linkMeeting.mutate({ meetingId: m.id, clientId: null }, { onError: err })} aria-label="Desvincular reunião" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"><X size={13} /></button></div>)}
      {free.length > 0 && <div className="flex gap-2"><select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Reunião para vincular" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs"><option value="">Vincular uma reunião…</option>{free.map((m) => <option key={m.id} value={m.id}>{dateBR(m.happened_on)} · {m.title}</option>)}</select><button disabled={!pick} onClick={() => { acts.linkMeeting.mutate({ meetingId: pick, clientId: client.id }, { onSuccess: () => setPick(""), onError: err }); }} className="rounded-full border border-cyan/60 px-4 text-xs text-cyan disabled:opacity-40">Vincular</button></div>}
      <Link to="/reunioes" className="block text-center text-xs text-cyan hover:underline">Abrir Reuniões</Link>
      {view && <MeetingViewer id={view} onClose={() => setView(null)} />}
    </div>
  );
}

/** Copiar a senha. */
function CopyPass({ user, pass }: { user: string; pass: string }) {
  const [ok, setOk] = useState(false);
  if (!user && !pass) return null;
  // pronto para colar e enviar: usuário e senha, um embaixo do outro
  const text = [user && `Usuário: ${user}`, pass && `Senha: ${pass}`].filter(Boolean).join("\n");
  return <button type="button" onClick={() => { void copyText(text).then((done) => { if (done) { setOk(true); toast.success(pass ? "Usuário e senha copiados" : "Usuário copiado"); setTimeout(() => setOk(false), 1400); } else toast.error("Não consegui copiar. Selecione o texto e copie manualmente."); }); }} aria-label="Copiar usuário e senha" title="Copiar usuário e senha" data-testid="copiar-usuario-senha" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground transition hover:text-cyan active:scale-90">{ok ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}</button>;
}

/** Tarefas, compromissos, treinamentos e implantações ligados ao cliente — e um jeito rápido de criar mais, já vinculadas. */
function ClientTasks({ client, tasks }: { client: Client; tasks: Task[] }) {
  const qc = useQueryClient(), create = useCreateTask(), toggle = useToggleTask(), cats = useCategories().data ?? [], files = useTaskFiles(), update = useUpdateTask(), del = useDeleteTask(), allClients = useAllClients().data ?? [], [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState(""), [date, setDate] = useState(""), [time, setTime] = useState(""), [cat, setCat] = useState(""), [remind, setRemind] = useState<number[]>([]), [open, setOpen] = useState(false);
  const field = "min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60 [color-scheme:dark]";
  const catName = (id: string | null | undefined) => cats.find((x) => x.id === id)?.name;
  // sem categoria escolhida, a tarefa vai para "Clientes" (não para "Demandas"): assim, nas Tarefas, dá para separar tudo o que é para os clientes
  const add = async () => {
    if (!title.trim() || create.isPending) return;
    const category_id = cat || (await ensureClientCategory().catch(() => null));
    let attachments: Awaited<ReturnType<typeof files.upload>> = [];
    try { attachments = await files.upload(); } catch (e) { toast.error(`Não consegui enviar o arquivo: ${(e as Error).message}`); return; }
    create.mutate({ title: title.trim(), category_id, ...(attachments.length ? { attachments } : {}), due_date: date || null, due_time: time || null, remind_before: time && date && remind.length ? remind : null, client_id: client.id },
      { onSuccess: () => { setTitle(""); setDate(""); setTime(""); setRemind([]); files.clear(); void qc.invalidateQueries({ queryKey: ["categories"] }); toast.success(`Tarefa criada em Clientes · ${client.name}`); }, onError: (e) => toast.error((e as Error).message) });
  };
  return (
    <div className="space-y-2" data-testid="cliente-tarefas">
      <form onSubmit={(e) => { e.preventDefault(); void add(); }} onPaste={files.onPaste} onDrop={files.onDrop} onDragOver={files.onDragOver} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Nova tarefa para ${client.name} (ex.: Treinamento)`} aria-label="Nova tarefa do cliente" data-testid="cliente-tarefa-titulo" className={field} /><button type="submit" disabled={!title.trim() || create.isPending || files.busy} className="rounded-full border border-cyan/60 px-4 text-sm text-cyan transition hover:bg-cyan/10 disabled:opacity-40">{files.busy ? "Enviando…" : "Criar"}</button></div>
        <TaskFilePicker files={files} />
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[0.7rem] text-muted-foreground hover:text-cyan">{open ? "Menos opções" : "Data, hora, categoria e lembrete"}</button>
        {open && (
          <div className="space-y-2">
            <div className="flex gap-2"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" className={field} /><input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora" className={field} /></div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria" className={`${field} w-full`}><option value="" className="bg-popover">Clientes (padrão)</option>{cats.map((x) => <option key={x.id} value={x.id} className="bg-popover">{x.name}</option>)}</select>
            <div><p className="mb-1 text-[0.7rem] text-muted-foreground">Lembrar antes {(!date || !time) && "(precisa de data e hora)"}</p><RemindPicker value={remind} onChange={setRemind} disabled={!date || !time} /></div>
          </div>
        )}
      </form>
      {tasks.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">Nenhuma tarefa vinculada a este cliente ainda.</p>}
      {tasks.map((t) => (
        <div key={t.id} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--violet)" } as CSSProperties} data-testid="cliente-tarefa">
          <button onClick={() => toggle.mutate({ id: t.id, done: !t.done })} aria-label={t.done ? "Reabrir" : "Concluir"} className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${t.done ? "border-emerald bg-emerald/20 text-emerald" : "border-white/20"}`}>{t.done && <Check size={12} />}</button>
          <div className="min-w-0 flex-1"><p className={`truncate text-sm font-medium ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
            <TaskThumbs files={t.attachments ?? []} title={t.title} />
            <p className="truncate text-xs text-muted-foreground">{[catName(t.category_id), t.due_date && dateBR(t.due_date), t.due_time?.slice(0, 5), t.remind_before?.length ? `avisa ${t.remind_before.map(beforeWords).join(", ")} antes` : ""].filter(Boolean).join(" · ") || "Sem data"}</p></div>
          <button type="button" onClick={() => setEditing(t)} aria-label={`Editar ${t.title}`} data-testid="cliente-tarefa-editar" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
          <button type="button" onClick={() => { if (window.confirm(`Excluir a tarefa "${t.title}"?`)) del.mutate(t.id, { onSuccess: () => toast.success("Tarefa excluída"), onError: (e) => toast.error((e as Error).message) }); }} aria-label={`Excluir ${t.title}`} data-testid="cliente-tarefa-excluir" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
        </div>
      ))}
      {editing && (
        <TaskEditDialog task={editing} categories={cats} clients={allClients} saving={update.isPending} onClose={() => setEditing(null)}
          onSave={(patch) => update.mutate({ id: editing.id, patch }, { onSuccess: () => { setEditing(null); toast.success("Tarefa atualizada"); }, onError: (e) => toast.error((e as Error).message) })}
          onDelete={() => { if (window.confirm(`Excluir a tarefa "${editing.title}"?`)) del.mutate(editing.id, { onSuccess: () => { setEditing(null); toast.success("Tarefa excluída"); }, onError: (e) => toast.error((e as Error).message) }); }} />
      )}
      <Link to="/tarefas" className="block text-center text-xs text-cyan hover:underline">Abrir todas as tarefas</Link>
    </div>
  );
}

function AccessTab({ client, access, acts, err, dossierName }: { client: Client; access: import("@/lib/clients").ClientAccess[]; acts: Acts; err: (e: unknown) => void; dossierName: string | undefined }) {
  const [label, setLabel] = useState(""), [user, setUser] = useState(""), [pass, setPass] = useState(""), [note, setNote] = useState(""), [shown, setShown] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<{ id: string; label: string; user: string; pass: string; note: string } | null>(null);
  const saveEdit = () => {
    if (!edit || !edit.label.trim()) return;
    acts.updateAccess.mutate({ id: edit.id, label: edit.label, username: edit.user, note: edit.note }, { onSuccess: () => { saveAccessLogin({ accessId: edit.id, label: edit.label, user: edit.user, pass: edit.pass, owner: client.contactName, dossier: dossierName ?? client.name, note: edit.note }); setEdit(null); }, onError: err });
  };
  const field = "min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60";
  return (
    <div className="space-y-2">
      <p className="rounded-xl border border-amber/25 bg-amber/5 px-3 py-2 text-[0.7rem] text-muted-foreground">Guarde aqui <b className="text-foreground">onde</b> fica cada acesso, o usuário e a <b className="text-foreground">senha</b>. A senha fica <b className="text-foreground">só neste navegador</b> (não vai para o banco nem para a IA) e o acesso já aparece em <b className="text-foreground">Logins e senhas</b>, na Documentação.</p>
      {access.map((a) => { const pw = passwordOfAccess(a.id); const on = shown[a.id] !== false; return edit?.id === a.id ? (
        <form key={a.id} onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="space-y-2 rounded-2xl border border-cyan/50 bg-black/20 p-3" data-testid="acesso-editando">
          <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="Onde" aria-label="Editar onde" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
          <div className="flex gap-2"><input value={edit.user} onChange={(e) => setEdit({ ...edit, user: e.target.value })} placeholder="Usuário" aria-label="Editar usuário" autoComplete="off" className={field} /><input value={edit.pass} onChange={(e) => setEdit({ ...edit, pass: e.target.value })} placeholder="Senha" aria-label="Editar senha" autoComplete="new-password" className={`${field} font-mono`} /></div>
          <input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Observação (opcional)" aria-label="Editar observação" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
          <div className="flex gap-2"><button type="button" onClick={() => setEdit(null)} className="flex-1 rounded-full border border-white/10 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancelar</button><button type="submit" disabled={!edit.label.trim() || acts.updateAccess.isPending} className="flex-1 rounded-full border border-cyan/60 py-1.5 text-sm text-cyan transition hover:bg-cyan/10 disabled:opacity-40">Salvar</button></div>
        </form>
      ) : (
        <div key={a.id} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--amber)" } as CSSProperties}>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.label}</p><p className="truncate font-mono text-xs text-muted-foreground">{a.username || "—"}{a.note && ` · ${a.note}`}</p>
            {pw !== null && <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-xs text-amber" data-testid="acesso-senha"><span className="text-muted-foreground">Senha:</span> {pw ? (on ? pw : "••••••••••") : "—"}{pw && <button type="button" onClick={() => setShown((m) => ({ ...m, [a.id]: !on }))} aria-label={on ? "Ocultar senha" : "Mostrar senha"} className="text-muted-foreground transition hover:text-cyan">{on ? <EyeOff size={12} /> : <Eye size={12} />}</button>}</p>}</div>
          <CopyPass user={a.username} pass={pw ?? ""} />
          <button onClick={() => setEdit({ id: a.id, label: a.label, user: a.username, pass: pw ?? "", note: a.note })} aria-label={`Editar ${a.label}`} data-testid="acesso-editar" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
          <button onClick={() => acts.removeAccess.mutate(a.id, { onSuccess: () => removeAccessLogin(a.id), onError: err })} aria-label={`Apagar ${a.label}`} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
        </div>); })}
      <form onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; acts.addAccess.mutate({ clientId: client.id, label, username: user, note }, { onSuccess: (id) => { saveAccessLogin({ accessId: id, label, user, pass, owner: client.contactName, dossier: dossierName ?? client.name, note }); setLabel(""); setUser(""); setPass(""); setNote(""); }, onError: err }); }} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Onde (ex.: painel de anúncios)" aria-label="Onde" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
        <div className="flex gap-2"><input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuário" aria-label="Usuário" autoComplete="off" className={field} /><input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Senha" aria-label="Senha" autoComplete="new-password" data-testid="acesso-nova-senha" className={`${field} font-mono`} /></div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (opcional)" aria-label="Observação" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
        <button type="submit" disabled={!label.trim()} className="w-full rounded-full border border-cyan/60 py-1.5 text-sm text-cyan transition hover:bg-cyan/10 active:scale-[.99] disabled:opacity-40">Adicionar acesso</button>
      </form>
    </div>
  );
}

function LogTab({ client, log, acts, err }: { client: Client; log: import("@/lib/clients").ClientLog[]; acts: Acts; err: (e: unknown) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; acts.addLog.mutate({ clientId: client.id, text }, { onSuccess: () => setText(""), onError: err }); }} className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Anotar o que aconteceu…" aria-label="Anotação" data-testid="cliente-log-texto" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60" /><button type="submit" disabled={!text.trim()} className="rounded-full border border-cyan/60 px-4 text-sm text-cyan disabled:opacity-40">Anotar</button></form>
      {log.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">Sem histórico ainda.</p> : <ol className="ml-1.5 space-y-3.5 border-l border-white/10 pl-5">{log.map((l) => <li key={l.id} className="group relative"><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-violet shadow-[0_0_10px_var(--violet)]" /><p className="mono-caps">{dateBR(l.date)}</p><p className="text-sm">{l.text}</p><button onClick={() => acts.removeLog.mutate(l.id, { onError: err })} aria-label="Apagar anotação" className="absolute right-0 top-0 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"><Trash2 size={11} /></button></li>)}</ol>}
    </div>
  );
}

function ClientForm({ initial, dossiers, busy, onClose, onSave }: { initial: Client | null; dossiers: { id: string; name: string }[]; busy: boolean; onClose: () => void; onSave: (c: Omit<Client, "id" | "projectId"> & { id?: string | undefined }) => void }) {
  const [f, setF] = useState<Omit<Client, "id" | "projectId">>(initial ? { dossierId: initial.dossierId, name: initial.name, segment: initial.segment, contactName: initial.contactName, email: initial.email, phone: initial.phone, docNumber: initial.docNumber, status: initial.status, plan: initial.plan, monthlyValue: initial.monthlyValue, contractEnd: initial.contractEnd, notes: initial.notes } : BLANK);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const inp = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60";
  const lab = (t: string, node: React.ReactNode) => <label className="block space-y-1"><span className="mono-caps">{t}</span>{node}</label>;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto border-white/10 bg-background" data-testid="cliente-form">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{lab("Nome do cliente", <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} data-testid="cliente-nome" maxLength={160} />)}</div>
          {lab("Dossiê vinculado", <select value={f.dossierId ?? ""} onChange={(e) => set("dossierId", e.target.value || null)} className={inp} data-testid="cliente-dossie"><option value="">Nenhum</option>{dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>)}
          {lab("Situação", <select value={f.status} onChange={(e) => set("status", e.target.value as ClientStatus)} className={inp}>{(Object.keys(STATUS_LABEL) as ClientStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>)}
          {lab("Responsável / contato", <input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} className={inp} />)}
          {lab("Segmento", <input value={f.segment} onChange={(e) => set("segment", e.target.value)} className={inp} />)}
          {lab("E-mail", <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={inp} />)}
          {lab("Telefone", <input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inp} />)}
          {lab("CNPJ / CPF", <input value={f.docNumber} onChange={(e) => set("docNumber", e.target.value)} className={inp} />)}
          {lab("Plano ou serviço", <input value={f.plan} onChange={(e) => set("plan", e.target.value)} className={inp} />)}
          {lab("Valor por mês (R$)", <input type="number" min={0} step="0.01" value={f.monthlyValue || ""} onChange={(e) => set("monthlyValue", Number(e.target.value) || 0)} className={inp} data-testid="cliente-valor" />)}
          {lab("Fim do contrato", <input type="date" value={f.contractEnd ?? ""} onChange={(e) => set("contractEnd", e.target.value || null)} className={inp} data-testid="cliente-fim" />)}
          <div className="sm:col-span-2">{lab("Observações", <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inp} />)}</div>
        </div>
        <div className="flex justify-end gap-2 pt-1"><button onClick={onClose} className="rounded-full border border-white/15 px-5 py-2 text-sm">Cancelar</button><button onClick={() => f.name.trim() && onSave({ ...f, ...(initial ? { id: initial.id } : {}) })} disabled={busy || !f.name.trim()} data-testid="cliente-salvar" className="rounded-full bg-gradient-to-r from-cyan to-violet px-6 py-2 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Salvando…" : "Salvar"}</button></div>
      </DialogContent>
    </Dialog>
  );
}
