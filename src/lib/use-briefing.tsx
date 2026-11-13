import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { isComplete, type Briefing, type Memory } from "@/lib/briefing";
import { loadBriefingState } from "@/lib/data/briefing";

type Ctx = {
  available: boolean; loading: boolean; briefing: Briefing | null; memories: Memory[]; completed: boolean;
  open: boolean; openFlow: () => void; closeFlow: (skipped?: boolean) => void; refresh: () => void;
};
const BriefingCtx = createContext<Ctx | null>(null);
export const useBriefing = (): Ctx => { const v = useContext(BriefingCtx); if (!v) throw new Error("useBriefing fora do BriefingProvider"); return v; };
/** Versão que não lança: para componentes que podem aparecer fora do provider. */
export const useBriefingSafe = (): Ctx | null => useContext(BriefingCtx);

const skipKey = (owner: string) => `presence.briefing.adiado.${owner}`;

/** Carrega o briefing e a memória da pessoa e decide se abre o briefing sozinho (conta nova, ainda sem briefing). */
export function BriefingProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const qc = useQueryClient();
  const owner = account?.owner ?? "legado";
  const q = useQuery({ queryKey: ["briefing", owner], queryFn: loadBriefingState, staleTime: 30_000 });
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false);

  const available = q.data?.available ?? false;
  const completed = isComplete(q.data?.briefing ?? null);

  // Conta nova (não é a principal) sem briefing: abre sozinho, uma vez por aparelho, a menos que a pessoa adie.
  useEffect(() => {
    if (auto || !q.data || !q.data.available || completed || !account || account.principal) return;
    let skipped = false;
    try { skipped = localStorage.getItem(skipKey(account.owner)) === "1"; } catch { /* sem armazenamento */ }
    setAuto(true);
    if (!skipped) setOpen(true);
  }, [auto, q.data, completed, account]);

  // Abre pelo botão "Meu briefing" de qualquer tela.
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("presence:briefing", on);
    return () => window.removeEventListener("presence:briefing", on);
  }, []);

  const closeFlow = useCallback((skipped = false) => {
    setOpen(false);
    if (skipped && account) { try { localStorage.setItem(skipKey(account.owner), "1"); } catch { /* sem armazenamento */ } }
  }, [account]);
  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ["briefing", owner] }); }, [qc, owner]);

  const value = useMemo<Ctx>(() => ({
    available, loading: q.isLoading, briefing: q.data?.briefing ?? null, memories: q.data?.memories ?? [], completed,
    open, openFlow: () => setOpen(true), closeFlow, refresh,
  }), [available, q.isLoading, q.data, completed, open, closeFlow, refresh]);
  return <BriefingCtx.Provider value={value}>{children}</BriefingCtx.Provider>;
}

/** Pede para abrir o briefing (usado por botões espalhados pelo app). */
export const openBriefing = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("presence:briefing")); };
