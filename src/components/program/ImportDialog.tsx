/** Enviar a ficha (prints, PDF ou texto): o Orion lê, você revisa o que ele entendeu e só então salva. */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, X } from "lucide-react";

import { readFiles, type LocalFile } from "@/components/inbox/files";
import { backdropProps } from "@/lib/backdrop";
import { importProgram } from "@/lib/program.functions";
import type { Program } from "@/lib/program";
import { RECOMP_12 } from "@/lib/program-recomp";

export function ImportDialog({ onClose, onSave, saving }: { onClose: () => void; onSave: (p: Program, start: string) => Promise<void>; saving: boolean }) {
  const [text, setText] = useState(""), [files, setFiles] = useState<LocalFile[]>([]), [busy, setBusy] = useState(false), [prog, setProg] = useState<Program | null>(null), pick = useRef<HTMLInputElement>(null);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const add = async (l: FileList | null) => { if (!l?.length) return; const r = await readFiles([...l], files); setFiles((f) => [...f, ...r.added].slice(0, 12)); r.rejected.forEach((x) => toast.error(x)); };
  const read = async () => {
    setBusy(true);
    try { const r = await importProgram({ data: { texto: text, files: files.map(({ name, mime, size, data }) => ({ name, mime, size, data })) } }); if (r.ok) setProg(r.programa); else toast.error(r.error); }
    catch (e) { toast.error(`Não consegui ler a ficha: ${(e as Error).message}`); }
    setBusy(false);
  };
  const n = prog?.dias.reduce((a, d) => a + d.exercicios.length, 0) ?? 0;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background/85 p-3 backdrop-blur-md sm:p-8" {...backdropProps(onClose)} data-testid="importar-ficha">
      <div onClick={(e) => e.stopPropagation()} className="glass mx-auto w-full max-w-2xl rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">Enviar minha ficha</h2><p className="text-xs text-muted-foreground">Prints, PDF ou texto. O Orion monta os treinos, as cargas e a regra de progressão para você conferir.</p></div><button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button></div>
        {!prog ? <div className="mt-4 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Cole aqui o texto da ficha (opcional se anexar os arquivos)" className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60" data-testid="ficha-texto" />
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => pick.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10"><FileUp size={15} /> Anexar prints ou PDF</button><input ref={pick} type="file" multiple accept="image/*,application/pdf,.txt,.md,.csv" className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} data-testid="ficha-arquivos" />
            {files.map((f) => <span key={f.name} className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-xs text-cyan">{f.name}<button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setFiles((l) => l.filter((x) => x !== f))}><X size={11} /></button></span>)}</div>
          <button type="button" onClick={() => setProg(RECOMP_12())} className="block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" data-testid="ficha-pronta">Ou use a ficha pronta: Recomposição corporal — 12 semanas</button>
          <button type="button" onClick={() => void read()} disabled={busy || (!text.trim() && !files.length)} className="inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-5 py-2.5 text-sm font-medium text-cyan hover:bg-cyan/20 disabled:opacity-40" data-testid="ficha-ler">{busy ? <><Loader2 size={15} className="animate-spin" /> Lendo a ficha…</> : <><Sparkles size={15} /> Ler a ficha</>}</button>
        </div> : <div className="mt-4 space-y-3" data-testid="ficha-revisao">
          <p className="text-sm"><b>{prog.nome}</b></p>
          <ul className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">{([["Dias", prog.dias.filter((d) => d.tipo !== "descanso").length], ["Exercícios", n], ["Semanas", prog.semanas], ["Regras", prog.regras.length]] as const).map(([k, v]) => <li key={k} className="rounded-xl border border-white/10 bg-black/20 p-2"><b className="block font-display text-xl">{v}</b>{k}</li>)}</ul>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs">{prog.dias.map((d) => <div key={d.id}><b>{d.titulo}</b> <span className="text-muted-foreground">({d.tipo})</span>{d.exercicios.length > 0 && <p className="text-muted-foreground">{d.exercicios.map((e) => `${e.nome} ${e.tipo === "forca" ? `${e.series}×${e.repsMin}${e.repsMax !== e.repsMin ? `–${e.repsMax}` : ""}` : e.prescricao}`).join(" · ")}</p>}</div>)}</div>
          <p className="text-xs text-muted-foreground">Confira se está tudo certo. Você pode ajustar depois; o que a ficha não dizia ficou em branco.</p>
          <label className="block text-xs text-muted-foreground">Começa em<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm" /></label>
          <div className="flex gap-2"><button type="button" onClick={() => setProg(null)} className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10">Voltar</button><button type="button" onClick={() => void onSave(prog, start)} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2 text-sm font-medium text-emerald hover:bg-emerald/25 disabled:opacity-50" data-testid="ficha-salvar">{saving && <Loader2 size={15} className="animate-spin" />} Salvar este programa</button></div>
        </div>}
      </div>
    </div>
  );
}
