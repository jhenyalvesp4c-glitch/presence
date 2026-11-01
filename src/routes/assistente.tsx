import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import {
  ArrowRight, AudioLines, BarChart3, Bookmark, Calendar, CalendarCheck, ClipboardList, Dumbbell, Heart, Home,
  Layers, Lightbulb, ListChecks, LogOut, Mic, Puzzle, Settings, Sparkles, Sun, Sprout, SquarePlus, Wallet, CreditCard,
  Workflow,
} from "lucide-react";
import { LivingOrb } from "@/components/LivingOrb";
import imgRotina from "@/assets/card-rotina.jpg";
import imgSaude from "@/assets/card-saude.jpg";
import imgFoco from "@/assets/card-foco.jpg";
import imgFin from "@/assets/card-financeiro.jpg";
import imgProj from "@/assets/card-projetos.jpg";

export const Route = createFileRoute("/assistente")({
  head: () => ({
    meta: [
      { title: "Presence · Assistente pessoal" },
      { name: "description", content: "Fale com Presence, seu assistente pessoal para rotina, saúde, foco, finanças e projetos." },
      { property: "og:title", content: "Presence · Assistente pessoal" },
      { property: "og:description", content: "Seu assistente pessoal futurista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Assistente,
});

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;

const rail: { Icon: typeof Home; label: string; c: string; to?: "/saude" | "/demandas" }[] = [
  { Icon: Home, label: "Início", c: "cyan" },
  { Icon: ClipboardList, label: "Demandas", c: "violet", to: "/demandas" },
  { Icon: ListChecks, label: "Tarefas", c: "cyan" },
  { Icon: Wallet, label: "Financeiro", c: "emerald" },
  { Icon: Calendar, label: "Agenda", c: "cyan" },
  { Icon: BarChart3, label: "Progresso", c: "violet" },
  { Icon: Heart, label: "Saúde", c: "emerald", to: "/saude" },
  { Icon: Puzzle, label: "Integrações", c: "cyan" },
  { Icon: Workflow, label: "Fluxos", c: "violet" },
  { Icon: Settings, label: "Ajustes", c: "cyan" },
];


const quick = [
  { Icon: CalendarCheck, label: ["Organize", "meu dia"], c: "cyan" },
  { Icon: Dumbbell, label: ["Mostrar", "meu treino"], c: "violet" },
  { Icon: BarChart3, label: ["Como estou", "progredindo?"], c: "emerald" },
];

const prompts = [
  { Icon: Sparkles, t: "Minhas tarefas" }, { Icon: Sun, t: "Tenho algo pra hoje?" }, { Icon: Sprout, t: "Como estão meus hábitos?" },
  { Icon: CreditCard, t: "Como está meu financeiro?" }, { Icon: Heart, t: "Meu patrimônio" }, { Icon: Bookmark, t: "Meus lembretes" },
];

const cards = [
  { img: imgRotina, Icon: Calendar, t: "Rotina do dia", d: ["Veja seus compromissos", "e tarefas de hoje"], c: "violet" },
  { img: imgSaude, Icon: Heart, t: "Saúde e bem-estar", d: ["Treino, dieta, hábitos", "e evolução"], c: "emerald", to: "/saude" as const },
  { img: imgFoco, Icon: Layers, t: "Foco e produtividade", d: ["Organize seus projetos", "e prioridades"], c: "cyan", to: "/demandas" as const },
  { img: imgFin, Icon: BarChart3, t: "Controle financeiro", d: ["Acompanhe seus gastos", "e metas"], c: "cyan" },
  { img: imgProj, Icon: Lightbulb, t: "Projetos e ideias", d: ["Registre e desenvolva", "suas ideias"], c: "violet" },
];

function RailIcon({ Icon, label, c, on = false, to, onClick, delay = "0s" }: {
  Icon: typeof Home; label: string; c: string; on?: boolean;
  to?: "/saude" | "/demandas" | undefined; onClick?: () => void; delay?: string;

}) {
  const cls = `group relative grid h-10 w-10 place-items-center rounded-full transition duration-500 hover:-translate-y-0.5 hover:scale-[1.14] ${
    on ? "bg-[color-mix(in_oklab,var(--glow)_14%,transparent)] text-[color:var(--glow)] shadow-[inset_0_0_20px_-6px_var(--glow)]" : "text-muted-foreground/55 hover:text-[color:var(--glow)]"
  }`;

  return (
    <div className="rail-float" style={{ animationDelay: delay } as CSSProperties}>
      {to ? (
        <Link to={to} aria-label={label} className={cls} style={tint(c)}>
          <RailBits Icon={Icon} label={label} on={on} />
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} className={cls} style={tint(c)}>
          <RailBits Icon={Icon} label={label} on={on} />
        </button>
      )}
    </div>
  );
}

function RailBits({ Icon, label, on }: { Icon: typeof Home; label: string; on: boolean }) {
  return (
    <>
      <span aria-hidden className={`rail-halo transition-opacity duration-500 ${on ? "opacity-75" : "opacity-0 group-hover:opacity-100"}`} />
      <span aria-hidden className={`rail-ring transition-opacity duration-700 ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />

      <Icon size={19} className="relative z-10 transition duration-500 group-hover:-rotate-6" />
      <span aria-hidden className={`rail-label -translate-x-1.5 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 ${on ? "group-hover:opacity-100" : ""}`}>{label}</span>
    </>
  );
}

function Assistente() {

  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(8);

  return (
    <div className="min-h-screen p-3 [background:radial-gradient(60%_50%_at_50%_30%,color-mix(in_oklab,var(--cyan)_7%,transparent),transparent_70%),oklch(0.11_0.025_265)]">
      <div className="mx-auto flex w-full max-w-[1680px] items-stretch gap-4">
        {/* Rail — floating icons */}
        <aside className="sticky top-3 z-30 hidden h-[calc(100vh-1.5rem)] w-16 shrink-0 flex-col items-start pl-3 md:flex">


          <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
            {rail.map(({ Icon, label, c, to }, i) => (
              <RailIcon key={label} Icon={Icon} label={label} c={c} to={to} on={i === active}
                onClick={() => setActive(i)} delay={`${(i % 5) * 0.7}s`} />
            ))}
          </div>
          <RailIcon Icon={LogOut} label="Sair" c="violet" delay="2.4s" />
        </aside>


        <main className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Header */}
          <header className="glass flex items-center justify-between rounded-3xl px-6 py-4 animate-rise">
            <div className="flex items-center gap-5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan shadow-[0_0_12px_var(--cyan)] animate-pulse-ring" />
              <span className="font-display text-xl font-semibold tracking-[0.35em] text-cyan">PRESENCE</span>
              <span className="tag hidden !px-4 !py-1.5 sm:inline" style={tint("violet")}>Assistente pessoal</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: listening ? "var(--emerald)" : "var(--cyan)", boxShadow: "0 0 8px currentColor" }} />
              <span className="mono-caps hidden !text-[0.65rem] sm:inline">{listening ? "Ouvindo…" : "Standby"}</span>
              <span className="h-8 w-px bg-border" />
              <button onClick={() => setListening((l) => !l)} className="icon-tile h-11 w-11 !rounded-full" style={tint("cyan")} aria-label="Voz"><AudioLines size={18} /></button>
            </div>
          </header>

          {/* Hero: text · orb (centered) · quick actions */}
          <section className="grid items-center gap-6 px-[3%] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.8fr)] sm:gap-2">
            <div className="flex animate-rise flex-col items-center text-center sm:items-start sm:justify-self-start sm:text-left" style={{ animationDelay: ".1s" }}>
              <p className="mono-caps mb-3">Olá, Jheny <span className="text-violet">✦</span></p>
              <h1 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-[clamp(1.9rem,4.2vw,4.25rem)]">
                Como posso<br /><span className="text-gradient">te ajudar hoje?</span>
              </h1>
              <p className="mt-5 max-w-sm text-[0.95rem] leading-relaxed text-muted-foreground">
                Organize sua rotina, acompanhe seus objetivos e conte com a Presence para facilitar seu dia.
              </p>
              <Link to="/planejamento" className="glass group mt-7 inline-flex items-center gap-4 rounded-full px-6 py-3 text-sm transition hover:shadow-[0_0_30px_-8px_var(--cyan)]">
                <Sparkles size={18} className="text-cyan" /> "Planeje meu dia de hoje"
                <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </Link>
            </div>

            <button onClick={() => setListening((l) => !l)} aria-label="Tocar para falar"
              className="relative mx-auto aspect-[4/3] w-[clamp(240px,36vw,620px)] shrink-0 animate-rise" style={{ animationDelay: ".2s" }}>
              <div className="pointer-events-none absolute inset-0 origin-center scale-[1.12] sm:scale-[1.32] md:scale-[1.36] lg:scale-[1.45] xl:scale-[1.55]">
                <div className="absolute inset-[12%] rounded-full blur-3xl transition" style={{ background: `color-mix(in oklab, var(--${listening ? "emerald" : "cyan"}) ${listening ? 38 : 26}%, transparent)` }} />
                <div className="absolute inset-[30%] rounded-full blur-2xl transition" style={{ background: `color-mix(in oklab, var(--violet) ${listening ? 30 : 20}%, transparent)` }} />
                <LivingOrb active={listening} />
              </div>

            </button>

            <div className="mx-auto flex w-full max-w-xs animate-rise flex-col items-stretch gap-3 sm:mx-0 sm:w-36 lg:w-40 sm:max-w-none sm:justify-self-start">
              {quick.map(({ Icon, label, c }, i) => {
                const cls = "glass flex items-center justify-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-[0.82rem] text-muted-foreground transition hover:text-foreground hover:shadow-[0_0_28px_-8px_var(--glow)] sm:justify-start sm:[&:nth-child(2)]:translate-x-5";
                const st = { ...tint(c), animationDelay: `${0.3 + i * 0.1}s` };
                const inner = (<><Icon size={19} style={{ color: "var(--glow)" }} /><span className="leading-snug">{label[0]}<br />{label[1]}</span></>);
                return i < 2
                  ? <Link key={i} to={i === 0 ? "/organizar" : "/treino"} className={cls} style={st}>{inner}</Link>
                  : <button key={i} onClick={() => setText(label.join(" "))} className={cls} style={st}>{inner}</button>;
              })}
            </div>
          </section>

          <p className="-mt-4 text-center">
            <span className="mono-caps mx-auto block w-fit rounded-full bg-[oklch(0.11_0.025_265/0.85)] px-5 shadow-[0_0_0_7px_oklch(0.11_0.025_265/0.85)] !text-[0.72rem] !tracking-[0.3em] !text-foreground">
              Toque <span className="text-cyan">para falar</span> · ou diga <span className="text-cyan">Presence</span>
            </span>
          </p>


          {/* Action */}
          <div className="w-full space-y-4 px-[3%] animate-rise" style={{ animationDelay: ".3s" }}>
            <div className="flex items-center gap-4">
              <button onClick={() => setListening((l) => !l)} className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-full py-5 text-base font-semibold text-primary-foreground shadow-[0_0_50px_-12px_var(--cyan)] transition hover:shadow-[0_0_60px_-8px_var(--violet)]"
                style={{ background: "linear-gradient(90deg, var(--cyan), oklch(0.66 0.19 265) 55%, var(--violet))" }}>
                <Mic size={22} className={listening ? "animate-pulse-ring" : ""} /> {listening ? "Ouvindo…" : "Registrar demanda"}
              </button>
              <Link to="/demandas" className="icon-tile h-16 w-16 shrink-0 !rounded-2xl transition hover:scale-105" style={tint("violet")} aria-label="Nova demanda"><SquarePlus size={20} /></Link>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {prompts.map(({ Icon, t }) => (
                <button key={t} onClick={() => setText(t)}
                  className="glass flex shrink-0 items-center gap-3 rounded-full px-5 py-3 text-sm text-foreground/85 transition hover:text-foreground hover:shadow-[0_0_20px_-8px_var(--cyan)]">
                  <Icon size={18} className="text-violet" /> {t}
                </button>
              ))}
            </div>

            {text && (
              <form onSubmit={(e) => { e.preventDefault(); setText(""); }} className="glass flex items-center gap-3 rounded-full p-2 pl-5">
                <input value={text} onChange={(e) => setText(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" autoFocus />
                <button type="submit" className="grid h-10 w-10 place-items-center rounded-full bg-gradient-brand text-primary-foreground" aria-label="Enviar"><ArrowRight size={16} /></button>
              </form>
            )}
          </div>

          {/* Cards */}
          <section className="grid gap-4 pb-2 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map(({ img, Icon, t, d, c, to }, i) => {
              const body = (
                <>
                  <img src={img} alt="" loading="lazy" width={992} height={672} className="absolute inset-0 h-[65%] w-full object-cover opacity-80 transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_10%,oklch(0.13_0.03_262)_62%)]" />
                  <div className="relative mt-auto p-5">
                    <div className="flex items-center gap-3">
                      <span className="icon-tile h-10 w-10 shrink-0 !rounded-full"><Icon size={18} /></span>
                      <span className="text-[0.95rem] font-semibold leading-tight">{t}</span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p className="text-sm leading-relaxed text-muted-foreground">{d[0]}<br />{d[1]}</p>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary/80 transition group-hover:translate-x-1 group-hover:text-[color:var(--glow)]"><ArrowRight size={16} /></span>
                    </div>
                  </div>
                </>
              );
              const cls = "accent-card group flex h-56 flex-col text-left animate-rise";
              const st = { ...tint(c), animationDelay: `${0.4 + i * 0.08}s` };
              return to ? <Link key={t} to={to} className={cls} style={st}>{body}</Link> : <button key={t} className={cls} style={st}>{body}</button>;
            })}
          </section>
        </main>
      </div>
    </div>
  );
}
