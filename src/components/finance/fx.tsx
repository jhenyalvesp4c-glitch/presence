import { useRef, type CSSProperties, type ReactNode } from "react";

/* Efeitos visuais do financeiro: fundo animado, moldura de luz, cartão 3D e ilustrações. */

/** Pseudo-aleatório estável (mesmas posições no servidor e no navegador). */
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const STARS = Array.from({ length: 70 }, (_, i) => ({ x: rnd(i) * 100, y: rnd(i + 99) * 100, s: rnd(i + 7) * 1.8 + 0.6, d: rnd(i + 3) * 6, t: 3 + rnd(i + 5) * 5 }));

/** Fundo de "sala de controle": auroras, estrelas piscando, feixe de luz e grade em perspectiva. */
export function FinBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <span className="absolute -left-40 -top-20 h-[34rem] w-[34rem] rounded-full bg-[var(--violet)] opacity-[0.14] blur-3xl" style={{ animation: "fin-aurora 18s ease-in-out infinite" }} />
      <span className="absolute -right-32 top-1/3 h-[30rem] w-[30rem] rounded-full bg-[var(--cyan)] opacity-[0.11] blur-3xl" style={{ animation: "fin-aurora 22s ease-in-out infinite reverse" }} />
      <span className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-[var(--emerald)] opacity-[0.06] blur-3xl" style={{ animation: "fin-aurora 26s ease-in-out infinite" }} />
      {STARS.map((s, i) => <span key={i} className="absolute rounded-full bg-foreground" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animation: `fin-twinkle ${s.t}s ease-in-out ${s.d}s infinite` }} />)}
      <span className="absolute -top-1/4 left-0 h-[150%] w-40 bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--cyan)_10%,transparent)] to-transparent blur-2xl" style={{ animation: "fin-beam 14s ease-in-out infinite" }} />
      <div className="absolute inset-x-[-20%] bottom-[-10%] h-[45%] opacity-40"><div className="fin-floor h-full w-full" /></div>
    </div>
  );
}

/** Cartão que inclina em 3D seguindo o mouse, com reflexo de luz. */
export function Tilt({ children, className = "", max = 10, style }: { children: ReactNode; className?: string; max?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null), glare = useRef<HTMLSpanElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || e.pointerType === "touch") return;
    const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
    if (glare.current) { glare.current.style.opacity = "1"; glare.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, oklch(1 0 0 / 28%), transparent 55%)`; }
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; if (glare.current) glare.current.style.opacity = "0"; };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`relative transition-transform duration-300 ease-out [transform-style:preserve-3d] ${className}`} style={style}>
      {children}
      <span ref={glare} aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-[1.4rem] opacity-0 mix-blend-overlay transition-opacity duration-300" />
    </div>
  );
}

/** Ilustração de órbitas: anéis girando, planetas e um núcleo brilhante. */
export function OrbitArt({ size = 260, children }: { size?: number; children?: ReactNode }) {
  const c = size / 2;
  const rings = [{ r: c * 0.93, dur: 38, col: "var(--violet)", dot: 0 }, { r: c * 0.74, dur: 26, col: "var(--cyan)", dot: 1 }, { r: c * 0.58, dur: 18, col: "var(--emerald)", dot: 2 }];
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-[22%] rounded-full bg-gradient-brand opacity-30 blur-2xl" style={{ animation: "fin-breathe 5s ease-in-out infinite" }} />
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <radialGradient id="orb-core" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="var(--background)" /><stop offset="70%" stopColor="var(--background)" stopOpacity=".85" /><stop offset="100%" stopColor="var(--cyan)" stopOpacity=".5" /></radialGradient>
        </defs>
        {rings.map((g, i) => (
          <g key={i} style={{ transformOrigin: `${c}px ${c}px`, animation: `${i % 2 ? "fin-spin-rev" : "fin-spin"} ${g.dur}s linear infinite` }}>
            <circle cx={c} cy={c} r={g.r} fill="none" stroke={g.col} strokeOpacity=".28" strokeWidth="1" strokeDasharray={i === 1 ? "2 7" : i === 2 ? "14 10" : undefined} />
            <circle cx={c + g.r} cy={c} r={i === 0 ? 5 : 4} fill={g.col} style={{ filter: `drop-shadow(0 0 8px ${g.col})` }} />
            {i === 0 && <circle cx={c - g.r * 0.7} cy={c - g.r * 0.71} r={2.5} fill="var(--amber)" style={{ filter: "drop-shadow(0 0 6px var(--amber))" }} />}
          </g>
        ))}
        <circle cx={c} cy={c} r={c * 0.44} fill="url(#orb-core)" opacity=".85" />
        <circle cx={c} cy={c} r={c * 0.44} fill="none" stroke="var(--cyan)" strokeOpacity=".45" strokeWidth="1.2" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Título de seção grande, com selo em fonte mono e uma linha de luz. */
export function SectionTitle({ kicker, title, accent, sub, right }: { kicker: string; title: string; accent: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3" style={{ animation: "fin-rise .6s both" }}>
      <div>
        <p className="mono-caps flex items-center gap-2"><span className="relative grid h-2 w-2 place-items-center"><span className="absolute h-2 w-2 rounded-full bg-cyan" style={{ animation: "fin-pulse 2s ease-out infinite" }} /><span className="h-1.5 w-1.5 rounded-full bg-cyan" /></span>{kicker}</p>
        <h2 className="mt-1 font-serif text-4xl leading-none md:text-5xl">{title} <span className="text-gradient italic">{accent}</span></h2>
        {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
        <span aria-hidden className="mt-3 block h-px w-40 bg-gradient-to-r from-cyan via-violet to-transparent" />
      </div>
      {right}
    </div>
  );
}

/** Bloco de destaque grande (topo das abas), com moldura de luz e grade de pontos. */
export function HeroPanel({ children, className = "", glow = "var(--cyan)", ...rest }: { children: ReactNode; className?: string; glow?: string } & Record<string, unknown>) {
  return (
    <section {...rest} className={`fin-frame glass relative overflow-hidden rounded-[2rem] p-5 sm:p-7 ${className}`} style={{ animation: "fin-rise .7s both", boxShadow: `inset 0 1px 0 oklch(1 0 0 / 7%), 0 40px 100px -50px ${glow}` }}>
      <div aria-hidden className="fin-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_left,#000,transparent_70%)]" />
      <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: glow }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-[var(--violet)] opacity-20 blur-3xl" />
      <div className="relative">{children}</div>
    </section>
  );
}

/** Pequeno indicador com ponto pulsando ("ao vivo"). */
export function LiveDot({ color = "var(--emerald)", label }: { color?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.68rem] font-medium" style={{ color, borderColor: `color-mix(in oklab, ${color} 35%, transparent)`, background: `color-mix(in oklab, ${color} 10%, transparent)` }}>
      <span className="relative grid h-2 w-2 place-items-center"><span className="absolute h-2 w-2 rounded-full" style={{ background: color, animation: "fin-pulse 1.8s ease-out infinite" }} /><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /></span>{label}
    </span>
  );
}
