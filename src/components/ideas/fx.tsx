/** Efeitos da página de ideias: onda de voz, "Orion pensando" e confete ao virar projeto. */
import { useEffect, useState } from "react";

import { OrbitArt } from "@/components/finance/fx";

const COLORS = ["var(--cyan)", "var(--violet)", "var(--emerald)", "var(--amber)", "var(--pink)"];
const rnd = (i: number) => { const x = Math.sin(i * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };

/** Barrinhas que dançam enquanto grava a voz. */
export function VoiceWave({ bars = 22 }: { bars?: number }) {
  return (
    <span aria-hidden className="inline-flex h-6 items-center gap-[3px]">
      {Array.from({ length: bars }, (_, i) => <span key={i} data-idea-fx className="w-[3px] origin-center rounded-full bg-destructive" style={{ height: 22, animation: `idea-wave ${0.7 + rnd(i) * 0.7}s ease-in-out ${rnd(i + 5) * 0.6}s infinite`, opacity: 0.5 + rnd(i + 9) * 0.5 }} />)}
    </span>
  );
}

/** Painel "o Orion está pensando": órbitas girando, feixe de luz e frases que se revezam. */
export function Thinking({ lines = ["Lendo a sua ideia…", "Procurando o que falta perguntar…", "Pesando riscos…", "Montando os primeiros passos…"] }: { lines?: string[] }) {
  const [n, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN((v) => (v + 1) % lines.length), 1800); return () => clearInterval(t); }, [lines.length]);
  return (
    <div className="relative mt-4 flex items-center gap-4 overflow-hidden rounded-2xl border border-violet/30 bg-black/20 p-4" data-testid="ideia-pensando" role="status">
      <OrbitArt size={86} />
      <div className="min-w-0"><p className="font-display text-sm font-semibold">O Orion está pensando</p><p key={n} className="mt-0.5 text-xs text-muted-foreground" style={{ animation: "fin-rise .5s both" }}>{lines[n]}</p></div>
      <span aria-hidden data-idea-fx className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-violet/20 to-transparent" style={{ animation: "idea-sweep 2.4s ease-in-out infinite" }} />
    </div>
  );
}

/** Explosão de confete (some sozinha). Use com `key` novo para repetir. */
export function Burst({ onDone }: { onDone?: () => void }) {
  useEffect(() => { const t = setTimeout(() => onDone?.(), 1600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] grid place-items-center">
      {Array.from({ length: 34 }, (_, i) => {
        const a = (i / 34) * Math.PI * 2 + rnd(i) * 0.6, d = 140 + rnd(i + 3) * 220;
        return <span key={i} data-idea-fx className="absolute h-2 w-1.5 rounded-sm" style={{ background: COLORS[i % COLORS.length], "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d - 60}px`, "--rot": `${rnd(i + 8) * 720 - 360}deg`, animation: `idea-burst ${1 + rnd(i + 2) * 0.5}s cubic-bezier(.15,.7,.3,1) both` } as React.CSSProperties} />;
      })}
    </div>
  );
}
