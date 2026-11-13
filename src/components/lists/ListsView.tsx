import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Mic, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bySection, cleanLabel, progress, type CList } from "@/lib/checklist";
import { addItems, createList, deleteList, loadLists, removeItems, setItemDone } from "@/lib/data/checklists";
import { colorVar } from "@/components/PlanShell";

/** Anel de progresso da lista. */
function Ring({ pct, cor }: { pct: number; cor: string }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="color-mix(in oklab, currentColor 12%, transparent)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .6s ease", filter: `drop-shadow(0 0 6px ${cor})` }} />
      </svg>
      <span className="absolute text-[0.7rem] font-semibold tabular-nums">{pct}%</span>
    </span>
  );
}

function ListCard({ l, onChange, idx }: { l: CList; onChange: () => void; idx: number }) {
  const [novo, setNovo] = useState("");
  const [open, setOpen] = useState(true);
  const p = progress(l.items), pct = p.total ? Math.round((p.feitos / p.total) * 100) : 0, cor = colorVar(l.color);
  const run = async (f: () => Promise<unknown>) => { try { await f(); onChange(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não consegui salvar."); } };
  return (
    <section data-testid="lista" className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[oklch(0.16_0.03_265/0.7)] backdrop-blur animate-rise"
      style={{ boxShadow: `0 24px 60px -34px ${cor}`, animationDelay: `${idx * 0.07}s` }}>
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: cor }} />
      <header className="relative flex items-center gap-4 px-5 pb-3 pt-5">
        <Ring pct={pct} cor={cor} />
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <h3 className="truncate font-serif text-2xl leading-tight">{l.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{p.feitos} de {p.total} prontos{pct === 100 && p.total > 0 ? " · tudo certo ✨" : ""}</p>
        </button>
        <button type="button" aria-label="Recolher ou abrir" onClick={() => setOpen(!open)} className="rounded-full p-2 text-muted-foreground transition hover:text-foreground"><ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} /></button>
        <button type="button" aria-label="Excluir lista" onClick={() => { if (confirm(`Excluir a lista "${l.title}"?`)) void run(() => deleteList(l.id)); }} className="rounded-full p-2 text-muted-foreground/70 transition hover:text-destructive"><Trash2 size={15} /></button>
      </header>
      {open && (
        <div className="relative space-y-4 px-5 pb-5">
          {bySection(l.items).map((s) => (
            <div key={s.secao}>
              {s.secao && (
                <p className="mb-1.5 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: cor }}>
                  {s.secao}<span aria-hidden className="h-px flex-1" style={{ background: `linear-gradient(to right, color-mix(in oklab, ${cor} 45%, transparent), transparent)` }} />
                </p>
              )}
              <ul className="space-y-0.5">
                {s.itens.map((i) => (
                  <li key={i.id} className="group flex items-center gap-1">
                    <button type="button" role="checkbox" aria-checked={i.done} onClick={() => void run(() => setItemDone(i.id, !i.done))} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.05]">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border transition" style={i.done ? { background: cor, borderColor: cor, color: "#04121a", boxShadow: `0 0 12px -2px ${cor}` } : { borderColor: `color-mix(in oklab, ${cor} 45%, transparent)` }}>{i.done && <Check size={12} strokeWidth={3.2} />}</span>
                      <span className={`min-w-0 flex-1 break-words text-sm transition ${i.done ? "text-muted-foreground line-through decoration-white/30" : ""}`}>{i.label}</span>
                    </button>
                    <button type="button" aria-label={`Tirar ${i.label}`} onClick={() => void run(() => removeItems([i.id], l.id))} className="rounded-full p-1.5 text-muted-foreground/40 transition hover:text-destructive max-sm:text-muted-foreground/60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = cleanLabel(novo); if (!t) return; setNovo(""); void run(() => addItems(l.id, [{ texto: t }])); }}>
            <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Adicionar item…" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm outline-none transition focus:border-cyan/50" />
            <button type="submit" aria-label="Adicionar" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 transition hover:border-white/30" style={{ color: cor }}><Plus size={16} /></button>
          </form>
        </div>
      )}
    </section>
  );
}

/** As listas (checklists) do Presence: criar, marcar, ajustar. Também mudam por voz. */
export function ListsView() {
  const [lists, setLists] = useState<CList[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nova, setNova] = useState("");
  const load = useCallback(async () => { try { setLists(await loadLists()); setErro(null); } catch (e) { setErro(e instanceof Error ? e.message : "erro"); } }, []);
  useEffect(() => {
    void load();
    const v = () => { if (document.visibilityState === "visible") void load(); };
    const t = setInterval(v, 6000); // pega o que foi mudado por voz com a página aberta
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [load]);

  return (
    <div data-testid="listas" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="mono-caps">Listas e checklists</p>
          <h2 className="mt-1 font-serif text-4xl leading-none md:text-5xl">Minhas <span className="text-gradient italic">listas</span></h2>
          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><Mic size={15} className="mt-0.5 shrink-0 text-cyan" /><span>Peça por voz: “vou à praia, monta uma lista do que levar”. Depois ajuste falando: “tira o biquíni”, “coloca protetor”, “marca a toalha como pronta”.</span></p>
        </div>
        <form className="flex w-full gap-2 sm:w-auto" onSubmit={(e) => { e.preventDefault(); const t = cleanLabel(nova); if (!t) return; setNova(""); void createList(t, []).then(load).catch((er: Error) => toast.error(er.message)); }}>
          <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova lista…" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm outline-none focus:border-cyan/50 sm:w-56" />
          <button type="submit" className="flex items-center gap-2 rounded-2xl border border-cyan/40 bg-cyan/10 px-4 py-2.5 text-sm text-cyan transition hover:bg-cyan/20"><Plus size={15} /> Criar</button>
        </form>
      </div>
      {erro && <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">Não consegui carregar as listas: {erro}</p>}
      {lists === null && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {lists?.length === 0 && (
        <div className="rounded-[1.75rem] border border-dashed border-white/15 p-10 text-center text-sm text-muted-foreground" data-testid="listas-vazio">
          <Sparkles className="mx-auto mb-2 text-violet" size={22} />Nenhuma lista ainda. Toque no orbe e diga, por exemplo: “monta uma lista do que levar para a praia”.
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-2">{lists?.map((l, i) => <ListCard key={l.id} l={l} idx={i} onChange={() => void load()} />)}</div>
    </div>
  );
}
