/**
 * Exemplo (dados fictícios, nada é salvo) de como a Documentação ficaria para quem trabalha com clientes: carteira, ficha com documentos,
 * atas, demandas e acessos, vencimentos e perguntas ao Orion. Usa o visual do app; serve só para ver e decidir.
 */
import { useMemo, useState, type CSSProperties } from "react";
import { Building2, CalendarClock, Check, ClipboardList, Copy, Eye, EyeOff, FileText, FlaskConical, FolderOpen, KeyRound, LayoutGrid, List, Paperclip, Search, Send, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const TODAY = new Date(2026, 10, 21);
const COLORS = ["violet", "cyan", "emerald", "amber", "pink", "violet", "cyan"] as const;

type Status = "ativo" | "neg" | "pausa";
type Client = {
  id: number; nome: string; seg: string; resp: string; email: string; tel: string; status: Status; plano: string; valor: number; venc: string; cnpj: string;
  docs: { nome: string; tipo: string; kind: string; data: string }[];
  reunioes: { titulo: string; data: string; resumo: string }[];
  demandas: { titulo: string; feita: boolean; prazo: string }[];
  acessos: { nome: string; user: string; pass: string }[];
  linha: { data: string; texto: string }[];
};

const SEED: Client[] = [
  { id: 1, nome: "Clínica Vida Plena", seg: "Saúde", resp: "Dra. Helena Duarte", email: "helena@vidaplena.exemplo", tel: "(11) 4000-1201", status: "ativo", plano: "Gestão completa", valor: 4800, venc: "2026-12-04", cnpj: "00.000.001/0001-01",
    docs: [{ nome: "Contrato de prestação.pdf", tipo: "PDF", kind: "Contrato", data: "12/03/2026" }, { nome: "Proposta comercial v3.pdf", tipo: "PDF", kind: "Proposta", data: "20/02/2026" }, { nome: "Termo LGPD assinado.pdf", tipo: "PDF", kind: "Termo", data: "12/03/2026" }, { nome: "Briefing de campanha.docx", tipo: "DOC", kind: "Briefing", data: "02/09/2026" }],
    reunioes: [{ titulo: "Alinhamento de metas do trimestre", data: "14/11/2026", resumo: "3 decisões · 4 tarefas" }, { titulo: "Revisão de resultados de outubro", data: "05/11/2026", resumo: "2 decisões · 1 tarefa" }],
    demandas: [{ titulo: "Enviar relatório de novembro", feita: false, prazo: "28/11" }, { titulo: "Atualizar tabela de preços no site", feita: false, prazo: "30/11" }, { titulo: "Corrigir horários no Google Meu Negócio", feita: true, prazo: "18/11" }],
    acessos: [{ nome: "Painel de anúncios", user: "vidaplena.ads", pass: "Vp#9482!kd" }, { nome: "Hospedagem do site", user: "admin_vp", pass: "Hs@2231xq" }],
    linha: [{ data: "21/11", texto: "Cliente pediu reajuste de agenda para dezembro" }, { data: "14/11", texto: "Reunião de metas do trimestre" }, { data: "02/09", texto: "Briefing de campanha recebido" }, { data: "12/03", texto: "Contrato assinado" }] },
  { id: 2, nome: "Construtora Alvorada", seg: "Construção", resp: "Marcos Telles", email: "marcos@alvorada.exemplo", tel: "(21) 3000-4410", status: "ativo", plano: "Consultoria mensal", valor: 7200, venc: "2026-12-18", cnpj: "00.000.002/0001-02",
    docs: [{ nome: "Contrato 2026.pdf", tipo: "PDF", kind: "Contrato", data: "08/01/2026" }, { nome: "Cronograma de obras.xlsx", tipo: "XLS", kind: "Planilha", data: "11/11/2026" }, { nome: "Procuração.pdf", tipo: "PDF", kind: "Jurídico", data: "08/01/2026" }],
    reunioes: [{ titulo: "Visita ao canteiro · bloco B", data: "17/11/2026", resumo: "5 pendências" }],
    demandas: [{ titulo: "Revisar orçamento do bloco C", feita: false, prazo: "25/11" }, { titulo: "Pedir alvará atualizado", feita: false, prazo: "02/12" }],
    acessos: [{ nome: "Portal de licitações", user: "alvorada.compras", pass: "Av!771#pz" }],
    linha: [{ data: "17/11", texto: "Visita ao canteiro do bloco B" }, { data: "11/11", texto: "Cronograma atualizado recebido" }, { data: "08/01", texto: "Contrato assinado" }] },
  { id: 3, nome: "Pet Café Mimo", seg: "Varejo", resp: "Juliana Reis", email: "ju@petcafemimo.exemplo", tel: "(31) 99000-7788", status: "neg", plano: "Proposta em análise", valor: 2400, venc: "2026-11-28", cnpj: "00.000.003/0001-03",
    docs: [{ nome: "Proposta comercial.pdf", tipo: "PDF", kind: "Proposta", data: "15/11/2026" }, { nome: "Apresentação institucional.pdf", tipo: "PDF", kind: "Material", data: "10/11/2026" }],
    reunioes: [{ titulo: "Primeira conversa", data: "10/11/2026", resumo: "Interesse alto" }],
    demandas: [{ titulo: "Responder dúvidas sobre prazo", feita: false, prazo: "24/11" }, { titulo: "Enviar contrato para assinatura", feita: false, prazo: "28/11" }],
    acessos: [], linha: [{ data: "15/11", texto: "Proposta enviada" }, { data: "10/11", texto: "Primeira conversa" }] },
  { id: 4, nome: "Escola Árvore do Saber", seg: "Educação", resp: "Prof. Antônio Lacerda", email: "antonio@arvoresaber.exemplo", tel: "(41) 3200-9090", status: "ativo", plano: "Gestão de redes", valor: 3100, venc: "2027-02-10", cnpj: "00.000.004/0001-04",
    docs: [{ nome: "Contrato anual.pdf", tipo: "PDF", kind: "Contrato", data: "10/02/2026" }, { nome: "Calendário de posts.xlsx", tipo: "XLS", kind: "Planilha", data: "03/11/2026" }, { nome: "Autorização de imagem.pdf", tipo: "PDF", kind: "Termo", data: "14/02/2026" }],
    reunioes: [{ titulo: "Planejamento do semestre", data: "19/10/2026", resumo: "6 ações" }],
    demandas: [{ titulo: "Aprovar artes de dezembro", feita: false, prazo: "29/11" }],
    acessos: [{ nome: "Instagram da escola", user: "arvoresaber.oficial", pass: "Ae$5520#rt" }],
    linha: [{ data: "03/11", texto: "Calendário de posts atualizado" }, { data: "19/10", texto: "Planejamento do semestre" }, { data: "10/02", texto: "Contrato anual assinado" }] },
  { id: 5, nome: "Doces da Vó Lia", seg: "Alimentos", resp: "Lia Monteiro", email: "lia@docesvolia.exemplo", tel: "(19) 98100-2233", status: "pausa", plano: "Pausado até jan/27", valor: 1500, venc: "2026-12-01", cnpj: "00.000.005/0001-05",
    docs: [{ nome: "Contrato.pdf", tipo: "PDF", kind: "Contrato", data: "05/05/2026" }, { nome: "Pedido de pausa.pdf", tipo: "PDF", kind: "Documento", data: "30/10/2026" }],
    reunioes: [{ titulo: "Conversa sobre pausa", data: "28/10/2026", resumo: "Retomada em janeiro" }],
    demandas: [{ titulo: "Reativar contas em janeiro", feita: false, prazo: "05/01" }],
    acessos: [{ nome: "Loja virtual", user: "volia.loja", pass: "Vl#3318mm" }],
    linha: [{ data: "30/10", texto: "Pausa solicitada" }, { data: "28/10", texto: "Conversa sobre pausa" }, { data: "05/05", texto: "Contrato assinado" }] },
  { id: 6, nome: "Studio Pilates Corpo & Alma", seg: "Saúde", resp: "Renata Barros", email: "renata@corpoalma.exemplo", tel: "(11) 97700-3400", status: "ativo", plano: "Gestão completa", valor: 3900, venc: "2026-11-30", cnpj: "00.000.006/0001-06",
    docs: [{ nome: "Contrato renovação.pdf", tipo: "PDF", kind: "Contrato", data: "28/11/2025" }, { nome: "Relatório de outubro.pdf", tipo: "PDF", kind: "Relatório", data: "04/11/2026" }],
    reunioes: [{ titulo: "Resultados de outubro", data: "04/11/2026", resumo: "Meta batida" }],
    demandas: [{ titulo: "Renovar contrato", feita: false, prazo: "30/11" }, { titulo: "Gravar vídeos de dezembro", feita: false, prazo: "06/12" }],
    acessos: [{ nome: "Agenda online", user: "corpoalma.adm", pass: "Ca&4417#zx" }],
    linha: [{ data: "04/11", texto: "Relatório de outubro enviado" }, { data: "28/11", texto: "Última renovação (2025)" }] },
];

const STATUS: Record<Status, { label: string; tone: string }> = { ativo: { label: "Ativo", tone: "emerald" }, neg: { label: "Em negociação", tone: "cyan" }, pausa: { label: "Pausado", tone: "muted-foreground" } };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const diasAte = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - TODAY.getTime()) / 864e5);
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const ini = (n: string) => n.split(" ").filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Venc({ c }: { c: Client }) {
  const d = diasAte(c.venc), cor = c.status === "pausa" ? "" : d < 0 ? "text-destructive" : d <= 30 ? "text-amber" : "";
  return <span className={cor}>{dataBR(c.venc)} <small className="text-muted-foreground">· {d < 0 ? `venceu há ${-d} d` : d === 0 ? "vence hoje" : `em ${d} d`}</small></span>;
}
function StatusTag({ s }: { s: Status }) { return <span className="tag whitespace-nowrap !py-0.5 !text-[0.7rem]" style={tint(STATUS[s].tone)}>{STATUS[s].label}</span>; }

