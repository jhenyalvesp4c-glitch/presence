/**
 * Cursos: catálogo + área de estudo (trilhas, aulas, simulado, flashcards, laboratório, glossário, anotações, fontes e backup).
 * Visual do Orion (fundo animado, painel com moldura de luz, anéis, cartões 3D). Progresso só no navegador (localStorage), sem banco.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { AlertTriangle, BookMarked, BookOpen, Brain, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Database, Download, ExternalLink, GraduationCap, Layers, Library, MessageSquareText, RotateCw, Search, ShieldAlert, ShieldCheck, Sparkles, Trash2, Trophy, Upload, X } from "lucide-react";

import { Meter, RadialRings, Ring, Sparkline, useCountUp } from "@/components/finance/charts";
import { FinBackdrop, HeroPanel, LiveDot, SectionTitle, Tilt } from "@/components/finance/fx";
import { COURSES, lessonsOf, minutesOf, type Course, type Lesson } from "@/lib/courses";
import { backupJson, empty, load, parseBackup, save, type Store } from "@/lib/courses/storage";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const TONES = ["cyan", "violet", "emerald", "amber", "pink", "cyan"] as const;
const fmtDate = (iso: string) => iso.split("-").reverse().join("/");
type Tab = "visao" | "aulas" | "prova" | "cards" | "lab" | "glossario" | "notas" | "fontes" | "dados";
const TABS: [Tab, string, typeof BookOpen][] = [["visao", "Visão geral", Layers], ["aulas", "Trilhas e aulas", BookOpen], ["prova", "Simulado", ClipboardCheck], ["cards", "Flashcards", Brain], ["lab", "Laboratório", MessageSquareText], ["glossario", "Glossário", BookMarked], ["notas", "Anotações", GraduationCap], ["fontes", "Fontes", Library], ["dados", "Dados", Database]];

function Verified({ v }: { v: string | null }) {
  return v ? <span className="tag inline-flex items-center gap-1.5 whitespace-nowrap !py-0.5 !text-[0.7rem]" style={tint("emerald")} title="Conferido nas fontes oficiais nesta data"><ShieldCheck size={11} /> Verificado em {fmtDate(v)}</span>
    : <span className="tag inline-flex items-center gap-1.5 whitespace-nowrap !py-0.5 !text-[0.7rem]" style={tint("amber")} title="Ainda não conferido nas fontes oficiais"><ShieldAlert size={11} /> Verificação pendente</span>;
}

export function CoursesPage() {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const course = COURSES.find((c) => c.id === courseId) ?? null;
  return (
    <main className="relative mx-auto min-h-screen max-w-[1500px] px-4 pb-32 pt-6 md:py-8" data-testid="pagina-cursos"><FinBackdrop />
      {!mounted ? null : course ? <CourseArea key={course.id} course={course} onBack={() => setCourseId(null)} /> : <Catalog onOpen={setCourseId} />}
    </main>
  );
}

function progressOf(course: Course, store: Store) {
  const lessons = lessonsOf(course), done = lessons.filter((l) => store.completed.includes(l.id)).length;
  return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
}

function Catalog({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionTitle kicker="Aprender" title="Seus" accent="cursos" sub="Trilhas de estudo com fontes oficiais e data de verificação. O progresso fica só neste navegador." right={<LiveDot color="var(--cyan)" label="uso local" />} />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {COURSES.map((c, i) => { const p = progressOf(c, load(c.id)), mins = lessonsOf(c).reduce((a, l) => a + minutesOf(l.duration), 0); return (
          <div key={c.id} style={{ animation: `fin-pop .55s ${i * 0.08}s both` }}>
            <Tilt max={9}>
              <button onClick={() => onOpen(c.id)} data-testid={`curso-${c.id}`} className="ex-card block w-full p-5 text-left" style={{ "--rail": `var(--${c.tone})` } as CSSProperties}>
                <div className="flex items-start gap-4">
                  <span className="icon-tile h-14 w-14 shrink-0 !rounded-2xl shadow-[0_0_28px_-6px_var(--glow)]" style={tint(c.tone)}><GraduationCap size={26} /></span>
                  <div className="min-w-0 flex-1"><p className="mono-caps">{c.audience}</p><h3 className="font-display text-xl font-semibold">{c.title}</h3><p className="mt-1 text-xs text-muted-foreground">{c.tagline}</p></div>
                  <Ring pct={p.pct} color={`var(--${c.tone})`} size={64} thickness={6}><span className="text-xs font-semibold tabular-nums">{p.pct}%</span></Ring>
                </div>
                <div className="mt-4"><Meter pct={p.pct} color={`var(--${c.tone})`} height={5} warn={false} /></div>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground"><span><BookOpen size={11} className="mr-1 inline" />{c.modules.length} trilhas · {p.total} aulas</span><span><Clock3 size={11} className="mr-1 inline" />~{mins} min</span><span><ClipboardCheck size={11} className="mr-1 inline" />{c.quiz.length} questões</span></p>
              </button>
            </Tilt>
          </div>); })}
        <div className="grid min-h-[11rem] place-items-center rounded-[1.25rem] border border-dashed border-white/15 p-5 text-center text-xs text-muted-foreground"><div><Sparkles size={20} className="mx-auto mb-2 text-cyan" />Novos cursos entram aqui.<br />Mande o conteúdo e eu monto a trilha.</div></div>
      </div>
    </div>
  );
}

function CourseArea({ course, onBack }: { course: Course; onBack: () => void }) {
  const lessons = useMemo(() => lessonsOf(course), [course]), ids = useMemo(() => lessons.map((l) => l.id), [lessons]);
  const [store, setStore] = useState<Store>(() => load(course.id, ids));
  const [tab, setTab] = useState<Tab>("visao");
  const [selLesson, setSelLesson] = useState(lessons[0]!.id);
  const [saveFailed, setSaveFailed] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { setSaveFailed(!save(course.id, store)); }, [store, course.id]);

  const p = progressOf(course, store), lesson = lessons.find((l) => l.id === selLesson) ?? lessons[0]!;
  const moduleOf = (id: string) => course.modules.find((m) => m.lessons.some((l) => l.id === id))!;
  const next = lessons.find((l) => !store.completed.includes(l.id)) ?? lessons[0]!;
  const minutesLeft = lessons.filter((l) => !store.completed.includes(l.id)).reduce((a, l) => a + minutesOf(l.duration), 0);
  const verified = lessons.filter((l) => l.verified).length, lastVerified = lessons.map((l) => l.verified).filter((v): v is string => !!v).sort().slice(-1)[0] ?? null;
  const go = (t: Tab) => { setTab(t); window.setTimeout(() => top.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 0); };
  const open = (id: string) => { setSelLesson(id); go("aulas"); };
  const pct = useCountUp(p.pct, 900);

  return (
    <div className="space-y-5" ref={top}>
      <div className="flex flex-wrap items-center gap-3"><button onClick={onBack} className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-muted-foreground transition hover:text-foreground">← Cursos</button><span className="mono-caps">Curso</span></div>
      {saveFailed && <div role="alert" className="flex items-center gap-2 rounded-2xl border border-amber/40 bg-amber/10 px-4 py-2.5 text-xs text-amber"><AlertTriangle size={14} /> O navegador não conseguiu gravar (armazenamento cheio ou bloqueado). Baixe um backup na aba Dados.</div>}

      <HeroPanel glow={`var(--${course.tone})`} data-testid="curso-hero">
        <div className="grid items-center gap-6 lg:grid-cols-[1.3fr_auto_1fr]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5"><p className="mono-caps">{course.audience}</p><Verified v={lastVerified} /></div>
            <h1 className="mt-2 font-serif text-5xl leading-[0.95] tracking-tight md:text-6xl">{course.title.split(" ")[0]} <span className="text-gradient inline-block pr-3 italic">{course.title.split(" ").slice(1).join(" ")}</span></h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">{course.tagline}</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button onClick={() => open(next.id)} data-testid="curso-continuar" className="flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2.5 text-sm font-semibold text-background shadow-[0_0_28px_-6px_var(--cyan)] transition active:scale-95">{p.done ? "Continuar estudando" : "Começar a estudar"} <ChevronRight size={16} /></button>
              <button onClick={() => go("prova")} className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-muted-foreground transition hover:text-foreground"><ClipboardCheck size={15} /> Fazer simulado</button>
            </div>
          </div>
          <div className="flex justify-center"><Ring pct={p.pct} size={190} thickness={14} color="var(--cyan)"><div className="text-center"><p className="font-display text-4xl font-semibold tabular-nums">{Math.round(pct)}%</p><p className="text-[0.65rem] text-muted-foreground">{p.done}/{p.total} aulas</p><p className="text-[0.62rem] text-muted-foreground">{minutesLeft ? `~${minutesLeft} min restantes` : "tudo concluído"}</p></div></Ring></div>
          <div className="hidden justify-center lg:flex"><RadialRings size={190} thickness={9} items={course.modules.map((m, i) => ({ id: m.id, label: m.title, color: `var(--${TONES[i % TONES.length]})`, pct: Math.round((m.lessons.filter((l) => store.completed.includes(l.id)).length / m.lessons.length) * 100) }))} center={<div><p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">trilhas</p><p className="font-display text-xl font-semibold">{course.modules.length}</p></div>} /></div>
        </div>
      </HeroPanel>

      <div role="tablist" className="glass flex gap-1 overflow-x-auto rounded-2xl p-1.5" aria-label="Seções do curso">
        {TABS.map(([k, l, I]) => <button key={k} role="tab" aria-selected={tab === k} data-testid={`curso-aba-${k}`} onClick={() => go(k)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition ${tab === k ? "bg-[color-mix(in_oklab,var(--cyan)_15%,transparent)] text-cyan shadow-[0_0_20px_-8px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}><I size={15} /> {l}</button>)}
      </div>

      {tab === "visao" && <Overview course={course} store={store} verified={verified} lastVerified={lastVerified} next={next} onOpen={open} onTab={go} />}
      {tab === "aulas" && <Lessons course={course} store={store} setStore={setStore} lesson={lesson} onSelect={(id) => { setSelLesson(id); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} moduleOf={moduleOf} lessons={lessons} />}
      {tab === "prova" && <Quiz course={course} store={store} setStore={setStore} />}
      {tab === "cards" && <Flashcards course={course} />}
      {tab === "lab" && <Lab course={course} store={store} setStore={setStore} />}
      {tab === "glossario" && <Glossary course={course} />}
      {tab === "notas" && <Notes store={store} setStore={setStore} />}
      {tab === "fontes" && <Sources course={course} lastVerified={lastVerified} verified={verified} total={p.total} onOpen={open} />}
      {tab === "dados" && <Data course={course} store={store} setStore={setStore} ids={ids} />}
    </div>
  );
}

function Overview({ course, store, verified, lastVerified, next, onOpen, onTab }: { course: Course; store: Store; verified: number; lastVerified: string | null; next: Lesson; onOpen: (id: string) => void; onTab: (t: Tab) => void }) {
  const lessons = lessonsOf(course), p = progressOf(course, store);
  const kpis = [["Aulas concluídas", `${p.done}/${p.total}`, "cyan", "do curso"], ["Melhor simulado", store.bestScore ? `${store.bestScore}%` : "—", "violet", `${store.attempts.length} tentativa${store.attempts.length === 1 ? "" : "s"}`], ["Anotações do laboratório", String(Object.values(store.caseNotes).filter(Boolean).length), "emerald", `de ${course.cases.length} casos`], ["Aulas verificadas", `${verified}/${lessons.length}`, "amber", lastVerified ? `até ${fmtDate(lastVerified)}` : "pendente"]] as const;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{kpis.map(([l, v, tone, sub], i) => <div key={l} className="ex-card p-4" style={{ "--rail": `var(--${tone})`, animation: `fin-rise .5s ${i * 0.06}s both` } as CSSProperties}><p className="mono-caps">{l}</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums">{v}</p><p className="mt-0.5 text-[0.7rem] text-muted-foreground">{sub}</p></div>)}</div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <p className="mono-caps">Trilhas de aprendizagem</p>
          {course.modules.map((m, i) => { const n = m.lessons.filter((l) => store.completed.includes(l.id)).length, pct = Math.round((n / m.lessons.length) * 100), tone = TONES[i % TONES.length]!; return (
            <div key={m.id} className="ex-card p-4" style={{ "--rail": `var(--${tone})`, animation: `fin-rise .5s ${i * 0.05}s both` } as CSSProperties}>
              <div className="flex items-start gap-3"><span className="icon-tile h-10 w-10 shrink-0 !rounded-xl font-mono text-xs font-bold" style={tint(tone)}>{String(i + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className="font-display text-base font-semibold">{m.title}</p><p className="text-xs text-muted-foreground">{m.subtitle}</p></div><span className="tag shrink-0 !text-[0.7rem]" style={tint(tone)}>{m.level}</span></div>
              <div className="mt-3 flex items-center gap-3"><div className="min-w-0 flex-1"><Meter pct={pct} color={`var(--${tone})`} height={6} warn={false} /></div><b className="text-xs tabular-nums">{pct}%</b></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{m.lessons.map((l) => { const d = store.completed.includes(l.id); return <button key={l.id} onClick={() => onOpen(l.id)} title={l.title} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] transition ${d ? "border-emerald/50 bg-emerald/10 text-emerald" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{d ? <CheckCircle2 size={11} style={{ animation: "ex-tick .5s both" }} /> : <Clock3 size={11} />}<span className="max-w-[11rem] truncate">{l.title}</span></button>; })}</div>
            </div>); })}
        </div>
        <div className="space-y-5">
          <div className="glass rounded-3xl p-5" style={tint("violet")}>
            <p className="mono-caps">Próximo passo</p>
            <div className="mt-3 flex items-start gap-3"><span className="icon-tile h-11 w-11 shrink-0 !rounded-2xl" style={tint("violet")}><GraduationCap size={20} /></span><div className="min-w-0"><h3 className="font-display text-lg font-semibold leading-tight">{next.title}</h3><p className="mt-1 text-xs text-muted-foreground">{next.summary}</p></div></div>
            <p className="mt-3 text-xs text-muted-foreground"><Clock3 size={12} className="mr-1 inline" />{next.duration} de leitura</p>
            <button onClick={() => onOpen(next.id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-cyan/60 py-2 text-sm text-cyan transition hover:bg-cyan/10">Abrir aula <ChevronRight size={15} /></button>
            <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-[0.7rem] text-muted-foreground">💡 Ao terminar uma aula, anote como o conceito aparece no seu dia a dia de suporte.</p>
          </div>
          <div className="glass rounded-3xl p-5"><div className="flex items-center justify-between"><p className="mono-caps">Evolução nos simulados</p><button onClick={() => onTab("prova")} className="text-[0.7rem] text-cyan hover:underline">fazer simulado</button></div>
            {store.attempts.length ? <><div className="mt-3"><Sparkline values={store.attempts.map((a) => a.score)} width={260} height={64} color="var(--violet)" /></div><p className="mt-2 text-xs text-muted-foreground">{store.attempts.length} tentativa{store.attempts.length === 1 ? "" : "s"} · melhor {store.bestScore}% · última {store.attempts[store.attempts.length - 1]!.score}%</p></> : <p className="mt-3 text-xs text-muted-foreground">Faça o primeiro simulado para ver sua evolução.</p>}</div>
          <p className="flex items-start gap-2 text-[0.7rem] text-muted-foreground"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald" /> Conteúdo conferido nas fontes oficiais {lastVerified ? `em ${fmtDate(lastVerified)}` : "(pendente)"}. <button onClick={() => onTab("fontes")} className="text-cyan hover:underline">Ver fontes e datas</button></p>
        </div>
      </div>
    </div>
  );
}

function Lessons({ course, store, setStore, lesson, onSelect, moduleOf, lessons }: { course: Course; store: Store; setStore: (f: (s: Store) => Store) => void; lesson: Lesson; onSelect: (id: string) => void; moduleOf: (id: string) => Course["modules"][number]; lessons: Lesson[] }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => { const n = q.trim().toLowerCase(); return n ? lessons.filter((l) => (l.title + " " + l.summary + " " + l.content.join(" ") + " " + l.keyPoints.join(" ")).toLowerCase().includes(n)) : []; }, [q, lessons]);
  const mod = moduleOf(lesson.id), idx = lessons.findIndex((l) => l.id === lesson.id), prev = lessons[idx - 1], nxt = lessons[idx + 1], done = store.completed.includes(lesson.id);
  const toggle = () => { setStore((s) => ({ ...s, completed: done ? s.completed.filter((i) => i !== lesson.id) : [...s.completed, lesson.id] })); toast.success(done ? "Aula desmarcada" : "Aula marcada como concluída"); };
  return (
    <div className="space-y-4">
      <label className="glass flex items-center gap-2 rounded-full px-4 py-2.5"><Search size={14} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar em todas as aulas…" aria-label="Pesquisar em todas as aulas" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />{q && <button onClick={() => setQ("")} aria-label="Limpar"><X size={14} /></button>}</label>
      {q.trim() && <div className="grid gap-2 sm:grid-cols-2">{hits.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma aula encontrada.</p> : hits.map((l) => <button key={l.id} onClick={() => { setQ(""); onSelect(l.id); }} className="ex-card p-3 text-left"><p className="text-sm font-medium">{l.title}</p><p className="text-xs text-muted-foreground">{moduleOf(l.id).title} · {l.duration}</p></button>)}</div>}
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="glass space-y-2 rounded-3xl p-3 lg:sticky lg:top-4 lg:max-h-[80vh] lg:self-start lg:overflow-y-auto">
          {course.modules.map((m, i) => { const tone = TONES[i % TONES.length]!; return (
            <div key={m.id}><p className="mono-caps px-2 pb-1 pt-2" style={{ color: `var(--${tone})` }}>{String(i + 1).padStart(2, "0")} · {m.title}</p>
              {m.lessons.map((l) => { const on = l.id === lesson.id, d = store.completed.includes(l.id); return <button key={l.id} onClick={() => onSelect(l.id)} aria-current={on ? "true" : undefined} data-testid={`aula-${l.id}`} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${on ? "bg-cyan/10 text-foreground shadow-[inset_2px_0_0_var(--cyan)]" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}>{d ? <CheckCircle2 size={14} className="shrink-0 text-emerald" /> : <Clock3 size={14} className="shrink-0 opacity-50" />}<span className="min-w-0 flex-1 truncate">{l.title}</span></button>; })}
            </div>); })}
        </aside>
        <article className="glass space-y-5 rounded-3xl p-5 sm:p-7" key={lesson.id} style={{ animation: "fin-rise .4s both" }} data-testid="aula-conteudo">
          <p className="mono-caps">Trilhas <ChevronRight size={10} className="inline" /> {mod.title}</p>
          <div className="flex flex-wrap items-center gap-2.5"><span className="tag !text-[0.7rem]" style={tint("violet")}>{mod.level}</span><span className="text-xs text-muted-foreground"><Clock3 size={12} className="mr-1 inline" />{lesson.duration}</span><Verified v={lesson.verified} /></div>
          <div><h2 className="font-display text-2xl font-semibold leading-tight md:text-3xl">{lesson.title}</h2><p className="mt-2 text-sm text-muted-foreground">{lesson.summary}</p></div>
          <div className="space-y-3.5 text-[0.92rem] leading-relaxed">{lesson.content.map((c, i) => <p key={i}>{c}</p>)}</div>
          <div className="rounded-2xl border border-cyan/30 bg-cyan/5 p-4"><h3 className="flex items-center gap-2 font-display text-base font-semibold"><CheckCircle2 size={16} className="text-cyan" /> O que você precisa guardar</h3><ul className="mt-2 space-y-1.5 text-sm">{lesson.keyPoints.map((k) => <li key={k} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />{k}</li>)}</ul></div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">📚 Fontes oficiais</b><Verified v={lesson.verified} /></div><p className="mt-1.5 text-xs text-muted-foreground">Confira a documentação atualizada antes de aplicar esta orientação. Páginas, preços, limites e telas da Meta mudam.</p><ul className="mt-2 space-y-1.5">{lesson.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm text-cyan hover:underline">{s.title} <ExternalLink size={12} /></a></li>)}</ul></div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><span className="text-xs text-muted-foreground">{done ? <span className="text-emerald"><CheckCircle2 size={14} className="mr-1 inline" />Aula concluída</span> : "Ao terminar, marque a aula como concluída."}</span><button onClick={toggle} data-testid="aula-concluir" className={done ? "rounded-full border border-white/15 px-5 py-2 text-sm" : "rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background"}>{done ? "Concluída ✓ (desmarcar)" : "Marcar como concluída"}</button></div>
          <div className="flex justify-between gap-3"><button disabled={!prev} onClick={() => prev && onSelect(prev.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm disabled:opacity-40 sm:flex-none"><ChevronLeft size={15} /> Anterior</button><button disabled={!nxt} onClick={() => nxt && onSelect(nxt.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm disabled:opacity-40 sm:flex-none">Próxima <ChevronRight size={15} /></button></div>
        </article>
      </div>
    </div>
  );
}

function Quiz({ course, store, setStore }: { course: Course; store: Store; setStore: (f: (s: Store) => Store) => void }) {
  const Q = course.quiz, [started, setStarted] = useState(false), [i, setI] = useState(0), [ans, setAns] = useState<Record<number, number>>({}), [result, setResult] = useState(false);
  const score = Q.filter((q, k) => ans[k] === q.answer).length, pct = Math.round((score / Q.length) * 100);
  const start = () => { setStarted(true); setI(0); setAns({}); setResult(false); };
  const finish = () => { setResult(true); setStore((s) => ({ ...s, answers: ans, bestScore: Math.max(s.bestScore, pct), attempts: [...s.attempts, { at: new Date().toISOString(), score: pct }].slice(-30) })); };
  return (
    <div className="glass mx-auto max-w-3xl rounded-3xl p-6 sm:p-8" data-testid="prova">
      {!started ? <div className="space-y-4 text-center"><span className="icon-tile mx-auto h-16 w-16 !rounded-3xl" style={tint("violet")}><ClipboardCheck size={28} /></span><h2 className="font-display text-2xl font-semibold">Simulado — Fundamentos Meta</h2><p className="text-sm text-muted-foreground">{Q.length} questões · múltipla escolha · explicação de cada resposta ao final</p><button onClick={start} data-testid="prova-iniciar" className="rounded-full bg-gradient-to-r from-cyan to-violet px-6 py-2.5 text-sm font-semibold text-background">Começar avaliação</button>
        {store.bestScore > 0 && <p className="text-sm text-muted-foreground">Sua melhor pontuação: <b className="text-foreground">{store.bestScore}%</b></p>}{store.attempts.length > 0 && <div className="flex justify-center"><Sparkline values={store.attempts.map((a) => a.score)} width={240} height={56} color="var(--violet)" /></div>}</div>
        : result ? <div className="space-y-4"><div className="text-center"><span className="icon-tile mx-auto h-16 w-16 !rounded-3xl" style={tint("emerald")}><Trophy size={28} /></span><h2 className="mt-3 font-display text-2xl font-semibold">Simulado concluído!</h2></div><div className="flex justify-center"><Ring pct={pct} size={150} thickness={12} color="var(--emerald)"><span className="font-display text-3xl font-semibold tabular-nums">{pct}%</span></Ring></div><p className="text-center text-sm text-muted-foreground">Você acertou {score} de {Q.length} questões.</p>
          <div className="space-y-2.5">{Q.map((q, k) => { const ok = ans[k] === q.answer; return <div key={k} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${ok ? "bg-emerald/20 text-emerald" : "bg-destructive/20 text-destructive"}`}>{ok ? "✓" : "×"}</span><div className="min-w-0"><p className="text-sm font-medium">{q.q}</p><p className="mt-0.5 text-xs text-muted-foreground">{q.why}</p>{!ok && <p className="mt-0.5 text-xs font-medium text-emerald">Resposta correta: {q.options[q.answer]}</p>}</div></div>; })}</div>
          <div className="text-center"><button onClick={start} className="inline-flex items-center gap-2 rounded-full border border-cyan/60 px-5 py-2 text-sm text-cyan hover:bg-cyan/10"><RotateCw size={14} /> Refazer simulado</button></div></div>
        : <div className="space-y-5"><div className="flex items-center justify-between text-[0.7rem]"><span className="mono-caps">Questão {i + 1} de {Q.length}</span><span className="tabular-nums text-muted-foreground">{Math.round(((i + 1) / Q.length) * 100)}%</span></div><Meter pct={((i + 1) / Q.length) * 100} color="var(--violet)" height={5} warn={false} />
          <h2 className="font-display text-xl font-semibold leading-snug">{Q[i]!.q}</h2>
          <div className="space-y-2.5" role="radiogroup" aria-label="Alternativas">{Q[i]!.options.map((o, k) => <button key={k} role="radio" aria-checked={ans[i] === k} onClick={() => setAns((a) => ({ ...a, [i]: k }))} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${ans[i] === k ? "border-cyan/70 bg-cyan/10 shadow-[0_0_24px_-10px_var(--cyan)]" : "border-white/10 hover:border-white/25"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${ans[i] === k ? "border-cyan bg-cyan text-background" : "border-white/20"}`}>{String.fromCharCode(65 + k)}</span>{o}</button>)}</div>
          <div className="flex justify-between"><button disabled={i === 0} onClick={() => setI((x) => x - 1)} className="rounded-full border border-white/15 px-4 py-2 text-sm disabled:opacity-40"><ChevronLeft size={14} className="mr-1 inline" />Anterior</button><button disabled={ans[i] === undefined} onClick={() => (i === Q.length - 1 ? finish() : setI((x) => x + 1))} className="rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background disabled:opacity-40">{i === Q.length - 1 ? "Finalizar" : "Próxima"} <ChevronRight size={14} className="ml-1 inline" /></button></div></div>}
    </div>
  );
}

function Flashcards({ course }: { course: Course }) {
  const F = course.flashcards, [i, setI] = useState(0), [flip, setFlip] = useState(false);
  const move = (d: number) => { setI((x) => (x + d + F.length) % F.length); setFlip(false); };
  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="flashcards">
      <p className="mono-caps text-center">Cartão {i + 1} de {F.length}</p>
      <div style={{ perspective: 1200 }}>
        <button onClick={() => setFlip((v) => !v)} aria-label={flip ? "Ver a pergunta" : "Revelar a resposta"} className="relative block h-72 w-full text-left transition-transform duration-500" style={{ transformStyle: "preserve-3d", transform: flip ? "rotateY(180deg)" : "none" }}>
          {[0, 1].map((side) => <span key={side} className={`glass absolute inset-0 flex flex-col justify-center gap-3 rounded-3xl p-8 ${side ? "" : "shadow-[0_0_50px_-20px_var(--cyan)]"}`} style={{ backfaceVisibility: "hidden", transform: side ? "rotateY(180deg)" : "none", ...tint(side ? "emerald" : "cyan") }}>
            <span className="mono-caps" style={{ color: "var(--glow)" }}>{side ? "Resposta" : "Pergunta"}</span><span className="font-display text-xl font-semibold leading-snug md:text-2xl">{F[i]![side]}</span><span className="text-xs text-muted-foreground">Clique para {side ? "ver a pergunta" : "revelar a resposta"}</span></span>)}
        </button>
      </div>
      <div className="flex justify-center gap-3"><button onClick={() => move(-1)} className="rounded-full border border-white/15 px-5 py-2 text-sm"><ChevronLeft size={14} className="mr-1 inline" />Anterior</button><button onClick={() => move(1)} className="rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background">Próximo cartão <ChevronRight size={14} className="ml-1 inline" /></button></div>
    </div>
  );
}

function Lab({ course, store, setStore }: { course: Course; store: Store; setStore: (f: (s: Store) => Store) => void }) {
  const [i, setI] = useState(0), [text, setText] = useState(store.caseNotes[0] ?? "");
  const pick = (k: number) => { setStore((s) => ({ ...s, caseNotes: { ...s.caseNotes, [i]: text } })); setI(k); setText(store.caseNotes[k] ?? ""); };
  const c = course.cases[i]!;
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]" data-testid="lab">
      <div className="space-y-2.5">{course.cases.map((x, k) => <button key={x.title} onClick={() => pick(k)} className={`ex-card block w-full p-4 text-left ${k === i ? "ring-1 ring-cyan/60" : ""}`} style={{ "--rail": "var(--violet)" } as CSSProperties}><p className="mono-caps">Caso 0{k + 1}{store.caseNotes[k] ? " ✓" : ""}</p><p className="mt-1 text-sm font-semibold">{x.title}</p><p className="text-xs text-muted-foreground">{x.level}</p></button>)}</div>
      <div className="glass space-y-4 rounded-3xl p-5 sm:p-6"><div className="flex items-center justify-between"><span className="tag !text-[0.7rem]" style={tint("violet")}>Estudo de caso</span><span className="text-xs text-muted-foreground">{c.level}</span></div><h2 className="font-display text-xl font-semibold">{c.title}</h2><p className="text-sm text-muted-foreground">{c.prompt}</p>
        <label htmlFor="lab-resp" className="mono-caps block">Sua análise e orientação ao cliente</label><textarea id="lab-resp" value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="Descreva o que você investigaria, quais evidências pediria e como orientaria o cliente…" className="w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-sm outline-none focus:border-cyan/60" />
        <button onClick={() => { setStore((s) => ({ ...s, caseNotes: { ...s.caseNotes, [i]: text } })); toast.success("Resposta salva"); }} data-testid="lab-salvar" className="rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background">Salvar minha resposta</button>
        <details className="rounded-2xl border border-white/10 bg-black/20 p-4"><summary className="cursor-pointer text-sm font-medium">Ver pontos esperados e orientação técnica</summary><p className="mt-3 text-sm text-muted-foreground">{c.guidance}</p><ul className="mt-2 space-y-1 text-sm">{c.expected.map((e) => <li key={e} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />{e}</li>)}</ul></details></div>
    </div>
  );
}

function Glossary({ course }: { course: Course }) {
  const [q, setQ] = useState(""), list = course.glossary.filter(([a, b]) => (a + " " + b).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4"><label className="glass flex items-center gap-2 rounded-full px-4 py-2.5"><Search size={14} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar termo ou definição…" aria-label="Buscar no glossário" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map(([t, d], k) => <div key={t} className="ex-card p-4" style={{ "--rail": `var(--${TONES[k % TONES.length]})` } as CSSProperties}><p className="font-display text-base font-semibold">{t}</p><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>)}{list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum termo encontrado.</p>}</div></div>
  );
}

function Notes({ store, setStore }: { store: Store; setStore: (f: (s: Store) => Store) => void }) {
  return (
    <div className="glass mx-auto max-w-3xl space-y-3 rounded-3xl p-5 sm:p-6"><div className="flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-medium"><BookMarked size={16} className="text-cyan" /> Caderno pessoal</p><span className="tag !text-[0.7rem]" style={tint("emerald")}>salvamento automático</span></div>
      <textarea value={store.notes} onChange={(e) => setStore((s) => ({ ...s, notes: e.target.value }))} aria-label="Caderno pessoal" rows={16} placeholder="Escreva aqui seus resumos, dúvidas, exemplos e aprendizados…" className="w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed outline-none focus:border-cyan/60" />
      <p className="text-xs text-muted-foreground">Ficam salvas neste navegador. {store.notes.length > 0 && `${store.notes.length.toLocaleString("pt-BR")} caracteres.`}</p></div>
  );
}

function Sources({ course, lastVerified, verified, total, onOpen }: { course: Course; lastVerified: string | null; verified: number; total: number; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-4" data-testid="fontes">
      <div className="glass flex flex-wrap items-center gap-6 rounded-3xl p-5"><Ring pct={Math.round((verified / total) * 100)} size={96} thickness={9} color="var(--emerald)"><span className="text-sm font-semibold tabular-nums">{verified}/{total}</span></Ring><div className="min-w-0 flex-1"><h3 className="font-display text-lg font-semibold">Última verificação: {lastVerified ? fmtDate(lastVerified) : "—"}</h3><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Aulas com “verificação pendente” ainda não tiveram os fatos conferidos nas fontes oficiais. Trate-as como rascunho e confirme na documentação antes de orientar um cliente. Não é aconselhamento jurídico.</p></div></div>
      {course.modules.map((m) => <div key={m.id} className="glass rounded-3xl p-5"><h3 className="font-display text-base font-semibold">{m.title}</h3>{m.lessons.map((l) => <div key={l.id} className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-white/10 pt-3"><div className="min-w-0"><button onClick={() => onOpen(l.id)} className="text-left text-sm font-medium text-cyan hover:underline">{l.title}</button><ul className="mt-1 space-y-1">{l.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 break-all text-xs text-muted-foreground hover:text-foreground">{s.title} <ExternalLink size={11} /></a></li>)}</ul></div><Verified v={l.verified} /></div>)}</div>)}
    </div>
  );
}

function Data({ course, store, setStore, ids }: { course: Course; store: Store; setStore: (s: Store) => void; ids: string[] }) {
  const file = useRef<HTMLInputElement>(null), [confirm, setConfirm] = useState<"reset" | null>(null);
  const exportData = () => { const a = document.createElement("a"), blob = new Blob([backupJson(course.id, store)], { type: "application/json" }); a.href = URL.createObjectURL(blob); a.download = `${course.id}-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast.success("Backup baixado"); };
  const importData = async (f: File | undefined) => { if (!f) return; try { const next = parseBackup(course.id, await f.text(), ids); setStore(next); toast.success("Backup restaurado"); } catch (e) { toast.error((e as Error).message); } };
  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="dados">
      <div className="glass space-y-3 rounded-3xl p-5"><h3 className="font-display text-lg font-semibold">Armazenamento local</h3><p className="text-sm text-muted-foreground">O progresso (aulas, simulados, respostas do laboratório e anotações) fica só neste navegador, sem conta nem servidor. Limpar os dados do navegador apaga tudo: baixe um backup de tempos em tempos.</p>
        <p className="text-xs text-muted-foreground">Hoje: {store.completed.length} aulas · {Object.values(store.caseNotes).filter(Boolean).length} respostas · {store.notes.length.toLocaleString("pt-BR")} caracteres de anotações · {store.attempts.length} simulados.</p>
        <div className="flex flex-wrap gap-2"><button onClick={exportData} data-testid="dados-exportar" className="inline-flex items-center gap-2 rounded-full border border-cyan/60 px-4 py-2 text-sm text-cyan hover:bg-cyan/10"><Download size={14} /> Exportar backup</button><button onClick={() => file.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm"><Upload size={14} /> Importar backup</button><input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void importData(e.target.files?.[0]); e.target.value = ""; }} />
          {confirm ? <span className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Apagar tudo deste curso?</span><button onClick={() => { setStore({ ...empty }); setConfirm(null); toast.success("Dados do curso apagados"); }} data-testid="dados-apagar-ok" className="rounded-full border border-destructive/60 px-3 py-1 text-destructive">Apagar</button><button onClick={() => setConfirm(null)} className="rounded-full border border-white/15 px-3 py-1">Cancelar</button></span> : <button onClick={() => setConfirm("reset")} className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"><Trash2 size={14} /> Apagar meus dados</button>}</div></div>
      <div className="glass rounded-3xl p-5 text-sm text-muted-foreground"><h3 className="font-display text-lg font-semibold text-foreground">Sobre o conteúdo</h3><p className="mt-2">Material educacional introdutório, conferido nas fontes oficiais na data indicada em cada aula. Políticas, nomes de produtos, interfaces, preços, limites e procedimentos da Meta mudam: consulte as fontes antes de orientar clientes. Não é aconselhamento jurídico nem garantia de aprovação ou de ausência de restrições.</p></div>
    </div>
  );
}
