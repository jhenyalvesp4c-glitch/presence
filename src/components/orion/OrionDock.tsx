import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

import { backdropProps } from "@/lib/backdrop";
import { OrionPanel } from "./OrionPanel";

/** Botão do Orion em todas as páginas (atalho Ctrl/⌘ + K). Abre a caixa de perguntar e documentar. */
export function OrionDock() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Abrir o Orion, seu segundo cérebro" data-testid="orion-abrir" title="Orion · Ctrl+K"
        className="group fixed bottom-5 right-5 z-40 lift-a grid h-14 w-14 place-items-center rounded-full border border-violet/50 bg-background/80 shadow-[0_0_34px_-6px_var(--violet)] backdrop-blur-xl transition hover:scale-105 hover:shadow-[0_0_44px_-2px_var(--violet)] max-sm:bottom-4 max-sm:right-4">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-violet/20" />
        <Sparkles size={22} className="relative text-cyan transition group-hover:rotate-12" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/60 backdrop-blur-sm" {...backdropProps(() => setOpen(false))} data-testid="orion-janela">
          <div className="pointer-events-none flex min-h-full items-end justify-end p-4 sm:pb-16">
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Orion"
              className="glass pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col rounded-3xl p-5 shadow-[0_0_60px_-20px_var(--violet)] animate-rise sm:max-h-[calc(100dvh-5rem)]">
              <div className="mb-4 flex shrink-0 items-center gap-3">
                <span className="icon-tile h-10 w-10 !rounded-full" style={{ "--glow": "var(--violet)" } as React.CSSProperties}><Sparkles size={18} /></span>
                <div className="mr-auto">
                  <h2 className="font-display text-lg font-semibold leading-tight">Orion</h2>
                  <p className="text-[0.7rem] text-muted-foreground">Seu segundo cérebro · pergunte ou documente</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
              </div>
              <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2" data-testid="orion-rolagem"><OrionPanel autoFocus /></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
