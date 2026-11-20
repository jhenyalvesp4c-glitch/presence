/** Uma ideia por inteiro: editar, desenvolver com o Orion (perguntas, riscos, passos, o que precisa) e transformar em projeto, tarefa, lembrete ou documentação. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, Paperclip, BellRing, BookOpen, CheckSquare, ExternalLink, FolderKanban, HelpCircle, Loader2, Sparkles, Trash2, X } from "lucide-react";

import { Burst, Thinking } from "@/components/ideas/fx";
import { backdropProps } from "@/lib/backdrop";
import { ideaFileUrls, useIdeaActions } from "@/lib/data/ideas";
import { developIdea } from "@/lib/ideas.functions";
import { AREAS, STATUSES, cleanLinks, cleanTags, ideaText, type Conversion, type Idea, type IdeaPlan, type IdeaStatus } from "@/lib/ideas";

const field = "mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition focus:border-violet/60";
const btn = "inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm transition hover:border-white/25 hover:bg-white/[0.08] disabled:pointer-events-none disabled:opacity-45";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const CONV_LINK: Record<Conversion["tipo"], (c: Conversion) => string> = { projeto: (c) => `/demandas?projeto=${encodeURIComponent(c.id)}`, tarefa: () => "/tarefas", lembrete: () => "/tarefas", documentacao: () => "/cerebro" };
const CONV_LABEL: Record<Conversion["tipo"], string> = { projeto: "Projeto", tarefa: "Tarefa", lembrete: "Lembrete", documentacao: "Documentação" };

export function IdeaDetail({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const acts = useIdeaActions(), navigate = useNavigate();
  const [title, setTitle] = useState(idea.title), [body, setBody] = useState(idea.body), [tags, setTags] = useState(idea.tags.join(", ")), [links, setLinks] = useState(idea.links.join("\n"));
  const [plan, setPlan] = useState<IdeaPlan | null>(idea.plan), [answers, setAnswers] = useState<string[]>(idea.plan?.perguntas.map((p) => p.a) ?? []);
  const [busy, setBusy] = useState<"" | "plano" | "projeto" | "tarefa" | "lembrete" | "doc">(""), [rem, setRem] = useState(false), [burst, setBurst] = useState(0), [drag, setDrag] = useState(false), pick = useRef<HTMLInputElement>(null), [date, setDate] = useState(today()), [time, setTime] = useState("");
  const [urls, setUrls] = useState<Record<string, { view: string; download: string }>>({});
  useEffect(() => { if (idea.attachments.length) void ideaFileUrls(idea.attachments).then(setUrls).catch(() => undefined); }, [idea.attachments]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);

  const draft = useMemo<Idea>(() => ({ ...idea, title, body, tags: cleanTags(tags.split(",")), links: cleanLinks(links.split(/\s+/)), plan }), [idea, title, body, tags, links, plan]);
  const dirty = title !== idea.title || body !== idea.body || tags !== idea.tags.join(", ") || links !== idea.links.join("\n");
  const save = async () => { try { await acts.update.mutateAsync({ id: idea.id, title, body, tags: draft.tags, links: draft.links }); toast.success("Salvo"); } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); } };
  const setStatus = (s: IdeaStatus) => acts.update.mutate({ id: idea.id, status: s }, { onError: (e) => toast.error(e.message) });

  const develop = async (withAnswers: boolean) => {
    setBusy("plano");
    try {
      const prev = plan ? { ...plan, perguntas: plan.perguntas.map((p, i) => ({ q: p.q, a: withAnswers ? (answers[i] ?? p.a) : p.a })) } : null;
      const r = await developIdea({ data: { texto: ideaText({ ...draft, plan: null }), plano: prev } });
      if (!r.ok) { toast.error(r.error); return; }
      setPlan(r.plano); setAnswers(r.plano.perguntas.map((p) => p.a));
      await acts.update.mutateAsync({ id: idea.id, plan: r.plano, ...(idea.status === "solta" ? { status: "explorando" as const } : {}) });
    } catch (e) { toast.error(`Não consegui desenvolver: ${(e as Error).message}`); }
    setBusy("");
  };
  const saveAnswers = async () => { if (!plan) return; const next = { ...plan, perguntas: plan.perguntas.map((p, i) => ({ ...p, a: answers[i] ?? p.a })) }; setPlan(next); await acts.update.mutateAsync({ id: idea.id, plan: next }).catch(() => undefined); };

  const run = async (kind: "projeto" | "tarefa" | "lembrete" | "doc") => {
    if (dirty) await save();
    setBusy(kind);
    try {
      if (kind === "projeto") { const r = await acts.toProject.mutateAsync({ ...draft }); setBurst(Date.now()); toast.success("Projeto criado", { description: "Com os primeiros passos como demandas.", action: { label: "Abrir", onClick: () => void navigate({ to: "/demandas", search: { projeto: r.id } as never }) } }); setTimeout(onClose, 900); }
      else if (kind === "tarefa") { await acts.toTask.mutateAsync({ ...draft }); toast.success("Virou tarefa", { description: "Está em Tarefas." }); }
      else if (kind === "lembrete") { await acts.toReminder.mutateAsync({ idea: { ...draft }, date, time: time || null }); toast.success("Lembrete criado"); setRem(false); }
      else { await acts.toDoc.mutateAsync({ ...draft }); toast.success("Guardado como documentação", { description: "Está no segundo cérebro; a ideia foi arquivada." }); }
    } catch (e) { toast.error(`Não consegui: ${(e as Error).message}`); }
    setBusy("");
  };
  const remove = () => { if (window.confirm(`Excluir "${idea.title}"? Não dá para desfazer.`)) acts.remove.mutate(idea, { onSuccess: onClose, onError: (e) => toast.error(e.message) }); };
  const isRef = idea.kind === "referencia";
  const attach = async (list: File[]) => {
    if (!list.length) return;
    try {
      const r = await acts.addFiles.mutateAsync({ idea, files: list });
      if (r.added) toast.success(r.added === 1 ? "Referência anexada" : `${r.added} referências anexadas`);
      if (r.rejected.length) toast.error(`Não anexei: ${r.rejected.join(", ")}`);
    } catch (e) { toast.error(`Não consegui anexar: ${(e as Error).message}`); }
  };
  // colar um print (Ctrl/Cmd+V) em qualquer lugar da ideia, exceto dentro de campos de texto com texto colado
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = [...(e.clipboardData?.files ?? [])];
    if (!imgs.length) return;
    e.preventDefault();
    void attach(imgs.map((f, n) => (f.name && f.name !== "image.png" ? f : new File([f], `print-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}${imgs.length > 1 ? `-${n + 1}` : ""}.${(f.type.split("/")[1] ?? "png").replace("jpeg", "jpg")}`, { type: f.type }))));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 p-3 backdrop-blur-md sm:p-6" {...backdropProps(onClose)} data-testid="ideia-detalhe">
      {burst > 0 && <Burst key={burst} />}
      <div onClick={(e) => e.stopPropagation()} onPaste={onPaste} onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void attach([...e.dataTransfer.files]); }} className="fin-frame glass capture-glow relative mx-auto w-full max-w-3xl rounded-3xl bg-background/70 p-5 animate-rise sm:p-7" style={{ "--glow": "var(--violet)" } as React.CSSProperties}>
        <div className="flex items-start gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Título" data-testid="ideia-titulo" className="min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold outline-none" />
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Estado">
          {STATUSES.map((s) => <button key={s.id} role="radio" aria-checked={idea.status === s.id} onClick={() => setStatus(s.id)} title={s.hint} data-testid={`ideia-estado-${s.id}`}
            className={`rounded-full border px-3 py-1 text-xs transition ${idea.status === s.id ? "border-violet/60 bg-violet/15 text-violet" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{s.label}</button>)}
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <select value={idea.area} onChange={(e) => acts.update.mutate({ id: idea.id, area: e.target.value as "pessoal" | "negocios" })} aria-label="Área" className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-foreground">{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
            <button onClick={() => acts.update.mutate({ id: idea.id, kind: isRef ? "ideia" : "referencia" })} className="rounded-full border border-white/10 px-2.5 py-1 hover:text-foreground">{isRef ? "Virar ideia" : "Mandar para o mural"}</button>
          </span>
        </div>

        <label className="mt-4 block text-xs text-muted-foreground">Detalhes<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={8000} data-testid="ideia-corpo" className={`${field} resize-y`} /></label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">Etiquetas (separadas por vírgula)<input value={tags} onChange={(e) => setTags(e.target.value)} className={field} placeholder="viagem, casa" /></label>
          <label className="block text-xs text-muted-foreground">Links (um por linha)<textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} className={`${field} resize-none font-mono text-xs`} /></label>
        </div>
        <section className={`mt-4 rounded-2xl border border-dashed p-3 transition ${drag ? "border-cyan/70 bg-cyan/10" : "border-white/15 bg-black/15"}`} data-testid="ideia-referencias">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Paperclip size={13} /> Referências e arquivos {idea.attachments.length > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5 normal-case tracking-normal">{idea.attachments.length}</span>}</h3>
            <button type="button" onClick={() => pick.current?.click()} disabled={acts.addFiles.isPending} className={btn} data-testid="ideia-anexar-arquivo">{acts.addFiles.isPending ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Adicionar</button>
            <input ref={pick} type="file" multiple className="hidden" data-testid="ideia-arquivo-input" onChange={(e) => { void attach([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>
          <p className="mt-1 text-[0.7rem] text-muted-foreground/80">{drag ? "Solte aqui para anexar" : "Cole um print (Ctrl+V), arraste arquivos para cá ou use Adicionar. Ficam guardados nesta ideia."}</p>
          {idea.attachments.length > 0 && <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{idea.attachments.map((a) => { const u = urls[a.path], img = a.mime.startsWith("image/"); return (
            <li key={a.path} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/25" data-testid="ideia-anexo">
              <a href={img ? u?.view : u?.download} target="_blank" rel="noreferrer" className="block">
                {img ? (u ? <img src={u.view} alt={a.name} className="h-24 w-full object-cover transition group-hover:scale-105" /> : <span className="grid h-24 w-full place-items-center text-xs text-muted-foreground">…</span>)
                  : <span className="grid h-24 w-full place-items-center px-2 text-center text-[0.7rem] text-muted-foreground"><Paperclip size={18} className="mb-1" />{a.name}</span>}
              </a>
              <button type="button" onClick={() => { if (window.confirm(`Remover "${a.name}" desta ideia?`)) acts.removeFile.mutate({ idea, path: a.path }, { onError: (e) => toast.error(e.message) }); }} aria-label={`Remover ${a.name}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 focus:opacity-100"><X size={12} /></button>
            </li>); })}</ul>}
        </section>
        {dirty && <div className="mt-3 flex justify-end"><button onClick={() => void save()} className={`${btn} !border-violet/50 text-violet`} data-testid="ideia-salvar">Salvar alterações</button></div>}

        {!isRef && <section className="card-premium mt-6 rounded-2xl !border-violet/30 p-4" data-testid="ideia-plano">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet/40 bg-violet/10 text-violet"><Sparkles size={16} /></span>
            <div className="mr-auto"><h3 className="font-display text-base font-semibold">Desenvolver com o Orion</h3><p className="text-xs text-muted-foreground">Perguntas que faltam, riscos, primeiros passos e o que seria preciso.</p></div>
            <button onClick={() => void develop(false)} disabled={busy !== ""} className={`${btn} !border-violet/50 text-violet`} data-testid="ideia-desenvolver">{busy === "plano" ? <><Loader2 size={15} className="animate-spin" /> Pensando…</> : plan ? "Refazer o plano" : "Desenvolver"}</button>
          </div>
          {busy === "plano" && <Thinking />}
          {plan && busy !== "plano" && <div className="mt-4 space-y-4 text-sm [&>*]:[animation:fin-rise_.6s_both] [&>*:nth-child(2)]:[animation-delay:.08s] [&>*:nth-child(3)]:[animation-delay:.16s] [&>*:nth-child(4)]:[animation-delay:.24s] [&>*:nth-child(5)]:[animation-delay:.32s] [&>*:nth-child(6)]:[animation-delay:.4s]">
            {plan.resumo && <p>{plan.resumo}</p>}
            {plan.proximoPasso && <p className="rounded-xl border border-emerald/30 bg-emerald/10 px-3 py-2"><b className="text-emerald">Próximo passo (24 a 48 h):</b> {plan.proximoPasso}</p>}
            {plan.perguntas.length > 0 && <div><h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><HelpCircle size={13} /> Perguntas que faltam</h4>
              <ul className="space-y-2">{plan.perguntas.map((p, i) => <li key={p.q}><p>{p.q}</p><textarea value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => { const n = [...a]; n[i] = e.target.value; return n; })} rows={1} placeholder="Sua resposta (opcional)" data-testid={`ideia-resposta-${i}`} className={`${field} resize-y text-xs`} /></li>)}</ul>
              <div className="mt-2 flex gap-2"><button onClick={() => void saveAnswers()} className={btn}>Salvar respostas</button><button onClick={() => void develop(true)} disabled={busy !== "" || !answers.some((a) => a?.trim())} className={`${btn} !border-violet/50 text-violet`} data-testid="ideia-refinar">Responder e refinar o plano</button></div></div>}
            {plan.riscos.length > 0 && <div><h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><AlertTriangle size={13} /> Riscos</h4><ul className="list-disc space-y-0.5 pl-5">{plan.riscos.map((r) => <li key={r}>{r}</li>)}</ul></div>}
            {plan.passos.length > 0 && <div><h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primeiros passos</h4><ol className="list-decimal space-y-0.5 pl-5">{plan.passos.map((r) => <li key={r}>{r}</li>)}</ol></div>}
            <div className="grid gap-2 sm:grid-cols-3">{([["Tempo", plan.precisa.tempo], ["Dinheiro", plan.precisa.dinheiro], ["Pessoas", plan.precisa.pessoas]] as const).map(([k, v]) => <div key={k} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{k}</p><p className="mt-0.5 text-xs">{v || "—"}</p></div>)}</div>
            <p className="text-[0.65rem] text-muted-foreground">Estimativas do Orion a partir do que você contou: confira antes de decidir.</p>
          </div>}
        </section>}

        <section className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isRef ? "Usar esta referência" : "Fazer acontecer"}</h3>
          <div className="flex flex-wrap gap-2">
            {!isRef && <button onClick={() => void run("projeto")} disabled={busy !== ""} className={`${btn} !border-cyan/40 text-cyan`} data-testid="ideia-virar-projeto">{busy === "projeto" ? <Loader2 size={15} className="animate-spin" /> : <FolderKanban size={15} />} Virar projeto</button>}
            <button onClick={() => void run("tarefa")} disabled={busy !== ""} className={btn} data-testid="ideia-virar-tarefa"><CheckSquare size={15} /> Virar tarefa</button>
            <button onClick={() => setRem((v) => !v)} disabled={busy !== ""} className={btn} data-testid="ideia-virar-lembrete"><BellRing size={15} /> Virar lembrete</button>
            <button onClick={() => void run("doc")} disabled={busy !== ""} className={btn} data-testid="ideia-virar-doc"><BookOpen size={15} /> Guardar como documentação</button>
          </div>
          {rem && <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="text-xs text-muted-foreground">Dia<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} data-testid="ideia-lembrete-dia" /></label>
            <label className="text-xs text-muted-foreground">Hora (opcional)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} /></label>
            <button onClick={() => void run("lembrete")} disabled={busy !== "" || !date} className={`${btn} !border-emerald/50 text-emerald`} data-testid="ideia-lembrete-criar">{busy === "lembrete" ? <Loader2 size={15} className="animate-spin" /> : null} Criar lembrete</button>
          </div>}
          {idea.converted.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground" data-testid="ideia-convertidas">{idea.converted.map((c) => <li key={c.id + c.em} className="flex items-center gap-2"><span className="rounded-full border border-white/10 px-2 py-0.5">{CONV_LABEL[c.tipo]}</span><Link to={CONV_LINK[c.tipo](c) as never} className="inline-flex items-center gap-1 hover:text-foreground">{c.label}<ExternalLink size={11} /></Link></li>)}</ul>}
        </section>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-muted-foreground">
          <span>Criada em {idea.createdAt.slice(0, 10).split("-").reverse().join("/")}</span>
          <button onClick={remove} className="inline-flex items-center gap-1.5 hover:text-destructive"><Trash2 size={13} /> Excluir</button>
        </div>
      </div>
    </div>
  );
}
