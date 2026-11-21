/** Traz do WhatsApp (ponte local, só leitura) as mensagens de um ou mais grupos/conversas num período, para a IA resumir. */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, RefreshCw, Search, Users } from "lucide-react";

import { directEnabled, enableDirect, waGet } from "@/lib/whatsapp/client";
import { sinceFor, waToText, type WaLine } from "@/lib/meetings";

type WaChat = { jid: string; name: string; is_group: boolean; last_ts: number; novas: number };
const PERIODS = [["hoje", "Hoje"], ["24h", "Últimas 24 h"], ["3d", "3 dias"], ["7d", "7 dias"]] as const;
type Period = (typeof PERIODS)[number][0];
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${on ? "border-emerald/60 bg-emerald/15 text-emerald shadow-[0_0_16px_-6px_var(--emerald)]" : "border-white/10 text-muted-foreground hover:text-foreground"}`;

export function WhatsAppPicker({ onText }: { onText: (text: string, names: string[]) => void }) {
  const [chats, setChats] = useState<WaChat[] | null>(null), [err, setErr] = useState(""), [loading, setLoading] = useState(false), [q, setQ] = useState(""), [sel, setSel] = useState<string[]>([]), [period, setPeriod] = useState<Period>("24h"), [busy, setBusy] = useState(false), [onlyGroups, setOnlyGroups] = useState(true);
  const load = async () => {
    setLoading(true); setErr("");
    const r = await waGet<{ chats: WaChat[] }>("chats", { limit: "120" });
    if (r.ok) setChats(r.data.chats ?? []); else { setChats(null); setErr(r.erro); }
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const list = useMemo(() => (chats ?? []).filter((c) => (!onlyGroups || c.is_group) && c.name.toLowerCase().includes(q.toLowerCase())), [chats, q, onlyGroups]);
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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm" data-testid="wa-desligado"><p className="text-muted-foreground">O WhatsApp fica no seu computador (somente leitura). Para trazer grupos para cá, ligue a ponte (<b>whatsapp.cmd</b>) e deixe este site procurá-la.</p>
      <button type="button" onClick={() => { enableDirect(); void load(); }} className="mt-3 rounded-full border border-emerald/50 bg-emerald/10 px-4 py-1.5 text-xs font-medium text-emerald hover:bg-emerald/20">Procurar a ponte neste computador</button></div>
  );
  return (
    <div className="space-y-3" data-testid="wa-picker">
      {err && <p className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">{err}</p>}
      <div className="flex flex-wrap items-center gap-2"><label className="relative min-w-0 flex-1"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo ou conversa…" className="w-full rounded-full border border-white/10 bg-black/25 py-2 pl-8 pr-3 text-sm outline-none focus:border-emerald/60" /></label>
        <button type="button" onClick={() => setOnlyGroups((o) => !o)} aria-pressed={onlyGroups} className={chip(onlyGroups)}><Users size={12} className="mr-1 inline" />Só grupos</button>
        <button type="button" onClick={() => void load()} aria-label="Atualizar lista" className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-muted-foreground hover:text-foreground">{loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button></div>
      <ul className="scroll-thin grid max-h-52 gap-1.5 overflow-y-auto sm:grid-cols-2">{list.map((c) => { const on = sel.includes(c.jid); return (
        <li key={c.jid}><button type="button" onClick={() => setSel((s) => (on ? s.filter((x) => x !== c.jid) : [...s, c.jid]))} aria-pressed={on} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${on ? "border-emerald/60 bg-emerald/10" : "border-white/10 hover:border-white/25"}`}>
          {c.is_group ? <Users size={14} className="shrink-0 text-emerald" /> : <MessageCircle size={14} className="shrink-0 text-cyan" />}<span className="min-w-0 flex-1 truncate">{c.name}</span>{c.novas > 0 && <span className="rounded-full bg-emerald/20 px-1.5 text-[0.65rem] text-emerald">{c.novas}</span>}</button></li>); })}
        {chats && !list.length && <li className="col-span-full py-3 text-center text-xs text-muted-foreground">Nenhuma conversa encontrada.</li>}</ul>
      <div className="flex flex-wrap items-center gap-2"><span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Período</span>{PERIODS.map(([k, l]) => <button key={k} type="button" onClick={() => setPeriod(k)} aria-pressed={period === k} className={chip(period === k)}>{l}</button>)}
        <button type="button" onClick={() => void fetchText()} disabled={busy || !sel.length} className="ml-auto inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-4 py-1.5 text-xs font-medium text-emerald transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="wa-trazer">{busy && <Loader2 size={13} className="animate-spin" />} Trazer mensagens ({sel.length})</button></div>
    </div>
  );
}
