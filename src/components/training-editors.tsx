import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { backdropProps } from "@/lib/backdrop";
import { toast } from "sonner";
import { BookOpen, ImageIcon, Layers, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { COLORS, newId, type Block, type Example, type Faq, type Script, type Visual } from "@/lib/training-library";
import { visualSrc } from "./training-images";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const field = "glass w-full rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--glow)]";
const label = "mb-1 block text-[0.7rem] text-muted-foreground";
const small = "flex items-center gap-1 text-[0.7rem] text-muted-foreground transition hover:text-[var(--glow)]";
const iconBtn = "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-pink";

function Modal({ title, subtitle, icon, color, onClose, onSubmit, onDelete, deleteLabel = "Excluir", isNew, children }: {
  title: string; subtitle?: string; icon: ReactNode; color: string; onClose: () => void; onSubmit: () => void;
  onDelete?: (() => void) | undefined; deleteLabel?: string; isNew?: boolean; children: ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(); };
  return (
    <div role="dialog" aria-modal="true" aria-label={title} {...backdropProps(onClose)}
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-md animate-rise">
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={tint(color)} className="glass flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl">
        <div className="flex items-start gap-3 border-b border-border p-5 pb-3">
          <span className="icon-tile h-10 w-10 shrink-0 !rounded-2xl">{icon}</span>
          <div className="mr-auto">
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            {subtitle && <p className="text-[0.7rem] text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="scroll-neon min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        <div className="flex items-center gap-2 border-t border-border p-4">
          {onDelete && <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs text-pink transition hover:bg-pink/10"><Trash2 size={13} /> {deleteLabel}</button>}
          <button type="button" onClick={onClose} className="ml-auto rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:scale-105">
            {isNew ? <><Plus size={12} /> Criar</> : <><Pencil size={12} /> Salvar</>}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <fieldset className="space-y-2 rounded-2xl border border-border p-3">
      <legend className="flex w-full items-center px-1"><span className="mono-caps mr-auto !text-[0.58rem]">{title}</span>{action}</legend>
      {children}
    </fieldset>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2">
      {COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Cor ${c}`} style={tint(c)}
          className={`h-7 w-7 rounded-full border-2 bg-[var(--glow)] transition ${value === c ? "scale-110 border-foreground" : "border-transparent opacity-60 hover:opacity-100"}`} />
      ))}
    </div>
  );
}

/** Lista de textos: cada linha editável, com excluir e adicionar. */
function ListField({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; addLabel: string }) {
  return (
    <div className="space-y-1.5">
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-5 shrink-0 text-right text-[0.65rem] tabular-nums text-muted-foreground">{i + 1}.</span>
          <input value={t} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder} className={`${field} !py-1.5`} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Excluir linha" className={iconBtn}><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])} className={small}><Plus size={11} /> {addLabel}</button>
    </div>
  );
}

/** Edita título, legenda e os pontos explicados de uma imagem; a posição dos pontos fica como está. */
function VisualFields({ v, onChange, onRemove }: { v: Visual; onChange: (v: Visual) => void; onRemove: () => void }) {
  const src = visualSrc(v);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-2.5">
      <div className="flex gap-3">
        {src ? <img src={src} alt={v.caption} className="h-20 w-32 shrink-0 rounded-lg border border-border object-cover" /> : <span className="grid h-20 w-32 shrink-0 place-items-center rounded-lg border border-dashed border-border text-muted-foreground"><ImageIcon size={18} /></span>}
        <div className="min-w-0 flex-1 space-y-1.5">
          <input value={v.title} onChange={(e) => onChange({ ...v, title: e.target.value })} placeholder="Título da imagem" className={`${field} !py-1.5`} />
          <input value={v.caption} onChange={(e) => onChange({ ...v, caption: e.target.value })} placeholder="Legenda" className={`${field} !py-1.5 text-xs`} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remover imagem" title="Remover imagem" className={iconBtn}><Trash2 size={13} /></button>
      </div>
      {v.pins.length > 0 && <p className="text-[0.65rem] text-muted-foreground">Pontos numerados na imagem</p>}
      {v.pins.map((p, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-brand text-[0.6rem] font-bold text-primary-foreground">{i + 1}</span>
          <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[150px_1fr]">
            <input value={p.label} onChange={(e) => onChange({ ...v, pins: v.pins.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Nome" className={`${field} !py-1.5 text-xs`} />
            <input value={p.text} onChange={(e) => onChange({ ...v, pins: v.pins.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Explicação" className={`${field} !py-1.5 text-xs`} />
          </div>
          <button type="button" onClick={() => onChange({ ...v, pins: v.pins.filter((_, j) => j !== i) })} aria-label="Excluir ponto" className={iconBtn}><Trash2 size={12} /></button>
        </div>
      ))}
    </div>
  );
}

const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
const cleanVisual = (v: Visual): Visual => ({ ...v, title: v.title.trim() || "Imagem", caption: v.caption.trim(), pins: v.pins.filter((p) => p.label.trim() || p.text.trim()) });

/* ───────────── Roteiro ───────────── */
export function ScriptEditor({ initial, onClose, onSave, onDelete }: {
  initial?: Script | undefined; onClose: () => void; onSave: (s: Script) => void; onDelete?: (() => void) | undefined;
}) {
  const [s, setS] = useState<Script>(() => initial ?? {
    id: newId("s"), title: "", audience: "", goal: "", color: "emerald", blocks: [{ id: newId("b"), title: "Abertura", minutes: 10, show: [], examples: [] }],
  });
  const submit = () => {
    if (!s.title.trim()) return void toast.error("Dê um nome para o roteiro.");
    onSave({ ...s, title: s.title.trim(), audience: s.audience.trim(), goal: s.goal.trim() });
  };
  return (
    <Modal title={initial ? "Editar roteiro" : "Novo roteiro"} subtitle="Os blocos você edita direto no roteiro." icon={<BookOpen size={18} />} color={s.color}
      onClose={onClose} onSubmit={submit} onDelete={onDelete} deleteLabel="Excluir roteiro" isNew={!initial}>
      <label className="block"><span className={label}>Nome do roteiro</span>
        <input autoFocus value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} maxLength={120} placeholder="Ex.: Primeiros passos no CRM" className={field} />
      </label>
      <label className="block"><span className={label}>Para quem</span>
        <input value={s.audience} onChange={(e) => setS({ ...s, audience: e.target.value })} maxLength={120} placeholder="Ex.: Consultores novos" className={field} />
      </label>
      <label className="block"><span className={label}>Objetivo</span>
        <textarea value={s.goal} onChange={(e) => setS({ ...s, goal: e.target.value })} rows={2} maxLength={500} placeholder="O que a turma precisa saber fazer ao final?" className={`${field} resize-none`} />
      </label>
      <div><span className={label}>Cor</span><ColorPicker value={s.color} onChange={(color) => setS({ ...s, color })} /></div>
    </Modal>
  );
}

/* ───────────── Bloco ───────────── */
export function BlockEditor({ initial, color, examples, onClose, onSave, onDelete }: {
  initial?: Block | undefined; color: string; examples: Example[]; onClose: () => void; onSave: (b: Block) => void; onDelete?: (() => void) | undefined;
}) {
  const [b, setB] = useState<Block>(() => initial ? structuredClone(initial) : { id: newId("b"), title: "", minutes: 10, show: [""], examples: [] });
  const set = <K extends keyof Block>(k: K, v: Block[K]) => setB((x) => ({ ...x, [k]: v }));
  const sc = b.scenario;
  const submit = () => {
    if (!b.title.trim()) return void toast.error("Dê um nome para o bloco.");
    const faq = (b.faq ?? []).map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q || f.a);
    const why = clean(b.why ?? []);
    const visuals = (b.visuals ?? []).map(cleanVisual);
    const scenario = sc && (sc.situation.trim() || sc.before.trim() || sc.after.trim()) ? sc : undefined;
    onSave({
      ...b, title: b.title.trim(), minutes: Math.max(0, Math.min(600, Math.round(b.minutes || 0))), show: clean(b.show),
      tip: b.tip?.trim() || undefined, faq: faq.length ? faq : undefined, why: why.length ? why : undefined,
      visuals: visuals.length ? visuals : undefined, scenario,
    });
  };
  const setFaq = (i: number, patch: Partial<Faq>) => set("faq", (b.faq ?? []).map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <Modal title={initial ? "Editar bloco" : "Novo bloco"} icon={<Layers size={18} />} color={color}
      onClose={onClose} onSubmit={submit} onDelete={onDelete} deleteLabel="Excluir bloco" isNew={!initial}>
      <div className="grid grid-cols-[1fr_100px] gap-2">
        <label className="block"><span className={label}>Nome do bloco</span>
          <input autoFocus value={b.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="Ex.: Etiquetas nos leads" className={field} />
        </label>
        <label className="block"><span className={label}>Minutos</span>
          <input type="number" min={0} max={600} value={b.minutes || ""} onChange={(e) => set("minutes", Number(e.target.value) || 0)} className={field} />
        </label>
      </div>

      <Section title="O que mostrar">
        <ListField items={b.show} onChange={(v) => set("show", v)} placeholder="Ex.: Onde ficam as etiquetas no lead" addLabel="Adicionar item" />
      </Section>

      <Section title="Exemplos para usar">
        {examples.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum exemplo no banco ainda.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {examples.map((e) => {
              const on = b.examples.includes(e.id);
              return (
                <button key={e.id} type="button" style={tint(e.color)} aria-pressed={on}
                  onClick={() => set("examples", on ? b.examples.filter((x) => x !== e.id) : [...b.examples, e.id])}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.7rem] transition ${on ? "border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_15%,transparent)] text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <Sparkles size={10} /> {e.title}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {(b.visuals?.length ?? 0) > 0 && (
        <Section title="Imagens de apoio">
          {b.visuals!.map((v, i) => (
            <VisualFields key={i} v={v} onChange={(nv) => set("visuals", b.visuals!.map((x, j) => (j === i ? nv : x)))} onRemove={() => set("visuals", b.visuals!.filter((_, j) => j !== i))} />
          ))}
        </Section>
      )}

      <Section title="Por que isso ajuda no dia a dia">
        <ListField items={b.why ?? []} onChange={(v) => set("why", v)} placeholder="Ex.: Acha todo mundo na mesma situação com um clique" addLabel="Adicionar motivo" />
      </Section>

      <Section title="Situação para contar" action={sc ? <button type="button" onClick={() => set("scenario", undefined)} className={`${small} hover:!text-pink`}><Trash2 size={11} /> Remover</button> : undefined}>
        {sc ? (
          <div className="space-y-2">
            <textarea value={sc.situation} onChange={(e) => set("scenario", { ...sc, situation: e.target.value })} rows={2} placeholder="A situação (ex.: a coordenadora pergunta…)" className={`${field} resize-none`} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <input value={sc.beforeLabel ?? ""} onChange={(e) => set("scenario", { ...sc, beforeLabel: e.target.value })} placeholder="Antes (ex.: Sem etiquetas)" className={`${field} !py-1.5 text-xs`} />
                <textarea value={sc.before} onChange={(e) => set("scenario", { ...sc, before: e.target.value })} rows={3} placeholder="Como fica sem" className={`${field} resize-none text-xs`} />
              </div>
              <div className="space-y-1.5">
                <input value={sc.afterLabel ?? ""} onChange={(e) => set("scenario", { ...sc, afterLabel: e.target.value })} placeholder="Depois (ex.: Com etiquetas)" className={`${field} !py-1.5 text-xs`} />
                <textarea value={sc.after} onChange={(e) => set("scenario", { ...sc, after: e.target.value })} rows={3} placeholder="Como fica com" className={`${field} resize-none text-xs`} />
              </div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => set("scenario", { situation: "", before: "", after: "", beforeLabel: "Antes", afterLabel: "Depois" })} className={small}><Plus size={11} /> Adicionar situação</button>
        )}
      </Section>

      <Section title="Dica">
        <textarea value={b.tip ?? ""} onChange={(e) => set("tip", e.target.value)} rows={2} maxLength={500} placeholder="Algo para lembrar na hora de explicar" className={`${field} resize-none`} />
      </Section>

      <Section title="Perguntas frequentes">
        {(b.faq ?? []).map((f, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <input value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} placeholder="Pergunta" className={`${field} !py-1.5`} />
              <textarea value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} rows={2} placeholder="Resposta" className={`${field} resize-none text-xs`} />
            </div>
            <button type="button" onClick={() => set("faq", (b.faq ?? []).filter((_, j) => j !== i))} aria-label="Excluir pergunta" className={iconBtn}><Trash2 size={13} /></button>
          </div>
        ))}
        <button type="button" onClick={() => set("faq", [...(b.faq ?? []), { q: "", a: "" }])} className={small}><Plus size={11} /> Adicionar pergunta</button>
      </Section>
    </Modal>
  );
}

/* ───────────── Exemplo ───────────── */
export function ExampleEditor({ initial, categories, onClose, onSave, onDelete }: {
  initial?: Example | undefined; categories: string[]; onClose: () => void; onSave: (e: Example) => void; onDelete?: (() => void) | undefined;
}) {
  const [e, setE] = useState<Example>(() => initial ? structuredClone(initial) : { id: newId("e"), title: "", cat: categories[0] ?? "Geral", color: "violet", situation: "", text: "" });
  const submit = () => {
    if (!e.title.trim()) return void toast.error("Dê um nome para o exemplo.");
    if (!e.text.trim()) return void toast.error("Escreva o exemplo.");
    onSave({ ...e, title: e.title.trim(), cat: e.cat.trim() || "Geral", situation: e.situation.trim(), text: e.text.trim(), visual: e.visual ? cleanVisual(e.visual) : undefined });
  };
  return (
    <Modal title={initial ? "Editar exemplo" : "Novo exemplo"} subtitle="Fica no Banco de exemplos e pode ser ligado aos blocos." icon={<Sparkles size={18} />} color={e.color}
      onClose={onClose} onSubmit={submit} onDelete={onDelete} deleteLabel="Excluir exemplo" isNew={!initial}>
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <label className="block"><span className={label}>Nome</span>
          <input autoFocus value={e.title} onChange={(x) => setE({ ...e, title: x.target.value })} maxLength={120} placeholder="Ex.: Etiqueta bem aplicada" className={field} />
        </label>
        <label className="block"><span className={label}>Categoria</span>
          <input value={e.cat} onChange={(x) => setE({ ...e, cat: x.target.value })} list="training-cats" maxLength={40} placeholder="Ex.: Etiquetas" className={field} />
          <datalist id="training-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
      </div>
      <label className="block"><span className={label}>Situação</span>
        <textarea value={e.situation} onChange={(x) => setE({ ...e, situation: x.target.value })} rows={2} maxLength={500} placeholder="Quando usar (ex.: lead pediu informações mas não falou de valores)" className={`${field} resize-none`} />
      </label>
      <label className="block"><span className={label}>Exemplo pronto</span>
        <textarea value={e.text} onChange={(x) => setE({ ...e, text: x.target.value })} rows={4} maxLength={2000} placeholder="O texto ou a resposta que você quer mostrar" className={`${field} resize-none`} />
      </label>
      <div><span className={label}>Cor</span><ColorPicker value={e.color} onChange={(color) => setE({ ...e, color })} /></div>
      {e.visual && (
        <Section title="Imagem">
          <VisualFields v={e.visual} onChange={(visual) => setE({ ...e, visual })} onRemove={() => setE({ ...e, visual: undefined })} />
        </Section>
      )}
    </Modal>
  );
}
