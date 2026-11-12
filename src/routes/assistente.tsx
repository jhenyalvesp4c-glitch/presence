import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import {
  ArrowRight, AudioLines, BarChart3, Bookmark, Brain, Calendar, CalendarCheck, ClipboardList, Dumbbell, Heart, Home,
  Layers, Lightbulb, ListChecks, Mic, Puzzle, Settings, Sparkles, Sun, Sprout, SquarePlus, Wallet, CreditCard,
  Workflow, Loader2, Trash2, X,
} from "lucide-react";
import { LivingOrb } from "@/components/LivingOrb";
import { InboxPanel } from "@/components/inbox/InboxPanel";
import { ActionChooser, type HomeAction } from "@/components/home/ActionChooser";
import { OrionPanel } from "@/components/orion/OrionPanel";
import { useVoice } from "@/lib/voice/use-voice";
import { useHome } from "@/lib/use-home";
import { useSpeech } from "@/lib/use-speech";
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

const rail: { Icon: typeof Home; label: string; c: string; to?: "/saude" | "/projetos" | "/tarefas" | "/planejamento" | "/cerebro" }[] = [
  { Icon: Home, label: "Início", c: "cyan" },
  { Icon: ClipboardList, label: "Demandas", c: "violet", to: "/projetos" },
  { Icon: ListChecks, label: "Tarefas", c: "cyan", to: "/tarefas" },
  { Icon: Wallet, label: "Financeiro", c: "emerald" },
  { Icon: Calendar, label: "Agenda", c: "cyan", to: "/planejamento" },
  { Icon: BarChart3, label: "Progresso", c: "violet" },
  { Icon: Heart, label: "Saúde", c: "emerald", to: "/saude" },
  { Icon: Brain, label: "Segundo cérebro", c: "violet", to: "/cerebro" },
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
  { img: imgRotina, Icon: Calendar, t: "Rotina do dia", d: ["Veja seus compromissos", "e tarefas de hoje"], c: "violet", to: "/tarefas" as const },
  { img: imgSaude, Icon: Heart, t: "Saúde e bem-estar", d: ["Treino, dieta, hábitos", "e evolução"], c: "emerald", to: "/saude" as const },
  { img: imgFoco, Icon: Layers, t: "Foco e produtividade", d: ["Organize seus projetos", "e prioridades"], c: "cyan", to: "/projetos" as const },
  { img: imgFin, Icon: BarChart3, t: "Controle financeiro", d: ["Acompanhe seus gastos", "e metas"], c: "cyan" },
  { img: imgProj, Icon: Lightbulb, t: "Projetos e ideias", d: ["Registre e desenvolva", "suas ideias"], c: "violet" },
];

