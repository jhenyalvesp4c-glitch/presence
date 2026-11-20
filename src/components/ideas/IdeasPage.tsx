/** Caixa de ideias: captura rápida, resumo semanal, quadro por estado e mural de referências. */
import { useMemo, useState } from "react";
import { Archive, ArrowRight, ExternalLink, FolderKanban, Lightbulb, Link2, Mic, Camera, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PlanShell, Panel } from "@/components/PlanShell";
import { Capture } from "@/components/ideas/Capture";
import { IdeaDetail } from "@/components/ideas/IdeaDetail";
import { useIdeaActions, useIdeas } from "@/lib/data/ideas";
import { STATUSES, daysSince, digest, type Idea, type IdeaStatus } from "@/lib/ideas";

type Tab = "ideias" | "mural";
type Area = "todas" | "pessoal" | "negocios";
const SRC_ICON = { voz: Mic, print: Camera, texto: Lightbulb, orion: Sparkles } as const;
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs transition ${on ? "border-violet/60 bg-violet/15 text-violet" : "border-white/10 text-muted-foreground hover:text-foreground"}`;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function Card({ idea, now, onOpen }: { idea: Idea; now: Date; onOpen: () => void }) {
  const Icon = SRC_ICON[idea.source] ?? Lightbulb, age = daysSince(idea.touchedAt, now);
  return (
    <button onClick={onOpen} data-testid="ideia-card" className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-violet/40 hover:bg-white/[0.06]">
      <div className="flex items-start gap-2"><Icon size={13} className="mt-1 shrink-0 text-muted-foreground" /><p className="min-w-0 flex-1 text-sm font-medium leading-snug">{idea.title}</p></div>
      {idea.body && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{idea.body}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.65rem] text-muted-foreground">
        <span className="rounded-full border border-white/10 px-2 py-0.5">{idea.area === "negocios" ? "Negócios" : "Pessoal"}</span>
        {idea.plan && <span className="rounded-full border border-violet/30 px-2 py-0.5 text-violet">com plano</span>}
        {idea.converted.length > 0 && <span className="rounded-full border border-emerald/30 px-2 py-0.5 text-emerald">virou {idea.converted.length}</span>}
        {idea.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
        <span className="ml-auto">{age === 0 ? "hoje" : `${age}d`}</span>
      </div>
    </button>
  );
}

export function IdeasPage() {
  const { data: all = [], isLoading } = useIdeas(), acts = useIdeaActions();
  const [tab, setTab] = useState<Tab>("ideias"), [area, setArea] = useState<Area>("todas"), [q, setQ] = useState(""), [openId, setOpenId] = useState<string | null>(null), [showArch, setShowArch] = useState(false);
  const now = useMemo(() => new Date(), [all]);
  const ideas = useMemo(() => all.filter((i) => i.kind === "ideia"), [all]), refs = useMemo(() => all.filter((i) => i.kind === "referencia"), [all]);
  const dg = useMemo(() => digest(all, now), [all, now]);
  const term = q.trim().toLowerCase();
  const match = (i: Idea) => (area === "todas" || i.area === area) && (!term || `${i.title} ${i.body} ${i.tags.join(" ")}`.toLowerCase().includes(term));
  const open = all.find((i) => i.id === openId) ?? null;
  const setStatus = (i: Idea, s: IdeaStatus, msg: string) => acts.update.mutate({ id: i.id, status: s }, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  const touch = (i: Idea) => acts.update.mutate({ id: i.id, touch: true }, { onSuccess: () => toast.success("Ok, a ideia segue viva") });
  const cols = STATUSES.filter((s) => s.id !== "arquivada");

  return (
    <PlanShell active={3}>
      <section className="animate-rise">
        <p className="mono-caps">Projetos e ideias</p>
        <h1 className="mt-2 font-serif text-5xl leading-none md:text-6xl">Caixa de <span className="text-gradient italic">ideias</span></h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">Jogue aqui qualquer ideia, por texto, voz ou print. Depois desenvolva com o Orion e transforme em projeto, tarefa, lembrete ou documentação.</p>
      </section>

      <Capture onCreated={(i) => { if (i.kind === "ideia") setOpenId(i.id); }} />

      {dg.total > 0 && <Panel>
        <div className="flex items-center gap-2"><Sparkles size={15} className="text-violet" /><h2 className="font-display text-base font-semibold">Resumo da semana</h2></div>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="ideias-resumo">{dg.texto}</p>
        {dg.paradas.length > 0 && <ul className="mt-3 space-y-2">{dg.paradas.slice(0, 5).map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber/25 bg-amber/[0.05] px-3 py-2 text-sm" data-testid="ideia-parada">
            <button onClick={() => setOpenId(i.id)} className="mr-auto min-w-0 truncate text-left hover:underline">{i.title} <span className="text-xs text-muted-foreground">· parada há {daysSince(i.touchedAt, now)} dias</span></button>
            <button onClick={() => touch(i)} className={chip(false)}>Continuar</button>
            <button onClick={() => setStatus(i, "arquivada", "Arquivada")} className={`${chip(false)} inline-flex items-center gap-1`}><Archive size={11} /> Arquivar</button>
            <button onClick={() => setOpenId(i.id)} className={`${chip(true)} inline-flex items-center gap-1`}><FolderKanban size={11} /> Virar projeto</button>
          </li>))}</ul>}
      </Panel>}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setTab("ideias")} className={chip(tab === "ideias")} data-testid="aba-ideias">Ideias ({ideas.length})</button>
        <button onClick={() => setTab("mural")} className={chip(tab === "mural")} data-testid="aba-mural">Mural de referências ({refs.length})</button>
        <span className="mx-1 h-4 w-px bg-white/10" />
        {(["todas", "pessoal", "negocios"] as const).map((a) => <button key={a} onClick={() => setArea(a)} className={chip(area === a)}>{a === "todas" ? "Todas" : a === "pessoal" ? "Pessoal" : "Negócios"}</button>)}
        <label className="ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs"><Search size={13} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-32 bg-transparent outline-none" /></label>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : tab === "ideias" ? (
        ideas.length === 0 ? <Panel><p className="py-6 text-center text-sm text-muted-foreground">Sua caixa está vazia. Escreva a primeira ideia lá em cima, ou fale no microfone.</p></Panel> : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cols.map((c) => {
              const list = ideas.filter((i) => i.status === c.id && match(i));
              return <div key={c.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-3" data-testid={`coluna-${c.id}`}>
                <div className="mb-2 flex items-center justify-between px-1"><div><h3 className="text-sm font-semibold" style={{ color: `var(--${c.color})` }}>{c.label}</h3><p className="text-[0.65rem] text-muted-foreground">{c.hint}</p></div><span className="text-xs text-muted-foreground">{list.length}</span></div>
                <div className="space-y-2">{list.map((i) => <Card key={i.id} idea={i} now={now} onOpen={() => setOpenId(i.id)} />)}{list.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground/70">Nada aqui.</p>}</div>
              </div>;
            })}</div>
            {dg.porStatus.arquivada > 0 && <div>
              <button onClick={() => setShowArch((v) => !v)} className={chip(showArch)}>{showArch ? "Esconder" : "Ver"} arquivadas ({dg.porStatus.arquivada})</button>
              {showArch && <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{ideas.filter((i) => i.status === "arquivada" && match(i)).map((i) => <Card key={i.id} idea={i} now={now} onOpen={() => setOpenId(i.id)} />)}</div>}
            </div>}
          </>)
      ) : (
        refs.length === 0 ? <Panel><p className="py-6 text-center text-sm text-muted-foreground">O mural guarda prints e links de referência (inspiração, exemplos). Para mandar algo para cá, abra uma ideia e use "Mandar para o mural".</p></Panel> : (
          <div className="columns-1 gap-4 sm:columns-2 xl:columns-3" data-testid="mural">{refs.filter(match).map((i) => (
            <div key={i.id} className="mb-4 break-inside-avoid rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <button onClick={() => setOpenId(i.id)} className="text-left text-sm font-medium hover:underline">{i.title}</button>
              {i.body && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{i.body}</p>}
              {i.links.map((l) => <a key={l} href={l} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-xs text-cyan hover:underline"><Link2 size={11} />{host(l)}<ExternalLink size={10} /></a>)}
              {i.attachments.length > 0 && <p className="mt-2 text-[0.65rem] text-muted-foreground">{i.attachments.length} anexo(s)</p>}
              <button onClick={() => setOpenId(i.id)} className="mt-2 inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground">Abrir <ArrowRight size={11} /></button>
            </div>))}</div>)
      )}
      {open && <IdeaDetail key={open.id} idea={open} onClose={() => setOpenId(null)} />}
    </PlanShell>
  );
}
