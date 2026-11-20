/** Avisa quando há uma versão nova do Orion (com o app aberto) e atualiza com um toque, sem precisar de atalho de teclado. */
import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { refreshApp } from "@/lib/refresh-app";

const read = async (): Promise<string | null> => { try { const r = await fetch("/api/versao", { cache: "no-store" }); return r.ok ? ((await r.json()) as { id?: string }).id ?? null : null; } catch { return null; } };

export function UpdateWatcher() {
  const first = useRef<string | null>(null), [fresh, setFresh] = useState(false), [hidden, setHidden] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const check = async () => { const id = await read(); if (!live || !id || id === "dev") return; if (first.current === null) first.current = id; else if (id !== first.current) setFresh(true); };
    void check();
    const t = setInterval(() => void check(), 3 * 60_000), on = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", on); window.addEventListener("online", on);
    return () => { live = false; clearInterval(t); document.removeEventListener("visibilitychange", on); window.removeEventListener("online", on); };
  }, []);
  if (!fresh || hidden) return null;
  return (
    <div role="status" data-testid="versao-nova" className="fixed inset-x-3 top-3 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-cyan/40 bg-[oklch(0.16_0.03_262/0.96)] px-4 py-3 shadow-[0_20px_60px_-20px_var(--cyan)] backdrop-blur-xl" style={{ animation: "fin-rise .5s both" }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan/15 text-cyan"><RefreshCw size={16} /></span>
      <p className="min-w-0 flex-1 text-sm"><b>Há uma versão nova do Orion.</b><span className="block text-xs text-muted-foreground">Atualize para ver as novidades.</span></p>
      <button type="button" disabled={busy} onClick={() => { setBusy(true); void refreshApp(); }} className="shrink-0 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-[#04121a] transition hover:brightness-110 disabled:opacity-60" data-testid="atualizar-agora">{busy ? "Atualizando…" : "Atualizar agora"}</button>
      <button type="button" onClick={() => setHidden(true)} aria-label="Depois" className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
    </div>
  );
}
