import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** Aviso para celulares cujo navegador está com zoom afastado (ex.: Safari em 50%): o layout de celular não aparece. */
export function ZoomHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("presence.zoomhint") === "1") return;
      const phone = Math.min(screen.width, screen.height) <= 600 && matchMedia("(pointer: coarse)").matches;
      const scale = window.visualViewport?.scale ?? 1;
      if (phone && window.innerWidth >= 700 && scale < 0.9) setShow(true);
    } catch { /* sem armazenamento ou sem visualViewport */ }
  }, []);
  if (!show) return null;
  return (
    <div role="status" data-testid="aviso-zoom" className="fixed inset-x-3 top-3 z-[90] rounded-2xl border border-amber/40 bg-[oklch(0.17_0.03_265/0.97)] p-4 shadow-[0_20px_60px_-20px_oklch(0.82_0.15_75)] backdrop-blur-xl">
      <button onClick={() => { setShow(false); try { localStorage.setItem("presence.zoomhint", "1"); } catch { /* ok */ } }} aria-label="Fechar aviso" className="absolute right-3 top-3 text-muted-foreground"><X size={16} /></button>
      <p className="pr-6 text-sm font-semibold text-amber">O navegador está com a tela afastada</p>
      <p className="mt-1 text-xs leading-snug text-foreground/85">Por isso o Presence aparece no formato de computador. No Safari, toque no ícone à esquerda da barra de endereço, ajuste o zoom da página para <b>100%</b> e escolha “Mostrar versão para dispositivos móveis”, se aparecer.</p>
    </div>
  );
}
