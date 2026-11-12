import { useEffect, useState, type CSSProperties } from "react";
import { AlertTriangle, CalendarClock, Check, ChevronDown, ClipboardList, FileText, Folder, Paperclip, Pencil, Repeat, StickyNote, Trash2, Bell, ListChecks, BookOpen } from "lucide-react";
import { CATEGORY_SLUGS, type Tipo } from "@/lib/mcp/records";
import { DESTINOS, convertTipo, titleOf, type Draft, type InboxItem } from "@/lib/inbox";
import type { InboxContext } from "@/lib/inbox.functions";
import type { LocalFile } from "./files";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const field = "w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none transition focus:border-cyan/60";
const sel = `${field} [&>option]:bg-popover`;

const ICON: Record<Tipo, typeof Folder> = {
  demanda: ClipboardList, compromisso: CalendarClock, lembrete: Bell, tarefa: ListChecks, rotina: Repeat, anotacao: StickyNote, documentacao: BookOpen, evidencia: Paperclip,
};
const PRIO = [["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]] as const;

type Spec = { k: string; label: string; kind: "text" | "area" | "date" | "time" | "select" | "project" | "dossie" | "dossies" | "lines" | "number"; options?: readonly (readonly [string, string])[]; show?: (d: Draft) => boolean };

const SPECS: Record<Tipo, Spec[]> = {
  demanda: [
    { k: "projeto_id", label: "Projeto", kind: "project" },
    { k: "escopo", label: "Alcance", kind: "select", options: [["geral", "Geral (sem polo)"], ["polo", "Um polo/dossiê"], ["multipolo", "Vários polos/dossiês"]] },
    { k: "dossie", label: "Polo / dossiê", kind: "dossie", show: (d) => d["escopo"] === "polo" },
    { k: "dossies", label: "Polos / dossiês", kind: "dossies", show: (d) => d["escopo"] === "multipolo" },
    { k: "titulo", label: "Título", kind: "text" }, { k: "descricao", label: "Descrição", kind: "area" },
    { k: "prioridade", label: "Prioridade", kind: "select", options: PRIO }, { k: "prazo", label: "Prazo", kind: "date" },
    { k: "status", label: "Status", kind: "select", options: [["a_fazer", "A fazer"], ["em_andamento", "Em andamento"], ["concluida", "Concluída"]] },
    { k: "categoria", label: "Categoria", kind: "text" },
    { k: "checklist", label: "Subtarefas (uma por linha; \"[x] \" na frente = concluída)", kind: "lines" }, { k: "responsavel", label: "Responsável", kind: "text" },
  ],
  compromisso: [
    { k: "titulo", label: "Título", kind: "text" },
    { k: "escopo", label: "Tipo", kind: "select", options: [["profissional", "Profissional"], ["pessoal", "Pessoal"]] },
    { k: "projeto_id", label: "Projeto", kind: "project", show: (d) => d["escopo"] === "profissional" },
    { k: "dossie", label: "Polo / dossiê", kind: "dossie", show: (d) => d["escopo"] === "profissional" },
    { k: "data", label: "Data", kind: "date" }, { k: "inicio", label: "Início", kind: "time" }, { k: "fim", label: "Término", kind: "time" },
    { k: "local", label: "Local / link", kind: "text" }, { k: "descricao", label: "Descrição", kind: "area" },
    { k: "lembrete_minutos_antes", label: "Lembrar X min antes", kind: "number" },
  ],
  lembrete: [
    { k: "texto", label: "O que lembrar", kind: "text" }, { k: "data", label: "Data", kind: "date" }, { k: "hora", label: "Hora", kind: "time" },
    { k: "projeto_id", label: "Projeto (opcional)", kind: "project" }, { k: "dossie", label: "Polo / dossiê", kind: "dossie" },
    { k: "prioridade", label: "Prioridade", kind: "select", options: PRIO }, { k: "detalhes", label: "Detalhes", kind: "area" },
  ],
  tarefa: [
    { k: "titulo", label: "Título", kind: "text" }, { k: "categoria", label: "Categoria", kind: "select" },
    { k: "prioridade", label: "Prioridade", kind: "select", options: PRIO }, { k: "data", label: "Data", kind: "date" }, { k: "hora", label: "Hora", kind: "time" },
    { k: "descricao", label: "Descrição", kind: "area" },
  ],
  rotina: [
    { k: "titulo", label: "Título", kind: "text" }, { k: "hora", label: "Hora (todo dia)", kind: "time" }, { k: "descricao", label: "Descrição", kind: "area" },
  ],
  anotacao: [
    { k: "projeto_id", label: "Projeto", kind: "project" }, { k: "dossie", label: "Polo / dossiê (opcional)", kind: "dossie" }, { k: "texto", label: "Anotação", kind: "area" },
  ],
  documentacao: [
    { k: "projeto_id", label: "Projeto", kind: "project" }, { k: "titulo", label: "Título", kind: "text" }, { k: "categoria", label: "Categoria", kind: "text" },
    { k: "situacao", label: "Quando usar", kind: "text" }, { k: "texto", label: "Procedimento / orientação", kind: "area" },
  ],
  evidencia: [{ k: "demanda", label: "Demanda (código ou ref)", kind: "text" }, { k: "texto", label: "Texto", kind: "area" }],
};

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** Resumo em "chips" do que foi identificado: projeto, polo, data, prioridade… */
function chips(d: Draft, ctx: InboxContext | null): { label: string; value: string; color: string }[] {
  const out: { label: string; value: string; color: string }[] = [];
  const proj = ctx?.projects.find((p) => p.id === d["projeto_id"]);
  if (proj) out.push({ label: "Projeto", value: proj.nome, color: "cyan" });
  else if (d["projeto_id"]) out.push({ label: "Projeto", value: str(d["projeto_id"]), color: "cyan" });
  const label = proj?.rotulo.singular ?? "Polo";
  if (d["dossie"]) out.push({ label, value: str(d["dossie"]), color: "violet" });
  if (Array.isArray(d["dossies"]) && d["dossies"].length) out.push({ label: proj?.rotulo.plural ?? "Polos", value: `${d["dossies"].length}: ${(d["dossies"] as string[]).join(", ")}`, color: "violet" });
  if (d["escopo"] && d.tipo === "demanda") out.push({ label: "Alcance", value: str(d["escopo"]), color: "emerald" });
  if (d.tipo === "compromisso" && d["escopo"]) out.push({ label: "Tipo", value: str(d["escopo"]), color: "emerald" });
  const when = [str(d["data"]) || str(d["prazo"]), str(d["inicio"]) || str(d["hora"])].filter(Boolean).join(" ");
  if (when) out.push({ label: d.tipo === "demanda" ? "Prazo" : "Quando", value: when, color: "amber" });
  if (d["prioridade"]) out.push({ label: "Prioridade", value: str(d["prioridade"]), color: "pink" });
  if (d["categoria"]) out.push({ label: "Categoria", value: str(d["categoria"]), color: "emerald" });
  return out;
}

export function RecordCard({ item, ctx, files, problems, warnings, duplicado, onChange, onRemove }: {
  item: InboxItem; ctx: InboxContext | null; files: LocalFile[]; problems: string[]; warnings: string[]; duplicado: string | undefined;
  onChange: (next: InboxItem) => void; onRemove: () => void;
}) {
  const d = item.registro;
  const dest = DESTINOS.find((x) => x.tipo === d.tipo)!;
  const Icon = ICON[d.tipo];
  const [open, setOpen] = useState(problems.length > 0);
  // Pendências novas abrem a edição sozinhas (por exemplo, depois de mudar o destino do cartão).
  useEffect(() => { if (problems.length > 0) setOpen(true); }, [problems.length]);
  const project = ctx?.projects.find((p) => p.id === d["projeto_id"]);
  const set = (k: string, v: Draft[string] | undefined) => {
    const next: Draft = { ...d };
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) delete next[k]; else next[k] = v;
    if (k === "projeto_id") { delete next["dossie"]; delete next["dossies"]; }
    onChange({ ...item, registro: next });
  };
  const bad = problems.length > 0;

  return (
    <article className={`accent-card relative flex flex-col gap-3 !rounded-2xl p-4 animate-rise ${bad ? "!border-destructive/50" : ""}`} style={tint(dest.cor)} data-testid="cartao" data-tipo={d.tipo}>
      <header className="flex items-start gap-2.5">
        <span className="icon-tile h-9 w-9 shrink-0 !rounded-xl"><Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <select value={d.tipo} onChange={(e) => onChange({ ...item, registro: convertTipo(d, e.target.value as Tipo) })} aria-label="Mover para outro destino"
              className="max-w-full cursor-pointer rounded-full border border-[color-mix(in_oklab,var(--glow)_40%,transparent)] bg-[color-mix(in_oklab,var(--glow)_10%,transparent)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--glow)] outline-none [&>option]:bg-popover [&>option]:text-foreground">
              {DESTINOS.filter((x) => x.tipo !== "evidencia" || d.tipo === "evidencia").map((x) => <option key={x.tipo} value={x.tipo}>{x.label}</option>)}
            </select>
            {item.motivo && <span className="truncate text-[0.62rem] text-muted-foreground" title={item.motivo}>{item.motivo}</span>}
          </div>
          <h4 className="mt-1.5 text-sm font-semibold leading-snug">{titleOf(d) || <span className="text-muted-foreground">(sem título)</span>}</h4>
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Fechar edição" : "Editar"} title="Revisar e editar" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-cyan"><Pencil size={14} /></button>
        <button onClick={onRemove} aria-label="Remover registro" title="Remover" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-destructive"><Trash2 size={14} /></button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {chips(d, ctx).map((c) => (
          <span key={c.label + c.value} className="tag !normal-case !tracking-normal !text-[0.65rem]" style={tint(c.color)}><b className="font-semibold opacity-70">{c.label}:</b> {c.value}</span>
        ))}
        {!chips(d, ctx).length && <span className="text-[0.65rem] text-muted-foreground">Nenhum detalhe preenchido ainda.</span>}
      </div>

      {bad && (
        <ul className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive" data-testid="pendencias-cartao">
          {problems.map((p, i) => <li key={i} className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {p}</li>)}
        </ul>
      )}
      {duplicado && (
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 p-2.5 text-xs text-amber">
          <input type="checkbox" checked={!!item.duplicadoOk} onChange={(e) => onChange({ ...item, duplicadoOk: e.target.checked })} className="mt-0.5 accent-[var(--amber)]" />
          <span>Já existe algo equivalente: {duplicado}. {item.duplicadoOk ? "Será criado mesmo assim." : "Será ignorado. Marque para criar mesmo assim."}</span>
        </label>
      )}
      {!duplicado && warnings.map((w, i) => <p key={i} className="text-[0.7rem] text-amber">{w}</p>)}

      {d.tipo === "demanda" && files.length > 0 && (
        <div className="rounded-xl border border-border bg-secondary/25 p-2.5">
          <p className="mono-caps mb-1.5 flex items-center gap-1.5 !text-[0.55rem]"><Paperclip size={10} /> Anexar como evidência</p>
          <div className="flex flex-wrap gap-1.5">
            {files.map((f) => {
              const on = item.anexos?.includes(f.name) ?? false;
              return (
                <button key={f.name} type="button" onClick={() => onChange({ ...item, anexos: on ? (item.anexos ?? []).filter((n) => n !== f.name) : [...(item.anexos ?? []), f.name] })} aria-pressed={on}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] transition ${on ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {on ? <Check size={10} /> : <FileText size={10} />} <span className="max-w-[140px] truncate">{f.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && (
        <div className="grid gap-2.5 border-t border-border pt-3 sm:grid-cols-2" data-testid="editor">
          {SPECS[d.tipo].filter((s) => !s.show || s.show(d)).map((s) => {
            const v = d[s.k];
            const wide = s.kind === "area" || s.kind === "lines" || s.kind === "dossies";
            return (
              <label key={s.k} className={`block text-[0.68rem] text-muted-foreground ${wide ? "sm:col-span-2" : ""}`}>
                {s.label}
                {s.kind === "text" && <input value={str(v)} onChange={(e) => set(s.k, e.target.value)} className={`${field} mt-1`} />}
                {s.kind === "area" && <textarea value={str(v)} onChange={(e) => set(s.k, e.target.value)} rows={3} className={`${field} mt-1 resize-y`} />}
                {s.kind === "date" && <input type="date" value={str(v)} onChange={(e) => set(s.k, e.target.value)} className={`${field} mt-1 [color-scheme:dark]`} />}
                {s.kind === "time" && <input type="time" value={str(v)} onChange={(e) => set(s.k, e.target.value)} className={`${field} mt-1 [color-scheme:dark]`} />}
                {s.kind === "number" && <input type="number" min={5} max={10080} value={str(v)} onChange={(e) => set(s.k, e.target.value ? Number(e.target.value) : undefined)} className={`${field} mt-1`} />}
                {s.kind === "lines" && <textarea value={Array.isArray(v) ? (v as string[]).join("\n") : ""} onChange={(e) => set(s.k, e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} rows={3} className={`${field} mt-1 resize-y`} />}
                {s.kind === "select" && (
                  <select value={str(v)} onChange={(e) => set(s.k, e.target.value)} className={`${sel} mt-1`}>
                    <option value="">—</option>
                    {(s.k === "categoria" ? (ctx?.categories ?? CATEGORY_SLUGS.map((c) => ({ slug: c, nome: c }))).map((c) => [c.slug, c.nome] as const) : (s.options ?? [])).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                  </select>
                )}
                {s.kind === "project" && (
                  <select value={str(v)} onChange={(e) => set(s.k, e.target.value)} className={`${sel} mt-1`}>
                    <option value="">—</option>
                    {ctx?.projects.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                )}
                {s.kind === "dossie" && (
                  <select value={str(v)} onChange={(e) => set(s.k, e.target.value)} className={`${sel} mt-1`} disabled={!project}>
                    <option value="">{project ? "—" : "Escolha o projeto antes"}</option>
                    {project?.dossies.map((x) => <option key={x.id} value={x.nome}>{x.nome}</option>)}
                  </select>
                )}
                {s.kind === "dossies" && (
                  <div className="scroll-neon mt-1 grid max-h-36 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-border bg-secondary/25 p-2 sm:grid-cols-3">
                    {!project && <span className="col-span-full text-xs">Escolha o projeto antes.</span>}
                    {project?.dossies.map((x) => {
                      const cur = Array.isArray(v) ? (v as string[]) : [];
                      const on = cur.includes(x.nome);
                      return (
                        <label key={x.id} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${on ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-border text-foreground/80"}`}>
                          <input type="checkbox" checked={on} onChange={() => set(s.k, on ? cur.filter((n) => n !== x.nome) : [...cur, x.nome])} className="accent-[var(--cyan)]" />
                          <span className="truncate">{x.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </label>
            );
          })}
          <button type="button" onClick={() => setOpen(false)} className="col-span-full flex items-center justify-center gap-1 text-[0.7rem] text-cyan"><ChevronDown size={12} className="rotate-180" /> Fechar edição</button>
        </div>
      )}
    </article>
  );
}
