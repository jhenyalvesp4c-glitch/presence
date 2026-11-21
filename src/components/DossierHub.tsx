/**
 * Página do dossiê (Documentação): tudo que está ligado ao dossiê numa tela só: documentos da pasta, demandas, logins,
 * reuniões, registros e o cliente. Aparece quando a pasta está vinculada a um dossiê.
 */
import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Building2, CalendarClock, Check, ClipboardList, FileText, KeyRound, Layers, NotebookPen } from "lucide-react";

import { Meter, Ring } from "@/components/finance/charts";
import { HeroPanel, LiveDot } from "@/components/finance/fx";
import { useDossierHub, useFreeMeetingsForHub, useHubActions } from "@/lib/data/dossier-hub";
import { STATUS_LABEL, STATUS_TONE, brl, dateBR, dueOf } from "@/lib/clients";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
export type HubDoc = { id: string; title: string; kind: string; updated: string };
export type HubLogin = { id: string; title: string; user: string; owner: string };
type Tab = "geral" | "docs" | "dem" | "log" | "reun" | "reg" | "cli";

export function DossierHub({ projectId, dossier, docs, logins, onOpenDoc, onOpenLogin }: { projectId: string; dossier: { id: string; name: string }; docs: HubDoc[]; logins: HubLogin[]; onOpenDoc: (id: string) => void; onOpenLogin: (id: string) => void }) {
  const hub = useDossierHub(projectId, dossier), acts = useHubActions(projectId, dossier.id), free = useFreeMeetingsForHub().data ?? [];
  const [tab, setTab] = useState<Tab>("geral"), [pick, setPick] = useState("");
  const d = hub.data, dem = d?.demands ?? [], done = dem.filter((x) => x.status === "done").length, open = dem.length - done, pct = dem.length ? Math.round((done / dem.length) * 100) : 0;
  const err = (e: unknown) => toast.error(`Não consegui salvar: ${(e as Error).message}`);
  const tabs: [Tab, string, typeof FileText, number][] = [["geral", "Visão geral", Layers, 0], ["docs", "Documentos", FileText, docs.length], ["dem", "Demandas", ClipboardList, open], ["log", "Logins", KeyRound, logins.length], ["reun", "Reuniões", CalendarClock, d?.meetings.length ?? 0], ["reg", "Registros", NotebookPen, d?.records.length ?? 0], ["cli", "Cliente", Building2, d?.clients.length ?? 0]];
  const stats = [{ l: "Documentos", v: docs.length, c: "var(--cyan)", t: "docs" as Tab }, { l: "Demandas abertas", v: open, c: "var(--violet)", t: "dem" as Tab }, { l: "Logins", v: logins.length, c: "var(--amber)", t: "log" as Tab }, { l: "Reuniões", v: d?.meetings.length ?? 0, c: "var(--emerald)", t: "reun" as Tab }];

  return (
    <HeroPanel glow="var(--violet)" data-testid="dossie-pagina" className="!p-4 sm:!p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Ring pct={pct} color="var(--emerald)" size={78} thickness={7}><span className="text-xs font-semibold tabular-nums">{dem.length ? `${pct}%` : "—"}</span></Ring>
        <div className="mr-auto min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="mono-caps">Página do dossiê</p><LiveDot color="var(--violet)" label="vinculado" /></div>
          <h3 className="font-display text-2xl font-semibold leading-tight">{dossier.name}</h3>
          <p className="text-xs text-muted-foreground">{dem.length ? `${done} de ${dem.length} demandas concluídas` : "Nenhuma demanda neste dossiê"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{stats.map((s, i) => (
          <button key={s.l} onClick={() => setTab(s.t)} className="rounded-2xl border bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.07]" style={{ borderColor: `color-mix(in oklab, ${s.c} 28%, transparent)`, animation: `fin-rise .5s ${i * 0.06}s both` }}>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em]" style={{ color: s.c }}>{s.l}</p><p className="font-display text-xl font-semibold tabular-nums">{s.v}</p></button>))}</div>
      </div>
      <div className="mt-4"><Meter pct={pct} color="var(--emerald)" height={5} warn={false} /></div>

      <div role="tablist" className="mt-4 flex flex-wrap gap-x-1 border-b border-white/10">{tabs.map(([k, l, I, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`dossie-aba-${k}`} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition ${tab === k ? "border-cyan text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}><I size={12} /> {l}{n > 0 && <span className="tag !px-1.5 !py-0 !text-[0.6rem]" style={tint("cyan")}>{n}</span>}</button>)}</div>

      <div className="mt-4 space-y-2">
        {tab === "geral" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Block title="Demandas em aberto" empty="Nada em aberto." items={dem.filter((x) => x.status !== "done").slice(0, 4).map((x) => ({ k: x.code, t: x.title, s: x.deadline ? `prazo ${x.deadline}` : x.priority }))} more={() => setTab("dem")} />
            <Block title="Últimos documentos" empty="Nenhum documento na pasta." items={docs.slice(0, 4).map((x) => ({ k: x.id, t: x.title, s: x.kind, go: () => onOpenDoc(x.id) }))} more={() => setTab("docs")} />
            <Block title="Reuniões" empty="Nenhuma reunião vinculada." items={(d?.meetings ?? []).slice(0, 3).map((x) => ({ k: x.id, t: x.title, s: dateBR(x.happenedOn) }))} more={() => setTab("reun")} />
            <Block title="Registros e notas" empty="Nenhum registro com este dossiê." items={(d?.records ?? []).slice(0, 3).map((x) => ({ k: x.id, t: x.title, s: x.kind === "nota" ? "nota" : dateBR(x.date) }))} more={() => setTab("reg")} />
          </div>)}
        {tab === "docs" && (docs.length ? docs.map((x) => <Row key={x.id} icon={FileText} tone="cyan" title={x.title} sub={`${x.kind} · ${x.updated}`} onClick={() => onOpenDoc(x.id)} />) : <Empty>Nenhum documento na pasta. Use <b>+ Documento</b> para criar contratos, atas, propostas e o que precisar.</Empty>)}
        {tab === "dem" && (dem.length ? dem.map((x) => <button key={x.code} onClick={() => acts.setDemand.mutate({ code: x.code, status: x.status === "done" ? "todo" : "done" }, { onError: err })} className="ex-card flex w-full items-center gap-3 p-3 text-left" style={{ "--rail": "var(--emerald)" } as CSSProperties}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${x.status === "done" ? "border-emerald bg-emerald/20 text-emerald" : "border-white/20"}`}>{x.status === "done" && <Check size={12} />}</span><div className="min-w-0"><p className={`truncate text-sm font-medium ${x.status === "done" ? "text-muted-foreground line-through" : ""}`}>{x.title}</p><p className="text-xs text-muted-foreground">{x.code}{x.deadline && ` · prazo ${x.deadline}`}</p></div></button>) : <Empty>Nenhuma demanda com o dossiê “{dossier.name}”. Crie na aba Demandas e escolha este dossiê.</Empty>)}
        {tab === "log" && (logins.length ? logins.map((x) => <Row key={x.id} icon={KeyRound} tone="amber" title={x.title} sub={`${x.user}${x.owner ? ` · ${x.owner}` : ""}`} onClick={() => onOpenLogin(x.id)} />) : <Empty>Nenhum login para “{dossier.name}”. Cadastre em <b>Logins dos Dossiês</b>, escolhendo este dossiê. Senhas ficam só neste navegador.</Empty>)}
        {tab === "reun" && <>
          {(d?.meetings ?? []).map((x) => <div key={x.id} className="ex-card flex items-center gap-3 p-3" style={{ "--rail": "var(--violet)" } as CSSProperties}><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg font-mono text-[0.6rem]" style={tint("violet")}>ATA</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{x.title}</p><p className="text-xs text-muted-foreground">{dateBR(x.happenedOn)}</p></div><button onClick={() => acts.linkMeeting.mutate({ meetingId: x.id, link: false }, { onError: err })} className="rounded-full border border-white/15 px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Desvincular</button></div>)}
          {(d?.meetings.length ?? 0) === 0 && <Empty>Nenhuma reunião vinculada a este dossiê.</Empty>}
          {free.length > 0 && <div className="flex gap-2"><select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Reunião para vincular" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs"><option value="">Vincular uma reunião…</option>{free.map((m) => <option key={m.id} value={m.id}>{dateBR(m.happened_on)} · {m.title}</option>)}</select><button disabled={!pick} onClick={() => acts.linkMeeting.mutate({ meetingId: pick, link: true }, { onSuccess: () => setPick(""), onError: err })} className="rounded-full border border-cyan/60 px-4 text-xs text-cyan disabled:opacity-40">Vincular</button></div>}
          <Link to="/reunioes" className="block text-center text-xs text-cyan hover:underline">Abrir Reuniões</Link></>}
        {tab === "reg" && ((d?.records.length ?? 0) ? (d?.records ?? []).map((x) => <div key={x.id} className="ex-card p-3" style={{ "--rail": "var(--cyan)" } as CSSProperties}><p className="mono-caps">{x.kind === "nota" ? "Nota" : "Registro"} · {x.kind === "nota" ? x.date : dateBR(x.date)}</p><p className="line-clamp-3 whitespace-pre-wrap text-sm">{x.text}</p></div>) : <Empty>Nenhum registro ou nota marcado com este dossiê.</Empty>)}
        {tab === "cli" && ((d?.clients.length ?? 0) ? (d?.clients ?? []).map((c) => { const due = dueOf(c); return <div key={c.id} className="ex-card flex flex-wrap items-center gap-3 p-3" style={{ "--rail": "var(--amber)" } as CSSProperties}><span className="icon-tile h-10 w-10 shrink-0 !rounded-xl" style={tint("amber")}><Building2 size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.contactName || "sem contato"} · {c.monthlyValue ? `${brl(c.monthlyValue)}/mês` : "sem valor"} · fim {dateBR(c.contractEnd)}{due.days !== null && due.level === "soon" ? " (vence logo)" : ""}</p></div><span className="tag !py-0.5 !text-[0.7rem]" style={tint(STATUS_TONE[c.status])}>{STATUS_LABEL[c.status]}</span></div>; }) : <Empty>Nenhum cliente vinculado a este dossiê. Em <b>Clientes</b>, escolha este dossiê no cadastro.</Empty>)}
      </div>
    </HeroPanel>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-muted-foreground">{children}</p>; }
function Row({ icon: I, tone, title, sub, onClick }: { icon: typeof FileText; tone: string; title: string; sub: string; onClick: () => void }) {
  return <button onClick={onClick} className="ex-card flex w-full items-center gap-3 p-3 text-left" style={{ "--rail": `var(--${tone})` } as CSSProperties}><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg" style={tint(tone)}><I size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{title}</p><p className="truncate text-xs text-muted-foreground">{sub}</p></div></button>;
}
function Block({ title, items, empty, more }: { title: string; items: { k: string; t: string; s: string; go?: () => void }[]; empty: string; more: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between"><p className="mono-caps">{title}</p><button onClick={more} className="text-[0.65rem] text-cyan hover:underline">ver tudo</button></div>
      {items.length === 0 ? <p className="py-2 text-xs text-muted-foreground">{empty}</p> : <ul className="space-y-1.5">{items.map((i) => <li key={i.k}><button onClick={i.go} disabled={!i.go} className="flex w-full items-baseline justify-between gap-3 text-left text-sm enabled:hover:text-cyan"><span className="min-w-0 truncate">{i.t}</span><span className="shrink-0 text-[0.65rem] text-muted-foreground">{i.s}</span></button></li>)}</ul>}
    </div>
  );
}
