import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, CheckCircle2, Circle, ClipboardList, Clock, Flag, Loader2, Mic, Plus, Search, Sparkles, Trash2, Type } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Panel, PlanShell, colorVar, tint } from "@/components/PlanShell";
import { useCreateDemand, useDeleteDemand, useDemands, useUpdateDemand } from "@/lib/data/demands";
import type { DemandRow, Priority } from "@/lib/types";

export const Route = createFileRoute("/demandas")({
  head: () => ({
    meta: [
      { title: "Presence · Demandas" },
      { name: "description", content: "Organize seus projetos, demandas e prioridades com a Presence." },
      { property: "og:title", content: "Presence · Demandas" },
      { property: "og:description", content: "Organize seus projetos e prioridades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Demandas,
});

type Status = DemandRow["status"];
const statusInfo: Record<Status, { label: string; c: string; next: Status }> = {
  nova: { label: "Nova", c: "cyan", next: "em_andamento" },
  em_andamento: { label: "Em andamento", c: "amber", next: "concluida" },
  concluida: { label: "Concluída", c: "emerald", next: "nova" },
};
const sourceLabel: Record<DemandRow["source"], string> = { voz: "Voz", texto: "Texto", assistente: "Assistente" };
const prioLabel: Record<Priority, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
const prioColor: Record<Priority, string> = { alta: "rose", media: "amber", baixa: "emerald" };
const prioNext: Record<Priority, Priority> = { media: "alta", alta: "baixa", baixa: "media" };
const tabs: { k: "todas" | Status; l: string }[] = [
  { k: "todas", l: "Todas" }, { k: "nova", l: "Novas" }, { k: "em_andamento", l: "Em andamento" }, { k: "concluida", l: "Concluídas" },
];

function Demandas() {
  const q = useDemands();
  const create = useCreateDemand();
  const update = useUpdateDemand();
  const del = useDeleteDemand();

  const [tab, setTab] = useState<"todas" | Status>("todas");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [prio, setPrio] = useState<Priority>("media");

  const all = q.data ?? [];
  const count = (s: Status) => all.filter((d) => d.status === s).length;
  const shown = useMemo(
    () => all.filter((d) => (tab === "todas" || d.status === tab) && d.title.toLowerCase().includes(search.toLowerCase())),
    [all, tab, search],
  );
  const onErr = (e: Error) => toast.error(e.message);

  const add = () => {
    if (!title.trim() || create.isPending) return;
    create.mutate(
      { title, description: desc.trim() || null, priority: prio },
      { onSuccess: () => { setTitle(""); setDesc(""); setPrio("media"); toast.success("Demanda registrada"); }, onError: onErr },
    );
  };

  const stats = [
    { n: all.length, l: "Demandas", Icon: ClipboardList, c: "cyan" },
    { n: count("nova") + count("em_andamento"), l: "Em aberto", Icon: Clock, c: "violet" },
    { n: count("concluida"), l: "Concluídas", Icon: CheckCircle2, c: "emerald" },
  ];

  return (
    <PlanShell active={2}>
      <section className="flex flex-wrap items-center justify-between gap-6 px-2">
        <div className="animate-rise">
          <p className="mono-caps">Projetos e prioridades</p>
          <h1 className="mt-2 font-serif text-5xl leading-none md:text-6xl">Minhas <span className="text-gradient italic">demandas</span></h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">Tudo o que você registra por voz, texto ou pela assistente fica aqui.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {stats.map(({ n, l, Icon, c }, i) => (
            <div key={l} className="accent-card flex items-center gap-3 px-4 py-3 animate-rise" style={{ ...tint(c), animationDelay: `${i * 0.1}s` }}>
              <span className="icon-tile h-11 w-11 rounded-full"><Icon size={20} /></span>
              <span><b className="block font-display text-2xl leading-none">{n}</b><span className="text-xs text-muted-foreground">{l}</span></span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="glass flex flex-wrap gap-1 rounded-2xl p-1.5">
            {tabs.map(({ k, l }) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition ${tab === k ? "bg-cyan/10 text-cyan shadow-[inset_0_0_0_1px_var(--cyan),0_0_20px_-6px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}>
                {l} <span className="font-mono text-xs opacity-70">{k === "todas" ? all.length : count(k)}</span>
              </button>
            ))}
          </div>

          <Panel c="cyan" className="flex flex-col">
            <label className="mb-3 flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-2 text-sm focus-within:border-cyan">
              <Search size={14} className="text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar demanda..." className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
            </label>
            <ul className="divide-y divide-border">
              {q.isPending && <li className="flex justify-center py-10"><Loader2 className="animate-spin text-cyan" /></li>}
              {q.isError && <li className="py-10 text-center text-sm text-destructive">Não consegui carregar: {q.error.message}</li>}
              {q.isSuccess && shown.length === 0 && (
                <li className="py-10 text-center text-sm text-muted-foreground">{all.length === 0 ? "Nenhuma demanda ainda. Registre a primeira ao lado ou pela página inicial." : "Nenhuma demanda encontrada."}</li>
              )}
              {shown.map((d, i) => {
                const st = statusInfo[d.status];
                const finished = d.status === "concluida";
                return (
                  <li key={d.id} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                    <button aria-label={`Status: ${st.label}. Clique para avançar`} title={`${st.label} → ${statusInfo[st.next].label}`}
                      onClick={() => update.mutate({ id: d.id, patch: { status: st.next } }, { onError: onErr })}
                      className="grid h-7 w-7 place-items-center rounded-full border transition hover:scale-110" style={{ color: colorVar(st.c), borderColor: colorVar(st.c) }}>
                      {finished ? <Check size={15} strokeWidth={3} /> : d.status === "em_andamento" ? <Clock size={14} /> : <Circle size={12} />}
                    </button>
                    <span className="min-w-0">
                      <b className={`block truncate text-sm font-semibold ${finished ? "text-muted-foreground line-through" : ""}`}>{d.title}</b>
                      <span className="block truncate text-xs text-muted-foreground">
                        {d.description ? `${d.description} · ` : ""}{format(new Date(d.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tag hidden sm:inline-flex" style={tint(st.c)}>{st.label}</span>
                      <span className="tag hidden items-center gap-1 md:inline-flex">{d.source === "voz" ? <Mic size={11} /> : d.source === "assistente" ? <Sparkles size={11} /> : <Type size={11} />}{sourceLabel[d.source]}</span>
                      <button aria-label={`Prioridade ${prioLabel[d.priority]}. Clique para mudar`} title={`Prioridade ${prioLabel[d.priority]}`}
                        onClick={() => update.mutate({ id: d.id, patch: { priority: prioNext[d.priority] } }, { onError: onErr })}
                        className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary" style={{ color: colorVar(prioColor[d.priority]) }}><Flag size={15} /></button>
                      <button aria-label="Excluir demanda" onClick={() => del.mutate(d.id, { onError: onErr })}
                        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground opacity-40 transition hover:text-destructive group-hover:opacity-100"><Trash2 size={15} /></button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <Panel c="violet" className="h-fit">
          <div className="flex items-center gap-3">
            <span className="icon-tile h-10 w-10 rounded-full"><Plus size={18} /></span>
            <span><b className="block font-display text-base">Nova demanda</b><span className="text-xs text-muted-foreground">Registre algo para não esquecer.</span></span>
          </div>
          <div className="mt-4 space-y-2.5">
            <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="O que precisa ser feito?" maxLength={300}
              className="w-full rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={5000} placeholder="Detalhes (opcional)"
              className="w-full resize-none rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet" />
            <button type="button" onClick={() => setPrio(prioNext[prio])}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:border-violet">
              <Flag size={14} style={{ color: colorVar(prioColor[prio]) }} /> Prioridade {prioLabel[prio].toLowerCase()}
            </button>
            <button onClick={add} disabled={create.isPending}
              className="shine flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-8px_var(--cyan)] transition hover:scale-[1.02] disabled:opacity-60">
              {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Registrar demanda
            </button>
          </div>
        </Panel>
      </div>
    </PlanShell>
  );
}
