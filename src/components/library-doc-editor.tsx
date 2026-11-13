import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  BarChart3, BookOpen, Check, ChevronDown, ClipboardList, Compass, FileText, GraduationCap, HelpCircle, ImageIcon, LayoutTemplate, ListChecks, Loader2, MessageSquareText,
  NotebookPen, Paperclip, PencilLine, PlayCircle, Save, Scale, ShieldCheck, Users, Workflow, X, type LucideIcon,
} from "lucide-react";

import { backdropProps } from "@/lib/backdrop";
import { MAX_PENDING, filesFromClipboard, readPending, sizeLabel, toPending, type Pending } from "@/lib/brain-files";
import { uploadFiles, type Attachment } from "@/lib/data/brain";
import { fieldsOf } from "@/lib/library-doc-fields";

export type DocKind = { kind: string; color: string; Icon: LucideIcon; group: string; what: string; example: string };
/** Tipos de documento: o que é cada um e um exemplo (aparece no seletor). A ordem aqui é a do seletor. */
export const DOC_KINDS: DocKind[] = [
  { kind: "Tutorial", color: "violet", Icon: PlayCircle, group: "Ensinar", what: "Passo a passo para aprender a fazer uma coisa.", example: "Como importar a base de contatos" },
  { kind: "Guia", color: "cyan", Icon: Compass, group: "Ensinar", what: "Visão geral de um assunto, com dicas e boas práticas.", example: "Boas práticas de disparo em massa" },
  { kind: "Manual", color: "amber", Icon: BookOpen, group: "Ensinar", what: "Referência completa de uma ferramenta ou área.", example: "Manual da plataforma de atendimento" },
  { kind: "FAQ", color: "cyan", Icon: HelpCircle, group: "Ensinar", what: "Dúvidas que se repetem, com as respostas prontas.", example: "Perguntas frequentes dos coordenadores" },
  { kind: "Curso", color: "pink", Icon: GraduationCap, group: "Ensinar", what: "Conteúdo de treinamento organizado em módulos.", example: "Curso de atendimento em 5 módulos" },
  { kind: "Processo", color: "emerald", Icon: Workflow, group: "Fazer", what: "Sequência fixa de etapas, com quem faz o quê.", example: "Implantação de um novo polo" },
  { kind: "Checklist", color: "emerald", Icon: ListChecks, group: "Fazer", what: "Lista para conferir antes ou depois de fazer algo.", example: "Antes de disparar: o que conferir" },
  { kind: "Política", color: "amber", Icon: ShieldCheck, group: "Fazer", what: "O que pode e o que não pode, as regras da casa.", example: "Regras de uso do número" },
  { kind: "Script", color: "violet", Icon: MessageSquareText, group: "Fazer", what: "Textos prontos para falar ou enviar a clientes.", example: "Mensagem de boas-vindas ao cliente" },
  { kind: "Template", color: "violet", Icon: LayoutTemplate, group: "Fazer", what: "Modelo em branco para copiar e preencher.", example: "Modelo de proposta comercial" },
  { kind: "Briefing", color: "cyan", Icon: ClipboardList, group: "Registrar", what: "Resumo de um pedido para outra pessoa executar.", example: "Briefing do vídeo de treinamento" },
  { kind: "Ata", color: "cyan", Icon: Users, group: "Registrar", what: "O que foi falado e decidido numa reunião.", example: "Reunião com Juiz de Fora, 10/11" },
  { kind: "Decisão", color: "amber", Icon: Scale, group: "Registrar", what: "Uma escolha e o motivo dela, para não rediscutir.", example: "Passamos o disparo para duas etapas" },
  { kind: "Registro", color: "emerald", Icon: NotebookPen, group: "Registrar", what: "O que aconteceu, com data, para consultar depois.", example: "Falhas de disparo de novembro" },
  { kind: "Relatório", color: "emerald", Icon: BarChart3, group: "Registrar", what: "Resultado de um período, com números.", example: "Disparos da semana" },
  { kind: "Documento", color: "cyan", Icon: FileText, group: "Outros", what: "Qualquer texto que não se encaixe nos outros tipos.", example: "Contrato, proposta, comunicado" },
  { kind: "Rascunho", color: "cyan", Icon: PencilLine, group: "Outros", what: "Algo ainda em construção, que ainda não vale.", example: "Ideia de manual para revisar" },
];
const GROUPS = ["Ensinar", "Fazer", "Registrar", "Outros"];
const hue = (c: string) => (c === "amber" ? "oklch(0.82 0.15 75)" : c === "pink" || c === "rose" ? "oklch(0.72 0.18 10)" : `var(--${c})`);

