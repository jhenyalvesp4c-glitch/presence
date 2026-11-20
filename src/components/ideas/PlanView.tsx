/** Plano final de uma ideia: documento único com detalhes, referências (imagens), perguntas e respostas, riscos, passos e o que precisa. Dá para imprimir/salvar em PDF ou guardar na documentação. */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { BookOpen, Loader2, Printer, X } from "lucide-react";

import { addEntry, type NewFile } from "@/lib/data/brain";
import { ideaFileUrls } from "@/lib/data/ideas";
import { AREAS, statusLabel, type Idea } from "@/lib/ideas";

const dateBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 mt-6 border-b border-neutral-200 pb-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-neutral-500">{children}</h3>;

/** Texto corrido do plano (vai para a documentação). */
export function planMarkdown(i: Idea): string {
  const p = i.plan, L = (t: string, xs: string[]) => (xs.length ? `\n${t}:\n${xs.map((x) => `- ${x}`).join("\n")}` : "");
  return [
    `PLANO FINAL: ${i.title}`, `${AREAS.find((a) => a.id === i.area)?.label ?? i.area} · ${statusLabel(i.status)}${i.tags.length ? ` · ${i.tags.map((t) => `#${t}`).join(" ")}` : ""}`,
    i.body && `\nDetalhes:\n${i.body}`, p?.resumo && `\nResumo: ${p.resumo}`, p?.proximoPasso && `\nPróximo passo: ${p.proximoPasso}`,
    p?.perguntas.length ? `\nPerguntas e respostas:\n${p.perguntas.map((q) => `- ${q.q}\n  → ${q.a || "(sem resposta)"}`).join("\n")}` : "",
    p ? L("Riscos", p.riscos) : "", p ? L("Primeiros passos", p.passos.map((x, n) => `${n + 1}. ${x}`)) : "",
    p ? `\nO que precisa: tempo — ${p.precisa.tempo || "—"}; dinheiro — ${p.precisa.dinheiro || "—"}; pessoas — ${p.precisa.pessoas || "—"}` : "",
    i.links.length ? L("Links", i.links) : "",
  ].filter(Boolean).join("\n");
}

