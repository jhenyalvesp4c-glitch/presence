import { useEffect, useRef } from "react";
import orb from "@/assets/presence-orb-v2.jpg";

// Sphere geometry inside presence-orb-v2.jpg (percent of width/height)
const CX = 49.8, CY = 44.3, R = 20.6, RC = 23.4;

export function LivingOrb({ active }: { active: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const cols = ["--cyan", "--violet", "--emerald"].map((v) => css.getPropertyValue(v).trim());
    const motes = Array.from({ length: 70 }, (_, i) => ({ a: Math.random() * 6.28, r: 1.05 + Math.random() * 0.9, s: (Math.random() * 0.5 + 0.2) * (i % 2 ? 1 : -1), z: Math.random(), c: cols[i % 3]!, tw: Math.random() * 6 }));
    const ripples: { t: number }[] = [];
    let raf = 0, t = 0, amp = 0, voice = 0, rot = 0, last = performance.now(), nextRipple = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const on = activeRef.current;
      amp += ((on ? 1 : 0) - amp) * 0.06;
      // simulated speech envelope: layered noise when listening
      const target = on ? 0.35 + 0.65 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1) * Math.sin(t * 11.7 + 2)) : 0;
      voice += (target - voice) * 0.25;
      const breath = Math.sin(t * 1.25) * 0.5 + 0.5; // ~5s breath cycle
      const scale = 1 + breath * 0.025 + voice * 0.06;
      rot = Math.sin(t * 0.35) * (4 + amp * 10);
      if (core.current) {
        core.current.style.transform = `rotate(${rot}deg) scale(${scale})`;
        core.current.style.filter = `brightness(${1 + breath * 0.15 + voice * 0.5}) saturate(${1 + amp * 0.4}) hue-rotate(${Math.sin(t * 0.4) * 12 - amp * 25}deg)`;
      }
      if (wrap.current) {
        wrap.current.style.transform = `translateY(${Math.sin(t * 0.8) * -6}px)`;
        wrap.current.style.setProperty("--halo", String(0.35 + breath * 0.25 + voice * 0.6));
      }

      const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const cx = (w * CX) / 100, cy = (h * CY) / 100, rad = (w * R) / 100 * scale;
      ctx.globalCompositeOperation = "lighter";

      // voice ripples
      if (on && t > nextRipple) { ripples.push({ t: 0 }); nextRipple = t + 0.35 + Math.random() * 0.4; }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]!; rp.t += dt;
        const k = rp.t / 1.6; if (k >= 1) { ripples.splice(i, 1); continue; }
        ctx.globalAlpha = (1 - k) * 0.5; ctx.strokeStyle = cols[i % 2 ? 1 : 0]!; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, rad * (1 + k * 0.8), 0, Math.PI * 2); ctx.stroke();
      }

      // drifting motes orbiting the presence
      for (const m of motes) {
        m.a += dt * m.s * (0.4 + amp * 1.6);
        const rr = rad * (m.r + voice * 0.15 * Math.sin(m.tw + t * 4));
        const x = cx + Math.cos(m.a) * rr, y = cy + Math.sin(m.a) * rr * 0.42 + Math.sin(m.a * 2 + m.tw) * rad * 0.12;
        const front = Math.sin(m.a) > 0;
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + m.tw);
        ctx.globalAlpha = (front ? 0.9 : 0.3) * tw;
        ctx.fillStyle = m.c;
        ctx.beginPath(); ctx.arc(x, y, (front ? 1.8 : 1) + m.z, 0, Math.PI * 2); ctx.fill();
      }

      // inner sparks (life inside the core)
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4 + t * (0.6 + i * 0.03), d = rad * (0.25 + ((i * 37) % 60) / 100);
        ctx.globalAlpha = (0.3 + 0.7 * Math.abs(Math.sin(t * 3 + i))) * (0.4 + voice);
        ctx.fillStyle = cols[i % 3]!;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, 1.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const circle = `circle(${RC}% at ${CX}% ${CY}%)`;
  const mask = "radial-gradient(closest-side, black 70%, transparent)";

  return (
    <div ref={wrap} className="relative h-full w-full" style={{ ["--halo" as string]: 0.4 }}>
      {/* breathing halo */}
      <div className="absolute rounded-full blur-3xl transition-colors duration-700"
        style={{ left: `${CX - R * 1.1}%`, top: `${CY - R * 1.45}%`, width: `${R * 2.2}%`, aspectRatio: "1", opacity: "var(--halo)" as unknown as number,
          background: `radial-gradient(circle, color-mix(in oklab, var(--${active ? "emerald" : "cyan"}) 55%, transparent), color-mix(in oklab, var(--violet) 25%, transparent) 55%, transparent 72%)` }} />
      {/* static: platform + orbits */}
      <img src={orb} alt="Orbe Presence" width={1024} height={768} className="absolute inset-0 h-full w-full object-contain mix-blend-screen" style={{ maskImage: mask, WebkitMaskImage: mask }} />
      {/* living core: sphere rotates, breathes, reacts */}
      <div ref={core} className="absolute inset-0 will-change-transform" style={{ transformOrigin: `${CX}% ${CY}%`, clipPath: circle }}>
        <img src={orb} alt="" width={1024} height={768} className="h-full w-full object-contain" />
      </div>
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
