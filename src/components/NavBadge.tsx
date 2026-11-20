import type { Badge } from "@/lib/nav-badges";

const COLOR = { cyan: "var(--cyan)", amber: "oklch(0.8 0.15 75)", rose: "oklch(0.7 0.18 10)" } as const;

/** Bolinha com o número de itens pedindo atenção, no canto de um botão (precisa de um pai `relative`). Passar o mouse mostra o que é. */
export function NavBadge({ badge, className = "-right-1 -top-1" }: { badge: Badge | undefined; className?: string }) {
  if (!badge) return null;
  const c = COLOR[badge.tone];
  return (
    <span role="status" aria-label={badge.text} title={badge.text} data-testid="nav-indicador" className={`absolute z-20 grid h-[1.05rem] min-w-[1.05rem] place-items-center rounded-full px-1 text-[0.6rem] font-bold leading-none text-[#06121a] ${className}`} style={{ background: c, boxShadow: `0 0 10px ${c}` }}>
      {badge.tone === "rose" && <span aria-hidden data-idea-fx className="absolute inset-0 rounded-full" style={{ background: c, animation: "fin-pulse 1.8s ease-out infinite" }} />}
      <span className="relative">{badge.n > 9 ? "9+" : badge.n}</span>
    </span>
  );
}
