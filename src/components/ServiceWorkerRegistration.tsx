/** Registra o service worker (app instalável). Só em produção: no desenvolvimento ele atrapalharia as mudanças ao vivo. */
import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const go = () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined); };
    if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
  }, []);
  return null;
}
