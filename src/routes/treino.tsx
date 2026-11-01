import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight, BarChart3, Calendar, Check, CheckCircle2, Clock, Dumbbell, Flame, Layers, Minus, Pause, Pencil, Play, Plus, Target, Timer,
} from "lucide-react";
import { PlanShell, Panel, tint } from "@/components/PlanShell";
import orb from "@/assets/treino-orb.jpg";
import musculos from "@/assets/treino-musculos.jpg";

export const Route = createFileRoute("/treino")({
  head: () => ({
    meta: [
      { title: "Presence · Meu treino" },
      { name: "description", content: "Seu treino do dia, divisão semanal, evolução de cargas e timer de descanso." },
      { property: "og:title", content: "Presence · Meu treino" },
      { property: "og:description", content: "Treino de hoje, divisão semanal e evolução de cargas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Treino,
});

const fade = { maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)" };

const semana = [
  { d: "Seg", t: "Glúteo + Posterior", done: true }, { d: "Ter", t: "Cardio + Abdômen" }, { d: "Qua", t: "Glúteo + Perna" },
  { d: "Qui", t: "Cardio + Superiores (leve)" }, { d: "Sex", t: "Glúteo + Posterior", hoje: true }, { d: "Sáb", t: "Livre / Mobilidade" }, { d: "Dom", t: "Descanso" },
];

type Ex = { n: string; m: string; s: string; r: string };
const fichas: Record<string, Ex[]> = {
  "Glúteo e Posterior": [
    { n: "Elevação de quadril", m: "Máquina / Glúteo", s: "3 x 12–15", r: "60s" },
    { n: "Stiff", m: "Posterior de coxa", s: "3 x 10–12", r: "60s" },
    { n: "Flexora", m: "Posterior de coxa", s: "3 x 12–15", r: "45s" },
    { n: "Abdutora", m: "Glúteo (lateral)", s: "3 x 15–20", r: "45s" },
    { n: "Adutora", m: "Parte interna da coxa", s: "3 x 15–20", r: "45s" },
    { n: "Agachamento máquina", m: "Glúteo e quadríceps", s: "3 x 10–12", r: "60s" },
  ],
  "Glúteo e Perna": [
    { n: "Agachamento livre", m: "Quadríceps e glúteo", s: "4 x 8–10", r: "90s" },
    { n: "Leg press", m: "Quadríceps", s: "3 x 12", r: "60s" },
    { n: "Afundo", m: "Glúteo e quadríceps", s: "3 x 10 cada", r: "60s" },
    { n: "Cadeira extensora", m: "Quadríceps", s: "3 x 15", r: "45s" },
    { n: "Panturrilha em pé", m: "Panturrilha", s: "4 x 15", r: "45s" },
    { n: "Glúteo na polia", m: "Glúteo máximo", s: "3 x 12 cada", r: "45s" },
  ],
};

const cargas = [62, 78, 90, 100, 110];

function Head({ Icon, t, d, right }: { Icon: typeof Dumbbell; t: string; d?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="icon-tile h-11 w-11 shrink-0 !rounded-full"><Icon size={19} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-semibold">{t}</h2>
        {d && <p className="text-xs text-muted-foreground">{d}</p>}
      </div>
      {right}
    </div>
  );
}

function Treino() {
  const [ficha, setFicha] = useState<keyof typeof fichas>("Glúteo e Posterior");
  const [done, setDone] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [carga, setCarga] = useState<Record<number, string>>({});
  const [rest, setRest] = useState(90);
  const [left, setLeft] = useState(90);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [toast, setToast] = useState("");
  const exs = fichas[ficha]!;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((s) => (s <= 1 ? (setRunning(false), setToast("Descanso finalizado! Próxima série."), rest) : s - 1)), 1000);
    return () => clearInterval(id);
  }, [running, rest]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 2800); return () => clearTimeout(id); }, [toast]);

  const toggle = (i: number) => setDone((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const adj = (d: number) => { const v = Math.max(15, Math.min(300, rest + d)); setRest(v); setLeft(v); };
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const pct = Math.round((done.size / exs.length) * 100);

  const stats = [
    { Icon: Dumbbell, t: "Treino de hoje", v: ficha, c: "cyan", hl: true },
    { Icon: Clock, t: "Duração estimada", v: "60 min", c: "violet" },
    { Icon: Layers, t: "Exercícios", v: `${done.size}/${exs.length}`, c: "violet" },
  ];

  const max = 120, min = 50, W = 300, H = 110;
  const pts = cargas.map((c, i) => [10 + (i * (W - 20)) / (cargas.length - 1), H - ((c - min) / (max - min)) * H] as const);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");

  return (
    <PlanShell active={5}>
      <section className="grid items-center gap-5 px-2 lg:grid-cols-[auto_auto_minmax(0,1fr)]">
        <div className="animate-rise">
          <p className="mono-caps mb-2 !tracking-[0.4em] text-muted-foreground">Saúde &amp; Performance</p>
          <h1 className="font-serif text-5xl leading-tight">Meu <span className="text-gradient">treino</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Sua evolução começa com consistência.</p>
        </div>
        <div className="mx-auto h-40 w-48 animate-rise">
          <img src={orb} alt="" width={816} height={816} className="h-full w-full object-contain animate-float" style={fade} />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map(({ Icon, t, v, c, hl }, i) => (
            <div key={t} className="glass rounded-2xl p-4 animate-rise" style={{ ...tint(c), animationDelay: `${0.1 + i * 0.06}s` }}>
              <Icon size={22} style={{ color: "var(--glow)" }} />
              <p className="mt-2 text-xs text-muted-foreground">{t}</p>
              <p className={`font-display font-semibold leading-tight ${hl ? "text-base text-cyan" : "text-2xl"}`}>{v}</p>
            </div>
          ))}
          <div className="glass rounded-2xl p-4 animate-rise" style={tint("cyan")}>
            <BarChart3 size={22} className="text-cyan" />
            <p className="mt-2 text-xs text-muted-foreground">Progresso semanal</p>
            <div className="flex items-center gap-3">
              <p className="font-display text-2xl font-semibold">{started ? 4 : 3}/5</p>
              <div className="h-1.5 flex-1 rounded-full bg-secondary"><div className="h-full rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)] transition-all" style={{ width: `${(started ? 4 : 3) * 20}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.75fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-5">
          <Panel c="cyan">
            <Head Icon={Calendar} t="Divisão semanal" d="Seu plano de treino da semana." />
            <ul className="space-y-2">
              {semana.map((s) => (
                <li key={s.d} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${s.hoje ? "border-cyan bg-[color-mix(in_oklab,var(--cyan)_10%,transparent)] shadow-[0_0_20px_-8px_var(--cyan)]" : "border-border/60"}`}>
                  <span className="w-9 font-medium">{s.d}</span>
                  <Dumbbell size={14} className="text-violet" />
                  <span className="flex-1 truncate text-foreground/85">{s.t}</span>
                  {s.done && <CheckCircle2 size={16} className="text-emerald" />}
                  {s.hoje && <Play size={13} className="fill-cyan text-cyan" />}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel c="violet">
            <Head Icon={Target} t="Meta da semana" />
            <div className="flex justify-between text-sm"><span>{started ? 4 : 3} de 5 treinos</span><span>{(started ? 4 : 3) * 20}%</span></div>
            <div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${(started ? 4 : 3) * 20}%` }} /></div>
          </Panel>
        </div>

        <Panel c="cyan">
          <Head Icon={Dumbbell} t="Treino de hoje" d={`${ficha} · ${exs.length} exercícios · ~60 minutos · ${pct}% concluído`}
            right={<button onClick={() => { setFicha((f) => (f === "Glúteo e Posterior" ? "Glúteo e Perna" : "Glúteo e Posterior")); setDone(new Set()); setCarga({}); setToast("Treino trocado."); }}
              className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm transition hover:border-cyan/60"><ArrowLeftRight size={15} /> Trocar treino</button>} />
          <ul className="divide-y divide-border/50">
            {exs.map((e, i) => (
              <li key={e.n} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-sm">{i + 1}</span>
                  <span className="icon-tile grid h-12 w-16 shrink-0 place-items-center !rounded-xl" style={tint(i % 2 ? "violet" : "cyan")}><Dumbbell size={20} /></span>
                  <div className="min-w-[9rem] flex-[1_1_10rem]">
                    <p className={`truncate text-sm font-medium ${done.has(i) ? "text-muted-foreground line-through" : ""}`}>{e.n}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.m}</p>
                  </div>
                  <div className="w-20 shrink-0 text-xs"><p>{e.s}</p><p className="flex items-center gap-1 text-muted-foreground"><Timer size={11} /> {e.r}</p></div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <button onClick={() => setOpen(open === i ? null : i)} className="hidden items-center gap-1 whitespace-nowrap rounded-full border border-cyan/50 px-3 py-1.5 text-[0.7rem] text-cyan md:flex"><Play size={11} /> Ver execução</button>
                    <button onClick={() => setOpen(open === i + 100 ? null : i + 100)} className="hidden items-center gap-1 whitespace-nowrap rounded-full border border-violet/50 px-3 py-1.5 text-[0.7rem] text-violet md:flex"><Dumbbell size={11} /> {carga[i] ? `${carga[i]} kg` : "Registrar carga"}</button>
                    <button onClick={() => toggle(i)} aria-label="Concluir exercício" className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${done.has(i) ? "border-cyan bg-cyan text-primary-foreground" : "border-border"}`}>{done.has(i) && <Check size={14} />}</button>
                  </div>
                </div>
                {open === i && <p className="ml-11 mt-2 rounded-xl border border-cyan/30 p-3 text-xs text-muted-foreground animate-rise">Execução: mantenha a postura neutra, controle a descida em 2–3s e contraia o músculo-alvo no topo. Respire na fase de esforço.</p>}
                {open === i + 100 && (
                  <form className="ml-11 mt-2 flex items-center gap-2 animate-rise" onSubmit={(ev) => { ev.preventDefault(); const v = new FormData(ev.currentTarget).get("kg"); if (v) { setCarga((c) => ({ ...c, [i]: String(v) })); setOpen(null); setToast(`Carga de ${v} kg registrada em ${e.n}.`); } }}>
                    <input name="kg" type="number" min={0} max={500} autoFocus placeholder="kg" className="w-24 rounded-full border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-violet" />
                    <button className="rounded-full bg-violet px-3 py-1.5 text-xs text-primary-foreground">Salvar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel c="violet">
            <Head Icon={Layers} t="Resumo muscular" d="Grupos trabalhados hoje." />
            <div className="flex flex-wrap items-center gap-2">
              <img src={musculos} alt="Mapa muscular com glúteos e posterior destacados" loading="lazy" width={816} height={816} className="h-40 w-40 shrink-0 object-contain" style={fade} />
              <ul className="space-y-2 text-xs">
                {["Glúteos", "Posterior de coxa", "Lateral da coxa", "Adutores"].map((m, i) => (
                  <li key={m} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: i < 2 ? "var(--violet)" : "var(--cyan)" }} />{m}</li>
                ))}
              </ul>
            </div>
          </Panel>
          <Panel c="cyan">
            <Head Icon={Calendar} t="Último treino" d="Seg, 27 de Out" right={<span className="tag" style={tint("emerald")}><Check size={12} /> Concluído</span>} />
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[[Clock, "58 min"], [Dumbbell, "6 exercícios"], [Flame, "420 kcal"]].map(([I, t]) => {
                const Ic = I as typeof Clock;
                return <span key={t as string} className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 py-2"><Ic size={13} className="text-cyan" />{t as string}</span>;
              })}
            </div>
          </Panel>
          <Panel c="violet">
            <Head Icon={BarChart3} t="Evolução de cargas" d="Elevação de quadril (carga máxima)" right={<span className="tag" style={tint("violet")}>{carga[0] ?? 110} kg</span>} />
            <svg viewBox={`-12 -10 ${W + 24} ${H + 30}`} className="h-36 w-full">
              <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--violet)" stopOpacity=".35" /><stop offset="1" stopColor="var(--violet)" stopOpacity="0" /></linearGradient></defs>
              <path d={`${path} L${pts.at(-1)![0]},${H} L${pts[0]![0]},${H} Z`} fill="url(#g)" />
              <path d={path} fill="none" stroke="var(--violet)" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 4px var(--violet))" }} />
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="var(--foreground)" />)}
              {pts.map(([x], i) => <text key={i} x={x} y={H + 18} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">Sem {i + 1}</text>)}
            </svg>
          </Panel>
        </div>
      </div>

      <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
        <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-4" style={tint("cyan")}>
          <span className="icon-tile h-11 w-11 !rounded-full"><Timer size={19} /></span>
          <div className="flex-1"><p className="font-display font-semibold">Timer de descanso</p><p className="text-xs text-muted-foreground">Pronto para o próximo exercício?</p></div>
          <button onClick={() => adj(-15)} aria-label="Menos 15 segundos" className="grid h-9 w-9 place-items-center rounded-full border border-border"><Minus size={15} /></button>
          <span className="font-display text-4xl font-semibold tabular-nums">{mm}:{ss}</span>
          <button onClick={() => adj(15)} aria-label="Mais 15 segundos" className="grid h-9 w-9 place-items-center rounded-full border border-border"><Plus size={15} /></button>
          <button onClick={() => setRunning((r) => !r)} aria-label={running ? "Pausar" : "Iniciar"} className="grid h-12 w-12 place-items-center rounded-full border-2 border-cyan text-cyan shadow-[0_0_20px_-4px_var(--cyan)]">{running ? <Pause size={20} /> : <Play size={20} className="fill-cyan" />}</button>
        </div>
        <button onClick={() => { setStarted(true); setToast("Treino iniciado! Bora 💪"); }} className="flex items-center justify-center gap-3 rounded-full py-4 font-display text-xl font-semibold text-primary-foreground shadow-[0_0_40px_-10px_var(--cyan)]" style={{ background: "linear-gradient(90deg, var(--cyan), var(--violet))" }}>
          {started ? <><Check size={22} /> Treino em andamento</> : <><Play size={22} /> Iniciar treino</>}
        </button>
        <div className="flex gap-3">
          <button onClick={() => setToast("Edição da ficha disponível em breve (demonstração).")} className="glass flex items-center gap-2 rounded-2xl px-5 py-4 text-sm"><Pencil size={17} /> Editar ficha</button>
          <button onClick={() => setToast("Histórico: 12 treinos neste mês (demonstração).")} className="glass flex items-center gap-2 rounded-2xl px-5 py-4 text-sm"><BarChart3 size={17} /> Histórico</button>
        </div>
      </div>

      {toast && <div role="status" className="glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm text-cyan animate-rise">{toast}</div>}
    </PlanShell>
  );
}
