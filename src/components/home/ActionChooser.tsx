import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BookPlus, ClipboardList, Search, Sparkles, X } from "lucide-react";

import { backdropProps } from "@/lib/backdrop";

export type HomeAction = "demand" | "doc" | "ask";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;

const OPTIONS: { key: HomeAction; n: string; icon: typeof Search; color: string; title: string; text: string; cta: string }[] = [
  { key: "demand", n: "1", icon: ClipboardList, color: "cyan", title: "Registrar demanda", text: "Cole o texto, prints, PDFs ou documentos. O Presence separa em demandas, tarefas, compromissos e lembretes para você confirmar.", cta: "Registrar" },
  { key: "doc", n: "2", icon: BookPlus, color: "violet", title: "Documentar", text: "Guarde no segundo cérebro o que aconteceu hoje: texto, voz, prints e arquivos. Depois é só perguntar.", cta: "Documentar" },
  { key: "ask", n: "3", icon: Search, color: "emerald", title: "Perguntar ao Orion", text: "Pergunte qualquer coisa. Ele pesquisa em demandas, tarefas, notas, documentos e arquivos e traz um relatório.", cta: "Perguntar" },
];

/** "O que você quer fazer?": escolhe entre registrar demanda, documentar ou perguntar (atalhos 1, 2 e 3). */
export function ActionChooser({ onPick, onClose }: { onPick: (a: HomeAction) => void; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const o = OPTIONS.find((x) => x.n === e.key);
      if (o && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) onPick(o.key);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onPick, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/75 p-4 backdrop-blur-xl" {...backdropProps(onClose)} data-testid="escolher-acao">
      <div className="pointer-events-none flex min-h-full items-center justify-center">
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="O que você quer fazer?" className="pointer-events-auto relative my-6 w-full max-w-5xl animate-rise">
          <div aria-hidden className="pointer-events-none absolute -inset-10 -z-10 bg-[radial-gradient(50%_60%_at_30%_30%,color-mix(in_oklab,var(--cyan)_16%,transparent),transparent),radial-gradient(50%_60%_at_75%_70%,color-mix(in_oklab,var(--violet)_18%,transparent),transparent)] blur-2xl" />
          <div className="mb-6 flex items-center gap-3">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center">
              <span className="absolute inset-0 animate-[spin_16s_linear_infinite] rounded-full border border-dashed border-cyan/60" />
              <Sparkles size={20} className="text-cyan" />
            </span>
            <div className="mr-auto">
              <p className="mono-caps !text-[0.65rem]">Presence</p>
              <h2 className="font-serif text-3xl leading-tight sm:text-4xl">O que você quer <span className="text-gradient">fazer?</span></h2>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground backdrop-blur transition hover:text-foreground"><X size={16} /></button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {OPTIONS.map((o, i) => {
              const I = o.icon;
              return (
                <button key={o.key} onClick={() => onPick(o.key)} data-testid={`acao-${o.key}`} style={{ ...tint(o.color), animationDelay: `${i * 90}ms` }}
                  className="group relative flex min-h-[15rem] flex-col overflow-hidden rounded-3xl border border-[color-mix(in_oklab,var(--glow)_40%,transparent)] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--glow)_12%,transparent),transparent_70%)] p-6 text-left backdrop-blur-xl animate-rise transition duration-300 hover:-translate-y-2 hover:border-[var(--glow)] hover:shadow-[0_24px_60px_-20px_var(--glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow)]">
                  <span aria-hidden className="scanline pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-50" />
                  <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--glow)] opacity-20 blur-3xl transition duration-500 group-hover:opacity-40" />
                  <span className="relative flex items-start">
                    <span className="icon-tile h-14 w-14 !rounded-2xl shadow-[0_0_30px_-8px_var(--glow)] transition duration-300 group-hover:scale-110 group-hover:rotate-3"><I size={24} /></span>
                    <span className="ml-auto rounded-md border border-border px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground transition group-hover:border-[var(--glow)] group-hover:text-[var(--glow)]">{o.n}</span>
                  </span>
                  <span className="relative mt-5 font-display text-2xl font-semibold leading-tight">{o.title}</span>
                  <span className="relative mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{o.text}</span>
                  <span className="relative mt-5 flex items-center gap-2 text-sm font-semibold text-[var(--glow)]">{o.cta} <ArrowRight size={16} className="transition duration-300 group-hover:translate-x-2" /></span>
                </button>
              );
            })}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">Para falar, toque na <span className="text-cyan">esfera</span> · use as teclas <span className="font-mono">1</span> <span className="font-mono">2</span> <span className="font-mono">3</span> · <span className="font-mono">Esc</span> fecha</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}