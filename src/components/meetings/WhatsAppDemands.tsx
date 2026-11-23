/** Verificar demandas no WhatsApp: um clique lê todos os grupos e conversas privadas (com imagens e PDFs), a IA lista os pedidos e você decide o que é demanda; o que você marcar segue para a Central. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AlertTriangle, BellOff, Brain, Check, CheckCheck, FileText, Loader2, MessageCircle, Quote, Radar, RefreshCw, Search, Send, Users, X } from "lucide-react";

import { InboxPanel } from "@/components/inbox/InboxPanel";
import { readFiles, type LocalFile } from "@/components/inbox/files";
import { Thinking } from "@/components/ideas/fx";
import { backdropProps } from "@/lib/backdrop";
import { useDecide, useDecided, useRules, useSaveRules, useUndecide } from "@/lib/data/wa-requests";
import { DEFAULT_RULES, buildBatches, groupChats, mergeRequests, requestsToInboxText, sinceSeconds, type ImageRef, type Req, type WaMessage } from "@/lib/wa-requests";
import { findRequests } from "@/lib/wa-requests.functions";
import { loadOrgContext, planFor, runOrganize } from "@/lib/data/wa-organize";
import type { OrgAction, OrgCtx } from "@/lib/wa-requests";
import { ListChecks } from "lucide-react";
import { startBridge, waGet } from "@/lib/whatsapp/client";

const ls = { get: (k: string, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };
const iso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dm = (s: string) => s.split("-").reverse().slice(0, 2).join("/");
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "chat";
const PERIODS = [["ultima", "Desde a última verificação"], ["hoje", "Hoje"], ["24h", "24 h"], ["3d", "3 dias"], ["7d", "7 dias"]] as const;
type Period = (typeof PERIODS)[number][0];
const PR = { alta: "oklch(0.72 0.18 10)", media: "var(--cyan)", baixa: "var(--muted-foreground)" } as const;
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${on ? "border-emerald/60 bg-emerald/15 text-emerald shadow-[0_0_16px_-6px_var(--emerald)]" : "border-white/10 text-muted-foreground hover:text-foreground"}`;
type Img = { n: number; file: LocalFile; ref: ImageRef };

async function loadMedia(ref: ImageRef): Promise<LocalFile | null> {
  const r = await waGet<{ ok: boolean; mime: string; data: string }>("midia", { chat: ref.chat, id: ref.id });
  if (!r.ok || !r.data.ok) return null;
  const bytes = Uint8Array.from(atob(r.data.data), (c) => c.charCodeAt(0));
  if (r.data.mime === "application/pdf" && bytes.length > 1_800_000) return null;
  const file = new File([bytes], `whatsapp-${slug(ref.chatName)}-${ref.n}.${r.data.mime === "application/pdf" ? "pdf" : "jpg"}`, { type: r.data.mime });
  return (await readFiles([file], [])).added[0] ?? null;
}

export function WhatsAppDemands() {
  const decided = useDecided(), decide = useDecide(), undecide = useUndecide(), rulesQ = useRules(), saveRules = useSaveRules();
  const [rulesOpen, setRulesOpen] = useState(false), [rulesText, setRulesText] = useState<string | null>(null);
  const rules = rulesText ?? (rulesQ.data || DEFAULT_RULES), aceitos = (decided.data ?? []).filter((d) => d.status === "enviada"), descartados = (decided.data ?? []).filter((d) => d.status === "descartada");
  const [period, setPeriod] = useState<Period>("ultima"), [grupos, setGrupos] = useState(true), [privadas, setPrivadas] = useState(true), [refazer, setRefazer] = useState(false), [imagens, setImagens] = useState(true);
  const [phase, setPhase] = useState<"idle" | "scan" | "done">("idle"), [prog, setProg] = useState({ txt: "", done: 0, total: 0 }), [offline, setOffline] = useState<string | null>(null), [starting, setStarting] = useState(false);
  const [reqs, setReqs] = useState<Req[]>([]), [imgs, setImgs] = useState<Map<number, Img>>(new Map()), [sel, setSel] = useState<Set<string>>(new Set()), [q, setQ] = useState(""), [showResolved, setShowResolved] = useState(false);
  const [stats, setStats] = useState<{ conversas: number; mensagens: number; ocultos: number; falhas: number; truncado: boolean } | null>(null), [inbox, setInbox] = useState<{ id: number; text: string; files: LocalFile[] } | null>(null), [zoom, setZoom] = useState<Img | null>(null);
  const abort = useRef(false), inboxRef = useRef<HTMLDivElement>(null);
  const [org, setOrg] = useState<{ actions: OrgAction[]; ctx: OrgCtx[]; reqs: Req[] } | null>(null), [orgBusy, setOrgBusy] = useState(false);
  const openDemands = useRef<{ codigo: string; titulo: string; dossie: string; projeto: string }[]>([]);
  const decidedKeys = useMemo(() => new Map((decided.data ?? []).map((d) => [d.key, d.status])), [decided.data]);

  const scan = async () => {
    abort.current = false; setPhase("scan"); setReqs([]); setSel(new Set()); setStats(null); setImgs(new Map()); setOffline(null); setInbox(null);
    setProg({ txt: "Falando com o WhatsApp…", done: 0, total: 0 });
    const st = await waGet<{ phase: string }>("status");
    if (!st.ok) { setOffline(st.erro); setPhase("idle"); return; }
    // as demandas já abertas: a IA liga o que chegou à demanda certa em vez de abrir outra
    try { const c = await loadOrgContext(); openDemands.current = c.flatMap((x) => x.demands.filter((d) => d.status !== "done").map((d) => ({ codigo: d.id.replace(/^#/, ""), titulo: d.title, dossie: d.polo ?? "", projeto: x.name }))).slice(0, 60); } catch { openDemands.current = []; }
    const last = Number(ls.get("orion:wa:varredura", "0")) || null, since = sinceSeconds(period, last), startedAt = Math.floor(Date.now() / 1000);
    setProg({ txt: "Buscando as mensagens…", done: 0, total: 0 });
    const r = await waGet<{ ok?: boolean; messages: WaMessage[]; truncated: boolean }>("varredura", { since: String(since), limit: "3000" });
    if (!r.ok) { setOffline(/404/.test(r.erro) ? "A ponte do WhatsApp que está ligada é de uma versão antiga (ainda não sabe fazer a verificação). Rode o atualizar, depois dê dois cliques em whatsapp-parar.cmd e em seguida em whatsapp-fundo.cmd." : r.erro); setPhase("idle"); return; }
    const chats = groupChats(r.data.messages ?? [], { grupos, privadas }), batches = buildBatches(chats, { withImages: imagens });
    if (!batches.length) { setStats({ conversas: 0, mensagens: 0, ocultos: 0, falhas: 0, truncado: false }); setPhase("done"); ls.set("orion:wa:varredura", String(startedAt)); return; }
    const euSou = ls.get("orion:reunioes:eu"), lists: Req[][] = [], allImgs = new Map<number, Img>(); let falhas = 0;
    for (let i = 0; i < batches.length; i++) {
      if (abort.current) break;
      const b = batches[i]!;
      setProg({ txt: `Lendo ${b.chats.length} conversa(s)${b.images.length ? " e baixando as imagens" : ""}…`, done: i, total: batches.length });
      const files: { n: number; name: string; mime: string; size: number; data: string }[] = []; let bytes = 0;
      for (const ref of b.images) {
        const lf = await loadMedia(ref); if (!lf || bytes + lf.data.length > 3_400_000) continue;
        bytes += lf.data.length; files.push({ n: ref.n, name: lf.name, mime: lf.mime, size: lf.size, data: lf.data }); allImgs.set(ref.n, { n: ref.n, file: lf, ref });
      }
      setProg({ txt: `A IA está procurando pedidos (${i + 1}/${batches.length})…`, done: i, total: batches.length });
      try {
        const res = await findRequests({ data: { texto: b.text, hoje: iso(), diaSemana: new Date().toLocaleDateString("pt-BR", { weekday: "long" }), euSou, regras: rulesQ.data ?? "", aceitos: aceitos.slice(0, 12).map((d) => ({ titulo: d.title, chat: d.chat, trecho: d.quote })), descartados: descartados.slice(0, 12).map((d) => ({ titulo: d.title, chat: d.chat, trecho: d.quote })), demandas: openDemands.current, files } });
        if (res.ok) lists.push(res.pedidos); else { falhas++; toast.error(res.error); }
      } catch (e) { falhas++; toast.error(`Falhou um lote: ${(e as Error).message}`); }
    }
    const merged = mergeRequests(lists), fresh = merged.filter((x) => refazer || !decidedKeys.has(x.key));
    setReqs(fresh); setImgs(allImgs);
    setStats({ conversas: chats.length, mensagens: chats.reduce((n, c) => n + c.msgs.length, 0), ocultos: merged.length - fresh.length, falhas, truncado: !!r.data.truncated });
    setProg({ txt: "", done: batches.length, total: batches.length }); setPhase("done");
    if (!falhas && !abort.current) ls.set("orion:wa:varredura", String(startedAt)); // só avança a "última verificação" se leu tudo
  };

  const visible = useMemo(() => reqs.filter((x) => (showResolved || !x.resolvido) && (`${x.titulo} ${x.quem} ${x.chat} ${x.detalhes}`.toLowerCase().includes(q.toLowerCase()))), [reqs, showResolved, q]);
  const hiddenResolved = reqs.filter((x) => x.resolvido).length;
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const dismiss = (list: Req[]) => { if (!list.length) return; decide.mutate({ reqs: list, status: "descartada" }, { onError: (e) => toast.error(e.message) }); const ks = new Set(list.map((x) => x.key)); setReqs((r) => r.filter((x) => !ks.has(x.key))); setSel((s) => new Set([...s].filter((k) => !ks.has(k)))); toast.message(`${list.length} descartado(s)`, { description: "Não aparecem de novo nas próximas verificações.", action: { label: "Desfazer", onClick: () => { list.forEach((x) => undecide.mutate(x.key)); setReqs((r) => [...r, ...list]); } } }); };
  const send = () => {
    const chosen = reqs.filter((x) => sel.has(x.key)); if (!chosen.length) { toast.error("Marque pelo menos um pedido como demanda."); return; }
    const files: LocalFile[] = [], names: Record<number, string> = {};
    for (const x of chosen) for (const n of x.imagens) { const im = imgs.get(n); if (im && files.length < 6 && !files.some((f) => f.name === im.file.name)) { files.push(im.file); names[n] = im.file.name; } }
    const skipped = chosen.flatMap((x) => x.imagens).filter((n) => imgs.has(n) && !names[n]).length;
    if (skipped) toast.message("A Central aceita até 6 arquivos por vez", { description: `${skipped} imagem(ns) ficaram de fora; envie esses pedidos em outra rodada para anexá-las.` });
    setInbox({ id: Date.now(), text: requestsToInboxText(chosen, names), files });
    decide.mutate({ reqs: chosen, status: "enviada" }, { onError: (e) => toast.error(e.message) });
    setReqs((r) => r.filter((x) => !sel.has(x.key))); setSel(new Set());
    setTimeout(() => inboxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };
  const organize = async () => {
    const chosen = reqs.filter((x) => sel.has(x.key)); if (!chosen.length) { toast.error("Marque pelo menos um pedido."); return; }
    setOrgBusy(true);
    try { const ctx = await loadOrgContext(); setOrg({ actions: planFor(chosen, ctx), ctx, reqs: chosen }); }
    catch (e) { toast.error(`Não consegui olhar as demandas: ${(e as Error).message}`); }
    setOrgBusy(false);
  };
  const confirmOrganize = async () => {
    if (!org) return; setOrgBusy(true);
    try {
      const r = await runOrganize(org.actions, org.ctx);
      decide.mutate({ reqs: org.reqs, status: "enviada" }, { onError: (e) => toast.error(e.message) });
      const ks = new Set(org.reqs.map((x) => x.key)); setReqs((l) => l.filter((x) => !ks.has(x.key))); setSel(new Set());
      toast.success(`${r.updated ? `${r.updated} ${r.updated === 1 ? "demanda atualizada" : "demandas atualizadas"}` : ""}${r.updated && r.created ? " · " : ""}${r.created ? `${r.created} ${r.created === 1 ? "criada" : "criadas"}` : ""} — ${r.steps} ${r.steps === 1 ? "passo" : "passos"} no checklist`);
      setOrg(null);
    } catch (e) { toast.error(`Não consegui organizar: ${(e as Error).message}`); }
    setOrgBusy(false);
  };
  // "Orion, verifica o WhatsApp": a voz abre esta tela com ?verificar=1 e a leitura começa sozinha
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || typeof location === "undefined" || new URLSearchParams(location.search).get("verificar") !== "1") return;
    auto.current = true; window.history.replaceState(null, "", location.pathname + "?aba=demandas"); void scan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const turnOn = async () => { setStarting(true); const r = await startBridge(); if (!r.ok) toast.error(r.erro); else { toast.success("WhatsApp ligado em segundo plano"); setOffline(null); } setStarting(false); };

  return (
    <div className="space-y-4" data-testid="wa-demandas">
      <section className="ex-card px-5 py-5 sm:px-6" style={{ "--rail": "var(--emerald)", animation: "fin-rise .6s both" } as React.CSSProperties}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Radar size={18} className="text-emerald" /> Verificar demandas no WhatsApp</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Um clique lê os grupos e as conversas privadas (com imagens e PDFs), a IA separa os <b>pedidos</b> que fizeram a você e você decide o que é demanda. O que não marcar não vira nada.</p></div>
          <button type="button" onClick={() => void scan()} disabled={phase === "scan" || (!grupos && !privadas)} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-6 py-3 text-sm font-semibold text-emerald shadow-[0_0_34px_-10px_var(--emerald)] transition hover:bg-emerald/25 active:scale-95 disabled:opacity-50" data-testid="verificar">{phase === "scan" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {phase === "scan" ? "Verificando…" : "Verificar agora"}</button></div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Período</span>{PERIODS.map(([k, l]) => <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)} data-testid={`periodo-${k}`} className={chip(period === k)}>{l}</button>)}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Incluir</span><button type="button" aria-pressed={grupos} onClick={() => setGrupos((o) => !o)} className={chip(grupos)}><Users size={12} className="mr-1 inline" />Grupos</button><button type="button" aria-pressed={privadas} onClick={() => setPrivadas((o) => !o)} className={chip(privadas)}><MessageCircle size={12} className="mr-1 inline" />Conversas privadas</button><button type="button" aria-pressed={imagens} onClick={() => setImagens((o) => !o)} className={chip(imagens)}>Imagens e PDFs</button><button type="button" aria-pressed={refazer} onClick={() => setRefazer((o) => !o)} className={chip(refazer)} data-testid="refazer" title="Mostra também os pedidos que você já organizou antes, para completar e arrumar as demandas com o que ficou faltando">Reorganizar o que já organizei</button></div>
        <div className="mt-4 border-t border-white/10 pt-3"><button type="button" onClick={() => setRulesOpen((o) => !o)} aria-expanded={rulesOpen} className="inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground" data-testid="regras-abrir"><Brain size={13} className="text-violet" /> O que conta como demanda para mim <span className="rounded-full bg-violet/15 px-2 py-0.5 text-violet">aprendendo com {aceitos.length} aceito(s) e {descartados.length} descartado(s)</span></button>
          {rulesOpen && <div className="mt-3" data-testid="regras" style={{ animation: "fin-rise .35s both" }}><p className="mb-2 text-xs text-muted-foreground">É o que a IA sabe sobre o seu trabalho. Já vem com os assuntos do CRM/P4C; edite à vontade. Além disso, ela aprende com o que você marca e descarta.</p>
            <textarea value={rules} onChange={(e) => setRulesText(e.target.value)} rows={12} maxLength={5000} className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed outline-none focus:border-violet/60" data-testid="regras-texto" />
            <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" onClick={() => saveRules.mutate(rules === DEFAULT_RULES ? "" : rules, { onSuccess: () => { setRulesText(null); toast.success("Regras salvas"); }, onError: (e) => toast.error(e.message) })} disabled={saveRules.isPending || rulesText === null} className="rounded-full border border-violet/50 bg-violet/15 px-4 py-1.5 text-xs font-medium text-violet hover:bg-violet/25 disabled:opacity-40" data-testid="regras-salvar">Salvar</button><button type="button" onClick={() => setRulesText(DEFAULT_RULES)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Voltar ao padrão</button></div></div>}</div>
        {offline && <div className="mt-4 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber" data-testid="wa-offline-demandas"><p className="flex items-start gap-2"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{offline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void turnOn()} disabled={starting} className="inline-flex items-center gap-1.5 rounded-full border border-emerald/50 bg-emerald/10 px-3 py-1 font-medium text-emerald hover:bg-emerald/20 disabled:opacity-50">{starting && <Loader2 size={12} className="animate-spin" />} Ligar o WhatsApp aqui</button><span className="text-muted-foreground">No site publicado: dois cliques em whatsapp-fundo.cmd (uma vez).</span></div></div>}
        {phase === "scan" && <div className="mt-4"><Thinking lines={["Lendo grupos e conversas…", "Baixando as imagens…", "Procurando quem pediu o quê…", "Separando o que parece demanda…"]} />
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground"><span className="min-w-0 flex-1 truncate" data-testid="progresso">{prog.txt}</span>{prog.total > 0 && <span className="font-mono">{prog.done}/{prog.total}</span>}<button type="button" onClick={() => { abort.current = true; }} className="hover:text-foreground">parar</button></div>
          {prog.total > 0 && <div className="mt-1 h-px overflow-hidden bg-white/10"><span className="block h-full bg-gradient-to-r from-emerald to-cyan transition-[width] duration-500" style={{ width: `${(prog.done / prog.total) * 100}%` }} /></div>}</div>}
      </section>

      {phase === "done" && stats && <p className="px-1 text-xs text-muted-foreground" data-testid="resumo-varredura">Li <b className="text-foreground">{stats.mensagens.toLocaleString("pt-BR")}</b> mensagens de <b className="text-foreground">{stats.conversas}</b> conversa(s). {reqs.length} pedido(s) novo(s){stats.ocultos ? ` (${stats.ocultos} já decididos antes ficaram de fora)` : ""}.{stats.truncado ? " O período tinha mais de 3.000 mensagens: veio o começo; use um período menor para ver o resto." : ""}{stats.falhas ? ` ${stats.falhas} lote(s) falharam: a última verificação não avançou.` : ""}</p>}

      {phase === "done" && reqs.length > 0 && <>
        <div className="glass sticky top-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5" data-testid="barra-selecao"><span className="text-sm"><b className="tabular-nums" data-testid="n-marcados">{sel.size}</b> marcado(s) como demanda · {visible.length} na lista</span>
          <label className="relative min-w-0 flex-1"><Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por grupo, pessoa ou assunto…" className="w-full rounded-full border border-white/10 bg-black/25 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-emerald/60" /></label>
          <button type="button" onClick={() => setSel(new Set(visible.map((x) => x.key)))} className="text-xs text-emerald hover:underline" data-testid="marcar-todos"><CheckCheck size={12} className="mr-1 inline" />Marcar todos</button><button type="button" onClick={() => setSel(new Set())} className="text-xs text-muted-foreground hover:underline">Limpar</button>
          <button type="button" onClick={() => dismiss(visible.filter((x) => !sel.has(x.key)))} className="text-xs text-muted-foreground hover:text-destructive hover:underline" data-testid="descartar-restantes"><BellOff size={12} className="mr-1 inline" />Descartar os não marcados</button>
          <button type="button" onClick={() => void organize()} disabled={!sel.size || orgBusy} className="inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/15 px-5 py-2 text-sm font-medium text-cyan shadow-[0_0_28px_-10px_var(--cyan)] transition hover:bg-cyan/25 active:scale-95 disabled:opacity-40" data-testid="organizar-demandas">{orgBusy ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />} Organizar nas demandas ({sel.size})</button>
          <button type="button" onClick={send} disabled={!sel.size} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2 text-sm font-medium text-emerald shadow-[0_0_28px_-10px_var(--emerald)] transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="criar-demandas"><Send size={14} /> Criar demandas ({sel.size})</button></div>
        {hiddenResolved > 0 && <button type="button" onClick={() => setShowResolved((o) => !o)} className="px-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{showResolved ? "Esconder" : "Mostrar"} {hiddenResolved} que parece(m) já resolvido(s)</button>}
        <ul className="space-y-3" data-testid="pedidos">{visible.map((x, i) => {
          const on = sel.has(x.key), c = PR[x.prioridade];
          return (
            <li key={x.key} className="ex-card px-5 py-4" style={{ "--rail": on ? "var(--emerald)" : c, animation: "fin-rise .5s both", animationDelay: `${Math.min(i, 10) * 45}ms` } as React.CSSProperties} data-testid="pedido">
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => toggle(x.key)} aria-pressed={on} aria-label={on ? "Desmarcar" : "Marcar como demanda"} data-testid="marcar" className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition active:scale-90 ${on ? "border-emerald bg-emerald/25 text-emerald shadow-[0_0_14px_var(--emerald)]" : "border-white/25 hover:border-emerald/60"}`}>{on && <Check size={15} strokeWidth={3} />}</button>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-semibold leading-snug">{x.titulo}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.65rem] text-muted-foreground"><span className="inline-flex items-center gap-1">{x.grupo ? <Users size={10} className="text-emerald" /> : <MessageCircle size={10} className="text-cyan" />}{x.chat}</span><span>· {x.quem}</span><span>· {x.quando}</span>{x.prazo && <span className="text-amber">· prazo {dm(x.prazo)}</span>}<span className="inline-flex items-center gap-1" style={{ color: c }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />{x.prioridade === "media" ? "normal" : x.prioridade}</span>
                    {decidedKeys.get(x.key) === "enviada" && <span className="rounded-full bg-white/10 px-1.5">já organizado antes</span>}{x.tipo === "complemento" && <span className="rounded-full bg-cyan/15 px-1.5 text-cyan">complemento{x.demanda ? ` de #${x.demanda}` : ""}</span>}{x.paraMim === "talvez" && <span className="rounded-full bg-white/10 px-1.5">pedido geral</span>}{x.resolvido && <span className="rounded-full bg-emerald/15 px-1.5 text-emerald">parece resolvido</span>}{x.confianca !== "alta" && <span className="rounded-full bg-amber/15 px-1.5 text-amber">confiança {x.confianca}</span>}</p>
                  {x.detalhes && <p className="mt-2 text-sm text-muted-foreground">{x.detalhes}</p>}
                  {x.trecho && <blockquote className="mt-2 flex gap-2 border-l border-white/15 pl-3 text-xs italic text-muted-foreground"><Quote size={11} className="mt-0.5 shrink-0 opacity-60" />{x.trecho}</blockquote>}
                  {x.imagens.some((n) => imgs.has(n)) && <div className="mt-3 flex flex-wrap gap-2" data-testid="evidencias">{x.imagens.map((n) => imgs.get(n)).filter((v): v is Img => !!v).map((im) => <button key={im.n} type="button" onClick={() => setZoom(im)} className="group relative h-16 w-16 overflow-hidden rounded-xl border border-white/10 hover:border-emerald/60" aria-label={`Ver ${im.file.name}`}>{im.file.mime.startsWith("image/") && im.file.preview ? <img src={im.file.preview} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-black/30 text-muted-foreground"><FileText size={20} /></span>}</button>)}</div>}
                </div>
                <button type="button" onClick={() => dismiss([x])} className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground transition hover:border-destructive/50 hover:text-destructive" data-testid="descartar"><X size={11} className="mr-1 inline" />Não é demanda</button>
              </div>
            </li>);
        })}</ul>
      </>}
      {phase === "done" && reqs.length === 0 && !inbox && <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground" data-testid="sem-pedidos">Nenhum pedido novo encontrado neste período. 🎉</p>}

      {org && createPortal(
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/70 p-3 backdrop-blur-md" {...backdropProps(() => !orgBusy && setOrg(null))} data-testid="organizar-dialogo">
          <div role="dialog" aria-label="Organizar nas demandas" onClick={(e) => e.stopPropagation()} className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[oklch(0.14_0.035_265/0.92)] shadow-[0_40px_120px_-30px_var(--cyan)] backdrop-blur-2xl" style={{ animation: "vp-in .45s cubic-bezier(.2,.8,.2,1) both" }}>
            <header className="flex items-start gap-3 px-6 pb-3 pt-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan/15 text-cyan"><ListChecks size={20} /></span>
              <div className="min-w-0 flex-1"><p className="mono-caps !text-[0.6rem]">Organizar</p><h2 className="font-serif text-2xl"><span className="text-gradient">Onde cada pedido vai entrar</span></h2>
                <p className="mt-1 text-xs text-muted-foreground">O que já tem demanda aberta do mesmo dossiê só é atualizado (passos no checklist e tudo o que foi enviado nas observações). Só cria demanda quando não existe nenhuma.</p></div>
              <button type="button" onClick={() => setOrg(null)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:rotate-90 hover:text-foreground"><X size={16} /></button></header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-4">
              {org.actions.map((a, i) => (
                <div key={i} className={`rounded-2xl border p-3 ${a.kind === "update" ? "border-cyan/40 bg-cyan/[0.06]" : "border-emerald/40 bg-emerald/[0.06]"}`} data-testid="organizar-acao">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium"><span className={`tag ${a.kind === "update" ? "!text-cyan" : "!text-emerald"}`}>{a.kind === "update" ? "Atualiza" : "Cria nova"}</span>{a.kind === "update" ? <><span className="font-mono text-xs text-muted-foreground">{a.code}</span> {a.title}</> : a.title}{a.dossier && <span className="text-xs text-muted-foreground">· {a.dossier}</span>}</p>
                  <ul className="mt-2 space-y-1 pl-1 text-xs text-muted-foreground">{a.add.map((t, k) => <li key={k} className="flex gap-2"><Check size={11} className="mt-0.5 shrink-0 text-emerald" /><span className="min-w-0 break-words">{t}</span></li>)}</ul>
                  <p className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-muted-foreground"><FileText size={11} className="shrink-0" /> Mensagens, templates e dados recebidos entram organizados no <b className="text-foreground">Material</b> da demanda.</p>
                </div>))}
              {!org.actions.length && <p className="py-6 text-center text-sm text-muted-foreground">Nada para organizar.</p>}
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-3"><button type="button" onClick={() => setOrg(null)} disabled={orgBusy} className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs transition hover:border-cyan/40 active:scale-95">Cancelar</button>
              <button type="button" onClick={() => void confirmOrganize()} disabled={orgBusy || !org.actions.length} data-testid="organizar-confirmar" className="inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/15 px-5 py-1.5 text-xs font-medium text-cyan transition hover:-translate-y-0.5 hover:bg-cyan/25 active:scale-95 disabled:opacity-40">{orgBusy && <Loader2 size={12} className="animate-spin" />} Organizar</button></footer>
          </div></div>, document.body)}

      <div ref={inboxRef}>{inbox && <InboxPanel incoming={inbox} onClose={() => setInbox(null)} onListen={() => undefined} listening={false} interim="" />}</div>
      {zoom && createPortal(<div className="fixed inset-0 z-[70] grid place-items-center bg-background/90 p-4 backdrop-blur-md" {...backdropProps(() => setZoom(null))} data-testid="zoom"><div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>{zoom.file.mime.startsWith("image/") && zoom.file.preview ? <img src={zoom.file.preview} alt={zoom.file.name} className="max-h-[85dvh] rounded-2xl border border-white/10" /> : <p className="glass rounded-2xl p-6 text-sm">{zoom.file.name} (PDF) vai junto como evidência.</p>}<p className="mt-2 text-center font-mono text-xs text-muted-foreground">{zoom.ref.chatName}</p><button type="button" onClick={() => setZoom(null)} aria-label="Fechar" className="absolute -right-3 -top-3 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-background"><X size={15} /></button></div></div>, document.body)}
    </div>
  );
}
