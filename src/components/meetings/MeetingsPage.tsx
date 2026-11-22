/** Assistente de reuniões: cole, grave ou traga do WhatsApp; o Orion devolve ata, decisões, quem faz o quê e manda as ações para a Central (demandas, lembretes, compromisso). */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { ClipboardCopy, Clock, FileText, Loader2, Mic, MessageCircle, Radar, Send, Sparkles, Square, Trash2, X } from "lucide-react";

import { FinBackdrop, HeroPanel, LiveDot, OrbitArt } from "@/components/finance/fx";
import { InboxPanel } from "@/components/inbox/InboxPanel";
import { Burst, Thinking, VoiceWave } from "@/components/ideas/fx";
import { demoAnalysis } from "@/lib/meetings-demo";
import { MeetingResult } from "@/components/meetings/MeetingResult";
import { WhatsAppDemands } from "@/components/meetings/WhatsAppDemands";
import { WhatsAppPicker } from "@/components/meetings/WhatsAppPicker";
import { useLinkTargets, useMeetingActions, useMeetings, type Meeting } from "@/lib/data/meetings";
import { actionsToInboxText, analysisToMarkdown, type Analysis, type Mode, type Source } from "@/lib/meetings";
import { analyzeMeeting } from "@/lib/meetings.functions";
import { Link2 } from "lucide-react";
import { useLiveRecorder } from "@/lib/use-live-recorder";

