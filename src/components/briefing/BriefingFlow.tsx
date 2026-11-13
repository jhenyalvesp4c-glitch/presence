import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Brain, Check, Loader2, Mic, Pencil, Plus, Sparkles, Square, Trash2, X } from "lucide-react";

import { LivingOrb, type OrbMode } from "@/components/LivingOrb";
import { transcribeAudio } from "@/lib/audio.functions";
import { EMPTY_BRIEFING, GREETING_OPTIONS, TONE_OPTIONS, sanitize, type Briefing, type Greeting } from "@/lib/briefing";
import { addMemory, deleteMemory, saveBriefing } from "@/lib/data/briefing";
import { MAX_SECONDS, useRecorder } from "@/lib/use-recorder";
import { useBriefing } from "@/lib/use-briefing";

type StepKey = "nome" | "tom" | "saudacao" | "trabalho" | "demanda" | "rotina" | "objetivos" | "regras" | "resumo";
type Step = { key: StepKey; ask: (name: string) => string; sub?: string; optional?: boolean };

const STEPS: Step[] = [
  { key: "nome", ask: () => "Oi! Eu sou o Presence, seu assistente pessoal. Como você quer que eu te chame?", sub: "Pode ser seu nome, um apelido… do jeito que você preferir." },
  { key: "tom", ask: (n) => `Prazer${n ? `, ${n}` : ""}! Como você quer que eu converse com você?`, sub: "Escolha um jeito ou descreva o seu." },
  { key: "saudacao", ask: () => "E quando a gente começar a conversar, como você quer que eu inicie?", sub: "Por exemplo: me cumprimentar e já mostrar o que tenho para hoje." },
  { key: "trabalho", ask: () => "Com o que você trabalha?", sub: "Conte o que você faz, onde atua, com quem trabalha. Pode falar, se preferir." },
  { key: "demanda", ask: () => "Qual é a sua maior demanda hoje? O que mais pesa no seu dia?", sub: "Isso me ajuda a entender o que priorizar para você." },
  { key: "rotina", ask: () => "Como é o seu dia a dia?", sub: "Horários, reuniões, tarefas que se repetem, quando você rende mais…", optional: true },
  { key: "objetivos", ask: () => "O que você quer conquistar com o Presence?", sub: "Organizar o trabalho, não esquecer compromissos, cuidar da saúde…", optional: true },
  { key: "regras", ask: () => "Tem alguma regra ou preferência que eu deva sempre seguir?", sub: "Ex.: “nunca me ligue antes das 9h”, “sempre me avise de prazos”.", optional: true },
  { key: "resumo", ask: (n) => `Pronto${n ? `, ${n}` : ""}! Foi isso que eu entendi.`, sub: "Confira. Você pode mudar qualquer resposta ou refazer o briefing quando quiser." },
];

const field = "w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground/60 focus:border-cyan/60 focus:bg-white/[0.08]";

/** Efeito de digitação para a pergunta do Presence. */
function useTypewriter(text: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(text.length); return; }
    const t = setInterval(() => setN((x) => { if (x >= text.length) { clearInterval(t); return x; } return x + 1; }), 22);
    return () => clearInterval(t);
  }, [text]);
  return text.slice(0, n);
}

/** Briefing: o Presence conversa com a pessoa para aprender como chamar, como falar e como ajudar. */
export function BriefingFlow() {
  const ctx = useBriefing();
  if (!ctx.open || !ctx.available || typeof document === "undefined") return null;
  return createPortal(<Flow />, document.body);
}

