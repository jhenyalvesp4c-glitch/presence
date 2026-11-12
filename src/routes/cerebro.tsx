import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Brain, Files, History, Network, Paperclip, Search, Sparkles, X } from "lucide-react";

import { PlanShell } from "@/components/PlanShell";
import { BrainGraph } from "@/components/brain/BrainGraph";
import { EntryCard, EntryDrawer, FileTile, brDate, entryTitle, tint, type Urls } from "@/components/brain/EntryViews";
import { OrionPanel } from "@/components/orion/OrionPanel";
import { deleteEntry, listAllEntries, signedUrls, todayIso, type BrainEntry } from "@/lib/data/brain";
import { normalize } from "@/lib/orion";

export const Route = createFileRoute("/cerebro")({
  head: () => ({
    meta: [
      { title: "Presence · Segundo cérebro" },
      { name: "description", content: "Tudo o que você documenta, anexa e registra no Presence, ligado e pesquisável." },
      { property: "og:title", content: "Presence · Segundo cérebro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CerebroPage,
});

type Tab = "linha" | "mapa" | "arquivos";
type Src = "todos" | "anotacoes" | "arquivos" | "documentacao";

const dayLabel = (iso: string) => {
  const t = todayIso();
  const y = new Date(`${t}T12:00:00Z`); y.setUTCDate(y.getUTCDate() - 1);
  if (iso === t) return "Hoje";
  if (iso === y.toISOString().slice(0, 10)) return "Ontem";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

function Stat({ icon: I, label, value, color }: { icon: typeof Brain; label: string; value: number; color: string }) {
  return (
    <div style={tint(color)} className="accent-card group flex items-center gap-3 !rounded-2xl px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-14px_var(--glow)]">
      <span className="icon-tile h-10 w-10 shrink-0 transition group-hover:scale-110 group-hover:rotate-6"><I size={17} /></span>
      <span><span className="block font-display text-2xl font-semibold leading-none tabular-nums">{value}</span><span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">{label}</span></span>
    </div>
  );
}

function CerebroPage() {
  const [entries, setEntries] = useState<BrainEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [urls, setUrls] = useState<Urls>({});
  const [tab, setTab] = useState<Tab>("linha");
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<Src>("todos");
  const [dossier, setDossier] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setEntries(await listAllEntries()); setError(""); }
    catch (e) { setError((e as Error).message); }
    setReady(true);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const paths = useMemo(() => entries.flatMap((e) => e.attachments.map((a) => a.path)), [entries]);
  useEffect(() => { signedUrls(paths).then(setUrls).catch(() => undefined); }, [paths.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const words = normalize(q).split(" ").filter(Boolean);
    return entries.filter((e) => {
      if (src === "anotacoes" && (e.source === "documentacao" || e.attachments.length)) return false;
      if (src === "arquivos" && !e.attachments.length) return false;
      if (src === "documentacao" && e.source !== "documentacao") return false;
      if (dossier && !e.dossiers.includes(dossier)) return false;
      if (!words.length) return true;
      const hay = normalize(`${e.title} ${e.text} ${e.summary} ${e.dossiers.join(" ")} ${e.attachments.map((a) => a.name).join(" ")}`);
      return words.every((w) => hay.includes(w));
    });
  }, [entries, q, src, dossier]);

  const groups = useMemo(() => {
    const m = new Map<string, BrainEntry[]>();
    for (const e of filtered) (m.get(e.date) ?? m.set(e.date, []).get(e.date)!).push(e);
    return [...m.entries()];
  }, [filtered]);
  const files = useMemo(() => filtered.flatMap((e) => e.attachments.map((a) => ({ a, e }))), [filtered]);
  const dossiers = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of entries) for (const d of e.dossiers) c.set(d, (c.get(d) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const remove = async (e: BrainEntry) => {
    if (!window.confirm(`Excluir "${entryTitle(e)}" do segundo cérebro? Os arquivos anexados também serão apagados.`)) return;
    try { await deleteEntry(e.id); setEntries((l) => l.filter((x) => x.id !== e.id)); setOpenId(null); toast.success("Excluído"); }
    catch (err) { toast.error((err as Error).message); }
  };

  const open = entries.find((e) => e.id === openId);
  const nFiles = entries.reduce((n, e) => n + e.attachments.length, 0);
  const tabs: [Tab, string, typeof Brain][] = [["linha", "Linha do tempo", History], ["mapa", "Mapa de ligações", Network], ["arquivos", "Arquivos", Files]];

  return (
    <PlanShell active={7}>
      <section className="glass relative overflow-hidden rounded-3xl p-5 animate-rise sm:p-7" style={tint("violet")}>
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-cyan/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center">
            <span className="absolute inset-0 animate-[spin_22s_linear_infinite] rounded-full border border-dashed border-cyan/50" />
            <span className="absolute inset-2 animate-[spin_16s_linear_infinite_reverse] rounded-full border border-violet/50" />
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-violet/10" />
            <span className="relative grid h-12 w-12 animate-float place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-[0_0_40px_-4px_var(--violet)]"><Brain size={24} /></span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="mono-caps">Orion · memória do Presence</p>
            <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl"><span className="text-gradient">Segundo cérebro</span></h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Tudo o que você documenta, anexa e registra fica aqui, ligado por dossiê e demanda. Pergunte e o Orion procura em tudo.</p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Sparkles} label="Anotações" value={entries.filter((e) => e.source !== "documentacao").length} color="violet" />
            <Stat icon={Paperclip} label="Arquivos" value={nFiles} color="emerald" />
            <Stat icon={Network} label="Dossiês ligados" value={dossiers.length} color="cyan" />
            <Stat icon={Files} label="Da Documentação" value={entries.filter((e) => e.source === "documentacao").length} color="amber" />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[400px_1fr]">
        <aside className="glass relative rounded-3xl p-4 animate-rise xl:sticky xl:top-3" style={{ ...tint("violet"), animationDelay: ".05s" }}>
          <p className="mono-caps mb-3 flex items-center gap-2"><Sparkles size={11} className="text-cyan" /> Capturar ou perguntar</p>
          <OrionPanel onDocumented={() => void load()} />
          <p className="mt-3 text-[0.65rem] leading-snug text-muted-foreground">Cole um print com Ctrl+V, arraste arquivos ou grave um áudio. Demandas, tarefas, notas e conversas do Presence também entram na pergunta, sem você precisar copiar.</p>
        </aside>

        <section className="glass min-w-0 rounded-3xl p-4 animate-rise sm:p-5" style={{ animationDelay: ".1s" }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-2xl border border-border bg-secondary/40 p-1" role="tablist">
              {tabs.map(([k, l, I]) => (
                <button key={k} role="tab" aria-selected={tab === k} data-testid={`aba-${k}`} onClick={() => setTab(k)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${tab === k ? "bg-gradient-brand text-primary-foreground shadow-[0_0_18px_-6px_var(--violet)]" : "text-muted-foreground hover:text-foreground"}`}><I size={13} /> {l}</button>
              ))}
            </div>
            <label className="glass ml-auto flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl px-3 py-2 sm:max-w-xs">
              <Search size={13} className="text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar o que está guardado…" data-testid="filtro-cerebro" className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
              {q && <button onClick={() => setQ("")} aria-label="Limpar"><X size={11} /></button>}
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {([["todos", "Tudo"], ["anotacoes", "Anotações"], ["arquivos", "Com arquivos"], ["documentacao", "Documentação"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSrc(k)} aria-pressed={src === k} className={`rounded-full border px-3 py-1 text-[0.7rem] transition hover:-translate-y-0.5 ${src === k ? "border-violet/60 bg-violet/15 text-violet" : "border-border text-muted-foreground hover:text-foreground"}`}>{l}</button>
            ))}
            {dossier && <button onClick={() => setDossier(null)} className="flex items-center gap-1 rounded-full border border-cyan/60 bg-cyan/10 px-3 py-1 text-[0.7rem] text-cyan">{dossier} <X size={10} /></button>}
          </div>
          {dossiers.length > 0 && !dossier && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dossiers.slice(0, 14).map(([d, n]) => <button key={d} onClick={() => setDossier(d)} className="rounded-full border border-border px-2.5 py-0.5 text-[0.65rem] text-muted-foreground transition hover:-translate-y-0.5 hover:border-cyan/50 hover:text-cyan">{d} <span className="font-mono opacity-60">{n}</span></button>)}
            </div>
          )}

          <div className="mt-5">
            {!ready && <p className="py-16 text-center text-sm text-muted-foreground">Acordando o segundo cérebro…</p>}
            {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">Não consegui carregar: {error}</p>}
            {ready && !error && !filtered.length && (
              <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground"><Brain size={30} className="animate-float text-violet" />{entries.length ? "Nada encontrado com esses filtros." : "Ainda vazio. Documente a primeira anotação ao lado ✦"}</div>
            )}

            {ready && tab === "linha" && groups.map(([date, list]) => (
              <div key={date} className="relative pb-5 pl-6">
                <span className="absolute left-0 top-1 h-full w-px bg-gradient-to-b from-violet/60 via-cyan/30 to-transparent" />
                <span className="absolute -left-[3px] top-1 h-[7px] w-[7px] animate-pulse-ring rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)]" />
                <h2 className="mono-caps mb-3">{dayLabel(date)} <span className="ml-2 normal-case tracking-normal text-muted-foreground">{brDate(date)}</span></h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {list.map((e, i) => <EntryCard key={e.id} e={e} urls={urls} delay={i} onOpen={() => setOpenId(e.id)} onDelete={() => void remove(e)} />)}
                </div>
              </div>
            ))}

            {ready && tab === "mapa" && <BrainGraph entries={filtered} onOpen={setOpenId} onDossier={(d) => { setDossier(d); setTab("linha"); }} />}

            {ready && tab === "arquivos" && (files.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="grade-arquivos">{files.map(({ a, e }) => <FileTile key={a.path} a={a} e={e} urls={urls} onOpen={() => setOpenId(e.id)} />)}</div>
            ) : !error && entries.length > 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum arquivo guardado ainda. Anexe um print ou documento em “Documentar”.</p>)}
          </div>
        </section>
      </div>

      {open && <EntryDrawer e={open} all={entries} urls={urls} onClose={() => setOpenId(null)} onOpen={setOpenId} onDelete={() => void remove(open)} onChanged={(n) => setEntries((l) => l.map((x) => (x.id === n.id ? n : x)))} />}
      <p className="text-center text-[0.65rem] text-muted-foreground"><Link to="/assistente" className="transition hover:text-cyan">← Voltar ao início</Link></p>
    </PlanShell>
  );
}
