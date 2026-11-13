import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, ListChecks, Mic, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bySection, cleanLabel, progress, type CList } from "@/lib/checklist";
import { addItems, deleteList, loadLists, removeItems, setItemDone } from "@/lib/data/checklists";
import { colorVar } from "@/components/PlanShell";

export const Route = createFileRoute("/listas")({
  head: () => ({ meta: [
    { title: "Presence · Listas" },
    { name: "description", content: "Suas listas e checklists: crie e ajuste por conversa e marque o que já está pronto." },
    { property: "og:title", content: "Presence · Listas" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ListasPage,
});

function ListCard({ l, onChange }: { l: CList; onChange: () => void }) {
  const [novo, setNovo] = useState("");
  const [open, setOpen] = useState(true);
  const p = progress(l.items), pct = p.total ? Math.round((p.feitos / p.total) * 100) : 0;
  const cor = colorVar(l.color);
  const run = async (f: () => Promise<unknown>) => { try { await f(); onChange(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não consegui salvar."); } };
  return (
    <section data-testid="lista" className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur" style={{ boxShadow: `0 0 40px -22px ${cor}` }}>
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in oklab, ${cor} 18%, transparent)`, color: cor }}><ListChecks size={18} /></span>
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <h2 className="truncate text-base font-semibold">{l.title}</h2>
          <p className="text-xs text-muted-foreground">{p.feitos} de {p.total} prontos</p>
        </button>
        <button type="button" aria-label="Excluir lista" onClick={() => { if (confirm(`Excluir a lista "${l.title}"?`)) void run(() => deleteList(l.id)); }} className="rounded-full p-2 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
      </header>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} /></div>
      {open && (
        <div className="mt-3 space-y-3">
          {bySection(l.items).map((s) => (
            <div key={s.secao}>
              {s.secao && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: cor }}>{s.secao}</p>}
              <ul className="space-y-1">
                {s.itens.map((i) => (
                  <li key={i.id} className="group flex items-center gap-2">
                    <button type="button" role="checkbox" aria-checked={i.done} onClick={() => void run(() => setItemDone(i.id, !i.done))}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border transition" style={i.done ? { background: cor, borderColor: cor, color: "#04121a" } : { borderColor: "color-mix(in oklab, currentColor 35%, transparent)" }}>{i.done && <Check size={13} strokeWidth={3} />}</span>
                      <span className={`min-w-0 flex-1 break-words text-sm ${i.done ? "text-muted-foreground line-through" : ""}`}>{i.label}</span>
                    </button>
                    <button type="button" aria-label={`Tirar ${i.label}`} onClick={() => void run(() => removeItems([i.id], l.id))} className="rounded-full p-1.5 text-muted-foreground/50 opacity-0 transition hover:text-destructive group-hover:opacity-100 focus:opacity-100 max-sm:opacity-60"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); const t = cleanLabel(novo); if (!t) return; setNovo(""); void run(() => addItems(l.id, [{ texto: t }])); }}>
            <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Adicionar item…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-cyan/50" />
            <button type="submit" aria-label="Adicionar" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 hover:border-white/30"><Plus size={16} /></button>
          </form>
        </div>
      )}
    </section>
  );
}

function ListasPage() {
  const [lists, setLists] = useState<CList[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const load = useCallback(async () => { try { setLists(await loadLists()); setErro(null); } catch (e) { setErro(e instanceof Error ? e.message : "erro"); } }, []);
  useEffect(() => {
    void load();
    // pega o que foi mudado por voz enquanto a página está aberta
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 6000);
    const v = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-8 md:pl-24" data-testid="listas">
      <h1 className="font-display text-3xl">Listas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Peça por voz: “vou à praia, monta uma lista do que levar”. Depois ajuste falando — “tira o biquíni”, “coloca protetor”, “marca a toalha como pronta”.</p>
      <div className="mt-6 space-y-4">
        {erro && <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">Não consegui carregar as listas: {erro}</p>}
        {lists === null && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {lists?.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-sm text-muted-foreground" data-testid="listas-vazio">
            <Mic className="mx-auto mb-2 text-cyan" size={20} />Nenhuma lista ainda. Toque no orbe e diga, por exemplo: “monta uma lista do que levar para a praia”.
          </div>
        )}
        {lists?.map((l) => <ListCard key={l.id} l={l} onChange={() => void load()} />)}
      </div>
    </main>
  );
}
