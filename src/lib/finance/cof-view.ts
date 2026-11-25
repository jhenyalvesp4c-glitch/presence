import { useCallback, useSyncExternalStore } from "react";

import type { CofView } from "./calc";

const KEY = "fin.cofrinho.view", EVT = "fin:cofview";
const OK = (v: unknown): v is CofView => v === "tudo" || v === "bolso" || v === "cofrinho";
const read = (): CofView => { try { const v = localStorage.getItem(KEY); return OK(v) ? v : "bolso"; } catch { return "bolso"; } };
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };

/** Visão escolhida (vale em todas as telas do financeiro): tudo, sem cofrinho (padrão) ou só cofrinho. */
export function useCofView(): [CofView, (v: CofView) => void] {
  const view = useSyncExternalStore(subscribe, read, () => "bolso" as CofView);
  const set = useCallback((v: CofView) => { try { localStorage.setItem(KEY, v); } catch { /* sem armazenamento */ } window.dispatchEvent(new Event(EVT)); }, []);
  return [view, set];
}

const RKEY = "fin.reservas.on", REVT = "fin:reservas";
const rRead = (): boolean => { try { return localStorage.getItem(RKEY) !== "0"; } catch { return true; } };
const rSub = (cb: () => void) => { window.addEventListener(REVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(REVT, cb); window.removeEventListener("storage", cb); }; };
/** Liga/desliga geral: descontar as metas ligadas da sobra de caixa e dos próximos meses (padrão: ligado). */
export function useReservesOn(): [boolean, (v: boolean) => void] {
  const on = useSyncExternalStore(rSub, rRead, () => true);
  const set = useCallback((v: boolean) => { try { localStorage.setItem(RKEY, v ? "1" : "0"); } catch { /* sem armazenamento */ } window.dispatchEvent(new Event(REVT)); }, []);
  return [on, set];
}
