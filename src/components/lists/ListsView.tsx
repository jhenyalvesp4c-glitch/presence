import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, ListTodo, Mic, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bySection, cleanLabel, progress, type CList } from "@/lib/checklist";
import { addItems, createList, deleteList, loadLists, removeItems, renameList, setItemDone } from "@/lib/data/checklists";
import { colorVar } from "@/components/PlanShell";

/** Anel de progresso. */
function Ring({ pct, cor, size = 56, label = true }: { pct: number; cor: string; size?: number; label?: boolean }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox="0 0 48 48" className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="color-mix(in oklab, currentColor 12%, transparent)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .6s ease", filter: `drop-shadow(0 0 5px ${cor})` }} />
      </svg>
      {label && <span className="absolute font-semibold tabular-nums" style={{ fontSize: size > 48 ? "0.8rem" : "0.62rem" }}>{pct}%</span>}
    </span>
  );
}

const pctOf = (l: CList) => { const p = progress(l.items); return p.total ? Math.round((p.feitos / p.total) * 100) : 0; };

/** Uma lista aberta: cabeçalho, adicionar item e os grupos distribuídos em colunas. */
function Detail({ l, onChange }: { l: CList; onChange: () => void }) {
  const [novo, setNovo] = useState("");
  const [grupo, setGrupo] = useState("");
  const [oculta, setOculta] = useState(false);
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(l.title);
  useEffect(() => { setTitulo(l.title); setEditando(false); setGrupo(""); }, [l.id, l.title]);
  const p = progress(l.items), pct = pctOf(l), cor = colorVar(l.color);
  const secoes = useMemo(() => bySection(l.items), [l.items]);
  const run = async (f: () => Promise<unknown>) => { try { await f(); onChange(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não consegui salvar."); } };

  return (
    <section data-testid="lista" className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[oklch(0.15_0.03_265/0.75)] p-5 backdrop-blur sm:p-7" style={{ boxShadow: `0 30px 80px -40px ${cor}` }}>
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: cor }} />
      <header className="relative flex flex-wrap items-center gap-4 sm:gap-5">
        <Ring pct={pct} cor={cor} size={72} />
        <div className="min-w-0 flex-[1_1_10rem]">
          {editando ? (
            <form onSubmit={(e) => { e.preventDefault(); const t = cleanLabel(titulo); if (t && t !== l.title) void run(() => renameList(l.id, t)); setEditando(false); }}>
              <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => setEditando(false)} className="w-full rounded-xl border border-cyan/40 bg-black/20 px-3 py-1.5 font-serif text-2xl outline-none" />
            </form>
          ) : (
            <h3 className="flex items-center gap-2 font-serif text-2xl leading-tight sm:text-4xl">
              <span className="min-w-0 break-words">{l.title}</span>
              <button type="button" aria-label="Renomear lista" onClick={() => setEditando(true)} className="rounded-full p-1.5 text-muted-foreground/60 transition hover:text-foreground"><Pencil size={14} /></button>
            </h3>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{p.feitos} de {p.total} prontos{pct === 100 && p.total > 0 ? " · tudo certo ✨" : ""}</p>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <button type="button" onClick={() => setOculta(!oculta)} aria-pressed={oculta} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs transition hover:border-white/30">
            {oculta ? <Eye size={14} /> : <EyeOff size={14} />} {oculta ? "Mostrar feitos" : "Ocultar feitos"}
          </button>
          <button type="button" aria-label="Excluir lista" onClick={() => { if (confirm(`Excluir a lista "${l.title}"?`)) void run(() => deleteList(l.id)); }} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"><Trash2 size={15} /></button>
        </div>
      </header>

      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cor}, var(--violet))` }} /></div>

      <form className="relative mt-5 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const t = cleanLabel(novo); if (!t) return; setNovo(""); void run(() => addItems(l.id, [{ texto: t, grupo }])); }}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Adicionar item…" className="min-w-0 flex-[2_1_14rem] rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 text-sm outline-none transition focus:border-cyan/50" />
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo do item" className="min-w-0 flex-[1_1_9rem] rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-cyan/50">
          <option value="">Sem grupo</option>
          {secoes.filter((s) => s.secao).map((s) => <option key={s.secao} value={s.secao}>{s.secao}</option>)}
        </select>
        <button type="submit" className="flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition hover:brightness-125" style={{ borderColor: `color-mix(in oklab, ${cor} 50%, transparent)`, background: `color-mix(in oklab, ${cor} 12%, transparent)`, color: cor }}><Plus size={15} /> Adicionar</button>
      </form>

      <div className="relative mt-6 columns-1 gap-4 md:columns-2 2xl:columns-3">
        {secoes.map((s) => {
          const sp = progress(s.itens), itens = oculta ? s.itens.filter((i) => !i.done) : s.itens;
          if (!itens.length) return null;
          return (
            <div key={s.secao} className="mb-4 break-inside-avoid rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
              <p className="mb-2 flex items-center gap-2 px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: cor }}>
                <span className="min-w-0 flex-1 truncate">{s.secao || "Itens"}</span>
                <span className="rounded-full px-2 py-0.5 font-mono text-[0.66rem] normal-case tracking-normal" style={{ background: `color-mix(in oklab, ${cor} 15%, transparent)` }}>{sp.feitos}/{sp.total}</span>
              </p>
              <ul className="space-y-0.5">
                {itens.map((i) => (
                  <li key={i.id} className="group flex items-center gap-1">
                    <button type="button" role="checkbox" aria-checked={i.done} onClick={() => void run(() => setItemDone(i.id, !i.done))} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.06]">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border transition" style={i.done ? { background: cor, borderColor: cor, color: "#04121a", boxShadow: `0 0 12px -2px ${cor}` } : { borderColor: `color-mix(in oklab, ${cor} 45%, transparent)` }}>{i.done && <Check size={12} strokeWidth={3.2} />}</span>
                      <span className={`min-w-0 flex-1 break-words text-sm transition ${i.done ? "text-muted-foreground line-through decoration-white/30" : ""}`}>{i.label}</span>
                    </button>
                    <button type="button" aria-label={`Tirar ${i.label}`} onClick={() => void run(() => removeItems([i.id], l.id))} className="rounded-full p-1.5 text-muted-foreground/40 transition hover:text-destructive max-sm:text-muted-foreground/60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {oculta && p.total > 0 && p.feitos === p.total && <p className="relative py-6 text-center text-sm text-muted-foreground">Tudo pronto por aqui ✨</p>}
      {p.total === 0 && <p className="relative py-8 text-center text-sm text-muted-foreground">Lista vazia. Adicione acima ou peça por voz: “coloca protetor, toalha e boia”.</p>}
    </section>
  );
}

/** As listas (checklists) do Presence: seletor ao lado, lista aberta em tela cheia. Também mudam por voz. */
export function ListsView() {
  const [lists, setLists] = useState<CList[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [nova, setNova] = useState("");
  const load = useCallback(async () => { try { setLists(await loadLists()); setErro(null); } catch (e) { setErro(e instanceof Error ? e.message : "erro"); } }, []);
  useEffect(() => {
    void load();
    const v = () => { if (document.visibilityState === "visible") void load(); };
    const t = setInterval(v, 6000); // pega o que foi mudado por voz com a página aberta
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [load]);
  const atual = lists?.find((l) => l.id === sel) ?? lists?.[0];

  return (
    <div data-testid="listas" className="flex flex-col gap-6">
      <div className="max-w-2xl">
        <p className="mono-caps">Listas e checklists</p>
        <h2 className="mt-1 font-serif text-4xl leading-none md:text-5xl">Minhas <span className="text-gradient italic">listas</span></h2>
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><Mic size={15} className="mt-0.5 shrink-0 text-cyan" /><span>Peça por voz: “vou à praia, monta uma lista do que levar”. Depois ajuste falando: “tira o biquíni”, “coloca protetor”, “marca a toalha como pronta”.</span></p>
      </div>
      {erro && <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">Não consegui carregar as listas: {erro}</p>}
      {lists === null && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {lists && (
        <div className="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = cleanLabel(nova); if (!t) return; setNova(""); void createList(t, []).then((id) => { setSel(id); return load(); }).catch((er: Error) => toast.error(er.message)); }}>
              <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova lista…" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 text-sm outline-none focus:border-cyan/50" />
              <button type="submit" aria-label="Criar lista" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan/40 bg-cyan/10 text-cyan transition hover:bg-cyan/20"><Plus size={16} /></button>
            </form>
            <nav aria-label="Suas listas" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {lists.map((l) => {
                const on = l.id === atual?.id, cor = colorVar(l.color), p = progress(l.items);
                return (
                  <button key={l.id} type="button" onClick={() => setSel(l.id)} aria-current={on} data-testid="lista-item"
                    className={`flex min-w-[13rem] items-center gap-3 rounded-2xl border p-3 text-left transition lg:min-w-0 ${on ? "bg-white/[0.07]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
                    style={on ? { borderColor: `color-mix(in oklab, ${cor} 55%, transparent)`, boxShadow: `0 12px 34px -20px ${cor}` } : undefined}>
                    <Ring pct={pctOf(l)} cor={cor} size={40} label={false} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{l.title}</span><span className="block text-xs text-muted-foreground">{p.feitos} de {p.total} prontos</span></span>
                  </button>
                );
              })}
            </nav>
          </aside>
          {atual ? <Detail l={atual} onChange={() => void load()} /> : (
            <div className="rounded-[2rem] border border-dashed border-white/15 p-12 text-center text-sm text-muted-foreground" data-testid="listas-vazio">
              <Sparkles className="mx-auto mb-3 text-violet" size={24} /><ListTodo className="hidden" />Nenhuma lista ainda. Crie uma ao lado ou toque no orbe e diga: “monta uma lista do que levar para a praia”.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
