import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { FileText, Loader2, Mic, Paperclip, Send, Sparkles, Square, X } from "lucide-react";

import { VoicePanel } from "@/components/voice/VoicePanel";
import { WhatsChat } from "@/components/voice/WhatsChat";
import { transcribeAudio } from "@/lib/audio.functions";
import { authHeaders } from "@/lib/auth-token";
import { filesFromClipboard, sizeLabel, toPending, type Pending } from "@/lib/brain-files";
import { MAX_ANEXOS, MAX_ANEXOS_CHARS, anexosTotal, type Anexo } from "@/lib/voice/attachments";
import type { Panel, VoiceEvent } from "@/lib/voice/agent";
import { MAX_SECONDS, useRecorder } from "@/lib/use-recorder";
import { supabase, ownerId } from "@/lib/supabase";
import { clientFetcher } from "@/lib/whatsapp/client";
import { runWhatsAppTool } from "@/lib/whatsapp/tools";

type Bubble = { id: number; who: "eu" | "orion"; text: string; files?: { name: string; preview?: string | undefined }[]; panel?: Panel | undefined; busy?: boolean };
const LIMITS = { maxFiles: MAX_ANEXOS, maxBytes: 25 * 1024 * 1024, aiCap: MAX_ANEXOS } as const;
let seq = 0;

