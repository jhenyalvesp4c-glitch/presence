/** Assistente de reuniões: cole, grave ou traga do WhatsApp; o Orion devolve ata, decisões, quem faz o quê e manda as ações para a Central (demandas, lembretes, compromisso). */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy, Clock, FileText, Loader2, Mic, MessageCircle, Send, Sparkles, Square, Trash2, X } from "lucide-react";

import { FinBackdrop, HeroPanel, LiveDot, OrbitArt } from "@/components/finance/fx";
import { InboxPanel } from "@/components/inbox/InboxPanel";
import { Burst, Thinking, VoiceWave } from "@/components/ideas/fx";
import { MeetingResult } from "@/components/meetings/MeetingResult";
import { WhatsAppPicker } from "@/components/meetings/WhatsAppPicker";
import { transcribeAudio } from "@/lib/audio.functions";
import { useMeetingActions, useMeetings, type Meeting } from "@/lib/data/meetings";
import { actionsToInboxText, analysisToMarkdown, type Analysis, type Mode, type Source } from "@/lib/meetings";
import { analyzeMeeting } from "@/lib/meetings.functions";
import { MAX_SECONDS, useRecorder } from "@/lib/use-recorder";

const ls = { get: (k: string, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };
const isoOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const tab = (on: boolean) => `flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${on ? "text-cyan shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cyan)_45%,transparent),0_0_24px_-8px_var(--cyan)] bg-cyan/10" : "text-muted-foreground hover:text-foreground"}`;
const THINK_MEETING = ["Lendo a conversa…", "Separando os assuntos…", "Achando as decisões…", "Descobrindo quem ficou de fazer o quê…"], THINK_GROUP = ["Lendo os grupos…", "Resumindo cada grupo…", "Transformando pedidos em ações…", "Montando as pendências…"];

export function MeetingsPage() {
  const history = useMeetings(), acts = useMeetingActions();
  const [mode, setMode] = useState<Mode>("reuniao"), [src, setSrc] = useState<"texto" | "voz" | "whatsapp">("texto"), [text, setText] = useState(""), [title, setTitle] = useState(""), [me, setMe] = useState(() => ls.get("orion:reunioes:eu"));
  const [busy, setBusy] = useState(false), [a, setA] = useState<Analysis | null>(null), [cur, setCur] = useState<{ id: string | null; title: string; date: string; raw: string; source: Source; mode: Mode } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set()), [sent, setSent] = useState<Set<number>>(new Set()), [inbox, setInbox] = useState<{ id: number; text: string } | null>(null), [burst, setBurst] = useState(0), [transcribing, setTranscribing] = useState(false);
  const rec = useRecorder(), resultRef = useRef<HTMLDivElement>(null), inboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { ls.set("orion:reunioes:eu", me); }, [me]);
  const append = (t: string) => setText((x) => (x.trim() ? `${x.trim()}\n\n${t}` : t));
  // gravação: cada trecho (até 3 min) vira texto e se junta ao que já está na caixa
  const finishRecording = async () => {
    const r = await rec.stop(); if (!r) return;
    setTranscribing(true);
    try { const t = await transcribeAudio({ data: { data: r.data, mime: r.mime } }); if (t.ok) { append(t.text); toast.success("Trecho transcrito"); } else toast.error(t.error); }
    catch (e) { toast.error(`Não consegui transcrever: ${(e as Error).message}`); }
    setTranscribing(false);
  };
  useEffect(() => { if (rec.state === "recording" && rec.seconds >= MAX_SECONDS) void finishRecording(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rec.seconds, rec.state]);
  const startRec = async () => { try { await rec.start(); } catch (e) { toast.error((e as Error).message); } };

  const analyze = async () => {
    if (text.trim().length < 20) { toast.error("Cole ou grave um pouco mais de conteúdo para eu analisar."); return; }
    setBusy(true); setA(null); setInbox(null);
    const today = isoOf(), weekday = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
    try {
      const r = await analyzeMeeting({ data: { texto: text, modo: mode, hoje: today, diaSemana: weekday, euSou: me.trim(), titulo: title.trim() } });
      if (!r.ok) { toast.error(r.error); setBusy(false); return; }
      const analysis = r.analise, source: Source = src;
      setA(analysis); setSelected(new Set(analysis.acoes.map((_, i) => i))); setSent(new Set()); setBurst((n) => n + 1);
      let id: string | null = null;
      try { id = await acts.save.mutateAsync({ title: analysis.titulo, source, mode, raw: text, analysis, happenedOn: today }); } catch (e) { toast.error(`A análise ficou pronta, mas não consegui salvar no histórico: ${(e as Error).message}`); }
      setCur({ id, title: analysis.titulo, date: today, raw: text, source, mode });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) { toast.error(`Não consegui analisar: ${(e as Error).message}`); }
    setBusy(false);
  };
  const open = (m: Meeting) => { setA(m.analysis); setCur({ id: m.id, title: m.title, date: m.happenedOn, raw: m.raw, source: m.source, mode: m.mode }); setSelected(new Set(m.analysis.acoes.map((_, i) => i).filter((i) => !m.sent.includes(i)))); setSent(new Set(m.sent)); setInbox(null); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); };
  const sendToCentral = () => {
    if (!a || !cur) return;
    const idx = [...selected].filter((i) => !sent.has(i)).sort((x, y) => x - y), list = idx.map((i) => a.acoes[i]!);
    const wantsNext = !!a.proxima?.data && !sent.has(-1);
    if (!list.length && !wantsNext) { toast.error("Marque pelo menos uma ação."); return; }
    setInbox({ id: Date.now(), text: actionsToInboxText(cur.title, cur.date, list, wantsNext ? a.proxima : null) });
    const next = new Set([...sent, ...idx, ...(wantsNext ? [-1] : [])]); setSent(next); setSelected(new Set());
    if (cur.id) acts.markSent.mutate({ id: cur.id, sent: [...next] });
    setTimeout(() => inboxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };
  const copy = async () => { if (!a || !cur) return; try { await navigator.clipboard.writeText(analysisToMarkdown(a, cur.date)); toast.success("Ata copiada", { description: "Cole no WhatsApp, no e-mail ou num documento." }); } catch { toast.error("Não consegui copiar."); } };
  const remove = (m: Meeting) => { if (window.confirm(`Apagar “${m.title}” do histórico?`)) acts.remove.mutate(m.id, { onSuccess: () => { if (cur?.id === m.id) { setA(null); setCur(null); } }, onError: (e) => toast.error(e.message) }); };
  const nSel = useMemo(() => [...selected].filter((i) => !sent.has(i)).length, [selected, sent]);

  return (
    <main className="relative mx-auto min-h-screen max-w-6xl px-4 pb-40 pt-6 md:py-10 md:pl-24" data-testid="reunioes"><FinBackdrop />
      {burst > 0 && <Burst key={burst} />}
      <HeroPanel glow="var(--violet)"><div className="grid items-center gap-6 lg:grid-cols-[1.4fr_0.6fr]"><div>
        <p className="mono-caps flex items-center gap-3">Assistente de reuniões <LiveDot color="var(--emerald)" label="ata em segundos" /></p>
        <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">Reuniões <span className="text-gradient inline-block pr-3 italic">sem esforço</span></h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">Cole a conversa do WhatsApp, grave a reunião ou traga os grupos. O Orion entrega a ata, as decisões, quem ficou de fazer o quê — e já manda as ações para a Central virarem demandas e lembretes.</p></div>
        <div className="mx-auto"><OrbitArt size={190}><Mic size={32} className="text-violet drop-shadow-[0_0_14px_var(--violet)]" /></OrbitArt></div></div></HeroPanel>

      <section className="ex-card mt-5 px-5 py-5 sm:px-6" style={{ "--rail": "var(--violet)", animation: "fin-rise .6s both" } as React.CSSProperties} data-testid="reuniao-entrada">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-2xl border border-white/10 p-1" role="tablist" aria-label="Tipo">{([["reuniao", "Reunião", FileText], ["grupo", "Resumir grupos", MessageCircle]] as const).map(([k, l, I]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); if (k === "grupo") setSrc("whatsapp"); }} data-testid={`modo-${k}`} className={tab(mode === k)}><I size={15} />{l}</button>)}</div>
          <div className="flex gap-1 rounded-2xl border border-white/10 p-1" role="tablist" aria-label="Origem">{([["texto", "Colar texto", FileText], ["voz", "Gravar", Mic], ["whatsapp", "Do WhatsApp", MessageCircle]] as const).map(([k, l, I]) => <button key={k} role="tab" aria-selected={src === k} onClick={() => setSrc(k)} data-testid={`origem-${k}`} className={tab(src === k)}><I size={15} />{l}</button>)}</div>
        </div>

        {src === "voz" && <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4" data-testid="gravador">
          {rec.state === "recording" ? <>
            <button type="button" onClick={() => void finishRecording()} className="grid h-14 w-14 place-items-center rounded-full border border-destructive/60 bg-destructive/20 text-destructive shadow-[0_0_30px_-6px_var(--destructive)] transition active:scale-90" aria-label="Parar e transcrever" data-testid="parar-gravacao"><Square size={20} fill="currentColor" /></button>
            <div className="min-w-0 flex-1"><VoiceWave bars={30} /><p className="mt-1 font-mono text-sm tabular-nums text-destructive">{Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, "0")} <span className="text-muted-foreground">/ {MAX_SECONDS / 60}:00</span></p></div>
            <button type="button" onClick={rec.cancel} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X size={13} /> cancelar</button></>
            : <><button type="button" onClick={() => void startRec()} disabled={!rec.supported || transcribing} className="grid h-14 w-14 place-items-center rounded-full border border-violet/60 bg-violet/15 text-violet shadow-[0_0_30px_-8px_var(--violet)] transition hover:bg-violet/25 active:scale-90 disabled:opacity-40" aria-label="Gravar" data-testid="gravar">{transcribing ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}</button>
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">{rec.supported ? (transcribing ? "Transcrevendo o trecho…" : "Toque para gravar. Cada trecho vai até 3 minutos e é transcrito e juntado ao texto abaixo — grave quantos trechos precisar.") : "Este navegador não permite gravar. Use outro navegador ou cole o texto."}</p></>}
        </div>}
        {src === "whatsapp" && <div className="mt-4"><WhatsAppPicker onText={(t) => { append(t); setSrc("texto"); }} /></div>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Título (opcional): Alinhamento P4C" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-violet/60" data-testid="reuniao-titulo" />
          <input value={me} onChange={(e) => setMe(e.target.value)} maxLength={60} placeholder="Seu nome na conversa (para marcar o que é seu)" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-violet/60" data-testid="reuniao-eu" /></div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={60000} disabled={busy} placeholder={mode === "grupo" ? "Traga os grupos pelo WhatsApp (acima) ou cole aqui as conversas. Para vários grupos, comece cada um com: === Grupo: nome ===" : "Cole aqui a conversa do WhatsApp, a transcrição ou as suas anotações da reunião…"} className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-violet/60 disabled:opacity-60" data-testid="reuniao-texto" />
        <div className="mt-1 flex items-center justify-between text-[0.68rem] text-muted-foreground"><span>{text.length.toLocaleString("pt-BR")} / 60.000 caracteres</span>{text && !busy && <button type="button" onClick={() => setText("")} className="hover:text-foreground">limpar</button>}</div>
        {busy ? <Thinking lines={mode === "grupo" ? THINK_GROUP : THINK_MEETING} />
          : <button type="button" onClick={() => void analyze()} disabled={!text.trim()} className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet/50 bg-violet/15 px-6 py-3 text-sm font-medium text-violet shadow-[0_0_30px_-10px_var(--violet)] transition hover:bg-violet/25 active:scale-95 disabled:opacity-40" data-testid="analisar"><Sparkles size={16} /> {mode === "grupo" ? "Resumir com o Orion" : "Gerar ata com o Orion"}</button>}
      </section>

      <div ref={resultRef} className="mt-6 scroll-mt-6">
        {a && cur && <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="mono-caps !text-[0.62rem]">{dm(cur.date)} · {cur.mode === "grupo" ? "resumo de grupos" : "reunião"}</p><h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="reuniao-titulo-final">{cur.title}</h2></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10" data-testid="copiar-ata"><ClipboardCopy size={14} /> Copiar ata</button>
              <button type="button" onClick={sendToCentral} disabled={nSel === 0 && !(a.proxima?.data && !sent.has(-1))} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2 text-sm font-medium text-emerald shadow-[0_0_28px_-10px_var(--emerald)] transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="enviar-central"><Send size={14} /> Criar demandas e lembretes ({nSel}{a.proxima?.data && !sent.has(-1) ? " + compromisso" : ""})</button></div></div>
          <MeetingResult a={a} selected={selected} sent={new Set([...sent].filter((i) => i >= 0))} onToggle={(i) => setSelected((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} onSelectAll={(on) => setSelected(on ? new Set(a.acoes.map((_, i) => i).filter((i) => !sent.has(i))) : new Set())} />
          {sent.size > 0 && <button type="button" onClick={() => { setSent(new Set()); setSelected(new Set(a.acoes.map((_, i) => i))); if (cur.id) acts.markSent.mutate({ id: cur.id, sent: [] }); }} className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Liberar as ações já enviadas para enviar de novo</button>}
        </>}
        <div ref={inboxRef} className="mt-5">{inbox && <InboxPanel incoming={inbox} onClose={() => setInbox(null)} onListen={() => undefined} listening={false} interim="" />}</div>
      </div>

      <section className="mt-8" data-testid="reunioes-historico"><h3 className="mono-caps mb-3 flex items-center gap-2 !text-[0.68rem]"><Clock size={13} className="text-cyan" /> Reuniões anteriores<span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" /></h3>
        {history.isPending && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-cyan" /></div>}
        {history.isSuccess && history.data.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">Nenhuma reunião ainda. A primeira análise fica guardada aqui.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(history.data ?? []).map((m, i) => (
          <li key={m.id} className="ex-card group px-4 py-3" style={{ "--rail": m.mode === "grupo" ? "var(--emerald)" : "var(--violet)", animation: "fin-rise .5s both", animationDelay: `${Math.min(i, 8) * 50}ms` } as React.CSSProperties} data-testid="reuniao-item">
            <button type="button" onClick={() => open(m)} className="block w-full text-left"><span className="font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">{dm(m.happenedOn)} · {m.mode === "grupo" ? "grupos" : m.source === "voz" ? "gravada" : m.source === "whatsapp" ? "whatsapp" : "texto"}</span>
              <b className="mt-0.5 block truncate font-display text-base">{m.title}</b><span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{m.analysis.resumo || m.analysis.grupos[0]?.resumo}</span>
              <span className="mt-2 flex gap-3 font-mono text-[0.62rem] text-muted-foreground"><span>{m.analysis.acoes.length} ações</span><span>{m.analysis.decisoes.length} decisões</span>{m.sent.length > 0 && <span className="text-emerald">{m.sent.filter((n) => n >= 0).length} enviadas</span>}</span></button>
            <button type="button" onClick={() => remove(m)} aria-label={`Apagar ${m.title}`} className="absolute right-3 top-3 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"><Trash2 size={13} /></button></li>))}</ul></section>
    </main>
  );
}