/** Seletor de tipo: botão com o tipo atual e um painel com cartões (ícone, o que é e exemplo), agrupados. */
function KindPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = DOC_KINDS.find((k) => k.kind === value) ?? DOC_KINDS.find((k) => k.kind === "Documento")!;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("keydown", k, true);
    return () => document.removeEventListener("keydown", k, true);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="doc-tipo" aria-haspopup="dialog"
        className="group mt-1 flex w-full items-center gap-2.5 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-left text-sm text-foreground transition hover:border-cyan/50">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${hue(cur.color)} 16%, transparent)`, color: hue(cur.color) }}><cur.Icon size={15} /></span>
        <span className="min-w-0 flex-1 truncate font-medium">{cur.kind}</span>
        <ChevronDown size={14} className="text-muted-foreground transition group-hover:text-cyan" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/70 p-3 backdrop-blur-md sm:p-6" onClick={() => setOpen(false)} data-testid="doc-tipo-painel">
          <div role="dialog" aria-label="Escolher o tipo de documento" onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[oklch(0.15_0.03_265/0.96)] shadow-[0_40px_120px_-30px_var(--violet)]" style={{ animation: "vp-in .45s cubic-bezier(.2,.8,.2,1) both" }}>
            <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[var(--violet)] opacity-25 blur-3xl" />
            <header className="relative flex items-start gap-3 px-6 pb-3 pt-6">
              <div className="min-w-0 flex-1">
                <p className="mono-caps !text-[0.6rem]">Novo documento</p>
                <h3 className="mt-1 font-serif text-2xl leading-tight sm:text-3xl"><span className="text-gradient">Que tipo de documento é este?</span></h3>
                <p className="mt-1 text-xs text-muted-foreground">O tipo ajuda a organizar e a achar depois, inclusive pelo Orion.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </header>
            <div className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
              {GROUPS.map((g) => (
                <section key={g}>
                  <p className="mono-caps mb-2 !text-[0.62rem]">{g}</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {DOC_KINDS.filter((k) => k.group === g).map((k, i) => {
                      const on = k.kind === value;
                      return (
                        <li key={k.kind} style={{ animation: `vp-item .4s ease ${i * 0.03}s both` }}>
                          <button type="button" onClick={() => { onChange(k.kind); setOpen(false); }} aria-pressed={on} data-testid={`tipo-${k.kind}`}
                            className="group relative flex h-full w-full items-start gap-3 overflow-hidden rounded-2xl border p-3 text-left transition duration-300 hover:-translate-y-0.5"
                            style={{ borderColor: on ? `color-mix(in oklab, ${hue(k.color)} 65%, transparent)` : "rgba(255,255,255,.1)", background: on ? `color-mix(in oklab, ${hue(k.color)} 10%, transparent)` : "rgba(255,255,255,.04)", boxShadow: on ? `0 10px 30px -18px ${hue(k.color)}` : undefined }}>
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${hue(k.color)} 16%, transparent)`, color: hue(k.color) }}><k.Icon size={18} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2"><span className="text-sm font-semibold">{k.kind}</span>{on && <Check size={13} style={{ color: hue(k.color) }} />}</span>
                              <span className="mt-0.5 block text-[0.78rem] leading-snug text-foreground/85">{k.what}</span>
                              <span className="mt-1 block text-[0.7rem] italic text-muted-foreground">Ex.: {k.example}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

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
  const fields = fieldsOf(kind);

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
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={fields.title} className={field} data-testid="doc-titulo" />
          </label>
          <div className="block text-xs text-muted-foreground">Tipo
            <KindPicker value={kind} onChange={setKind} />
          </div>
        </div>
        <label className="mt-3 block text-xs text-muted-foreground">{fields.desc.label}
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={fields.desc.rows ?? 5} placeholder={fields.desc.ph} className={`${field} resize-y`} data-testid="doc-descricao" />
        </label>
        {(fields.rules || fields.steps) && (
          <div className={`mt-3 grid gap-3 ${fields.rules && fields.steps ? "sm:grid-cols-2" : ""}`}>
            {fields.rules && (
              <label className="block text-xs text-muted-foreground">{fields.rules.label} {fields.rules.hint && <span className="opacity-60">({fields.rules.hint})</span>}
                <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={fields.rules.rows ?? 4} placeholder={fields.rules.ph} className={`${field} resize-y`} data-testid="doc-regras" />
              </label>
            )}
            {fields.steps && (
              <label className="block text-xs text-muted-foreground">{fields.steps.label} {fields.steps.hint && <span className="opacity-60">({fields.steps.hint})</span>}
                <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={fields.steps.rows ?? 4} placeholder={fields.steps.ph} className={`${field} resize-y`} data-testid="doc-passos" />
              </label>
            )}
          </div>
        )}

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
