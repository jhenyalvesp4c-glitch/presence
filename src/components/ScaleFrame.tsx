/**
 * Plano B para o app instalado no iPhone que abre "encolhido" (a página vira ~2x mais larga que a tela e o layout de
 * computador aparece). Nesse caso o Orion se abre dentro de uma moldura com a largura REAL da tela (ex.: 428 px), ampliada
 * pelo mesmo fator: lá dentro a página enxerga uma tela de celular e mostra o layout certo. Só liga nessa situação.
 * `?moldura=1` força (teste); `?moldura=0` desliga.
 */
import { useEffect, useState, type ReactNode } from "react";

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

export function ScaleFrame({ children }: { children: ReactNode }) {
  const [k, setK] = useState<number | null>(null);
  useEffect(() => { setK(frameFactor()); }, []);
  if (!k) return <>{children}</>;
  const inv = 100 / k;
  return (
    <div data-testid="moldura-celular" style={{ position: "fixed", inset: 0, background: "#070a1d", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
        <iframe title="Orion" src={`${location.pathname}${location.search.replace(/[?&]moldura=1/, "")}${location.hash}`} allow="microphone; camera; clipboard-write; clipboard-read; fullscreen; notifications"
          style={{ position: "absolute", left: 0, top: 0, border: 0, width: `${inv}%`, height: `${inv}%`, transform: `scale(${k})`, transformOrigin: "0 0", background: "#070a1d" }} />
      </div>
    </div>
  );
}
