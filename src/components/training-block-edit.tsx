import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";

import { shiftMedia, type Block, type MediaFile, type Panel, type Table } from "@/lib/training-library";

const field = "w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[clamp(.9rem,1.3vw,1.15rem)] leading-snug outline-none transition focus:border-[var(--glow)]";
const cap = "mono-caps mb-1.5 block !text-[clamp(.65rem,.9vw,.85rem)] text-[var(--glow)]";

/** Move os arquivos dos passos quando um passo é removido (mantém cada arquivo no passo certo). */
const dropShow = (b: Block, i: number): Block => ({ ...b, show: b.show.filter((_, k) => k !== i), media: shiftMedia(b.media, i) });

/** Edição do bloco dentro da apresentação: troca palavras do que falar, dos passos, tabelas e quadros sem sair da tela. */
export function BlockEditInline({ block, onSave, onCancel }: { block: Block; onSave: (b: Block) => void; onCancel: () => void }) {
  const [b, setB] = useState<Block>(() => structuredClone(block));
  const set = <K extends keyof Block>(k: K, v: Block[K]) => setB((x) => ({ ...x, [k]: v }));
  const setShow = (i: number, t: string) => set("show", b.show.map((x, k) => (k === i ? t : x)));
  const setPanel = (i: number, p: Partial<Panel>) => set("panels", (b.panels ?? []).map((x, k) => (k === i ? { ...x, ...p } : x)));
  const setTable = (i: number, fn: (t: Table) => Table) => set("tables", (b.tables ?? []).map((x, k) => (k === i ? fn(x) : x)));
  const save = () => {
    const show = b.show.map((t) => t.trim());
    // passo apagado (vazio) sai da lista e leva os arquivos junto
    let clean: Block = { ...b, show };
    for (let i = show.length - 1; i >= 0; i--) if (!show[i]) clean = dropShow(clean, i);
    onSave({
      ...clean, title: clean.title.trim() || block.title, say: clean.say?.trim() || undefined, tip: clean.tip?.trim() || undefined,
      panels: clean.panels?.length ? clean.panels.map((p) => ({ ...p, title: p.title.trim(), lines: p.lines.map((l) => l.trim()).filter(Boolean) })).filter((p) => p.lines.length) : undefined,
    });
  };

  return (
    <div className="space-y-5" data-testid="editar-bloco-inline">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_8%,transparent)] p-3">
        <p className="mr-auto text-sm font-semibold">Editando este bloco</p>
        <button onClick={onCancel} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"><X size={14} /> Cancelar</button>
        <button onClick={save} data-testid="salvar-bloco-inline" className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:scale-105"><Check size={14} /> Salvar alterações</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <label><span className={cap}>Nome do bloco</span><input value={b.title} onChange={(e) => set("title", e.target.value)} maxLength={120} className={field} aria-label="Nome do bloco" /></label>
        <label><span className={cap}>Minutos</span><input type="number" min={0} max={600} value={b.minutes || ""} onChange={(e) => set("minutes", Math.max(0, Math.min(600, Number(e.target.value) || 0)))} className={field} aria-label="Minutos" /></label>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <span className={cap}>O que mostrar</span>
          <ul className="space-y-2">
            {b.show.map((t, i) => {
              const files: MediaFile[] = b.media?.[String(i)] ?? [];
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--glow)] text-xs text-[var(--glow)]">{i + 1}</span>
                  <textarea value={t} onChange={(e) => setShow(i, e.target.value)} rows={2} className={`${field} resize-y`} aria-label={`Passo ${i + 1}`} />
                  {files.length > 0 && <span className="mt-2 shrink-0 text-[0.65rem] text-cyan">{files.length} arq.</span>}
                  <button onClick={() => setB((x) => dropShow(x, i))} aria-label={`Remover passo ${i + 1}`} className="mt-2 text-muted-foreground hover:text-pink"><Trash2 size={15} /></button>
                </li>
              );
            })}
          </ul>
          <button onClick={() => set("show", [...b.show, ""])} className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[var(--glow)]"><Plus size={14} /> Adicionar passo</button>
        </div>
        <label className="block">
          <span className={cap}>O que falar</span>
          <textarea value={b.say ?? ""} onChange={(e) => set("say", e.target.value)} rows={Math.min(24, Math.max(10, Math.ceil((b.say?.length ?? 0) / 70)))} maxLength={12000} className={`${field} resize-y`} aria-label="O que falar" placeholder="Escreva aqui o que você vai falar. Linha em branco separa os parágrafos." />
        </label>
      </div>

      {(b.panels ?? []).map((p, i) => (
        <div key={i} className="rounded-2xl border border-border p-3">
          <input value={p.title} onChange={(e) => setPanel(i, { title: e.target.value })} className={`${field} mb-2 font-semibold`} aria-label={`Título do quadro ${i + 1}`} />
          <textarea value={p.lines.join("\n")} onChange={(e) => setPanel(i, { lines: e.target.value.split("\n") })} rows={Math.max(2, p.lines.length)} className={`${field} resize-y`} aria-label={`Linhas do quadro ${i + 1}`} />
          <p className="mt-1 text-[0.7rem] text-muted-foreground">Uma linha por item.</p>
        </div>
      ))}

      {(b.tables ?? []).map((t, ti) => (
        <div key={ti} className="overflow-x-auto rounded-2xl border border-border p-3">
          <table className="w-full border-collapse"><thead><tr>{t.head.map((h, ci) => <th key={ci} className="p-1"><input value={h} onChange={(e) => setTable(ti, (x) => ({ ...x, head: x.head.map((y, k) => (k === ci ? e.target.value : y)) }))} className={`${field} font-semibold`} aria-label={`Coluna ${ci + 1}`} /></th>)}<th /></tr></thead>
            <tbody>{t.rows.map((r, ri) => (
              <tr key={ri}>{r.map((c, ci) => <td key={ci} className="p-1 align-top"><textarea value={c} rows={1} onChange={(e) => setTable(ti, (x) => ({ ...x, rows: x.rows.map((rr, a) => (a === ri ? rr.map((cc, k) => (k === ci ? e.target.value : cc)) : rr)) }))} className={`${field} resize-y`} aria-label={`Linha ${ri + 1}, coluna ${ci + 1}`} /></td>)}
                <td className="p-1"><button onClick={() => setTable(ti, (x) => ({ ...x, rows: x.rows.filter((_, a) => a !== ri) }))} aria-label={`Remover linha ${ri + 1}`} className="text-muted-foreground hover:text-pink"><Trash2 size={14} /></button></td></tr>
            ))}</tbody></table>
          <button onClick={() => setTable(ti, (x) => ({ ...x, rows: [...x.rows, x.head.map(() => "")] }))} className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[var(--glow)]"><Plus size={14} /> Adicionar linha</button>
        </div>
      ))}

      <label className="block"><span className={cap}>Dica só para você (a turma não vê)</span><textarea value={b.tip ?? ""} onChange={(e) => set("tip", e.target.value)} rows={2} className={`${field} resize-y`} aria-label="Dica" /></label>
    </div>
  );
}
