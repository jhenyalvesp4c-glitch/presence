import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, ImageIcon, Loader2, Paperclip, Save, X } from "lucide-react";

import { backdropProps } from "@/lib/backdrop";
import { MAX_PENDING, filesFromClipboard, readPending, sizeLabel, toPending, type Pending } from "@/lib/brain-files";
import { uploadFiles, type Attachment } from "@/lib/data/brain";

export const DOC_KINDS: { kind: string; color: string }[] = [
  { kind: "Tutorial", color: "violet" }, { kind: "Guia", color: "cyan" }, { kind: "Processo", color: "emerald" }, { kind: "Manual", color: "amber" },
  { kind: "Registro", color: "emerald" }, { kind: "Template", color: "violet" }, { kind: "Ata", color: "cyan" }, { kind: "Curso", color: "pink" },
  { kind: "Documento", color: "cyan" }, { kind: "Rascunho", color: "cyan" },
];

export type EditableDoc = { title: string; desc: string; kind: string; color: string; rules: string[]; steps: string[]; attachments: Attachment[]; summary: string };
const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

/** Criar/editar um documento da Biblioteca: título, tipo, descrição, regras, passo a passo e arquivos (clique, arraste ou cole). */
export function DocEditor({ initial, isNew, folderName, onSave, onClose }: {
  initial: EditableDoc; isNew: boolean; folderName: string; onSave: (d: EditableDoc) => Promise<void> | void; onClose: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState(initial.kind === "Rascunho" && isNew ? "Documento" : initial.kind);
  const [desc, setDesc] = useState(initial.desc);
  const [rules, setRules] = useState(initial.rules.join("\n"));
  const [steps, setSteps] = useState(initial.steps.join("\n"));
  const [kept, setKept] = useState<Attachment[]>(initial.attachments);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = !!stage;
  const ok = !!title.trim();

  const add = async (list: File[]) => {
    if (!list.length) return;
    setError("");
    const { added, rejected } = await toPending(list, pending).catch((e) => ({ added: [] as Pending[], rejected: [(e as Error).message] }));
    if (added.length) setPending((p) => [...p, ...added]);
    if (rejected.length) setError(rejected.join(" · "));
  };

  const submit = async () => {
    if (!ok || busy) return;
    setError("");
    try {
      let summary = kept.length === initial.attachments.length ? initial.summary : "";
      let uploaded: Attachment[] = [];
      if (pending.length) {
        setStage("Lendo os arquivos…");
        const r = await readPending(pending);
        if (r.note) toast.message(r.note);
        summary = [summary, r.summary].filter(Boolean).join("\n\n");
        setStage("Guardando os arquivos…");
        uploaded = await uploadFiles("biblioteca", pending.map((p) => ({ name: p.name, mime: p.mime, blob: p.blob })));
      }
      setStage("Salvando…");
      const color = DOC_KINDS.find((k) => k.kind === kind)?.color ?? initial.color;
      await onSave({ title: title.trim(), desc: desc.trim(), kind, color, rules: lines(rules), steps: lines(steps), attachments: [...kept, ...uploaded], summary });
    } catch (e) { setError((e as Error).message); }
    setStage("");
  };

  const field = "mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none transition focus:border-cyan/60";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 p-4 backdrop-blur-md" {...backdropProps(() => { if (!busy) onClose(); })} data-testid="editor-documento">
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} onClick={(e) => e.stopPropagation()}
        onPaste={(e) => { const f = filesFromClipboard(e); if (f.length) { e.preventDefault(); void add(f); } }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
        onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setOver(false); void add([...e.dataTransfer.files]); } }}
        className="glass relative mx-auto my-8 w-full max-w-2xl rounded-3xl p-5 animate-rise" style={{ "--glow": "var(--cyan)" } as React.CSSProperties}>
        {over && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-3xl border-2 border-dashed border-cyan bg-background/85 text-sm text-cyan backdrop-blur-sm"><span className="flex items-center gap-2"><Paperclip size={16} /> Solte para anexar</span></div>}
        <div className="flex items-center gap-3">
          <span className="icon-tile h-10 w-10 !rounded-2xl"><FileText size={18} /></span>
          <div className="mr-auto">
            <h3 className="font-display text-lg font-semibold">{isNew ? "Novo documento" : "Editar documento"}</h3>
            <p className="text-[0.7rem] text-muted-foreground">Pasta: {folderName}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_11rem]">
          <label className="block text-xs text-muted-foreground">Título
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Como arquivar leads" className={field} data-testid="doc-titulo" />
          </label>
          <label className="block text-xs text-muted-foreground">Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} [&>option]:bg-popover`} data-testid="doc-tipo">{DOC_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.kind}</option>)}</select>
          </label>
        </div>
        <label className="mt-3 block text-xs text-muted-foreground">Descrição
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="Escreva o que é este documento, o contexto, o que aconteceu…" className={`${field} resize-y`} data-testid="doc-descricao" />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">Regras importantes <span className="opacity-60">(uma por linha)</span>
            <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4} className={`${field} resize-y`} data-testid="doc-regras" />
          </label>
          <label className="block text-xs text-muted-foreground">Passo a passo <span className="opacity-60">(um por linha)</span>
            <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={4} className={`${field} resize-y`} data-testid="doc-passos" />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <p className="mono-caps mr-auto flex items-center gap-2"><Paperclip size={11} /> Arquivos e imagens</p>
            <button type="button" onClick={() => input.current?.click()} disabled={busy || pending.length >= MAX_PENDING} data-testid="doc-anexar" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-cyan/60 hover:text-cyan disabled:opacity-40"><Paperclip size={12} /> Anexar</button>
            <input ref={input} type="file" multiple hidden data-testid="doc-arquivo" onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>
          {kept.length === 0 && pending.length === 0 ? (
            <button type="button" onClick={() => input.current?.click()} className="mt-2 grid w-full place-items-center gap-1 rounded-2xl border border-dashed border-border py-6 text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-cyan">
              <ImageIcon size={20} /> Clique, arraste arquivos aqui ou cole um print (Ctrl+V)
            </button>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="doc-anexos">
              {kept.map((a) => <li key={a.path} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 p-2"><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg"><FileText size={14} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs">{a.name}</span><span className="text-[0.6rem] text-muted-foreground">{sizeLabel(a.size)} · já guardado</span></span><button type="button" onClick={() => setKept((k) => k.filter((x) => x.path !== a.path))} aria-label={`Remover ${a.name}`} className="text-muted-foreground hover:text-destructive"><X size={13} /></button></li>)}
              {pending.map((p) => <li key={p.key} className="flex items-center gap-2 rounded-xl border border-cyan/40 bg-cyan/5 p-2">{p.preview ? <img src={p.preview} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="icon-tile h-9 w-9 shrink-0 !rounded-lg"><FileText size={14} /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-xs">{p.name}</span><span className="text-[0.6rem] text-muted-foreground">{sizeLabel(p.size)}{p.ai ? "" : " · sem leitura por IA"}</span></span><button type="button" onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))} aria-label={`Remover ${p.name}`} className="text-muted-foreground hover:text-destructive"><X size={13} /></button></li>)}
            </ul>
          )}
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <p className="mt-3 text-[0.65rem] leading-snug text-muted-foreground">Tudo o que você salvar aqui o Orion (segundo cérebro) passa a conhecer: título, descrição, passos e o conteúdo dos arquivos.</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          {stage && <span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground" data-testid="doc-etapa"><Loader2 size={13} className="animate-spin text-cyan" /> {stage}</span>}
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-40">Cancelar</button>
          <button type="submit" disabled={!ok || busy} data-testid="doc-salvar" className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition enabled:hover:scale-105 disabled:opacity-40"><Save size={14} /> Salvar</button>
        </div>
      </form>
    </div>
  );
}
