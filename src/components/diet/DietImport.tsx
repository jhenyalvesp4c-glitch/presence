/** Enviar a ficha de dieta (prints, PDF ou texto): o Orion lê, você confere e só então salva. */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, X } from "lucide-react";

import { readFiles, type LocalFile } from "@/components/inbox/files";
import { backdropProps } from "@/lib/backdrop";
import { importDiet } from "@/lib/diet-plan.functions";
import { optionProtein, type DietPlan } from "@/lib/diet-plan";
import { DIET_RECOMP } from "@/lib/diet-recomp";

export function DietImport({ onClose, onSave, saving }: { onClose: () => void; onSave: (p: DietPlan, start: string) => Promise<void>; saving: boolean }) {
  const [text, setText] = useState(""), [files, setFiles] = useState<LocalFile[]>([]), [busy, setBusy] = useState(false), [plan, setPlan] = useState<DietPlan | null>(null), pick = useRef<HTMLInputElement>(null);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const add = async (l: FileList | null) => { if (!l?.length) return; const r = await readFiles([...l], files); setFiles((f) => [...f, ...r.added].slice(0, 12)); r.rejected.forEach((x) => toast.error(x)); };
  const read = async () => {
    setBusy(true);
    try { const r = await importDiet({ data: { texto: text, files: files.map(({ name, mime, size, data }) => ({ name, mime, size, data })) } }); if (r.ok) setPlan(r.plano); else toast.error(r.error); }
    catch (e) { toast.error(`Não consegui ler a ficha: ${(e as Error).message}`); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background/85 p-3 backdrop-blur-md sm:p-8" {...backdropProps(onClose)} data-testid="importar-dieta">
      <div onClick={(e) => e.stopPropagation()} className="glass mx-auto w-full max-w-2xl rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">Enviar minha ficha de dieta</h2><p className="text-xs text-muted-foreground">Prints, PDF ou texto. O Orion monta as opções de refeições, as trocas e o acompanhamento para você conferir.</p></div><button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button></div>
        {!plan ? <div className="mt-4 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Cole aqui o texto da ficha (opcional se anexar os arquivos)" className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-emerald/60" data-testid="dieta-texto" />
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => pick.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10"><FileUp size={15} /> Anexar prints ou PDF</button><input ref={pick} type="file" multiple accept="image/*,application/pdf,.txt,.md,.csv" className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} data-testid="dieta-arquivos" />
            {files.map((f) => <span key={f.name} className="inline-flex items-center gap-1.5 rounded-full border border-emerald/40 bg-emerald/10 px-2.5 py-1 text-xs text-emerald">{f.name}<button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setFiles((l) => l.filter((x) => x !== f))}><X size={11} /></button></span>)}</div>
          <button type="button" onClick={() => setPlan(DIET_RECOMP())} className="block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" data-testid="dieta-pronta">Ou use a ficha pronta: Recomposição corporal (2 ou 3 refeições)</button>
          <button type="button" onClick={() => void read()} disabled={busy || (!text.trim() && !files.length)} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/10 px-5 py-2.5 text-sm font-medium text-emerald hover:bg-emerald/20 disabled:opacity-40" data-testid="dieta-ler">{busy ? <><Loader2 size={15} className="animate-spin" /> Lendo a ficha…</> : <><Sparkles size={15} /> Ler a ficha</>}</button>
        </div> : <div className="mt-4 space-y-3" data-testid="dieta-revisao">
          <p className="text-sm"><b>{plan.nome}</b></p>
          <ul className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">{([["Opções", plan.opcoes.length], ["Refeições", plan.opcoes.reduce((a, o) => a + o.refeicoes.length, 0)], ["Grupos de troca", plan.grupos.length], ["Proteína/dia", plan.proteina.min ? `${plan.proteina.min}–${plan.proteina.max ?? plan.proteina.min} g` : "—"]] as const).map(([k, v]) => <li key={k} className="rounded-xl border border-white/10 bg-black/20 p-2"><b className="block font-display text-xl">{v}</b>{k}</li>)}</ul>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs">{plan.opcoes.map((o) => <div key={o.id}><b>{o.nome}</b> <span className="text-muted-foreground">(≈ {optionProtein(o)} g de proteína)</span><p className="text-muted-foreground">{o.refeicoes.map((m) => `${m.nome}: ${m.itens.map((i) => i.alimento).join(", ")}`).join(" · ")}</p></div>)}</div>
          <p className="text-xs text-muted-foreground">Confira se está tudo certo. O que a ficha não dizia ficou em branco.</p>
          <label className="block text-xs text-muted-foreground">Começa em<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm" /></label>
          <div className="flex gap-2"><button type="button" onClick={() => setPlan(null)} className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10">Voltar</button><button type="button" onClick={() => void onSave(plan, start)} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2 text-sm font-medium text-emerald hover:bg-emerald/25 disabled:opacity-50" data-testid="dieta-salvar">{saving && <Loader2 size={15} className="animate-spin" />} Salvar esta dieta</button></div>
        </div>}
      </div>
    </div>
  );
}