export function ClientsPreview() {
  const [clients, setClients] = useState(SEED);
  const [filtro, setFiltro] = useState<"todos" | Status>("todos"), [q, setQ] = useState(""), [vista, setVista] = useState<"tab" | "pas">("tab");
  const [selId, setSelId] = useState<number | null>(null), [tab, setTab] = useState<"docs" | "reun" | "dem" | "ace" | "lin">("docs"), [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [ask, setAsk] = useState(""), [answer, setAnswer] = useState<{ title: string; lines: string[]; pick?: number } | null>(null);
  const sel = clients.find((c) => c.id === selId) ?? null;

  const shown = useMemo(() => { const n = norm(q.trim()); return clients.filter((c) => (filtro === "todos" || c.status === filtro) && (!n || norm([c.nome, c.resp, c.seg, c.email, ...c.docs.map((d) => d.nome)].join(" ")).includes(n))); }, [clients, filtro, q]);
  const ativos = clients.filter((c) => c.status === "ativo"), vencendo = clients.filter((c) => c.status !== "pausa" && diasAte(c.venc) <= 30);
  const abertas = clients.reduce((a, c) => a + c.demandas.filter((d) => !d.feita).length, 0), nDocs = clients.reduce((a, c) => a + c.docs.length, 0);
  const mutate = (id: number, fn: (c: Client) => Client) => setClients((l) => l.map((c) => (c.id === id ? fn(c) : c)));

  const perguntar = (texto: string) => {
    setAsk(texto); const n = norm(texto);
    if (/venc|renov|fim do contrato/.test(n)) { const L = vencendo.slice().sort((a, b) => a.venc.localeCompare(b.venc)); setAnswer({ title: `${L.length} contratos vencem em até 30 dias`, lines: L.map((c) => `${c.nome} — ${dataBR(c.venc)} (em ${diasAte(c.venc)} dias) · ${brl(c.valor)}/mês`) }); return; }
    if (/demanda|pendente|aberta/.test(n)) { const L = clients.flatMap((c) => c.demandas.filter((d) => !d.feita).map((d) => `${d.titulo} — ${c.nome} (até ${d.prazo})`)); setAnswer({ title: `${L.length} demandas abertas`, lines: L.slice(0, 6).concat(L.length > 6 ? [`… e mais ${L.length - 6}`] : []) }); return; }
    if (/receb|mensal|faturamento|valor/.test(n)) { setAnswer({ title: `${brl(ativos.reduce((a, c) => a + c.valor, 0))} por mês`, lines: [`${ativos.length} clientes ativos`, `Em negociação: ${brl(clients.filter((c) => c.status === "neg").reduce((a, c) => a + c.valor, 0))}`] }); return; }
    const c = clients.find((x) => norm(texto).includes(norm(x.nome.split(" ").slice(-1)[0] ?? "")) || norm(texto).includes(norm(x.nome.split(" ")[0] ?? "")));
    if (c) { const doc = /contrato/.test(n) ? c.docs.find((d) => d.kind === "Contrato") : /proposta/.test(n) ? c.docs.find((d) => d.kind === "Proposta") : undefined;
      setAnswer({ title: doc ? `${doc.nome} está na pasta de ${c.nome}` : `Encontrei ${c.nome}`, lines: [doc ? `Documento de ${doc.data}` : `${c.docs.length} documentos · ${c.demandas.filter((d) => !d.feita).length} demandas abertas`], pick: c.id }); return; }
    setAnswer({ title: "Neste exemplo eu só respondo as sugestões abaixo", lines: [] });
  };

  const tabs: [typeof tab, string, typeof FileText][] = sel ? [["docs", `Documentos (${sel.docs.length})`, FileText], ["reun", `Reuniões (${sel.reunioes.length})`, CalendarClock], ["dem", `Demandas (${sel.demandas.filter((d) => !d.feita).length})`, ClipboardList], ["ace", "Acessos", KeyRound], ["lin", "Histórico", Sparkles]] : [];

  return (
    <div className="space-y-4" data-testid="clientes-exemplo">
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 animate-rise" style={tint("amber")}>
        <FlaskConical size={15} className="text-[var(--glow)]" />
        <p className="text-xs text-muted-foreground"><b className="text-[var(--glow)]">Exemplo com dados fictícios.</b> Mostra como a Documentação ficaria para quem trabalha com clientes. Mexa à vontade: nada aqui é salvo.</p>
      </div>

      <div className="glass rounded-3xl p-4 animate-rise sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl shadow-[0_0_24px_-6px_var(--glow)]" style={tint("cyan")}><Users size={22} /></span>
          <div className="mr-auto min-w-0">
            <h2 className="font-display text-xl font-semibold">Carteira de clientes</h2>
            <p className="text-xs text-muted-foreground">Contratos, documentos, atas, demandas e acessos de cada cliente, num lugar só.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (ask.trim()) perguntar(ask); }} className="glass flex min-w-[260px] max-w-md flex-1 items-center gap-2 rounded-full py-1 pl-4 pr-1">
            <Sparkles size={14} className="shrink-0 text-cyan" />
            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Pergunte ao Orion: “contratos que vencem em 30 dias”" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" aria-label="Pergunte ao Orion" />
            <button type="submit" aria-label="Perguntar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-r from-cyan to-violet text-background"><Send size={14} /></button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Quais contratos vencem em 30 dias?", "Onde está o contrato da Construtora Alvorada?", "Quais demandas estão abertas?", "Quanto recebo por mês?"].map((s) => (
            <button key={s} onClick={() => perguntar(s)} className="rounded-full border border-white/10 px-3 py-1 text-[0.7rem] text-muted-foreground transition hover:border-cyan/50 hover:text-foreground">{s}</button>))}
        </div>
        {answer && (
          <div className="mt-3 rounded-2xl border border-violet/30 bg-violet/10 p-4 text-sm" data-testid="clientes-resposta" style={{ animation: "fin-rise .35s both" }}>
            <div className="flex items-start gap-2"><b className="flex-1 font-display">{answer.title}</b><button onClick={() => setAnswer(null)} aria-label="Fechar resposta" className="text-muted-foreground hover:text-foreground"><X size={13} /></button></div>
            {answer.lines.map((l) => <p key={l} className="mt-1 text-xs text-muted-foreground">• {l}</p>)}
            {answer.pick && <button onClick={() => { setSelId(answer.pick ?? null); setTab("docs"); }} className="mt-2 rounded-full border border-cyan/50 px-3 py-1 text-xs text-cyan hover:bg-cyan/10">Abrir ficha</button>}
            <p className="mono-caps mt-2">Fonte: fichas dos clientes</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Clientes ativos", String(ativos.length), `${clients.length} na carteira`, "emerald", false], ["Receita mensal", brl(ativos.reduce((a, c) => a + c.valor, 0)), "dos clientes ativos", "cyan", false], ["Contratos vencendo", String(vencendo.length), "nos próximos 30 dias", "amber", vencendo.length > 0], ["Demandas abertas", String(abertas), `${nDocs} documentos guardados`, "violet", false]].map(([l, n, s, tone, alert], i) => (
          <div key={String(l)} className="ex-card p-4" style={{ "--rail": `var(--${tone})`, animation: `fin-rise .5s ${i * 0.06}s both` } as CSSProperties}>
            <p className="mono-caps">{l}</p>
            <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${alert ? "text-amber" : ""}`}>{n}</p>
            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{s}</p>
          </div>))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por situação">
          {([["todos", "Todos"], ["ativo", "Ativos"], ["neg", "Em negociação"], ["pausa", "Pausados"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)} aria-pressed={filtro === k} className={`rounded-full border px-3.5 py-1.5 text-xs transition ${filtro === k ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{l}</button>))}
        </div>
        <span className="grow" />
        <label className="glass flex min-w-[200px] items-center gap-2 rounded-xl px-3 py-2"><Search size={13} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, contato, documento…" className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground" aria-label="Buscar" />{q && <button onClick={() => setQ("")} aria-label="Limpar"><X size={11} /></button>}</label>
        <div className="glass flex rounded-xl p-1">{([["tab", "Tabela", List], ["pas", "Pastas", LayoutGrid]] as const).map(([k, l, I]) => <button key={k} onClick={() => setVista(k)} aria-pressed={vista === k} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${vista === k ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}><I size={13} /> {l}</button>)}</div>
      </div>

      <div className={`grid gap-4 ${sel ? "xl:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
        <section className="glass overflow-hidden rounded-3xl animate-rise" data-testid="clientes-lista">
          {shown.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente com esse filtro.</p> : vista === "tab" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b border-white/10 text-left">{["Cliente", "Situação", ...(sel ? [] : ["Plano", "Valor/mês"]), "Fim do contrato", ...(sel ? [] : ["Docs"])].map((h) => <th key={h} className="mono-caps whitespace-nowrap px-4 py-3 font-normal">{h}</th>)}</tr></thead>
                <tbody>{shown.map((c) => (
                  <tr key={c.id} onClick={() => { setSelId(c.id); setTab("docs"); }} onKeyDown={(e) => { if (e.key === "Enter") { setSelId(c.id); setTab("docs"); } }} tabIndex={0} data-testid={`cliente-${c.id}`}
                    className={`cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.04] ${selId === c.id ? "bg-violet/10" : ""}`}>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="icon-tile h-9 w-9 shrink-0 !rounded-xl text-[0.7rem] font-bold" style={tint(COLORS[c.id % COLORS.length]!)}>{ini(c.nome)}</span><div className="min-w-0"><p className="truncate font-medium">{c.nome}</p><p className="truncate text-xs text-muted-foreground">{c.resp} · {c.seg}</p></div></div></td>
                    <td className="px-4 py-3"><StatusTag s={c.status} /></td>
                    {!sel && <><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{c.plano}</td><td className="px-4 py-3 tabular-nums">{brl(c.valor)}</td></>}
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums"><Venc c={c} /></td>
                    {!sel && <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.docs.length}</td>}
                  </tr>))}</tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-1 p-3">{shown.map((c) => (
              <div key={c.id}>
                <button onClick={() => { setSelId(selId === c.id ? null : c.id); setTab("docs"); }} aria-expanded={selId === c.id} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]">
                  <FolderOpen size={17} className="shrink-0 text-cyan" /><b className="min-w-0 flex-1 truncate font-medium">{c.nome}</b><StatusTag s={c.status} /><span className="mono-caps">{c.docs.length} docs</span>
                </button>
                {selId === c.id && <div className="ml-9 space-y-0.5 pb-2">{c.docs.map((d) => <div key={d.nome} className="flex justify-between gap-3 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"><span className="flex min-w-0 items-center gap-2"><FileText size={12} className="shrink-0" /><span className="truncate">{d.nome}</span></span><span className="mono-caps shrink-0">{d.kind}</span></div>)}</div>}
              </div>))}</div>
          )}
        </section>

        {sel && (
          <aside className="glass space-y-4 rounded-3xl p-5 animate-rise xl:sticky xl:top-4 xl:self-start" data-testid="cliente-ficha" key={sel.id}>
            <div className="flex items-start gap-3">
              <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl" style={tint(COLORS[sel.id % COLORS.length]!)}><Building2 size={20} /></span>
              <div className="min-w-0 flex-1"><p className="mono-caps">Ficha do cliente</p><h3 className="font-display text-lg font-semibold leading-tight">{sel.nome}</h3><div className="mt-1.5"><StatusTag s={sel.status} /></div></div>
              <button onClick={() => setSelId(null)} aria-label="Fechar ficha" className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {([["Responsável", sel.resp], ["Segmento", sel.seg], ["E-mail", sel.email], ["Telefone", sel.tel], ["CNPJ", sel.cnpj], ["Plano", `${sel.plano} · ${brl(sel.valor)}/mês`]] as const).map(([k, v]) => <div key={k} className="min-w-0"><dt className="mono-caps">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}
              <div className="col-span-2"><dt className="mono-caps">Fim do contrato</dt><dd className="font-medium"><Venc c={sel} /></dd></div>
            </dl>
            <div role="tablist" className="flex flex-wrap gap-x-1 border-b border-white/10">
              {tabs.map(([k, l, I]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition ${tab === k ? "border-cyan text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}><I size={12} /> {l}</button>)}
            </div>
            {tab === "docs" && <div className="space-y-2">
              {sel.docs.map((d) => <div key={d.nome} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--cyan)" } as CSSProperties}><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg font-mono text-[0.6rem]" style={tint("cyan")}>{d.tipo}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.nome}</p><p className="text-xs text-muted-foreground">{d.kind} · {d.data}</p></div><button onClick={() => toast("No Orion de verdade, o arquivo abre aqui.")} className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-cyan/50">Abrir</button></div>)}
              <button onClick={() => { mutate(sel.id, (c) => ({ ...c, docs: [{ nome: "Novo documento anexado.pdf", tipo: "PDF", kind: "Documento", data: "21/11/2026" }, ...c.docs] })); toast.success("Documento anexado (exemplo)", { description: "No Orion de verdade, ele também lê o texto do arquivo." }); }} className="mt-1 flex w-full items-center justify-center gap-2 rounded-full border border-cyan/60 py-2 text-sm text-cyan transition hover:bg-cyan/10"><Paperclip size={14} /> Anexar documento</button>
            </div>}
            {tab === "reun" && <div className="space-y-2">{sel.reunioes.map((r) => <div key={r.titulo} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--violet)" } as CSSProperties}><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg font-mono text-[0.6rem]" style={tint("violet")}>ATA</span><div className="min-w-0"><p className="truncate text-sm font-medium">{r.titulo}</p><p className="text-xs text-muted-foreground">{r.data} · {r.resumo}</p></div></div>)}</div>}
            {tab === "dem" && <div className="space-y-2">{sel.demandas.map((d, i) => <button key={d.titulo} onClick={() => mutate(sel.id, (c) => ({ ...c, demandas: c.demandas.map((x, j) => (j === i ? { ...x, feita: !x.feita } : x)) }))} className="ex-card flex w-full items-center gap-3 p-3 text-left" style={{ "--rail": "var(--emerald)" } as CSSProperties}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${d.feita ? "border-emerald bg-emerald/20 text-emerald" : "border-white/20"}`}>{d.feita && <Check size={12} />}</span><div className="min-w-0"><p className={`truncate text-sm font-medium ${d.feita ? "text-muted-foreground line-through" : ""}`}>{d.titulo}</p><p className="text-xs text-muted-foreground">Prazo {d.prazo}</p></div></button>)}</div>}
            {tab === "ace" && (sel.acessos.length ? <div className="space-y-2">{sel.acessos.map((a, i) => { const k = `${sel.id}:${i}`; return <div key={k} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--amber)" } as CSSProperties}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.nome}</p><p className="truncate font-mono text-xs text-muted-foreground">{a.user} · {reveal[k] ? a.pass : "••••••••••"}</p></div>
              <button onClick={() => setReveal((r) => ({ ...r, [k]: !r[k] }))} aria-label={reveal[k] ? "Ocultar senha" : "Mostrar senha"} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground">{reveal[k] ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              <button onClick={() => void copyText(a.pass).then((ok) => (ok ? toast.success("Copiado") : toast.error("Não consegui copiar")))} aria-label="Copiar senha" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"><Copy size={13} /></button></div>; })}
              <p className="mono-caps pt-1">Dados fictícios · no uso real, ficam só no seu banco privado</p></div> : <p className="py-6 text-center text-sm text-muted-foreground">Nenhum acesso guardado para este cliente.</p>)}
            {tab === "lin" && <ol className="ml-1.5 space-y-3.5 border-l border-white/10 pl-5">{sel.linha.map((l) => <li key={l.data + l.texto} className="relative"><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-violet shadow-[0_0_10px_var(--violet)]" /><p className="mono-caps">{l.data}</p><p className="text-sm">{l.texto}</p></li>)}</ol>}
          </aside>
        )}
      </div>
    </div>
  );
}