function Flow() {
  const ctx = useBriefing();
  const [b, setB] = useState<Briefing>(() => ({ ...EMPTY_BRIEFING, ...(ctx.briefing ?? {}) }));
  const [i, setI] = useState(0);
  const [tab, setTab] = useState<"briefing" | "memoria">("briefing");
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [newMem, setNewMem] = useState("");
  const rec = useRecorder();
  const recording = rec.state === "recording";
  const area = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const step = STEPS[i]!;
  const first = (b.call_name.split(" ")[0] ?? "").trim();
  const question = useTypewriter(step.ask(first));
  const mode: OrbMode = recording ? "listening" : transcribing || saving ? "thinking" : question.length < step.ask(first).length ? "speaking" : "idle";

  const set = useCallback(<K extends keyof Briefing>(k: K, v: Briefing[K]) => setB((x) => ({ ...x, [k]: v })), []);
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => { setError(""); const t = setTimeout(() => area.current?.focus(), 400); return () => clearTimeout(t); }, [i, tab]);

  const text = useMemo<Record<string, [string, (v: string) => void]>>(() => ({
    nome: [b.call_name, (v) => set("call_name", v)], trabalho: [b.work, (v) => set("work", v)], demanda: [b.biggest_demand, (v) => set("biggest_demand", v)],
    rotina: [b.routine, (v) => set("routine", v)], objetivos: [b.goals, (v) => set("goals", v)], regras: [b.preferences, (v) => set("preferences", v)],
  }), [b, set]);

  async function toggleMic() {
    setError("");
    if (recording) {
      const audio = await rec.stop(); if (!audio) return;
      setTranscribing(true);
      try {
        const r = await transcribeAudio({ data: audio });
        const cur = text[step.key];
        if (r.ok && cur) cur[1](cur[0].trim() ? `${cur[0].trim()} ${r.text}` : r.text); else if (!r.ok) setError(r.error);
      } catch (e) { setError((e as Error).message); }
      setTranscribing(false);
    } else { try { await rec.start(); } catch (e) { setError((e as Error).message); } }
  }
  useEffect(() => { if (recording && rec.seconds >= MAX_SECONDS) void toggleMic(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rec.seconds, recording]);

  const value = text[step.key]?.[0] ?? "";
  const canNext = step.key === "nome" ? b.call_name.trim().length > 0 : step.key === "tom" ? b.tone.trim().length > 0 : step.key === "saudacao" ? true : step.key === "resumo" ? true : step.optional ? true : value.trim().length > 0;

  async function persist(finish: boolean) {
    setSaving(true); setError("");
    try {
      await saveBriefing(sanitize(b), finish);
      ctx.refresh();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Não consegui salvar."); return false; }
    finally { setSaving(false); }
  }
  async function next() {
    if (!canNext || saving) return;
    if (recording) await rec.cancel();
    if (step.key === "resumo") { if (await persist(true)) { toast.success("Briefing salvo. Agora eu já sei como falar com você."); ctx.closeFlow(); } return; }
    setI((x) => Math.min(STEPS.length - 1, x + 1));
  }
  async function later() {
    if (recording) await rec.cancel();
    const hasAny = [b.call_name, b.tone, b.work, b.biggest_demand, b.routine, b.goals, b.preferences].some((x) => x.trim());
    if (hasAny) await persist(false);
    ctx.closeFlow(true);
  }

  const labelOf: Record<string, string> = { "Nome": b.call_name, "Jeito de conversar": b.tone, "Como começar a conversa": `${GREETING_OPTIONS.find((g) => g.v === b.greeting)?.label ?? ""}${b.greeting_note ? ` — ${b.greeting_note}` : ""}`, "Trabalho": b.work, "Maior demanda": b.biggest_demand, "Dia a dia": b.routine, "Objetivos": b.goals, "Regras e preferências": b.preferences };
  const stepOf: Record<string, number> = { "Nome": 0, "Jeito de conversar": 1, "Como começar a conversa": 2, "Trabalho": 3, "Maior demanda": 4, "Dia a dia": 5, "Objetivos": 6, "Regras e preferências": 7 };

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-[oklch(0.1_0.025_265/0.96)] backdrop-blur-xl" data-testid="briefing" role="dialog" aria-label="Briefing do Presence">
      <div aria-hidden className="pointer-events-none fixed -left-24 -top-28 h-96 w-96 rounded-full bg-[var(--violet)] opacity-30 blur-3xl" style={{ animation: "vp-aurora 14s ease-in-out infinite" }} />
      <div aria-hidden className="pointer-events-none fixed -bottom-32 -right-24 h-96 w-96 rounded-full bg-[var(--cyan)] opacity-20 blur-3xl" style={{ animation: "vp-aurora 17s ease-in-out infinite reverse" }} />

      <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        {/* topo */}
        <header className="flex items-center gap-3">
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1 text-xs">
            {([["briefing", "Briefing", Sparkles], ["memoria", `O que aprendi (${ctx.memories.length})`, Brain]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setTab(k)} data-testid={`briefing-aba-${k}`} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${tab === k ? "bg-cyan/15 text-cyan" : "text-muted-foreground"}`}><I size={13} /> {l}</button>
            ))}
          </div>
          <button onClick={() => void later()} aria-label="Fechar" className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground" data-testid="briefing-depois">
            <X size={14} /> {ctx.completed ? "Fechar" : "Fazer depois"}
          </button>
        </header>

        {tab === "memoria" ? (
          <section className="mt-6 flex-1" data-testid="briefing-memoria">
            <h2 className="font-serif text-3xl leading-tight"><span className="text-gradient">O que o Presence aprendeu sobre você</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">Ele guarda o que você conta e pede para lembrar. Apague o que não quiser que ela use.</p>
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = newMem.trim(); if (!t) return; void addMemory(t, "aprendizado", "manual").then(() => { setNewMem(""); ctx.refresh(); }).catch((x) => setError(x.message)); }}>
              <input value={newMem} onChange={(e) => setNewMem(e.target.value)} placeholder="Ensinar algo novo: ex.: prefiro reuniões à tarde" className={field} maxLength={500} data-testid="briefing-nova-memoria" />
              <button type="submit" aria-label="Adicionar" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground"><Plus size={18} /></button>
            </form>
            <ul className="mt-4 space-y-2">
              {ctx.memories.map((m) => (
                <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="mt-0.5 shrink-0 rounded-full bg-violet/15 px-2 py-0.5 text-[0.65rem] text-violet">{m.kind}</span>
                  <span className="min-w-0 flex-1 break-words text-sm">{m.text}</span>
                  <button onClick={() => void deleteMemory(m.id).then(ctx.refresh)} aria-label="Esquecer" className="text-muted-foreground transition hover:text-destructive"><Trash2 size={15} /></button>
                </li>
              ))}
              {!ctx.memories.length && <li className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">Ainda não aprendi nada além do briefing. Conforme a gente conversa, eu vou guardando aqui.</li>}
            </ul>
          </section>
        ) : (
          <>
            {/* progresso */}
            <div className="mt-5 flex items-center gap-1.5" aria-label={`Passo ${i + 1} de ${STEPS.length}`}>
              {STEPS.map((s, k) => <span key={s.key} className="h-1 flex-1 rounded-full transition-all duration-500" style={{ background: k <= i ? "linear-gradient(90deg, var(--cyan), var(--violet))" : "rgba(255,255,255,.1)", boxShadow: k === i ? "0 0 10px var(--cyan)" : "none" }} />)}
            </div>

            {/* Presence */}
            <div className="mt-9 flex flex-col items-center text-center" key={step.key}>
              <div className="relative aspect-[4/3] w-[190px] shrink-0 sm:w-[230px]">
                <div className="pointer-events-none absolute inset-0 origin-center scale-[1.3]"><LivingOrb mode={mode} /></div>
              </div>
              <h2 className="mt-3 min-h-[5.5rem] max-w-xl font-serif text-[1.65rem] leading-snug sm:text-3xl" aria-live="polite" data-testid="briefing-pergunta">{question}<span className="ml-0.5 inline-block h-6 w-0.5 translate-y-1 animate-pulse bg-cyan" /></h2>
              {step.sub && <p className="mt-1 max-w-md text-sm text-muted-foreground" style={{ animation: "vp-item .6s ease .2s both" }}>{step.sub}</p>}
            </div>

            {/* resposta */}
            <div className="mt-6 flex-1" style={{ animation: "vp-item .5s ease .25s both" }}>
              {step.key === "tom" && (
                <div className="grid gap-2 sm:grid-cols-2" data-testid="briefing-tom">
                  {TONE_OPTIONS.map((o) => { const on = b.tone === o.v; return (
                    <button key={o.label} onClick={() => set("tone", o.v)} aria-pressed={on} className="rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5" style={{ borderColor: on ? "color-mix(in oklab, var(--cyan) 65%, transparent)" : "rgba(255,255,255,.1)", background: on ? "color-mix(in oklab, var(--cyan) 10%, transparent)" : "rgba(255,255,255,.04)" }}>
                      <span className="flex items-center gap-2 text-sm font-semibold">{o.label}{on && <Check size={14} className="text-cyan" />}</span><span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>
                    </button>); })}
                  <input ref={(el) => { area.current = el; }} value={TONE_OPTIONS.some((o) => o.v === b.tone) ? "" : b.tone} onChange={(e) => set("tone", e.target.value)} placeholder="Outro jeito: descreva como quer que eu fale" className={`${field} sm:col-span-2`} maxLength={400} />
                </div>
              )}
              {step.key === "saudacao" && (
                <div className="space-y-2" data-testid="briefing-saudacao">
                  {GREETING_OPTIONS.map((o) => { const on = b.greeting === o.v; return (
                    <button key={o.v} onClick={() => set("greeting", o.v as Greeting)} aria-pressed={on} className="flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5" style={{ borderColor: on ? "color-mix(in oklab, var(--violet) 65%, transparent)" : "rgba(255,255,255,.1)", background: on ? "color-mix(in oklab, var(--violet) 12%, transparent)" : "rgba(255,255,255,.04)" }}>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{o.label}</span><span className="block text-xs text-muted-foreground">{o.hint}</span></span>{on && <Check size={16} className="text-violet" />}
                    </button>); })}
                  <input ref={(el) => { area.current = el; }} value={b.greeting_note} onChange={(e) => set("greeting_note", e.target.value)} placeholder="Quer pedir algo a mais? Ex.: me perguntar como eu dormi" className={field} maxLength={400} />
                </div>
              )}
              {step.key === "nome" && (
                <input ref={(el) => { area.current = el; }} value={b.call_name} onChange={(e) => set("call_name", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void next(); }} placeholder="Como você quer ser chamada(o)?" maxLength={60} className={`${field} text-center text-xl`} data-testid="briefing-nome" />
              )}
              {["trabalho", "demanda", "rotina", "objetivos", "regras"].includes(step.key) && (
                <div className="relative">
                  <textarea ref={(el) => { area.current = el; }} value={value} onChange={(e) => text[step.key]![1](e.target.value)} rows={5} maxLength={1500} placeholder="Escreva aqui… ou toque no microfone e fale" className={`${field} resize-none pr-14`} data-testid="briefing-resposta" />
                  {rec.supported && (
                    <button type="button" onClick={() => void toggleMic()} disabled={transcribing} aria-label={recording ? "Parar gravação" : "Falar em vez de digitar"} data-testid="briefing-mic"
                      className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border transition ${recording ? "animate-pulse border-destructive/60 bg-destructive/20 text-destructive" : "border-white/10 bg-white/[0.06] text-cyan hover:border-cyan/50"}`}>
                      {transcribing ? <Loader2 size={16} className="animate-spin" /> : recording ? <Square size={14} /> : <Mic size={16} />}
                    </button>
                  )}
                  {recording && <p className="mt-2 text-xs text-destructive">Gravando… {Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, "0")} · toque no quadrado para terminar</p>}
                </div>
              )}
              {step.key === "resumo" && (
                <ul className="space-y-2" data-testid="briefing-resumo">
                  {Object.entries(labelOf).filter(([, v]) => v.trim()).map(([k, v]) => (
                    <li key={k} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <span className="min-w-0 flex-1"><span className="block text-[0.65rem] uppercase tracking-widest text-muted-foreground">{k}</span><span className="mt-0.5 block break-words text-sm">{v}</span></span>
                      <button onClick={() => setI(stepOf[k]!)} aria-label={`Editar ${k}`} className="mt-0.5 text-muted-foreground transition hover:text-cyan"><Pencil size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
              {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="briefing-erro">{error}</p>}
            </div>

            {/* navegação */}
            <footer className="sticky bottom-0 mt-6 flex items-center gap-3 bg-gradient-to-t from-[oklch(0.1_0.025_265)] via-[oklch(0.1_0.025_265/0.9)] to-transparent pb-1 pt-4">
              <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0 || saving} aria-label="Voltar" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition hover:text-foreground disabled:opacity-30"><ArrowLeft size={18} /></button>
              {step.optional && step.key !== "resumo" && <button onClick={() => setI((x) => x + 1)} className="rounded-full px-4 py-3 text-sm text-muted-foreground transition hover:text-foreground" data-testid="briefing-pular">Pular</button>}
              <button onClick={() => void next()} disabled={!canNext || saving} data-testid="briefing-proximo"
                className="ml-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_var(--cyan)] transition hover:brightness-110 disabled:opacity-50 sm:flex-none">
                {saving ? <Loader2 size={16} className="animate-spin" /> : step.key === "resumo" ? <Check size={16} /> : null}
                {step.key === "resumo" ? "Concluir briefing" : "Continuar"} {step.key !== "resumo" && !saving && <ArrowRight size={16} />}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
