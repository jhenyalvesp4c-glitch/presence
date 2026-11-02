import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarClock, FolderKanban, Plus, Sparkles, Target, X, Zap } from "lucide-react";
import { PlanShell, Panel, colorVar, tint } from "@/components/PlanShell";
import { loadProjects, saveProjects, seedProjects, type Project } from "@/lib/projects";

export const Route = createFileRoute("/projetos")({
  head: () => ({
    meta: [
      { title: "Presence · Projetos" },
      { name: "description", content: "Todos os seus projetos em um painel futurista, com progresso e demandas." },
      { property: "og:title", content: "Presence · Projetos" },
      { property: "og:description", content: "Veja, crie e acompanhe seus projetos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjetosPage,
});

const colors: Project["color"][] = ["cyan", "violet", "emerald", "amber", "rose"];

function Ring({ value, color, size = 96 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 1.2s ease" }} />
    </svg>
  );
}

function Spark({ seed, color }: { seed: number; color: string }) {
  const pts = Array.from({ length: 12 }, (_, i) => 30 - (Math.sin(i * 0.9 + seed) * 10 + i * 1.6));
  const d = pts.map((y, i) => `${i === 0 ? "M" : "L"}${(i / 11) * 160},${y}`).join(" ");
  const id = `sg${seed}`;
  return (
    <svg viewBox="0 0 160 40" className="h-10 w-full">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.45" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L160,40 L0,40 Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

function MiniSpark({ seed, color }: { seed: number; color: string }) {
  // Arredondado para o servidor e o navegador gerarem exatamente o mesmo SVG (evita aviso de hidratação).
  const pts = Array.from({ length: 16 }, (_, i) => Math.round((20 - (Math.sin(i * 0.8 + seed) * 5 + Math.cos(i * 1.4 + seed * 0.7) * 4)) * 100) / 100);
  const d = pts.map((y, i) => `${i === 0 ? "M" : "L"}${(i / 15) * 120},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 120 24" preserveAspectRatio="none" className="mt-2 h-6 w-full opacity-90">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      {pts.map((y, i) => (
        <circle key={i} cx={(i / 15) * 120} cy={y} r={1.3} fill={color} opacity={0.85}
          style={{ animation: `pulse-ring ${2 + (i % 3) * 0.6}s ease-in-out infinite`, animationDelay: `${i * 0.12}s`, transformOrigin: `${(i / 15) * 120}px ${y}px` }} />
      ))}
    </svg>
  );
}

function Orbit({ projects }: { projects: Project[] }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      {[1, 0.72, 0.44].map((s, i) => (
        <div key={s} className="absolute inset-0 m-auto rounded-full border border-dashed"
          style={{ width: `${s * 100}%`, height: `${s * 100}%`, borderColor: "color-mix(in oklab, var(--cyan) 25%, transparent)", animation: `rail-spin ${30 + i * 12}s linear infinite ${i % 2 ? "reverse" : ""}` }}>
          {projects.filter((_, j) => j % 3 === i).map((p, k) => (
            <span key={p.id} className="absolute h-3 w-3 rounded-full"
              style={{ background: colorVar(p.color), boxShadow: `0 0 12px ${colorVar(p.color)}`, top: `${50 - 50 * Math.cos(k * 2.3 + i)}%`, left: `${50 + 50 * Math.sin(k * 2.3 + i)}%`, transform: "translate(-50%,-50%)" }} />
          ))}
        </div>
      ))}
      <div className="absolute inset-0 m-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-brand shadow-[0_0_60px_-6px_var(--cyan)] animate-pulse-ring">
        <FolderKanban className="text-primary-foreground" size={34} />
      </div>
    </div>
  );
}

function ProjetosPage() {
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"Todos" | Project["status"]>("Todos");

  useEffect(() => setProjects(loadProjects()), []);
  const update = (l: Project[]) => { setProjects(l); saveProjects(l); };

  const stats = useMemo(() => {
    const total = projects.reduce((a, p) => a + p.demands, 0);
    const done = projects.reduce((a, p) => a + p.done, 0);
    const avg = projects.length ? Math.round(projects.reduce((a, p) => a + p.progress, 0) / projects.length) : 0;
    return { total, done, avg };
  }, [projects]);

  const shown = filter === "Todos" ? projects : projects.filter((p) => p.status === filter);

  return (
    <PlanShell active={2}>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel c="cyan" className="scan-line overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-24 w-full opacity-40"
            style={{ background: "radial-gradient(60% 100% at 30% 100%, color-mix(in oklab, var(--violet) 18%, transparent), transparent 70%)" }} />
          <p className="mono-caps relative">Central de projetos</p>
          <h1 className="relative mt-2 font-display text-4xl font-semibold">Seus <span className="text-gradient">projetos</span></h1>
          <p className="relative mt-2 max-w-md text-muted-foreground">Escolha um projeto para abrir suas demandas, ou crie um novo universo de trabalho.</p>
          <div className="relative mt-6 grid grid-cols-3 gap-3">
            {[
              { l: "Projetos", v: projects.length, I: FolderKanban, c: "cyan", s: 1 },
              { l: "Demandas", v: stats.total, I: Target, c: "violet", s: 2 },
              { l: "Concluídas", v: stats.done, I: Zap, c: "emerald", s: 3 },
            ].map(({ l, v, I, c, s }) => (
              <div key={l} className="accent-card p-4" style={tint(c)}>
                <div className="flex items-center justify-between">
                  <span className="icon-tile h-9 w-9"><I size={17} /></span>
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: colorVar(c), boxShadow: `0 0 10px ${colorVar(c)}`, animation: "pulse-ring 2.2s ease-in-out infinite" }} />
                </div>
                <p className="mt-3 font-display text-3xl font-semibold">{v}</p>
                <p className="mono-caps !text-[0.6rem]">{l}</p>
                <MiniSpark seed={s} color={colorVar(c)} />
              </div>
            ))}
          </div>
          <button onClick={() => setOpen(true)} className="shine relative mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-3 font-medium text-primary-foreground shadow-[0_0_30px_-6px_var(--cyan)] transition hover:scale-105">
            <Plus size={18} /> Novo projeto
          </button>
        </Panel>
        <Panel c="violet" className="flex flex-col items-center justify-center gap-4">
          <Orbit projects={projects} />
          <div className="text-center">
            <p className="mono-caps">Progresso médio</p>
            <p className="font-display text-3xl font-semibold text-gradient">{stats.avg}%</p>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["Todos", "Ativo", "Planejando", "Pausado"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`tag !px-4 !py-1.5 transition ${filter === f ? "shadow-[0_0_16px_-4px_var(--glow)]" : "opacity-60 hover:opacity-100"}`} style={tint(filter === f ? "cyan" : "violet")}>{f}</button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((p, i) => {
          const col = colorVar(p.color);
          return (
            <Link key={p.id} to="/demandas" search={{ projeto: p.id }} className="accent-card group block p-5 animate-rise" style={{ ["--glow" as string]: col, animationDelay: `${i * 0.08}s` }}>
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-3xl transition group-hover:opacity-60" style={{ background: col }} />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="tag">{p.status}</span>
                  <h3 className="mt-3 truncate font-display text-xl font-semibold">{p.name}</h3>
                  <p className="truncate text-sm text-muted-foreground">{p.desc}</p>
                </div>
                <div className="relative grid place-items-center">
                  <Ring value={p.progress} color={col} size={76} />
                  <span className="absolute font-display text-sm font-semibold">{p.progress}%</span>
                </div>
              </div>
              <div className="relative mt-4"><Spark seed={i + 1} color={col} /></div>
              <div className="relative mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Target size={14} style={{ color: col }} /> {p.done}/{p.demands} demandas</span>
                <span className="flex items-center gap-1.5"><CalendarClock size={14} /> {new Date(p.due + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
              </div>
              <span className="absolute bottom-5 right-5 grid h-8 w-8 translate-y-2 place-items-center rounded-full opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100" style={{ background: col }}>
                <ArrowUpRight size={16} className="text-primary-foreground" />
              </span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="glass group relative grid min-h-[230px] place-items-center overflow-hidden rounded-3xl border-dashed transition hover:shadow-[0_0_40px_-12px_var(--cyan)]">
          <span aria-hidden className="pointer-events-none absolute inset-0 m-auto h-44 w-44 rounded-full border border-dashed opacity-25 transition group-hover:opacity-60"
            style={{ borderColor: "color-mix(in oklab, var(--cyan) 45%, transparent)", animation: "rail-spin 24s linear infinite" }} />
          <span aria-hidden className="pointer-events-none absolute inset-0 m-auto h-28 w-28 rounded-full border border-dashed opacity-20 transition group-hover:opacity-50"
            style={{ borderColor: "color-mix(in oklab, var(--violet) 55%, transparent)", animation: "rail-spin 16s linear infinite reverse" }} />
          <span className="relative flex flex-col items-center gap-3 text-muted-foreground group-hover:text-cyan">
            <span className="grid h-14 w-14 place-items-center rounded-full border border-dashed border-current transition group-hover:rotate-90"><Plus /></span>
            Criar projeto
          </span>
        </button>
      </div>

      {open && <NewProject onClose={() => setOpen(false)} onCreate={(p) => { update([p, ...projects]); setOpen(false); }} />}
    </PlanShell>
  );
}

function NewProject({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Project) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [color, setColor] = useState<Project["color"]>("cyan");
  const [status, setStatus] = useState<Project["status"]>("Planejando");
  const input = "w-full rounded-xl border border-input bg-background/40 px-4 py-2.5 outline-none transition focus:border-[color:var(--cyan)] focus:shadow-[0_0_16px_-6px_var(--cyan)]";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate({ id: crypto.randomUUID(), name: name.trim(), desc: desc.trim() || "Novo projeto", color, status, progress: 0, demands: 0, done: 0, due: due || new Date().toISOString().slice(0, 10) });
      }} className="glass w-full max-w-md rounded-3xl p-6 animate-rise" style={tint(color)}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Sparkles size={18} className="text-[color:var(--glow)]" /> Novo projeto</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X /></button>
        </div>
        <div className="mt-5 space-y-3">
          <input autoFocus required placeholder="Nome do projeto" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          <input placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} className={input} />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
          <div className="flex gap-2">
            {(["Planejando", "Ativo", "Pausado"] as const).map((s) => (
              <button type="button" key={s} onClick={() => setStatus(s)} className={`tag flex-1 !py-2 ${status === s ? "" : "opacity-50"}`}>{s}</button>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="mono-caps">Cor</span>
            {colors.map((c) => (
              <button type="button" key={c} aria-label={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full transition ${color === c ? "scale-125 ring-2 ring-foreground/60" : "opacity-70"}`} style={{ background: colorVar(c), boxShadow: `0 0 12px ${colorVar(c)}` }} />
            ))}
          </div>
        </div>
        <button type="submit" className="shine mt-6 w-full rounded-full bg-gradient-brand py-3 font-medium text-primary-foreground">Criar projeto</button>
      </form>
    </div>
  );
}
