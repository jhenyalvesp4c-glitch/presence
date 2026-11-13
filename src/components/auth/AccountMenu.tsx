import { useEffect, useRef, useState } from "react";
import { LogOut, Sparkles } from "lucide-react";
import { openBriefing, useBriefingSafe } from "@/lib/use-briefing";

import { useAuth } from "@/lib/auth";

/** Botão redondo com a inicial da pessoa; abre um cartinho com o nome, o e-mail e "Sair". */
export function AccountMenu({ below = false }: { below?: boolean }) {
  const { account, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const briefing = useBriefingSafe();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  if (!account) return null;
  return (
    <div ref={ref} className="relative" data-testid="conta-menu">
      <button onClick={() => setOpen((o) => !o)} aria-label="Minha conta" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-xs font-semibold uppercase text-cyan transition hover:border-cyan/50">
        {account.name.slice(0, 1) || "?"}
      </button>
      {open && (
        <div className={`absolute z-50 w-56 rounded-2xl border border-white/10 bg-[oklch(0.16_0.03_265/0.97)] p-3 shadow-[0_20px_60px_-24px_var(--violet)] backdrop-blur-xl ${below ? "right-0 top-12" : "bottom-0 left-12"}`} style={{ animation: "vp-in .3s ease both" }}>
          <p className="truncate text-sm font-medium">{account.name}</p>
          <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          {briefing?.available && <button onClick={() => { setOpen(false); openBriefing(); }} data-testid="conta-briefing" className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-1.5 text-xs transition hover:border-violet/50 hover:text-violet"><Sparkles size={13} /> Meu briefing</button>}
          <button onClick={() => void signOut()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-1.5 text-xs transition hover:border-destructive/50 hover:text-destructive" data-testid="conta-sair"><LogOut size={13} /> Sair</button>
        </div>
      )}
    </div>
  );
}
