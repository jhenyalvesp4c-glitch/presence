import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Info = { zoom50: boolean; desktopMode: boolean; w: number; screen: number; scale: number; widest: string[] };

/** Elementos que chegam mais longe à direita (os que fazem a página ficar mais larga que a tela). */
const widest = (): string[] => {
  const out: { r: number; label: string }[] = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (!(el instanceof HTMLElement)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    out.push({ r: Math.round(r.right), label: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}`.slice(0, 70) });
  }
  return out.sort((a, b) => b.r - a.r).slice(0, 3).map((x) => `${x.label} → ${x.r}px`);
};

/**
 * Aviso para celulares cujo navegador mostra o Orion no formato de computador (página larga demais, "tela afastada").
 * Diz a causa provável (Safari pedindo o site de computador, ou algo mais largo que a tela) e mostra os números,
 * para dar para entender com um print. `?zoom=1` força o aviso (teste).
 */
export function ZoomHint() {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    try {
      const force = new URLSearchParams(location.search).get("zoom") === "1";
      if (!force && localStorage.getItem("presence.zoomhint") === "1") return;
      const phone = Math.min(screen.width, screen.height) <= 600 && matchMedia("(pointer: coarse)").matches;
      const scale = window.visualViewport?.scale ?? 1;
      if (force || (phone && window.innerWidth >= 700 && scale < 0.9)) {
        const desktopMode = /Macintosh|X11|Windows NT/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
        // tentativa de consertar sozinho: pede de novo a largura do aparelho (só quando não é o modo computador)
        if (!desktopMode) document.querySelector('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover");
        setInfo({ zoom50: !desktopMode && scale <= 0.65 && window.innerWidth / Math.min(screen.width, screen.height) >= 1.5, desktopMode, w: window.innerWidth, screen: Math.min(screen.width, screen.height), scale: Math.round(scale * 100) / 100, widest: widest() });
      }
    } catch { /* sem armazenamento ou sem visualViewport */ }
  }, []);
  if (!info) return null;
  return (
    <div role="status" data-testid="aviso-zoom" className="fixed inset-x-3 top-3 z-[90] max-h-[70dvh] overflow-y-auto rounded-2xl border border-amber/40 bg-[oklch(0.17_0.03_265/0.97)] p-4 shadow-[0_20px_60px_-20px_oklch(0.82_0.15_75)] backdrop-blur-xl">
      <button onClick={() => { setInfo(null); try { localStorage.setItem("presence.zoomhint", "1"); } catch { /* ok */ } }} aria-label="Fechar aviso" className="absolute right-3 top-3 text-muted-foreground"><X size={16} /></button>
      <p className="pr-6 text-sm font-semibold text-amber">{info.zoom50 ? "O zoom da página do Safari está em cerca de 50%" : info.desktopMode ? "O Safari está mostrando o site de computador" : "A página está mais larga que a tela"}</p>
      <p className="mt-1 text-xs leading-snug text-foreground/85">
        {info.zoom50
          ? <>Por isso tudo aparece pela metade. No <b>Safari</b>, abra este endereço, toque em <b>aA</b> (à esquerda da barra de endereço) e, na linha do zoom, toque várias vezes no <b>A grande</b> até aparecer <b>100%</b>. Depois feche e abra o Orion de novo. Também dá para ajustar em <b>Ajustes → Safari → Zoom da Página</b> (procure este site e escolha 100%).</>
          : info.desktopMode
          ? <>Toque no ícone <b>aA</b> à esquerda da barra de endereço e escolha <b>“Mostrar versão para dispositivos móveis”</b>. Depois apague o ícone da tela inicial e instale de novo.</>
          : <>O navegador aumentou a largura da página para caber tudo, então tudo aparece pequeno. Mande um print deste aviso: os números abaixo mostram o que está estourando.</>}
      </p>
      <p className="mt-2 font-mono text-[0.62rem] leading-relaxed text-muted-foreground">
        largura da página {info.w}px · tela {info.screen}px · zoom {info.scale} · {info.desktopMode ? "modo computador" : "modo celular"}
        {info.widest.map((x) => <span key={x} className="block break-all">{x}</span>)}
      </p>
    </div>
  );
}