const ls = { get: (k: string, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };
const isoOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const tab = (on: boolean) => `flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${on ? "text-cyan shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cyan)_45%,transparent),0_0_24px_-8px_var(--cyan)] bg-cyan/10" : "text-muted-foreground hover:text-foreground"}`;
const THINK_MEETING = ["Lendo a conversa…", "Separando os assuntos…", "Achando as decisões…", "Descobrindo quem ficou de fazer o quê…"], THINK_GROUP = ["Lendo os grupos…", "Resumindo cada grupo…", "Transformando pedidos em ações…", "Montando as pendências…"];

export function MeetingsPage({ embedded = false, projectId }: { embedded?: boolean; projectId?: string } = {}) {
  const history = useMeetings(), acts = useMeetingActions();
  const targets = useLinkTargets().data;
  const polos = (targets?.dossiers ?? []).filter((d) => !embedded || !projectId || d.project === projectId), clientes = (targets?.clients ?? []).filter((c) => !embedded || !projectId || c.project === projectId);
  const homeProject = embedded ? (projectId ?? null) : null;
  const [onlyProject, setOnlyProject] = useState(true);
  const [link, setLink] = useState<{ dossierId: string | null; dossierProject: string | null; clientId: string | null }>({ dossierId: null, dossierProject: embedded ? (projectId ?? null) : null, clientId: null });
  const poloName = polos.find((d) => d.id === link.dossierId && d.project === link.dossierProject)?.name;
  const dupNames = new Set(polos.map((d) => d.name).filter((n, i, l) => l.indexOf(n) !== i));
  /** Escolher o polo já marca o cliente ligado a ele (e vice-versa); salva na hora se a reunião já existe. */
    const changeLink = (v: string, who: "polo" | "cliente") => {
    let l = link;
    if (who === "polo") { const [project, id] = v ? [v.slice(0, v.indexOf("|")), v.slice(v.indexOf("|") + 1)] : [homeProject, null]; const c = id ? clientes.find((x) => x.dossierId === id && x.project === project) : undefined; l = { dossierId: id, dossierProject: project, clientId: c?.id ?? null }; }
    else { const c = clientes.find((x) => x.id === v); l = c ? { dossierId: c.dossierId ?? link.dossierId, dossierProject: c.dossierId ? c.project : (link.dossierProject ?? homeProject), clientId: c.id } : { ...link, clientId: null }; }
    setLink(l);
    if (cur?.id && !cur.demo) acts.link.mutate({ id: cur.id, link: l }, { onSuccess: () => toast.success(l.dossierId || l.clientId ? "Reunião vinculada: aparece na página do cliente" : "Vínculo removido"), onError: (e) => toast.error(`Não consegui vincular: ${e.message}`) });
  };

  const [view, setView] = useState<"reunioes" | "demandas">(() => (typeof location !== "undefined" && new URLSearchParams(location.search).get("aba") === "demandas" ? "demandas" : "reunioes"));
  const [mode, setMode] = useState<Mode>("reuniao"), [src, setSrc] = useState<"texto" | "voz" | "whatsapp">("texto"), [text, setText] = useState(""), [title, setTitle] = useState(""), [me, setMe] = useState(() => ls.get("orion:reunioes:eu"));
  const [busy, setBusy] = useState(false), [a, setA] = useState<Analysis | null>(null), [cur, setCur] = useState<{ id: string | null; title: string; date: string; raw: string; source: Source; mode: Mode; demo?: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set()), [sent, setSent] = useState<Set<number>>(new Set()), [inbox, setInbox] = useState<{ id: number; text: string } | null>(null), [burst, setBurst] = useState(0), [chunkMs] = useState(() => { const n = typeof location !== "undefined" ? Number(new URLSearchParams(location.search).get("trecho")) : 0; return n >= 3000 && n <= 60000 ? n : 25000; });
  const rec = useLiveRecorder(chunkMs), resultRef = useRef<HTMLDivElement>(null), inboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { ls.set("orion:reunioes:eu", me); }, [me]);
  const append = (t: string) => setText((x) => (x.trim() ? `${x.trim()}\n\n${t}` : t));
  // gravação contínua: transcreve enquanto grava; ao finalizar, junta tudo ao texto e já organiza
  const startRec = async () => { try { await rec.start(); setSrc("voz"); } catch (e) { toast.error((e as Error).message); } };
  const finishRecording = async () => {
    const { text: said, failed } = await rec.finish();
    if (!said.trim()) { toast.error(failed ? "Não consegui transcrever o áudio (veja a conexão e a chave da OpenAI)." : "Não ouvi nada na gravação."); return; }
    const full = text.trim() ? `${text.trim()}\n\n${said}` : said;
    setText(full);
    if (failed) toast.error(`${failed} trecho(s) não foram transcritos e ficaram de fora. Revise o texto antes de gerar a ata.`);
    else void analyze(full, "voz");
  };

  const analyze = async (override?: string, origem?: Source) => {
    const body = override ?? text;
    if (body.trim().length < 20) { toast.error("Cole ou grave um pouco mais de conteúdo para eu analisar."); return; }
    setBusy(true); setA(null); setCur(null); setInbox(null);
    const today = isoOf(), weekday = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
    try {
      const r = await analyzeMeeting({ data: { texto: body, modo: mode, hoje: today, diaSemana: weekday, euSou: me.trim(), titulo: title.trim() } });
      if (!r.ok) { toast.error(r.error); setBusy(false); return; }
      const analysis = r.analise, source: Source = origem ?? src;
      setA(analysis); setSelected(new Set(analysis.acoes.map((_, i) => i))); setSent(new Set()); setBurst((n) => n + 1);
      let id: string | null = null;
      try { id = await acts.save.mutateAsync({ title: analysis.titulo, source, mode, raw: text, analysis, happenedOn: today, link }); } catch (e) { toast.error(`A análise ficou pronta, mas não consegui salvar no histórico: ${(e as Error).message}`); }
      setCur({ id, title: analysis.titulo, date: today, raw: body, source, mode });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) { toast.error(`Não consegui analisar: ${(e as Error).message}`); }
    setBusy(false);
  };
  const open = (m: Meeting) => { setLink({ dossierId: m.dossierId, dossierProject: m.dossierProject, clientId: m.clientId }); setA(m.analysis); setCur({ id: m.id, title: m.title, date: m.happenedOn, raw: m.raw, source: m.source, mode: m.mode }); setSelected(new Set(m.analysis.acoes.map((_, i) => i).filter((i) => !m.sent.includes(i)))); setSent(new Set(m.sent)); setInbox(null); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); };
  const showDemo = (m: Mode) => { const an = demoAnalysis(m); setMode(m); setA(an); setCur({ id: null, title: an.titulo, date: isoOf(), raw: "", source: "texto", mode: m, demo: true }); setSelected(new Set(an.acoes.map((_, i) => i))); setSent(new Set()); setInbox(null); setBurst((n) => n + 1); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); };
  const sendToCentral = () => {
    if (!a || !cur) return;
    if (cur.demo) { toast.message("Isto é só um exemplo", { description: "Gere uma ata de verdade para criar demandas e lembretes." }); return; }
    const idx = [...selected].filter((i) => !sent.has(i)).sort((x, y) => x - y), list = idx.map((i) => a.acoes[i]!);
    const wantsNext = !!a.proxima?.data && !sent.has(-1);
    if (!list.length && !wantsNext) { toast.error("Marque pelo menos uma ação."); return; }
    setInbox({ id: Date.now(), text: actionsToInboxText(cur.title, cur.date, list, wantsNext ? a.proxima : null, poloName) });
    const next = new Set([...sent, ...idx, ...(wantsNext ? [-1] : [])]); setSent(next); setSelected(new Set());
    if (cur.id) acts.markSent.mutate({ id: cur.id, sent: [...next] });
    setTimeout(() => inboxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };
  const copy = async () => { if (!a || !cur) return; if (await copyText(analysisToMarkdown(a, cur.date))) toast.success("Ata copiada", { description: "Cole no WhatsApp, no e-mail ou num documento." }); else toast.error("Não consegui copiar."); };
  const remove = (m: Meeting) => { if (window.confirm(`Apagar “${m.title}” do histórico?`)) acts.remove.mutate(m.id, { onSuccess: () => { if (cur?.id === m.id) { setA(null); setCur(null); } }, onError: (e) => toast.error(e.message) }); };
  const nSel = useMemo(() => [...selected].filter((i) => !sent.has(i)).length, [selected, sent]);


  const clientIds = new Set(clientes.map((c) => c.id));
  const shownHistory = (history.data ?? []).filter((m) => !embedded || !projectId || !onlyProject || m.dossierProject === projectId || (m.clientId !== null && clientIds.has(m.clientId)));
  const Root = embedded ? "div" : "main";
  const LinkBar = (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 backdrop-blur" data-testid="reuniao-vinculo">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Link2 size={13} className={link.dossierId || link.clientId ? "text-violet" : ""} /> Vincular a</span>
      <select value={link.dossierId ? `${link.dossierProject}|${link.dossierId}` : ""} onChange={(e) => changeLink(e.target.value, "polo")} aria-label="Polo (dossiê)" data-testid="reuniao-polo" className="max-w-[11rem] rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none focus:border-violet/60"><option value="">Sem polo</option>{polos.map((d) => <option key={`${d.project}|${d.id}`} value={`${d.project}|${d.id}`}>{dupNames.has(d.name) ? `${d.name} · ${d.projectName}` : d.name}</option>)}</select>
      <select value={link.clientId ?? ""} onChange={(e) => changeLink(e.target.value, "cliente")} aria-label="Cliente" data-testid="reuniao-cliente" className="max-w-[11rem] rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none focus:border-violet/60"><option value="">Sem cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      {(link.dossierId || link.clientId) && <span className="text-[0.68rem] text-violet">aparece na página do cliente · as demandas criadas vão para o polo</span>}
    </div>);

  return (
    <Root className={embedded ? "relative" : "relative mx-auto min-h-screen max-w-[1500px] px-4 pb-40 pt-6 md:py-10"} data-testid="reunioes">{!embedded && <FinBackdrop />}
      {burst > 0 && <Burst key={burst} />}
      {!embedded &&       <HeroPanel glow="var(--violet)"><div className="grid items-center gap-6 lg:grid-cols-[1.4fr_0.6fr]"><div>
        <p className="mono-caps flex items-center gap-3">Assistente de reuniões <LiveDot color="var(--emerald)" label="ata em segundos" /></p>
        <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">Reuniões <span className="text-gradient inline-block pr-3 italic">sem esforço</span></h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">Cole a conversa do WhatsApp, grave a reunião ou traga os grupos. O Orion entrega a ata, as decisões, quem ficou de fazer o quê — e já manda as ações para a Central virarem demandas e lembretes.</p></div>
        <div className="mx-auto"><OrbitArt size={190}><Mic size={32} className="text-violet drop-shadow-[0_0_14px_var(--violet)]" /></OrbitArt></div></div></HeroPanel>}

      <div className="mt-5 flex gap-1 rounded-2xl border border-white/10 bg-black/20 p-1 sm:w-fit" role="tablist" aria-label="Área" data-testid="abas-reunioes">{([["reunioes", "Reuniões e grupos", FileText], ["demandas", "Demandas do WhatsApp", Radar]] as const).map(([k, l, I]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} data-testid={`aba-${k}`} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm transition sm:flex-none ${view === k ? "bg-cyan/10 text-cyan shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cyan)_45%,transparent),0_0_24px_-8px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}><I size={15} />{l}</button>)}</div>
      {view === "demandas" ? <div className="mt-5"><WhatsAppDemands /></div> : <>
      <section className="ex-card mt-5 px-5 py-5 sm:px-6" style={{ "--rail": "var(--violet)", animation: "fin-rise .6s both" } as React.CSSProperties} data-testid="reuniao-entrada">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-2xl border border-white/10 p-1" role="tablist" aria-label="Tipo">{([["reuniao", "Reunião", FileText], ["grupo", "Resumir grupos", MessageCircle]] as const).map(([k, l, I]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); if (k === "grupo") setSrc("whatsapp"); }} data-testid={`modo-${k}`} className={tab(mode === k)}><I size={15} />{l}</button>)}</div>
          <div className="flex gap-1 rounded-2xl border border-white/10 p-1" role="tablist" aria-label="Origem">{([["texto", "Colar texto", FileText], ["voz", "Gravar", Mic], ["whatsapp", "Do WhatsApp", MessageCircle]] as const).map(([k, l, I]) => <button key={k} role="tab" aria-selected={src === k} onClick={() => setSrc(k)} data-testid={`origem-${k}`} className={tab(src === k)}><I size={15} />{l}</button>)}</div>
        </div>

        {src === "voz" && <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4" data-testid="gravador">
          {!rec.recording && !rec.finishing && <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => void startRec()} disabled={!rec.supported} className="grid h-16 w-16 place-items-center rounded-full border border-violet/60 bg-violet/15 text-violet shadow-[0_0_34px_-8px_var(--violet)] transition hover:bg-violet/25 active:scale-90 disabled:opacity-40" aria-label="Gravar reunião" data-testid="gravar"><Mic size={24} /></button>
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">{rec.supported ? "Toque e fale (ou deixe a reunião rolando). O texto aparece enquanto você grava, sem limite de tempo. Ao finalizar, o Orion organiza tudo." : "Este navegador não permite gravar. Use outro navegador ou cole o texto."}</p></div>}
          {(rec.recording || rec.finishing) && <div data-testid="gravando">
            <div className="flex flex-wrap items-center gap-4">
              <span className="relative grid h-14 w-14 shrink-0 place-items-center"><span aria-hidden className="absolute inset-0 rounded-full border border-destructive/40" style={{ animation: "pulse-ring 1.8s ease-out infinite" }} /><span className="grid h-11 w-11 place-items-center rounded-full bg-destructive/20 text-destructive"><Mic size={20} /></span></span>
              <div className="min-w-0 flex-1"><VoiceWave bars={34} /><p className="mt-1 font-mono text-sm tabular-nums text-destructive" data-testid="gravacao-tempo">{String(Math.floor(rec.seconds / 3600)).padStart(2, "0")}:{String(Math.floor(rec.seconds / 60) % 60).padStart(2, "0")}:{String(rec.seconds % 60).padStart(2, "0")} <span className="font-body text-xs text-muted-foreground">· {rec.finishing ? "finalizando a transcrição…" : rec.pending ? "transcrevendo o último trecho…" : "gravando"}</span></p></div>
              {!rec.finishing && <div className="flex items-center gap-3"><button type="button" onClick={rec.cancel} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X size={13} /> descartar</button>
                <button type="button" onClick={() => void finishRecording()} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2.5 text-sm font-medium text-emerald shadow-[0_0_28px_-10px_var(--emerald)] transition hover:bg-emerald/25 active:scale-95" data-testid="finalizar-gravacao"><Square size={13} fill="currentColor" /> Finalizar e organizar</button></div>}
            </div>
            <div className="scroll-thin mt-3 max-h-56 min-h-16 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed" data-testid="transcricao-ao-vivo" aria-live="polite">
              {rec.chunks.length === 0 && !rec.live && <p className="text-xs text-muted-foreground">Ouvindo… o texto aparece aqui a cada poucos segundos.</p>}
              {rec.chunks.map((c) => <span key={c.idx} className={c.status === "erro" ? "text-amber" : c.status === "pendente" ? "text-muted-foreground" : ""} style={{ animation: "fin-rise .5s both" }}>{c.status === "pendente" ? "… " : c.status === "erro" ? "[trecho não transcrito] " : c.text ? `${c.text} ` : ""}</span>)}
              {rec.live && <span className="text-muted-foreground/70">{rec.live}<span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-cyan align-middle" /></span>}
            </div>
            {rec.failedCount > 0 && !rec.finishing && <button type="button" onClick={() => void rec.retry()} className="mt-2 text-xs text-amber underline-offset-2 hover:underline">{rec.failedCount} trecho(s) não transcrito(s): tentar de novo</button>}
          </div>}
        </div>}
        {src === "whatsapp" && <div className="mt-4"><WhatsAppPicker onText={(t) => { append(t); setSrc("texto"); }} /></div>}

        {!(a && cur && !cur.demo) && <div className="mt-4">{LinkBar}</div>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Título (opcional): Alinhamento P4C" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-violet/60" data-testid="reuniao-titulo" />
          <input value={me} onChange={(e) => setMe(e.target.value)} maxLength={60} placeholder="Seu nome na conversa (para marcar o que é seu)" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-violet/60" data-testid="reuniao-eu" /></div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={60000} disabled={busy} placeholder={mode === "grupo" ? "Traga os grupos pelo WhatsApp (acima) ou cole aqui as conversas. Para vários grupos, comece cada um com: === Grupo: nome ===" : "Cole aqui a conversa do WhatsApp, a transcrição ou as suas anotações da reunião…"} className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-violet/60 disabled:opacity-60" data-testid="reuniao-texto" />
        <div className="mt-1 flex items-center justify-between text-[0.68rem] text-muted-foreground"><span>{text.length.toLocaleString("pt-BR")} / 60.000 caracteres</span>{text && !busy && <button type="button" onClick={() => setText("")} className="hover:text-foreground">limpar</button>}</div>
        {busy ? <Thinking lines={mode === "grupo" ? THINK_GROUP : THINK_MEETING} />
          : <button type="button" onClick={() => void analyze()} disabled={!text.trim() || rec.recording} className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet/50 bg-violet/15 px-6 py-3 text-sm font-medium text-violet shadow-[0_0_30px_-10px_var(--violet)] transition hover:bg-violet/25 active:scale-95 disabled:opacity-40" data-testid="analisar"><Sparkles size={16} /> {mode === "grupo" ? "Resumir com o Orion" : "Gerar ata com o Orion"}</button>}
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-xs text-muted-foreground">Quer só ver como fica?<button type="button" onClick={() => showDemo("reuniao")} className="text-violet underline-offset-2 hover:underline" data-testid="exemplo-reuniao">Exemplo de reunião</button><button type="button" onClick={() => showDemo("grupo")} className="text-emerald underline-offset-2 hover:underline" data-testid="exemplo-grupo">Exemplo de resumo de grupos</button><span className="opacity-70">(dados inventados, não usa IA e não salva)</span></p>
      </section>

      <div ref={resultRef} className="mt-6 scroll-mt-6">
        {a && cur && <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="mono-caps !text-[0.62rem]">{dm(cur.date)} · {cur.mode === "grupo" ? "resumo de grupos" : "reunião"}{cur.demo && <span className="ml-2 rounded-full bg-amber/20 px-2 py-0.5 text-amber" data-testid="badge-exemplo">exemplo com dados inventados</span>}</p><h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="reuniao-titulo-final">{cur.title}</h2></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10" data-testid="copiar-ata"><ClipboardCopy size={14} /> Copiar ata</button>
              <button type="button" onClick={sendToCentral} disabled={nSel === 0 && !(a.proxima?.data && !sent.has(-1))} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2 text-sm font-medium text-emerald shadow-[0_0_28px_-10px_var(--emerald)] transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="enviar-central"><Send size={14} /> Criar demandas e lembretes ({nSel}{a.proxima?.data && !sent.has(-1) ? " + compromisso" : ""})</button></div></div>
          {!cur.demo && <div className="mb-3">{LinkBar}</div>}
          <MeetingResult a={a} selected={selected} sent={new Set([...sent].filter((i) => i >= 0))} onToggle={(i) => setSelected((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} onSelectAll={(on) => setSelected(on ? new Set(a.acoes.map((_, i) => i).filter((i) => !sent.has(i))) : new Set())} />
          {sent.size > 0 && <button type="button" onClick={() => { setSent(new Set()); setSelected(new Set(a.acoes.map((_, i) => i))); if (cur.id) acts.markSent.mutate({ id: cur.id, sent: [] }); }} className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Liberar as ações já enviadas para enviar de novo</button>}
        </>}
        <div ref={inboxRef} className="mt-5">{inbox && <InboxPanel incoming={inbox} onClose={() => setInbox(null)} onListen={() => undefined} listening={false} interim="" />}</div>
      </div>

      <section className="mt-8" data-testid="reunioes-historico"><h3 className="mono-caps mb-3 flex items-center gap-2 !text-[0.68rem]"><Clock size={13} className="text-cyan" /> Reuniões anteriores<span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />{embedded && projectId && <span className="flex rounded-full border border-white/10 p-0.5 text-[0.68rem] normal-case tracking-normal" role="radiogroup" aria-label="Quais reuniões mostrar">{([[true, "Deste projeto"], [false, "Todas"]] as const).map(([v, l]) => <button key={l} type="button" role="radio" aria-checked={onlyProject === v} onClick={() => setOnlyProject(v)} data-testid={v ? "reunioes-deste-projeto" : "reunioes-todas"} className={`rounded-full px-3 py-1 transition ${onlyProject === v ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>)}</span>}</h3>
        {history.isPending && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-cyan" /></div>}
        {history.isSuccess && shownHistory.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">Nenhuma reunião ainda. A primeira análise fica guardada aqui.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shownHistory.map((m, i) => (
          <li key={m.id} className="ex-card group px-4 py-3" style={{ "--rail": m.mode === "grupo" ? "var(--emerald)" : "var(--violet)", animation: "fin-rise .5s both", animationDelay: `${Math.min(i, 8) * 50}ms` } as React.CSSProperties} data-testid="reuniao-item">
            <button type="button" onClick={() => open(m)} className="block w-full text-left"><span className="font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">{dm(m.happenedOn)} · {m.mode === "grupo" ? "grupos" : m.source === "voz" ? "gravada" : m.source === "whatsapp" ? "whatsapp" : "texto"}</span>
              <b className="mt-0.5 block truncate font-display text-base">{m.title}</b><span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{m.analysis.resumo || m.analysis.grupos[0]?.resumo}</span>
              <span className="mt-2 flex gap-3 font-mono text-[0.62rem] text-muted-foreground"><span>{m.analysis.acoes.length} ações</span><span>{m.analysis.decisoes.length} decisões</span>{m.sent.length > 0 && <span className="text-emerald">{m.sent.filter((n) => n >= 0).length} enviadas</span>}</span></button>
            <button type="button" onClick={() => remove(m)} aria-label={`Apagar ${m.title}`} className="absolute right-3 top-3 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"><Trash2 size={13} /></button></li>))}</ul></section>
      </>}
    </Root>
  );
}