/** Conversa escrita com o Orion: texto, voz (ditado), imagens e arquivos. Usa o mesmo cérebro da esfera (mesmas ferramentas). */
export function OrionChat({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [pending, setPending] = useState<Pending[]>([]), [dragOver, setDragOver] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null), [transcribing, setTranscribing] = useState(false);
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const area = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null), end = useRef<HTMLDivElement>(null), ctrl = useRef<AbortController | null>(null);
  const recorder = useRecorder(), recording = recorder.state === "recording";

  useEffect(() => { if (autoFocus) area.current?.focus(); }, [autoFocus]);
  useEffect(() => { const el = area.current; if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; } }, [text]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [bubbles]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const addFiles = async (list: File[]) => {
    if (!list.length) return;
    setError("");
    try {
      const { added, rejected } = await toPending(list, pending, LIMITS);
      const ok = added.filter((p) => p.ai), skipped = added.filter((p) => !p.ai).map((p) => `${p.name}: só consigo ler imagens, PDFs (até 3 MB) e arquivos de texto`);
      if (ok.length) setPending((p) => [...p, ...ok]);
      const msgs = [...rejected, ...skipped];
      if (msgs.length) setError(msgs.join(" · "));
    } catch (e) { setError((e as Error).message); }
  };

  const patch = (id: number, f: (b: Bubble) => Bubble) => setBubbles((l) => l.map((b) => (b.id === id ? f(b) : b)));

  const send = useCallback(async () => {
    const msg = text.trim();
    if ((!msg && !pending.length) || busy) return;
    const anexos: Anexo[] = pending.flatMap((p) => (p.ai ? [{ name: p.name, mime: p.ai.mime, data: p.ai.data }] : []));
    if (anexosTotal(anexos) > MAX_ANEXOS_CHARS) { setError("Os arquivos juntos passam de ~3 MB. Mande menos arquivos por vez."); return; }
    setBusy(true); setError("");
    const files = pending.map((p) => ({ name: p.name, preview: p.preview }));
    const mine: Bubble = { id: ++seq, who: "eu", text: msg, files }, reply: Bubble = { id: ++seq, who: "orion", text: "", busy: true };
    setBubbles((l) => [...l, mine, reply]); setText(""); setPending([]);
    const userText = msg || `(enviou ${files.map((f) => f.name).join(", ")})`;
    history.current = [...history.current, { role: "user" as const, content: userText }].slice(-16);
    const c = new AbortController(); ctrl.current = c;
    let said = "";
    try {
      let body: Record<string, unknown> = { messages: history.current, modo: "chat", anexos };
      for (let round = 0; round < 4; round++) {
        const res = await fetch("/api/voz", { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(body), signal: c.signal });
        if (!res.ok || !res.body) throw new Error(res.status === 429 ? "Calma, estou recebendo pedidos demais. Tente em instantes." : res.status === 413 ? "Os arquivos são grandes demais. Mande menos ou menores." : "Não consegui falar com o servidor.");
        const reader = res.body.getReader(), dec = new TextDecoder();
        let carry = "", tools: Extract<VoiceEvent, { t: "ferramenta" }> | null = null;
        const handle = (e: VoiceEvent) => {
          if (e.t === "texto") { said += e.d; patch(reply.id, (b) => ({ ...b, text: said, busy: true })); }
          else if (e.t === "painel") { patch(reply.id, (b) => ({ ...b, panel: e.p })); setPanel(e.p); }
          else if (e.t === "acao") { if (e.a.tipo === "navegar") router.history.push(e.a.para); else if (e.a.tipo === "atualizar") window.dispatchEvent(new Event("orion:financeiro-atualizado")); }
          else if (e.t === "ferramenta") tools = e;
          else if (e.t === "erro") { said = said ? `${said}\n\n${e.m}` : e.m; patch(reply.id, (b) => ({ ...b, text: said })); }
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          carry += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = carry.indexOf("\n")) >= 0) { const line = carry.slice(0, nl).trim(); carry = carry.slice(nl + 1); if (line) { try { handle(JSON.parse(line) as VoiceEvent); } catch { /* linha incompleta */ } } }
        }
        const pend = tools as Extract<VoiceEvent, { t: "ferramenta" }> | null;
        if (!pend) break;
        // o servidor pediu ferramentas que só este navegador alcança (ponte do WhatsApp neste computador): executa e continua
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }), resultados: { id: string; content: string }[] = [];
        for (const call of pend.chamadas) {
          const out = await runWhatsAppTool(call.nome, call.args, clientFetcher, today).catch((er): { result: Record<string, unknown>; panel?: undefined } => ({ result: { ok: false, erro: er instanceof Error ? er.message : "erro" } }));
          if (out.panel) setPanel(out.panel);
          resultados.push({ id: call.id, content: JSON.stringify(out.result).slice(0, 12000) });
        }
        body = { messages: history.current, continuar: { estado: pend.estado, resultados }, modo: "chat" };
      }
      patch(reply.id, (b) => ({ ...b, busy: false, text: said.trim() || "Pronto." }));
      if (said.trim()) {
        history.current = [...history.current, { role: "assistant" as const, content: said.trim() }].slice(-16);
        void supabase.from("assistant_messages").insert([{ user_id: ownerId(), role: "user", content: userText }, { user_id: ownerId(), role: "assistant", content: said.trim() }]).then(() => undefined);
      }
    } catch (e) {
      if (!c.signal.aborted) patch(reply.id, (b) => ({ ...b, busy: false, text: (e as Error).message || "Tive um problema agora." }));
    }
    setBusy(false);
  }, [text, pending, busy, router]);

  const finishVoice = async () => {
    const audio = await recorder.stop();
    if (!audio) return;
    setTranscribing(true);
    try {
      const r = await transcribeAudio({ data: audio });
      if (r.ok) { setText((t) => (t.trim() ? `${t.trim()} ${r.text}` : r.text)); setTimeout(() => area.current?.focus(), 50); } else setError(r.error);
    } catch (e) { setError((e as Error).message); }
    setTranscribing(false);
  };
  useEffect(() => { if (recording && recorder.seconds >= MAX_SECONDS) void finishVoice(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [recorder.seconds, recording]);
  const startVoice = async () => { setError(""); try { await recorder.start(); } catch (e) { setError((e as Error).message); } };
  const go = (href: string) => { setPanel(null); router.history.push(href); };

  return (
    <div className="relative space-y-3" data-testid="orion-conversa"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragOver(false); void addFiles([...e.dataTransfer.files]); } }}>
      <input ref={fileInput} type="file" multiple hidden accept="image/*,application/pdf,text/*,.md,.csv,.json,.txt" data-testid="conversa-arquivo" onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      {dragOver && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-cyan bg-background/80 text-sm text-cyan backdrop-blur-sm"><span className="flex items-center gap-2"><Paperclip size={15} /> Solte para anexar</span></div>}

      <div className="max-h-[55vh] min-h-24 space-y-3 overflow-y-auto pr-1" data-testid="conversa-mensagens" aria-live="polite">
        {bubbles.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground"><Sparkles size={14} className="text-cyan" /> Pode falar comigo por aqui.</p>
            <p className="mt-1">Digite, grave um áudio ou anexe imagens, prints e PDFs. Eu analiso, respondo e faço o que for possível no Orion. Se eu não conseguir fazer algo, monto o pedido para o Claude e você confirma antes de enviar.</p>
          </div>
        )}
        {bubbles.map((b) => (
          <div key={b.id} className={`flex ${b.who === "eu" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${b.who === "eu" ? "border border-violet/40 bg-violet/10" : "border border-border bg-secondary/50"}`} data-testid={b.who === "eu" ? "msg-minha" : "msg-orion"}>
              {b.files && b.files.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {b.files.map((f, i) => f.preview ? <img key={i} src={f.preview} alt={f.name} className="h-16 w-16 rounded-lg object-cover" /> : <span key={i} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[0.7rem]"><FileText size={12} />{f.name}</span>)}
                </div>
              )}
              {b.text ? <p className="whitespace-pre-wrap break-words">{b.text}</p> : b.busy ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 size={13} className="animate-spin" /> Pensando…</span> : null}
              {b.who === "orion" && b.busy && b.text && <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-cyan align-middle" />}
              {b.panel && <button onClick={() => setPanel(b.panel!)} className="mt-2 flex items-center gap-1.5 rounded-full border border-cyan/40 px-3 py-1 text-xs text-cyan transition hover:bg-cyan/10" data-testid="abrir-painel">Ver: {b.panel.titulo}</button>}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-2" data-testid="conversa-anexos">
          {pending.map((p) => (
            <li key={p.key} className="relative flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-1.5 pr-7">
              {p.preview ? <img src={p.preview} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="icon-tile h-9 w-9 shrink-0 !rounded-lg"><FileText size={15} /></span>}
              <span className="min-w-0"><span className="block max-w-36 truncate text-[0.7rem]">{p.name}</span><span className="text-[0.6rem] text-muted-foreground">{sizeLabel(p.size)}</span></span>
              <button onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))} aria-label={`Remover ${p.name}`} className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-destructive"><X size={12} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative rounded-2xl border border-violet/40 bg-[linear-gradient(100deg,color-mix(in_oklab,var(--violet)_14%,transparent),color-mix(in_oklab,var(--cyan)_8%,transparent))] p-2">
        {recording ? (
          <div className="flex items-center gap-3 px-2 py-1" data-testid="conversa-gravando">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center"><span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" /><span className="relative h-3 w-3 rounded-full bg-destructive" /></span>
            <span className="flex-1 text-sm text-muted-foreground">Gravando… {Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, "0")}</span>
            <button onClick={() => void finishVoice()} className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-semibold text-primary-foreground" data-testid="conversa-parar"><Square size={12} /> Parar e escrever</button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            <button onClick={() => fileInput.current?.click()} disabled={pending.length >= MAX_ANEXOS} aria-label="Anexar imagem ou arquivo" title="Anexar imagem ou arquivo" data-testid="conversa-anexar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:text-cyan disabled:opacity-40"><Paperclip size={17} /></button>
            <textarea ref={area} value={text} rows={1} onChange={(e) => setText(e.target.value)} data-testid="conversa-texto"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
              onPaste={(e) => { const f = filesFromClipboard(e); if (f.length) { e.preventDefault(); void addFiles(f); } }}
              placeholder="Escreva, cole um print ou anexe arquivos… (Enter envia)" className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
            <button onClick={() => void startVoice()} disabled={transcribing || busy} aria-label="Falar (gravar áudio)" title="Falar (gravar áudio)" data-testid="conversa-microfone" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:text-cyan disabled:opacity-40">{transcribing ? <Loader2 size={17} className="animate-spin" /> : <Mic size={17} />}</button>
            <button onClick={() => void send()} disabled={busy || (!text.trim() && !pending.length)} aria-label="Enviar" data-testid="conversa-enviar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-[0_0_18px_-6px_var(--violet)] transition enabled:hover:scale-105 disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}</button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive" role="alert" data-testid="conversa-erro">{error}</p>}

      {panel && (panel.chat ? <WhatsChat panel={panel} onClose={() => setPanel(null)} /> : <VoicePanel panel={panel} onClose={() => setPanel(null)} onOpen={go} />)}
    </div>
  );
}
