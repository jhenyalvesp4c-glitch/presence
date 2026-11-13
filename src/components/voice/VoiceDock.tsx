import { useRouter, useRouterState } from "@tanstack/react-router";
import { Mic } from "lucide-react";

import { VoicePanel } from "@/components/voice/VoicePanel";
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

const SUBTITLE_LABEL: Record<Phase, string> = { idle: "Toque para falar", listening: "Ouvindo…", thinking: "Pensando…", speaking: "Falando…" };

/** Mini esfera viva: muda de forma conforme ouve, pensa e fala. */
function MiniOrb({ phase, onClick }: { phase: Phase; onClick: () => void }) {
  const c = COLOR[phase];
  return (
    <button onClick={onClick} aria-label={phase === "idle" ? "Falar com a Presence" : "Parar ou interromper"} data-testid={phase === "idle" ? "voz-abrir" : "voz-esfera"}
      className="group relative grid h-16 w-16 place-items-center rounded-full outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-cyan">
      <span className="absolute inset-0 rounded-full blur-xl transition-colors duration-700" style={{ background: `color-mix(in oklab, ${c} 45%, transparent)`, opacity: phase === "idle" ? 0.45 : 0.9 }} />
      {phase !== "idle" && <span className="absolute inset-0 animate-ping rounded-full" style={{ border: `1.5px solid ${c}`, animationDuration: phase === "listening" ? "1.8s" : phase === "speaking" ? "0.9s" : "2.6s" }} />}
      <span className="absolute inset-1.5 rounded-full border border-dashed opacity-70" style={{ borderColor: c, animation: `spin ${phase === "thinking" ? 1.1 : 12}s linear infinite` }} />
      <span className="relative grid h-11 w-11 place-items-center rounded-full shadow-[inset_0_0_14px_rgba(255,255,255,.25)] transition-all duration-500"
        style={{ background: `radial-gradient(circle at 35% 30%, ${c}, color-mix(in oklab, var(--violet) 70%, black))`, boxShadow: `0 0 26px -2px ${c}`, transform: phase === "speaking" ? "scale(1.12)" : phase === "listening" ? "scale(.94)" : "scale(1)" }}>
        {phase === "idle" || phase === "listening" ? <Mic size={18} className="text-white/90" /> : phase === "thinking" ? <span className="h-3 w-3 animate-pulse rounded-full bg-white/90" /> : <Bars on color="rgba(255,255,255,.95)" />}
      </span>
    </button>
  );
}

/** Esfera do assistente de voz nas outras páginas, legenda curta do que ela diz, avisos e painel com o que ela mostra. */
export function VoiceDock() {
  const v = useVoice();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const go = (href: string) => router.history.push(href);
  const onHome = path === "/assistente";

  return (
    <>
      {!onHome && (
        <div className="fixed bottom-4 left-4 z-40 flex max-w-[min(86vw,22rem)] flex-col items-start gap-2 lift-b sm:bottom-5 sm:left-5" data-testid="voz-dock">
          {v.active && (v.botText || v.note) && (
            <div className="space-y-1.5 animate-rise">
              {v.botText && v.phase !== "listening" && <p className="line-clamp-3 break-words rounded-2xl border border-border bg-background/85 px-3.5 py-2 text-sm leading-snug shadow-[0_0_30px_-12px_var(--cyan)] backdrop-blur-xl" data-testid="voz-texto">{v.botText}</p>}
              {v.note && <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-1.5 text-[0.72rem] leading-snug text-amber" role="alert" data-testid="voz-aviso">{v.note}</p>}
            </div>
          )}
          <div className="flex items-center gap-2">
            <MiniOrb phase={v.phase} onClick={v.toggle} />
            {v.active && <span className="mono-caps rounded-full border border-border bg-background/80 px-3 py-1 !text-[0.62rem] backdrop-blur" style={{ color: COLOR[v.phase] }} data-testid="voz-fase">{SUBTITLE_LABEL[v.phase]}</span>}
          </div>
        </div>
      )}
      {onHome && v.active && v.note && (
        <p className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,34rem)] -translate-x-1/2 rounded-xl border border-amber/40 bg-background/90 px-3 py-2 text-center text-[0.75rem] leading-snug text-amber backdrop-blur" role="alert" data-testid="voz-aviso">{v.note}</p>
      )}

      {v.panel && <VoicePanel panel={v.panel} onClose={v.closePanel} onOpen={go} />}
    </>
  );
}
