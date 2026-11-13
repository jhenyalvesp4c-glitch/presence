import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/diagnostico")({ component: Diagnostico, head: () => ({ meta: [{ title: "Diagnóstico · Presence" }] }) });

/** Mostra o que o aparelho informa (largura, tela, zoom): ajuda a entender por que o layout do celular não aparece. */
function Diagnostico() {
  const [d, setD] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => setD({
      "Largura da janela (innerWidth)": `${window.innerWidth}px`,
      "Largura do documento": `${document.documentElement.clientWidth}px`,
      "Largura da tela (screen.width)": `${screen.width}px`,
      "Zoom do visual (visualViewport)": String(window.visualViewport?.scale ?? "—"),
      "Largura do visual": `${Math.round(window.visualViewport?.width ?? 0)}px`,
      "Pixels por ponto (devicePixelRatio)": String(window.devicePixelRatio),
      "Toque (pointer: coarse)": String(matchMedia("(pointer: coarse)").matches),
      "Layout de celular (menor que 768px)": String(window.innerWidth < 768),
      "Navegador": navigator.userAgent,
    });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">Diagnóstico da tela</h1>
      <p className="mt-1 text-sm text-muted-foreground">Mande um print desta página para a Claude.</p>
      <dl className="mt-5 space-y-2" data-testid="diagnostico">
        {Object.entries(d).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="break-words text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
