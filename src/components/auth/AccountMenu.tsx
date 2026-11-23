import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, KeyRound, Loader2, LogOut, Settings, Sparkles } from "lucide-react";
import { openBriefing, useBriefingSafe } from "@/lib/use-briefing";

import { useAuth } from "@/lib/auth";

/** Botão redondo com a inicial da pessoa; abre um cartinho com o nome, o usuário, "Trocar senha" e "Sair". */
export function AccountMenu({ below = false }: { below?: boolean }) {
  const { account, signOut, setNewPassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false), [pw, setPw] = useState(""), [pwBusy, setPwBusy] = useState(false), [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function savePw() {
    if (pwBusy) return;
    setPwBusy(true); setPwMsg(null);
    const r = await setNewPassword(pw);
    setPwBusy(false);
    if (r.ok) { setPw(""); setPwOpen(false); setPwMsg({ ok: true, text: "Senha trocada." }); } else setPwMsg({ ok: false, text: r.error });
  }
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
          {pwOpen ? (
            <form onSubmit={(e) => { e.preventDefault(); void savePw(); }} className="mt-2 flex gap-1.5" data-testid="conta-senha-form">
              <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Senha nova" autoComplete="new-password" className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs outline-none focus:border-cyan/60" data-testid="conta-senha-nova" />
              <button type="submit" disabled={pwBusy} aria-label="Salvar senha" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground transition hover:brightness-110 disabled:opacity-60">{pwBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}</button>
            </form>
          ) : (
            <button onClick={() => { setPwOpen(true); setPwMsg(null); }} data-testid="conta-trocar-senha" className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-1.5 text-xs transition hover:border-cyan/50 hover:text-cyan"><KeyRound size={13} /> Trocar senha</button>
          )}
          {pwMsg && <p className={`mt-1 text-center text-[0.68rem] ${pwMsg.ok ? "text-emerald" : "text-destructive"}`}>{pwMsg.text}</p>}
          <Link to="/configuracoes" onClick={() => setOpen(false)} data-testid="conta-config" className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-1.5 text-xs transition hover:border-cyan/50 hover:text-cyan"><Settings size={13} /> Configurações</Link>
          <button onClick={() => void signOut()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-1.5 text-xs transition hover:border-destructive/50 hover:text-destructive" data-testid="conta-sair"><LogOut size={13} /> Sair</button>
        </div>
      )}
    </div>
  );
}
