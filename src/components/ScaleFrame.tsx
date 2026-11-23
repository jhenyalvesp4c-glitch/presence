/**
 * Plano B para o app instalado no iPhone que abre "encolhido" (a página vira ~2x mais larga que a tela e o layout de
 * computador aparece). Nesse caso o Orion se abre dentro de uma moldura com a largura REAL da tela (ex.: 428 px), ampliada
 * pelo mesmo fator: lá dentro a página enxerga uma tela de celular e mostra o layout certo. Só liga nessa situação.
 * `?moldura=1` força (teste); `?moldura=0` desliga.
 */
import { useEffect, useState, type ReactNode } from "react";

/** Cor de fundo do app (a mesma da moldura, para não aparecer emenda). */
const APP_BG_FALLBACK = "#07080f";
const appBg = (): string => { try { const c = getComputedStyle(document.body).backgroundColor; return c && c !== "rgba(0, 0, 0, 0)" ? c : APP_BG_FALLBACK; } catch { return APP_BG_FALLBACK; } };

/** Endereço dentro da moldura; leva a área do indicador do iPhone (já dividida pelo fator) em `_sab`. */
function frameSrc(k: number): string {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden";
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  const q = new URLSearchParams(location.search); q.delete("moldura"); q.set("_sab", String(Math.round((px / k) * 10) / 10));
  return `${location.pathname}?${q.toString()}${location.hash}`;
}

/** Fator de ampliação (ex.: 2) se estamos no caso acima; senão null. */
function frameFactor(): number | null {
  try {
    if (window.self !== window.top) return null; // já estamos dentro da moldura
    const q = new URLSearchParams(location.search).get("moldura");
    if (q === "0" || localStorage.getItem("presence.moldura") === "0") return null;
    const phone = Math.min(screen.width, screen.height) <= 600;
    if (!phone) return null;
    const k = window.innerWidth / Math.min(screen.width, screen.height);
    if (k < 1.4) return null; // a página tem o tamanho normal
    const small = (window.visualViewport?.scale ?? 1) <= 0.7;
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
    if (q === "1" || (standalone && small)) return Math.round(k * 100) / 100;
  } catch { /* sem acesso: segue normal */ }
  return null;
}

/**
 * "Tela de app": no app instalado (e dentro da moldura) bloqueia o zoom com dois dedos e o duplo toque, impede a página de
 * balançar para os lados e o efeito elástico nas pontas. A rolagem vertical do conteúdo continua normal.
 */
/** Dentro da moldura: aplica a área do indicador que o documento de fora mediu e limpa o endereço. */
function useFrameSafeArea() {
  useEffect(() => {
    try {
      if (window.self === window.top) return;
      const q = new URLSearchParams(location.search), sab = q.get("_sab");
      if (sab === null) return;
      document.documentElement.style.setProperty("--sab", `${Number(sab) || 0}px`);
      q.delete("_sab"); const rest = q.toString();
      history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
    } catch { /* sem acesso */ }
  }, []);
}

function useAppLock(force: boolean) {
  useEffect(() => {
    let off = () => undefined as void;
    try {
      const inFrame = window.self !== window.top;
      const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
      if (!force && !inFrame && !standalone && new URLSearchParams(location.search).get("travar") !== "1") return;
      const root = document.documentElement;
      root.dataset["lock"] = "1";
      const stop = (e: Event) => e.preventDefault();
      const multi = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
      document.addEventListener("gesturestart", stop, { passive: false });
      document.addEventListener("gesturechange", stop, { passive: false });
      document.addEventListener("gestureend", stop, { passive: false });
      document.addEventListener("touchmove", multi, { passive: false });
      off = () => { delete root.dataset["lock"]; document.removeEventListener("gesturestart", stop); document.removeEventListener("gesturechange", stop); document.removeEventListener("gestureend", stop); document.removeEventListener("touchmove", multi); };
    } catch { /* sem acesso */ }
    return off;
  }, [force]);
}

export function ScaleFrame({ children }: { children: ReactNode }) {
  const [k, setK] = useState<number | null>(null);
  useAppLock(!!k);
  useFrameSafeArea();
  useEffect(() => { setK(frameFactor()); }, []);
  if (!k) return <>{children}</>;
  const inv = 100 / k, APP_BG = appBg();
  return (
    <div data-testid="moldura-celular" style={{ position: "fixed", inset: 0, background: APP_BG, touchAction: "none", overscrollBehavior: "none" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: APP_BG }}>
        <iframe title="Orion" src={frameSrc(k)} allow="microphone; camera; clipboard-write; clipboard-read; fullscreen; notifications"
          style={{ position: "absolute", left: 0, top: 0, border: 0, width: `${inv}%`, height: `${inv}%`, transform: `scale(${k})`, transformOrigin: "0 0", background: APP_BG }} />
      </div>
    </div>
  );
}