function RailIcon({ Icon, label, c, on = false, to, onClick, delay = "0s" }: {
  Icon: typeof Home; label: string; c: string; on?: boolean;
  to?: "/saude" | "/projetos" | "/tarefas" | "/planejamento" | "/cerebro" | undefined; onClick?: () => void; delay?: string;

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

  const home = useHome();
  const voice = useVoice();
  const [text, setText] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  // Central de entrada: texto, prints e arquivos interpretados e levados ao módulo certo.
  // Painel aberto abaixo do botão: registrar demanda (Central de entrada) ou Orion (documentar / perguntar).
  const [panel, setPanel] = useState<HomeAction | null>(null);
  const [chooser, setChooser] = useState(false);
  const inboxOpen = panel === "demand";
  const setInboxOpen = (v: boolean | ((o: boolean) => boolean)) => setPanel((p) => ((typeof v === "function" ? v(p === "demand") : v) ? "demand" : p === "demand" ? null : p));
  const panelRef = useRef<HTMLDivElement>(null);
  const pick = (a: HomeAction) => { setChooser(false); setPanel(a); setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120); };
  const [incoming, setIncoming] = useState<{ id: number; text: string } | null>(null);
  const [active, setActive] = useState(0);
  const voiceTarget = useRef<"chat" | "demand">("chat");
  const convoEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    convoEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [home.messages.length, home.thinking]);

  useEffect(() => {
    if (home.error) toast.error(home.error);
  }, [home.error]);

  const speech = useSpeech((spoken) => {
    if (voiceTarget.current === "demand") { setInboxOpen(true); setIncoming({ id: Date.now(), text: spoken }); }
    else void home.ask(spoken);
  });
  const listening = speech.listening;

  function toggleVoice(target: "chat" | "demand") {
    if (speech.listening) return speech.stop();
    voiceTarget.current = target;
    if (!speech.start()) {
      // Navegador sem reconhecimento de voz: cai para digitação.
      if (target === "demand") setInboxOpen(true);
      else setChatOpen(true);
    }
  }

  function send(message: string) {
    setText("");
    void home.ask(message);
  }


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
              <span className="mono-caps hidden !text-[0.65rem] sm:inline">{listening || voice.phase === "listening" ? "Ouvindo…" : voice.phase === "speaking" ? "Falando…" : home.thinking || voice.phase === "thinking" ? "Pensando…" : "Standby"}</span>
              <span className="h-8 w-px bg-border" />
              <button onClick={voice.toggle} className="icon-tile h-11 w-11 !rounded-full" style={tint("cyan")} aria-label="Voz" data-testid="voz-cabecalho"><AudioLines size={18} /></button>
            </div>
          </header>

          {/* Hero: text · orb (centered) · quick actions */}
          <section className="grid items-center gap-6 px-[3%] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.8fr)] sm:gap-2">
            <div className="flex animate-rise flex-col items-center text-center sm:items-start sm:justify-self-start sm:text-left" style={{ animationDelay: ".1s" }}>
              <p className="mono-caps mb-3">Olá{home.displayName ? `, ${home.displayName}` : ""} <span className="text-violet">✦</span></p>
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

            <button onClick={voice.toggle} aria-label="Tocar para falar" data-testid="orbe"
              className="relative mx-auto aspect-[4/3] w-[clamp(240px,36vw,620px)] shrink-0 animate-rise" style={{ animationDelay: ".2s" }}>
              <div className="pointer-events-none absolute inset-0 origin-center scale-[1.12] sm:scale-[1.32] md:scale-[1.36] lg:scale-[1.45] xl:scale-[1.55]">
                <div className="absolute inset-[12%] rounded-full blur-3xl transition" style={{ background: `color-mix(in oklab, var(--${listening ? "emerald" : "cyan"}) ${listening ? 38 : 26}%, transparent)` }} />
                <div className="absolute inset-[30%] rounded-full blur-2xl transition" style={{ background: `color-mix(in oklab, var(--violet) ${listening ? 30 : 20}%, transparent)` }} />
                <LivingOrb active={listening || voice.phase === "listening" || voice.phase === "speaking"} />
              </div>

            </button>

            <div className="mx-auto flex w-full max-w-xs animate-rise flex-col items-stretch gap-3 sm:mx-0 sm:w-36 lg:w-40 sm:max-w-none sm:justify-self-start">
              {quick.map(({ Icon, label, c }, i) => {
                const cls = "glass flex items-center justify-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-[0.82rem] text-muted-foreground transition hover:text-foreground hover:shadow-[0_0_28px_-8px_var(--glow)] sm:justify-start sm:[&:nth-child(2)]:translate-x-5";
                const st = { ...tint(c), animationDelay: `${0.3 + i * 0.1}s` };
                const inner = (<><Icon size={19} style={{ color: "var(--glow)" }} /><span className="leading-snug">{label[0]}<br />{label[1]}</span></>);
                return i < 2
                  ? <Link key={i} to={i === 0 ? "/organizar" : "/treino"} className={cls} style={st}>{inner}</Link>
                  : <button key={i} onClick={() => send(label.join(" "))} className={cls} style={st}>{inner}</button>;
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
              <button onClick={() => (listening ? speech.stop() : setChooser(true))} data-testid="registrar-demanda" className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-full py-5 text-base font-semibold text-primary-foreground shadow-[0_0_50px_-12px_var(--cyan)] transition hover:shadow-[0_0_60px_-8px_var(--violet)]"
                style={{ background: "linear-gradient(90deg, var(--cyan), oklch(0.66 0.19 265) 55%, var(--violet))" }}>
                <Mic size={22} className={listening ? "animate-pulse-ring" : ""} /> {listening ? (speech.interim || "Ouvindo…") : "Registrar demanda"}
              </button>
              <button onClick={() => setInboxOpen((o) => !o)} className={`icon-tile h-16 w-16 shrink-0 !rounded-2xl transition hover:scale-105 ${inboxOpen ? "shadow-[0_0_30px_-6px_var(--glow)]" : ""}`} style={tint("violet")} aria-label="Central de entrada: texto, prints e arquivos" aria-expanded={inboxOpen} title="Enviar texto, prints, PDFs e documentos" data-testid="abrir-central"><SquarePlus size={20} /></button>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {prompts.map(({ Icon, t }) => (
                <button key={t} onClick={() => send(t)} disabled={home.thinking}
                  className="glass flex shrink-0 items-center gap-3 rounded-full px-5 py-3 text-sm text-foreground/85 transition hover:text-foreground hover:shadow-[0_0_20px_-8px_var(--cyan)]">
                  <Icon size={18} className="text-violet" /> {t}
                </button>
              ))}
            </div>

            {home.pendingCount !== null && (
              <p className="text-center text-xs text-muted-foreground">
                {home.pendingCount === 0 ? "Nenhuma demanda em aberto" : `${home.pendingCount} demanda${home.pendingCount > 1 ? "s" : ""} em aberto`}
              </p>
            )}

            <div ref={panelRef}>
              {inboxOpen && <InboxPanel incoming={incoming} onClose={() => setPanel(null)} onListen={() => toggleVoice("demand")} listening={listening} interim={speech.interim} />}
              {(panel === "doc" || panel === "ask") && (
                <section className="glass relative mx-auto w-full max-w-3xl rounded-3xl p-4 animate-rise sm:p-5" data-testid="painel-orion-inicio" style={tint(panel === "doc" ? "violet" : "emerald")}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="icon-tile h-10 w-10 !rounded-2xl"><Sparkles size={17} /></span>
                    <div className="mr-auto"><p className="mono-caps !text-[0.62rem]">Orion · segundo cérebro</p><h3 className="font-display text-lg font-semibold leading-tight">{panel === "doc" ? "Documentar" : "Perguntar"}</h3></div>
                    <button onClick={() => setChooser(true)} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-cyan">Trocar</button>
                    <button onClick={() => setPanel(null)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
                  </div>
                  <OrionPanel key={panel} initialMode={panel} autoFocus />
                </section>
              )}
            </div>
            {chooser && <ActionChooser onPick={pick} onClose={() => setChooser(false)} />}

            {(home.messages.length > 0 || home.thinking) && (
              <div className="glass mx-auto max-h-[420px] w-full max-w-3xl space-y-3 overflow-y-auto rounded-3xl p-5">
                <div className="flex items-center justify-between">
                  <span className="mono-caps !text-[0.65rem]">Conversa</span>
                  <button onClick={() => void home.clearConversation()} className="text-muted-foreground transition hover:text-foreground" aria-label="Limpar conversa"><Trash2 size={15} /></button>
                </div>
                {home.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-[color-mix(in_oklab,var(--cyan)_16%,transparent)] text-foreground" : "bg-secondary/70 text-foreground/90"}`}>
                      {m.content}
                    </p>
                  </div>
                ))}
                {home.thinking && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin text-cyan" /> Presence está pensando…</div>
                )}
                <div ref={convoEnd} />
              </div>
            )}

            {(chatOpen || text || home.messages.length > 0) && (
              <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(text); }} className="glass mx-auto flex w-full max-w-3xl items-center gap-3 rounded-full p-2 pl-5">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Fale com a Presence…" maxLength={4000}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none" autoFocus={chatOpen} disabled={home.thinking} />
                <button type="submit" disabled={home.thinking || !text.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-gradient-brand text-primary-foreground disabled:opacity-50" aria-label="Enviar"><ArrowRight size={16} /></button>
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
