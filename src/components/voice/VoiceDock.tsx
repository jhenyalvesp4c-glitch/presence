import { useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Check, Mic, Send, Square, Volume2, X } from "lucide-react";

import { useVoice, type Phase } from "@/lib/voice/use-voice";

const LABEL: Record<Phase, string> = { idle: "Pronta", listening: "Ouvindo…", thinking: "Pensando…", speaking: "Falando…" };
const COLOR: Record<Phase, string> = { idle: "var(--violet)", listening: "var(--emerald)", thinking: "var(--amber, oklch(0.8 0.15 75))", speaking: "var(--cyan)" };

function Bars({ on, color }: { on: boolean; color: string }) {
  return (
    <span className="flex h-8 w-12 shrink-0 items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} className="w-[3px] rounded-full" style={{ background: color, height: on ? `${35 + ((i * 41) % 60)}%` : "18%", boxShadow: on ? `0 0 8px ${color}` : "none", transition: "height .3s", animation: on ? `orion-wave .8s ease-in-out ${(i % 4) * 0.12}s infinite alternate` : "none" }} />
      ))}
    </span>
  );
}

/** Botão do assistente de voz em todas as páginas, barra de legendas enquanto conversa e painel com o que ele mostra. */
export function VoiceDock() {
  const v = useVoice();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [text, setText] = useState("");
  const color = COLOR[v.phase];
  const busy = v.phase === "thinking" || v.phase === "speaking";
  const go = (href: string) => router.history.push(href);

  return (
    <>
      {!v.active && path !== "/assistente" && (
        <button onClick={v.toggle} aria-label="Falar com a Presence" title="Falar com a Presence" data-testid="voz-abrir"
          className="group fixed bottom-5 left-5 z-40 grid h-14 w-14 place-items-center rounded-full border border-cyan/50 bg-background/80 shadow-[0_0_34px_-6px_var(--cyan)] backdrop-blur-xl transition hover:scale-105 hover:shadow-[0_0_44px_-2px_var(--cyan)] max-sm:bottom-4 max-sm:left-4 max-md:hidden">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-cyan/15" />
          <Mic size={22} className="relative text-cyan transition group-hover:scale-110" />
        </button>
      )}

      {v.active && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(94vw,760px)] -translate-x-1/2 animate-rise" data-testid="voz-barra" role="status" aria-live="polite">
          <div className="relative overflow-hidden rounded-3xl border bg-background/85 p-3 shadow-[0_0_60px_-18px_var(--glow)] backdrop-blur-2xl" style={{ borderColor: `color-mix(in oklab, ${color} 55%, transparent)`, ["--glow" as string]: color }}>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--glow)] to-transparent" />
            <div className="flex items-center gap-3">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, boxShadow: `0 0 26px -6px ${color}` }}>
                <span className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ background: color, animationDuration: v.phase === "listening" ? "1.4s" : "2.6s" }} />
                {v.phase === "thinking" ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: color, borderTopColor: "transparent" }} /> : <Mic size={18} style={{ color }} className="relative" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="mono-caps flex items-center gap-2 !text-[0.6rem]" style={{ color }}><span data-testid="voz-fase">{LABEL[v.phase]}</span></p>
                {v.userText && v.phase !== "listening" && <p className="truncate text-[0.7rem] text-muted-foreground">Você: {v.userText}</p>}
                <p className="line-clamp-3 break-words text-sm leading-snug" data-testid="voz-texto">
                  {v.phase === "listening" ? (v.interim || <span className="text-muted-foreground">{v.canListen ? "Pode falar…" : "Seu navegador não ouve voz. Digite abaixo."}</span>)
                    : v.phase === "thinking" && !v.botText ? <span className="text-muted-foreground">…</span> : v.botText}
                </p>
              </div>
              <Bars on={v.phase === "listening" || v.phase === "speaking"} color={color} />
              {busy && <button onClick={v.toggle} aria-label="Interromper e falar" title="Interromper" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-emerald/60 hover:text-emerald"><Mic size={15} /></button>}
              <button onClick={v.stop} aria-label="Encerrar conversa" title="Encerrar" data-testid="voz-encerrar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"><Square size={14} /></button>
            </div>
            {v.note && <p className="mt-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-1.5 text-[0.72rem] leading-snug text-amber" role="alert" data-testid="voz-aviso">{v.note}</p>}
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { v.sendText(text); setText(""); } }} className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="ou digite aqui…" maxLength={500} data-testid="voz-digitar" className="min-w-0 flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground" />
              <button type="button" onClick={v.testVoice} aria-label="Testar a voz" title="Testar a voz (toca uma frase)" data-testid="voz-testar" className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-cyan/60 hover:text-cyan"><Volume2 size={13} /></button>
              <button type="submit" disabled={!text.trim()} aria-label="Enviar" className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-brand text-primary-foreground disabled:opacity-40"><Send size={12} /></button>
            </form>
          </div>
        </div>
      )}

      {v.panel && (
        <aside className="fixed right-4 top-20 z-50 w-[min(92vw,420px)] animate-rise max-sm:top-16" data-testid="voz-painel">
          <div className="relative max-h-[68vh] overflow-y-auto rounded-3xl border border-cyan/30 bg-background/95 p-4 shadow-[0_0_60px_-20px_var(--cyan)] backdrop-blur-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="icon-tile h-9 w-9 !rounded-xl"><Check size={15} /></span>
              <h3 className="mr-auto font-display text-base font-semibold leading-tight first-letter:uppercase">{v.panel.titulo}</h3>
              <button onClick={v.closePanel} aria-label="Fechar painel" className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              {v.panel.secoes.map((s, i) => (
                <section key={i}>
                  <p className="mono-caps mb-1.5 !text-[0.6rem]">{s.titulo}</p>
                  <ul className="space-y-1.5">
                    {s.itens.map((it, k) => (
                      <li key={k}>
                        <button onClick={() => it.link && go(it.link)} disabled={!it.link} style={{ animationDelay: `${(i * 3 + k) * 40}ms` }}
                          className="group flex w-full items-start gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-2 text-left text-sm animate-rise transition enabled:hover:-translate-y-0.5 enabled:hover:border-cyan/50">
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${it.feita ? "bg-emerald" : "bg-cyan"}`} />
                          <span className="min-w-0 flex-1"><span className={`block break-words ${it.feita ? "text-muted-foreground line-through" : ""}`}>{it.rotulo}</span>{it.detalhe && <span className="block text-[0.7rem] text-muted-foreground">{it.detalhe}</span>}</span>
                          {it.link && <ArrowUpRight size={12} className="mt-1 shrink-0 opacity-0 transition group-hover:opacity-100" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
