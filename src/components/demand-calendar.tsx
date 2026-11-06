import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, ListChecks, MapPin, Pencil, Plus, Sparkles, Trash2, X,
} from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  APPT_COLORS, appointmentsOn, isoDay, monthGrid, type AppointmentDraft, type CalItem,
} from "@/lib/appointments";
import type { Dossier, DossierLabel } from "@/lib/dossiers";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fromIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y!, m! - 1, d!); };
const longDay = (s: string) => fromIso(s).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const dayCountLabel = (l: CalItem[]) => {
  const c = l.filter((a) => a.kind === "compromisso").length, t = l.length - c;
  return [c && `${c} compromisso${c === 1 ? "" : "s"}`, t && `${t} tarefa${t === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
};
const timeLabel = (a: CalItem) => (a.time ? (a.end ? `${a.time} – ${a.end}` : a.time) : "Dia todo");

type Props = {
  items: CalItem[];
  dossiers: Dossier[];
  label: DossierLabel;
  onSave: (d: AppointmentDraft, id?: string) => void;
  onDelete: (a: CalItem) => void;
  /** Tarefas comuns: marcar/desmarcar como feita. */
  onToggle: (a: CalItem) => void;
  saving?: boolean;
};

export function DemandCalendar({ items, dossiers, label, onSave, onDelete, onToggle, saving }: Props) {
  // Começa vazio no servidor e assume "hoje" depois de abrir no navegador (evita diferença de fuso).
  const [todayIso, setTodayIso] = useState("");
  const [cursor, setCursor] = useState({ y: 2026, m: 0 });
  const [sel, setSel] = useState("");
  const [dir, setDir] = useState<1 | -1>(1);
  const [f, setF] = useState("todos");
  const [edit, setEdit] = useState<CalItem | { date: string } | null>(null);
  useEffect(() => {
    const now = new Date();
    setTodayIso(isoDay(now));
    setSel(isoDay(now));
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
  }, []);

  const dossierName = (id?: string) => (id && dossiers.find((d) => d.id === id)?.name) || null;
  const shown = useMemo(() => items.filter((a) => {
    const linked = dossierName(a.dossierId) ? a.dossierId : undefined;
    if (f === "comp") return a.kind === "compromisso";
    if (f === "tarefas") return a.kind === "tarefa";
    return f === "todos" || (f === "geral" ? !linked : linked === f);
  }), [items, f, dossiers]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = monthGrid(cursor.y, cursor.m);
  const go = (delta: number) => {
    setDir(delta > 0 ? 1 : -1);
    setCursor(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };
  const goToday = () => {
    const now = new Date();
    setDir(1);
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
    setSel(isoDay(now));
  };
  const monthCount = shown.filter((a) => a.date.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`)).length;
  const dayList = sel ? appointmentsOn(shown, sel) : [];
  const upcoming = todayIso
    ? [...shown].filter((a) => !a.done && a.date >= todayIso && a.date !== sel).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")).slice(0, 4)
    : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      {/* mês */}
      <section className="glass relative overflow-hidden rounded-3xl p-4 animate-rise sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 animate-float rounded-full bg-violet/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 animate-float rounded-full bg-cyan/12 blur-3xl [animation-delay:-3s]" />
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan/70 to-transparent" />

        <div className="relative mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto flex items-center gap-4">
            <span className="icon-tile h-12 w-12 !rounded-2xl shadow-[0_0_30px_-8px_var(--glow)]" style={tint("cyan")}><CalendarDays size={20} /></span>
            <div key={`t-${cursor.y}-${cursor.m}`} className={`animate-in fade-in duration-500 ${dir > 0 ? "slide-in-from-right-3" : "slide-in-from-left-3"}`}>
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-gradient sm:text-4xl" data-testid="cal-mes">{MONTHS[cursor.m]}</h2>
                <span className="font-mono text-sm glow-text" style={tint("cyan")}>{cursor.y}</span>
              </div>
              <p className="text-xs text-muted-foreground">{monthCount ? `${monthCount} compromisso${monthCount === 1 ? "" : "s"} neste mês` : "Nenhum compromisso neste mês"}</p>
            </div>
          </div>
          <select value={f} onChange={(e) => setF(e.target.value)} aria-label="Filtrar compromissos"
            className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs outline-none transition hover:border-cyan/40 focus:border-cyan/60 [&>option]:bg-popover">
            <option value="todos">Compromissos e tarefas</option>
            <option value="comp">Só compromissos</option>
            <option value="tarefas">Só tarefas</option>
            <option value="geral">Gerais (sem {label.singular.toLowerCase()})</option>
            {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/30 p-1">
            <button onClick={() => go(-1)} aria-label="Mês anterior" className="rounded-lg p-1.5 text-muted-foreground transition hover:-translate-x-0.5 hover:bg-secondary hover:text-foreground"><ChevronLeft size={16} /></button>
            <button onClick={goToday} className="rounded-lg px-2.5 py-1 text-xs font-medium text-cyan transition hover:bg-cyan/10">Hoje</button>
            <button onClick={() => go(1)} aria-label="Próximo mês" className="rounded-lg p-1.5 text-muted-foreground transition hover:translate-x-0.5 hover:bg-secondary hover:text-foreground"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => setEdit({ date: sel || todayIso })} data-testid="novo-compromisso"
            className="shine flex items-center gap-2 rounded-xl border border-cyan/60 bg-cyan/10 px-3.5 py-2 text-xs font-medium text-cyan shadow-[0_0_24px_-8px_var(--cyan)] transition hover:-translate-y-0.5 hover:bg-cyan/20 hover:shadow-[0_0_32px_-6px_var(--cyan)]">
            <CalendarPlus size={14} /> Novo compromisso
          </button>
        </div>

        <div className="relative grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEK.map((w, i) => (
            <p key={w} className={`pb-2 text-center font-mono text-[0.6rem] uppercase tracking-[0.25em] ${i === 0 || i === 6 ? "text-violet" : "text-muted-foreground"}`}>{w}</p>
          ))}
        </div>
        {/* luz que segue o mouse por cima da grade */}
        <div className="group/grid relative"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`); }}>
          <div className="pointer-events-none absolute -inset-2 z-0 rounded-3xl opacity-0 transition-opacity duration-500 group-hover/grid:opacity-100"
            style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--cyan) 14%, transparent), transparent 70%)" }} />
          <div key={`${cursor.y}-${cursor.m}`} className="relative z-10 grid grid-cols-7 gap-1.5 sm:gap-2">
            {grid.map((d, i) => {
              const iso = isoDay(d);
              const inMonth = d.getMonth() === cursor.m;
              const isToday = iso === todayIso;
              const isSel = iso === sel;
              const past = !!todayIso && iso < todayIso;
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              const list = appointmentsOn(shown, iso);
              return (
                <div key={iso} role="button" tabIndex={0} onClick={() => setSel(iso)} onDoubleClick={() => setEdit({ date: iso })}
                  onKeyDown={(e) => { if (e.key === "Enter") setSel(iso); }} data-testid={`dia-${iso}`} aria-label={longDay(iso)}
                  style={{ animationDelay: `${(i % 7) * 25 + Math.floor(i / 7) * 35}ms` }}
                  className={`group/day relative flex min-h-[68px] cursor-pointer flex-col rounded-2xl border p-1.5 text-left outline-none transition duration-300 animate-in fade-in zoom-in-95 fill-mode-both focus-visible:ring-2 focus-visible:ring-cyan/50 sm:min-h-[132px] sm:p-2
                    ${isSel ? "border-cyan/70 bg-cyan/[0.08] shadow-[0_0_34px_-10px_var(--cyan),inset_0_0_24px_-14px_var(--cyan)]" : `border-border/50 ${weekend ? "bg-violet/[0.04]" : "bg-secondary/15"} hover:-translate-y-1 hover:border-cyan/35 hover:bg-secondary/40 hover:shadow-[0_14px_30px_-18px_var(--cyan)]`}
                    ${inMonth ? (past && !isSel ? "opacity-70" : "") : "opacity-30"}`}>
                  <span className="flex items-center justify-between">
                    <span className="relative grid h-7 w-7 place-items-center">
                      {isToday && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-cyan/30" />}
                      <span className={`relative grid h-6 w-6 place-items-center rounded-full text-xs tabular-nums transition sm:h-7 sm:w-7 sm:text-sm
                        ${isToday ? "bg-cyan font-bold text-background shadow-[0_0_16px_var(--cyan)]" : isSel ? "font-semibold text-cyan" : "text-foreground/85 group-hover/day:text-foreground"}`}>
                        {d.getDate()}
                      </span>
                    </span>
                    {isToday && <span className="hidden font-mono text-[0.55rem] uppercase tracking-widest text-cyan sm:inline">Hoje</span>}
                    <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setEdit({ date: iso }); }} aria-label={`Novo compromisso em ${iso}`}
                      className="hidden rounded-md p-0.5 text-muted-foreground opacity-0 transition hover:rotate-90 hover:text-cyan group-hover/day:opacity-100 sm:block">
                      <Plus size={14} />
                    </button>
                  </span>
                  {/* celular: pontinhos */}
                  <span className="mt-auto flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((a) => <span key={a.id} className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${a.color})`, boxShadow: `0 0 6px var(--${a.color})` }} />)}
                  </span>
                  {/* computador: cartõezinhos legíveis */}
                  <span className="mt-1.5 hidden min-w-0 flex-col gap-1 sm:flex">
                    {list.slice(0, 3).map((a, k) => (
                      <ApptChip key={a.id} a={a} dossier={dossierName(a.dossierId)} delay={k * 60} onOpen={() => { setSel(iso); if (a.kind === "compromisso") setEdit(a); else onToggle(a); }} />
                    ))}
                    {list.length > 3 && (
                      <span className="px-1 text-[0.65rem] font-medium text-muted-foreground transition group-hover/day:text-cyan">+{list.length - 3} mais</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative mt-4 flex items-center gap-1.5 text-[0.65rem] text-muted-foreground"><Sparkles size={11} className="text-violet" /> Toque duas vezes num dia para marcar um compromisso. Os compromissos entram sozinhos no “Organize meu dia” e no “Planeje meu dia”. Tarefas com data também aparecem aqui (clique nelas para marcar como feitas).</p>
      </section>

      {/* dia escolhido */}
      <aside className="grid content-start gap-4 lg:grid-cols-2 xl:grid-cols-1">
        <section className="glass relative overflow-hidden rounded-3xl p-5 animate-rise" style={{ animationDelay: ".05s" }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/70 to-transparent" />
          <p className="mono-caps">{sel === todayIso ? "Hoje" : "Dia escolhido"}</p>
          <h3 key={sel} className="mt-1 font-display text-xl font-bold first-letter:uppercase animate-in fade-in slide-in-from-bottom-1" data-testid="cal-dia">{sel ? longDay(sel) : "—"}</h3>
          <p className="text-xs text-muted-foreground">{dayList.length ? dayCountLabel(dayList) : "Nada marcado"}</p>

          <div key={`list-${sel}-${f}`} className="mt-4 space-y-2">
            {dayList.map((a, i) => (
              <AppointmentRow key={a.id} a={a} dossier={dossierName(a.dossierId)} delay={i * 50} onEdit={() => setEdit(a)} onDelete={() => onDelete(a)} onToggle={() => onToggle(a)} />
            ))}
            {!dayList.length && (
              <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-8 text-center">
                <span className="icon-tile h-11 w-11 !rounded-full" style={tint("violet")}><Sparkles size={18} /></span>
                <p className="text-sm text-muted-foreground">Dia livre</p>
              </div>
            )}
            <button onClick={() => setEdit({ date: sel || todayIso })} data-testid="novo-compromisso-dia"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-cyan">
              <Plus size={13} /> Marcar neste dia
            </button>
          </div>
        </section>

        {upcoming.length > 0 && (
          <section className="glass rounded-3xl p-5 animate-rise" style={{ animationDelay: ".1s" }}>
            <p className="mono-caps mb-3">Próximos</p>
            <div className="space-y-1">
              {upcoming.map((a) => {
                const d = fromIso(a.date);
                return (
                  <button key={a.id} onClick={() => { setSel(a.date); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }} style={tint(a.color)}
                    className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-secondary/50">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--glow)_40%,transparent)] bg-[color-mix(in_oklab,var(--glow)_10%,transparent)] leading-none">
                      <span className="font-display text-sm font-bold text-[var(--glow)]">{d.getDate()}</span>
                      <span className="font-mono text-[0.5rem] uppercase text-muted-foreground">{MONTHS[d.getMonth()]!.slice(0, 3)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{a.title}</span>
                      <span className="block truncate text-[0.65rem] text-muted-foreground">{timeLabel(a)}{dossierName(a.dossierId) ? ` · ${dossierName(a.dossierId)}` : ""}</span>
                    </span>
                    <ChevronRight size={14} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </aside>

      {edit && (
        <AppointmentDialog
          appt={"id" in edit ? edit : null} date={edit.date} dossiers={dossiers} label={label}
          onClose={() => setEdit(null)}
          saving={saving} onSave={(d) => { onSave(d, "id" in edit ? edit.id : undefined); setSel(d.date); const x = fromIso(d.date); setCursor({ y: x.getFullYear(), m: x.getMonth() }); setEdit(null); }}
        />
      )}
    </div>
  );
}

/** Item dentro do dia: horário + nome em até 3 linhas; ao passar o mouse mostra tudo. Tarefas têm caixinha. */
function ApptChip({ a, dossier, delay, onOpen }: { a: CalItem; dossier: string | null; delay: number; onOpen: () => void }) {
  const task = a.kind === "tarefa";
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} onDoubleClick={(e) => e.stopPropagation()}
          style={{ ...tint(a.color), animationDelay: `${delay + 120}ms` }} data-testid={task ? "chip-tarefa" : "chip-compromisso"}
          className={`group/chip relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border py-1 pl-2.5 pr-1.5 text-left transition duration-200 animate-in fade-in slide-in-from-left-1 fill-mode-both hover:translate-x-0.5 hover:border-[color-mix(in_oklab,var(--glow)_65%,transparent)] hover:shadow-[0_0_18px_-6px_var(--glow)]
            ${task ? "border-dashed border-[color-mix(in_oklab,var(--glow)_35%,transparent)] bg-secondary/30 hover:bg-secondary/60" : "border-[color-mix(in_oklab,var(--glow)_30%,transparent)] bg-[color-mix(in_oklab,var(--glow)_13%,transparent)] hover:bg-[color-mix(in_oklab,var(--glow)_22%,transparent)]"}
            ${a.done ? "opacity-55" : ""}`}>
          {!task && <span className="absolute inset-y-1 left-0.5 w-[3px] rounded-full bg-[var(--glow)] shadow-[0_0_8px_var(--glow)]" />}
          <span className="flex items-center gap-1 font-mono text-[0.6rem] leading-none text-[var(--glow)]">
            {task && (
              <span className={`-ml-1 grid h-3 w-3 shrink-0 place-items-center rounded-[4px] border transition ${a.done ? "border-[var(--glow)] bg-[var(--glow)] text-background" : "border-[var(--glow)]/70 group-hover/chip:bg-[color-mix(in_oklab,var(--glow)_25%,transparent)]"}`}>
                {a.done && <Check size={9} strokeWidth={3.5} />}
              </span>
            )}
            {a.time ?? (task ? "Tarefa" : "Dia todo")}
            {dossier && <span className="truncate font-sans text-muted-foreground">· {dossier}</span>}
          </span>
          <span className={`mt-0.5 line-clamp-3 break-words text-[0.72rem] font-medium leading-snug text-foreground ${a.done ? "line-through decoration-[var(--glow)]" : ""}`}>{a.title}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" style={tint(a.color)}
        className="w-72 overflow-hidden rounded-2xl border-[color-mix(in_oklab,var(--glow)_45%,transparent)] bg-popover/95 p-0 shadow-[0_20px_50px_-20px_var(--glow)] backdrop-blur-xl">
        <div className="h-1 bg-[var(--glow)] shadow-[0_0_14px_var(--glow)]" />
        <div className="space-y-2 p-4">
          <div>
            <p className="flex items-center gap-1.5 font-mono text-xs text-[var(--glow)]">{task ? <ListChecks size={12} /> : <Clock size={12} />} {task ? (a.time ? `Tarefa · ${a.time}` : "Tarefa") : timeLabel(a)}</p>
            <p className="mt-0.5 text-[0.65rem] text-muted-foreground first-letter:uppercase">{longDay(a.date)}</p>
          </div>
          <p className={`font-display text-base font-bold leading-snug ${a.done ? "line-through" : ""}`}>{a.title}</p>
          {a.place && <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin size={12} className="mt-0.5 shrink-0" /> {a.place}</p>}
          {a.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{a.notes}</p>}
          <div className="flex items-center justify-between pt-1">
            <span className="tag !text-[0.6rem] !tracking-normal" style={tint(task ? "cyan" : dossier ? "violet" : "cyan")}>{task ? (a.done ? "Feita" : "Pendente") : (dossier ?? "Geral")}</span>
            <span className="text-[0.6rem] text-muted-foreground">{task ? (a.done ? "Clique para reabrir" : "Clique para marcar como feita") : "Clique para editar"}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function AppointmentRow({ a, dossier, delay, onEdit, onDelete, onToggle }: { a: CalItem; dossier: string | null; delay: number; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const task = a.kind === "tarefa";
  return (
    <div onClick={task ? onToggle : onEdit} style={{ ...tint(a.color), animationDelay: `${delay}ms` }} data-testid={task ? "tarefa" : "compromisso"}
      className={`group/row relative flex cursor-pointer gap-3 overflow-hidden rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--glow)_50%,transparent)] hover:shadow-[0_10px_30px_-16px_var(--glow)] animate-in fade-in slide-in-from-right-2 fill-mode-both ${task ? "border-dashed border-border bg-secondary/10" : "border-border/60 bg-secondary/20"} ${a.done ? "opacity-60" : ""}`}>
      {!task && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--glow)] shadow-[0_0_10px_var(--glow)]" />}
      {task ? (
        <span className="flex w-12 shrink-0 items-start pl-1">
          <span role="checkbox" aria-checked={a.done} aria-label={`Marcar ${a.title} como feita`}
            className={`grid h-5 w-5 place-items-center rounded-md border transition ${a.done ? "scale-105 border-[var(--glow)] bg-[var(--glow)] text-background shadow-[0_0_12px_var(--glow)]" : "border-muted-foreground/50 group-hover/row:border-[var(--glow)]"}`}>
            {a.done && <Check size={12} strokeWidth={3} className="animate-in zoom-in-50" />}
          </span>
        </span>
      ) : (
        <span className="w-12 shrink-0 pl-1 font-mono text-[0.65rem] leading-tight text-[var(--glow)]">
          {a.time ?? "Dia"}<br /><span className="text-muted-foreground">{a.time ? a.end ?? "" : "todo"}</span>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block break-words text-sm font-medium ${a.done ? "line-through" : ""}`}>{a.title}</span>
        {a.place && <span className="mt-0.5 flex items-center gap-1 truncate text-[0.65rem] text-muted-foreground"><MapPin size={10} /> {a.place}</span>}
        {a.notes && <span className="mt-0.5 line-clamp-2 block text-[0.65rem] text-muted-foreground">{a.notes}</span>}
        <span className="tag mt-1.5 !text-[0.6rem] !tracking-normal" style={tint(task ? "cyan" : dossier ? "violet" : "cyan")}>{task ? `Tarefa${a.time ? ` · ${a.time}` : ""}` : (dossier ?? "Geral")}</span>
      </span>
      <span className="flex flex-col gap-0.5 opacity-100 transition md:translate-x-2 md:opacity-0 md:group-hover/row:translate-x-0 md:group-hover/row:opacity-100">
        {!task && <button onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label={`Editar ${a.title}`} className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-cyan"><Pencil size={12} /></button>}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label={`Excluir ${a.title}`} className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-destructive"><Trash2 size={12} /></button>
      </span>
    </div>
  );
}

function AppointmentDialog({ appt, date: startDate, dossiers, label, saving, onClose, onSave }: {
  appt: CalItem | null; date: string; dossiers: Dossier[]; label: DossierLabel; saving?: boolean | undefined; onClose: () => void; onSave: (d: AppointmentDraft) => void;
}) {
  const [title, setTitle] = useState(appt?.title ?? "");
  const [date, setDate] = useState(appt?.date ?? startDate);
  const [allDay, setAllDay] = useState(appt ? !appt.time : false);
  const [time, setTime] = useState(appt?.time ?? "09:00");
  const [end, setEnd] = useState(appt?.end ?? "");
  const [place, setPlace] = useState(appt?.place ?? "");
  const [notes, setNotes] = useState(appt?.notes ?? "");
  const [color, setColor] = useState<string>(appt?.color ?? APPT_COLORS[0]);
  const [dossierId, setDossierId] = useState(appt?.dossierId && dossiers.some((d) => d.id === appt.dossierId) ? appt.dossierId : "");
  const ok = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const field = "mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none transition focus:border-cyan/60 [color-scheme:dark]";
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 p-3 backdrop-blur-sm animate-in fade-in sm:p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ title, date, time: allDay ? undefined : time, end: allDay ? undefined : end, place, notes, color, dossierId }); }}
        className="glass relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl animate-in zoom-in-95" role="dialog" aria-label={appt ? "Editar compromisso" : "Novo compromisso"}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--glow)] shadow-[0_0_16px_var(--glow)]" style={tint(color)} />
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <span className="icon-tile h-10 w-10 transition" style={tint(color)}><CalendarDays size={18} /></span>
          <h2 className="flex-1 font-display text-xl font-bold">{appt ? "Editar compromisso" : "Novo compromisso"}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="scroll-neon min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mono-caps">O que é?</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunião, visita, ligação…" data-testid="compromisso-titulo" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block sm:col-span-1">
              <span className="mono-caps">Dia</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="compromisso-data" className={field} />
            </label>
            <div className="col-span-2 flex items-end sm:col-span-1">
              <button type="button" onClick={() => setAllDay((v) => !v)} aria-pressed={allDay}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${allDay ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-border text-muted-foreground hover:text-foreground"}`}>
                <span className={`relative h-4 w-7 rounded-full transition ${allDay ? "bg-cyan" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all ${allDay ? "left-3.5" : "left-0.5"}`} />
                </span>
                Dia todo
              </button>
            </div>
            {!allDay && (
              <>
                <label className="block animate-in fade-in">
                  <span className="mono-caps">Início</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="compromisso-hora" className={field} />
                </label>
                <label className="block animate-in fade-in">
                  <span className="mono-caps">Fim (opcional)</span>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
                </label>
              </>
            )}
          </div>
          <label className="block">
            <span className="mono-caps">Vincular a {label.singular.toLowerCase()}</span>
            <select value={dossierId} onChange={(e) => setDossierId(e.target.value)} data-testid="compromisso-dossie" className={`${field} [&>option]:bg-popover`}>
              <option value="">Nenhum (compromisso geral)</option>
              {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mono-caps">Local (opcional)</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Endereço, link da chamada…" className={field} />
          </label>
          <label className="block">
            <span className="mono-caps">Observações (opcional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} resize-none`} />
          </label>
          <div>
            <span className="mono-caps">Cor</span>
            <div className="mt-2 flex gap-2">
              {APPT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Cor ${c}`} aria-pressed={color === c}
                  className={`h-6 w-6 rounded-full transition hover:scale-110 ${color === c ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"}`}
                  style={{ background: `var(--${c})`, boxShadow: color === c ? `0 0 12px var(--${c})` : undefined }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm transition hover:border-cyan/40">Cancelar</button>
          <button disabled={!ok || saving} data-testid="salvar-compromisso" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan/60 bg-cyan/10 py-2.5 text-sm text-cyan shadow-[0_0_24px_-8px_var(--cyan)] transition hover:bg-cyan/20 disabled:opacity-40">
            <Check size={15} /> {appt ? "Salvar alterações" : "Marcar compromisso"}
          </button>
        </div>
      </form>
    </div>
  );
}
