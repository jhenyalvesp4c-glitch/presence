/** Traz do WhatsApp (ponte local, só leitura) as mensagens de um ou mais grupos/conversas num período, para a IA resumir. */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, MessageCircle, Pencil, RefreshCw, Search, Users, X } from "lucide-react";

import { directEnabled, enableDirect, startBridge, waGet, waPost } from "@/lib/whatsapp/client";
import { sinceFor, waToText, type WaLine } from "@/lib/meetings";

type WaChat = { jid: string; name: string; is_group: boolean; last_ts: number; novas: number; preview?: string; sem_nome?: boolean };
/** Contato sem nome salvo: mostra o número bonito (ou avisa que é um id interno do WhatsApp). */
const label = (c: WaChat) => {
  if (!c.sem_nome) return c.name;
  const d = c.jid.split("@")[0]!.split(":")[0]!;
  return c.jid.endsWith("@s.whatsapp.net") && d.length >= 11 ? `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, d.length - 4)}-${d.slice(-4)}` : "Contato sem nome (id interno)";
};
const PERIODS = [["hoje", "Hoje"], ["24h", "Últimas 24 h"], ["3d", "3 dias"], ["7d", "7 dias"]] as const;
type Period = (typeof PERIODS)[number][0];
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${on ? "border-emerald/60 bg-emerald/15 text-emerald shadow-[0_0_16px_-6px_var(--emerald)]" : "border-white/10 text-muted-foreground hover:text-foreground"}`;

export function WhatsAppPicker({ onText }: { onText: (text: string, names: string[]) => void }) {
  const [starting, setStarting] = useState(false), [chats, setChats] = useState<WaChat[] | null>(null), [err, setErr] = useState(""), [loading, setLoading] = useState(false), [q, setQ] = useState(""), [sel, setSel] = useState<string[]>([]), [period, setPeriod] = useState<Period>("24h"), [busy, setBusy] = useState(false), [onlyGroups, setOnlyGroups] = useState(false), [editing, setEditing] = useState<string | null>(null), [newName, setNewName] = useState("");
  const turnOn = async () => {
    setStarting(true); const r = await startBridge();
    if (!r.ok) toast.error(r.erro); else { toast.success("WhatsApp ligado em segundo plano"); await load(); }
    setStarting(false);
  };
  const load = async (query = q) => {
    setLoading(true); setErr("");
    const r = await waGet<{ chats: WaChat[] }>("chats", { limit: "300", ...(query.trim() ? { q: query.trim() } : {}) });
    if (r.ok) setChats(r.data.chats ?? []); else { setChats(null); setErr(r.erro); }
    setLoading(false);
  };
  useEffect(() => { void load(""); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // a busca é feita na ponte (acha pelo nome ou pelo número, em todas as conversas, não só nas primeiras da lista)
  useEffect(() => { const t = setTimeout(() => void load(q), 350); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);
  const rename = async (jid: string) => { const ok = await waPost("nome", { jid, nome: newName.trim() }); if (ok) { toast.success("Nome salvo"); setEditing(null); await load(q); } else toast.error("Não consegui salvar o nome (atualize a ponte: whatsapp-parar e whatsapp-fundo)."); };
  const list = useMemo(() => (chats ?? []).filter((c) => !onlyGroups || c.is_group), [chats, onlyGroups]);
  const fetchText = async () => {
    if (!sel.length) { toast.error("Escolha pelo menos uma conversa."); return; }
    setBusy(true);
    const since = String(sinceFor(period)), blocks: string[] = [], names: string[] = []; let capped = false;
    for (const jid of sel) {
      const c = chats?.find((x) => x.jid === jid); if (!c) continue;
      const r = await waGet<{ ok?: boolean; messages?: WaLine[]; erro?: string }>("messages", { chat: jid, since, limit: "200" });
      if (!r.ok || r.data.ok === false) { toast.error(`${c.name}: ${r.ok ? r.data.erro ?? "não consegui ler" : r.erro}`); continue; }
      const msgs = r.data.messages ?? []; if (msgs.length >= 200) capped = true;
      const t = waToText(msgs); if (t) { blocks.push(`=== Grupo: ${c.name} ===\n${t}`); names.push(c.name); }
    }
    setBusy(false);
    if (!blocks.length) { toast.message("Nenhuma mensagem de texto nesse período."); return; }
    onText(blocks.join("\n\n"), names);
    toast.success(`${blocks.length} conversa(s) trazida(s)`, capped ? { description: "Algumas passaram de 200 mensagens: vieram as mais recentes. Use um período menor para ver tudo." } : undefined);
  };
  if (!directEnabled() && chats === null && !loading) return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm" data-testid="wa-desligado"><p className="text-muted-foreground">O WhatsApp fica no seu computador (somente leitura). Para trazer grupos para cá, ligue a ponte (Configurações → WhatsApp, ou dois cliques em <b>whatsapp-fundo.cmd</b>, sem janela) e deixe este site procurá-la.</p>
      <button type="button" onClick={() => { enableDirect(); void load(); }} className="mt-3 rounded-full border border-emerald/50 bg-emerald/10 px-4 py-1.5 text-xs font-medium text-emerald hover:bg-emerald/20">Procurar a ponte neste computador</button></div>
  );
  return (
    <div className="space-y-3" data-testid="wa-picker">
      {err && <div className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">{err}
        <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void turnOn()} disabled={starting} className="inline-flex items-center gap-1.5 rounded-full border border-emerald/50 bg-emerald/10 px-3 py-1 font-medium text-emerald hover:bg-emerald/20 disabled:opacity-50" data-testid="wa-ligar">{starting ? <Loader2 size={12} className="animate-spin" /> : null} Ligar o WhatsApp aqui</button><span className="text-muted-foreground">No site publicado: dê dois cliques em whatsapp-fundo.cmd (uma vez).</span></div></div>}
      <div className="flex flex-wrap items-center gap-2"><label className="relative min-w-0 flex-1"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo ou conversa…" className="w-full rounded-full border border-white/10 bg-black/25 py-2 pl-8 pr-3 text-sm outline-none focus:border-emerald/60" /></label>
        <button type="button" onClick={() => setOnlyGroups((o) => !o)} aria-pressed={onlyGroups} className={chip(onlyGroups)}><Users size={12} className="mr-1 inline" />Só grupos</button>
        <button type="button" onClick={() => void load()} aria-label="Atualizar lista" className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-muted-foreground hover:text-foreground">{loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button></div>
      <ul className="scroll-thin grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2" data-testid="wa-lista">{list.map((c) => { const on = sel.includes(c.jid), edit = editing === c.jid; return (
        <li key={c.jid} className={`rounded-xl border transition ${on ? "border-emerald/60 bg-emerald/10" : "border-white/10 hover:border-white/25"}`}>
          {edit ? <form className="flex items-center gap-1.5 px-2.5 py-2" onSubmit={(e) => { e.preventDefault(); void rename(c.jid); }}><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder="Nome desta pessoa" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-sm outline-none focus:border-emerald/60" data-testid="wa-nome-input" /><button type="submit" aria-label="Salvar nome" className="text-emerald"><Check size={15} /></button><button type="button" aria-label="Cancelar" onClick={() => setEditing(null)} className="text-muted-foreground"><X size={15} /></button></form>
            : <div className="flex items-center gap-1 pr-2"><button type="button" onClick={() => setSel((x) => (on ? x.filter((y) => y !== c.jid) : [...x, c.jid]))} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm">
              {c.is_group ? <Users size={14} className="shrink-0 text-emerald" /> : <MessageCircle size={14} className="shrink-0 text-cyan" />}<span className="min-w-0 flex-1"><span className={`block truncate ${c.sem_nome ? "text-amber" : ""}`}>{label(c)}</span>{c.preview && <span className="block truncate text-[0.65rem] text-muted-foreground">{c.preview}</span>}</span>{c.novas > 0 && <span className="rounded-full bg-emerald/20 px-1.5 text-[0.65rem] text-emerald">{c.novas}</span>}</button>
              {!c.is_group && <button type="button" aria-label={`Dar nome a ${label(c)}`} onClick={() => { setEditing(c.jid); setNewName(c.sem_nome ? "" : c.name); }} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition hover:bg-white/10 ${c.sem_nome ? "text-amber" : "text-muted-foreground/60 hover:text-foreground"}`} data-testid="wa-renomear"><Pencil size={12} /></button>}</div>}
        </li>); })}
        {chats && !list.length && <li className="col-span-full py-3 text-center text-xs text-muted-foreground">Nenhuma conversa encontrada{q ? ` para “${q}”` : ""}. A ponte só guarda o que chegou depois de ligada.</li>}</ul>
      {list.some((c) => c.sem_nome) && <p className="text-[0.68rem] text-muted-foreground">Contatos em amarelo não têm nome salvo na ponte. Leia a última mensagem para reconhecer e toque no lápis para dar o nome (fica salvo).</p>}
      <div className="flex flex-wrap items-center gap-2"><span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Período</span>{PERIODS.map(([k, l]) => <button key={k} type="button" onClick={() => setPeriod(k)} aria-pressed={period === k} className={chip(period === k)}>{l}</button>)}
        <button type="button" onClick={() => void fetchText()} disabled={busy || !sel.length} className="ml-auto inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-4 py-1.5 text-xs font-medium text-emerald transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="wa-trazer">{busy && <Loader2 size={13} className="animate-spin" />} Trazer mensagens ({sel.length})</button></div>
    </div>
  );
}