export function PlanView({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const p = idea.plan, [urls, setUrls] = useState<Record<string, { view: string; download: string }>>({}), [saving, setSaving] = useState(false);
  const imgs = idea.attachments.filter((a) => a.mime.startsWith("image/")), others = idea.attachments.filter((a) => !a.mime.startsWith("image/"));
  useEffect(() => { if (idea.attachments.length) void ideaFileUrls(idea.attachments).then(setUrls).catch(() => undefined); }, [idea.attachments]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);

  const toDocs = async () => {
    setSaving(true);
    try {
      const files: NewFile[] = [];
      for (const a of idea.attachments) { const u = urls[a.path]; if (!u) continue; const r = await fetch(u.view); if (r.ok) files.push({ name: a.name, mime: a.mime, blob: await r.blob() }); }
      await addEntry({ title: `Plano final: ${idea.title}`.slice(0, 200), text: planMarkdown(idea).slice(0, 6000), files });
      toast.success("Plano guardado na documentação", { description: files.length ? `Com ${files.length} referência(s) anexada(s).` : undefined });
    } catch (e) { toast.error(`Não consegui guardar: ${(e as Error).message}`); }
    setSaving(false);
  };

  return createPortal(
    <div data-plano-portal className="fixed inset-0 z-[70] overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-8" onClick={onClose} data-testid="plano-final">
      <div className="mx-auto w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div data-print-hide className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20" data-testid="plano-imprimir"><Printer size={15} /> Imprimir / salvar PDF</button>
          <button onClick={() => void toDocs()} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/15 px-4 py-2 text-sm text-cyan hover:bg-cyan/25 disabled:opacity-50" data-testid="plano-guardar">{saving ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />} Guardar na documentação</button>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"><X size={16} /></button>
        </div>

        <article className="plano-paper overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-[0_30px_120px_-30px_var(--violet)]" style={{ animation: "fin-rise .5s both" }}>
          <header className="bg-gradient-to-r from-[oklch(0.45_0.18_295)] via-[oklch(0.5_0.16_250)] to-[oklch(0.62_0.13_210)] px-6 py-6 text-white sm:px-9">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] opacity-80">Plano final · Orion</p>
            <h2 className="mt-1 font-serif text-3xl leading-tight sm:text-4xl">{idea.title}</h2>
            <p className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/20 px-2.5 py-0.5">{AREAS.find((a) => a.id === idea.area)?.label}</span><span className="rounded-full bg-white/20 px-2.5 py-0.5">{statusLabel(idea.status)}</span>{idea.tags.map((t) => <span key={t} className="rounded-full bg-white/10 px-2.5 py-0.5">#{t}</span>)}</p>
          </header>

          <div className="px-6 pb-8 pt-2 text-sm leading-relaxed sm:px-9">
            {p?.proximoPasso && <p className="mt-5 rounded-xl border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3"><b className="text-emerald-700">Próximo passo:</b> {p.proximoPasso}</p>}
            {p?.resumo && <><H>Resumo</H><p>{p.resumo}</p></>}
            {idea.body && <><H>Detalhes</H><p className="whitespace-pre-wrap">{idea.body}</p></>}

            {imgs.length > 0 && <><H>Referências</H>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="plano-imagens">{imgs.map((a) => <li key={a.path} className="break-inside-avoid overflow-hidden rounded-xl border border-neutral-200">{urls[a.path] ? <a href={urls[a.path]!.view} target="_blank" rel="noreferrer"><img src={urls[a.path]!.view} alt={a.name} className="max-h-64 w-full object-cover" /></a> : <span className="grid h-32 place-items-center text-xs text-neutral-400">carregando…</span>}</li>)}</ul></>}
            {others.length > 0 && <p className="mt-3 text-xs text-neutral-500">Outros arquivos: {others.map((a) => a.name).join(", ")}</p>}

            {p && p.perguntas.length > 0 && <><H>Perguntas e respostas</H><ul className="space-y-3">{p.perguntas.map((q) => <li key={q.q} className="break-inside-avoid"><p className="font-medium">{q.q}</p><p className={q.a ? "text-neutral-700" : "italic text-neutral-400"}>{q.a || "Sem resposta ainda"}</p></li>)}</ul></>}
            {p && p.passos.length > 0 && <><H>Primeiros passos</H><ol className="list-decimal space-y-1 pl-5">{p.passos.map((x) => <li key={x}>{x}</li>)}</ol></>}
            {p && p.riscos.length > 0 && <><H>Riscos</H><ul className="list-disc space-y-1 pl-5">{p.riscos.map((x) => <li key={x}>{x}</li>)}</ul></>}
            {p && <><H>O que precisa</H><div className="grid gap-3 sm:grid-cols-3">{([["Tempo", p.precisa.tempo], ["Dinheiro", p.precisa.dinheiro], ["Pessoas", p.precisa.pessoas]] as const).map(([k, v]) => <div key={k} className="break-inside-avoid rounded-xl border border-neutral-200 bg-neutral-50 p-3"><p className="text-[0.65rem] font-bold uppercase tracking-wider text-neutral-500">{k}</p><p className="mt-1 text-xs">{v || "—"}</p></div>)}</div></>}
            {idea.links.length > 0 && <><H>Links</H><ul className="space-y-1">{idea.links.map((l) => <li key={l}><a href={l} target="_blank" rel="noreferrer" className="break-all text-blue-700 underline">{l}</a></li>)}</ul></>}
            {!p && <p className="mt-6 rounded-xl border border-dashed border-neutral-300 p-4 text-neutral-500">Esta ideia ainda não tem plano. Volte e use "Desenvolver com o Orion" para montar um.</p>}
            <p className="mt-8 border-t border-neutral-200 pt-3 text-[0.65rem] text-neutral-400">Criada em {dateBR(idea.createdAt)}{p ? ` · plano do Orion de ${dateBR(p.geradoEm)}` : ""} · estimativas do Orion a partir do que você contou: confira antes de decidir.</p>
          </div>
        </article>
      </div>
    </div>, document.body);
}
