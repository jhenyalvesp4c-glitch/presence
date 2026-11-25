import { Banknote, Landmark, PiggyBank, Wallet } from "lucide-react";
import type { Account, Card, CardBrand } from "@/lib/finance/types";
import { brl } from "@/lib/finance/calc";
import { TONES } from "./ui";

function BrandMark({ brand }: { brand: CardBrand }) {
  if (brand === "mastercard") return <svg viewBox="0 0 48 30" className="h-7 w-auto" aria-label="Mastercard"><circle cx="17" cy="15" r="12" fill="#eb001b" opacity=".92" /><circle cx="31" cy="15" r="12" fill="#f79e1b" opacity=".92" /><path d="M24 5.2a12 12 0 0 1 0 19.6 12 12 0 0 1 0-19.6Z" fill="#ff5f00" /></svg>;
  if (brand === "visa") return <span className="font-serif text-2xl font-black italic tracking-tight text-white" aria-label="Visa">VISA</span>;
  if (brand === "elo") return <span className="font-display text-xl font-black lowercase tracking-tight text-white" aria-label="Elo">elo</span>;
  if (brand === "amex") return <span className="font-display text-sm font-black tracking-widest text-white" aria-label="American Express">AMEX</span>;
  return <span className="text-xs uppercase tracking-widest text-white/70">cartão</span>;
}

/** Cartão de crédito desenhado: gradiente, chip, brilho que passa e uso do limite. */
export function CardVisual({ card, usedPct, selected = false, onClick, compact = false }: { card: Card; usedPct?: number; selected?: boolean; onClick?: () => void; compact?: boolean }) {
  const t = TONES[card.tone], Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} aria-pressed={onClick ? selected : undefined} aria-label={`Cartão ${card.name} final ${card.last4}`}
      className={`group relative block w-full overflow-hidden rounded-[1.4rem] text-left text-white transition duration-500 ${onClick ? "cursor-pointer hover:-translate-y-1" : ""} ${selected ? "scale-[1.02]" : ""}`}
      style={{ background: t.bg, aspectRatio: compact ? "1.9 / 1" : "1.586 / 1", boxShadow: `0 ${selected ? 30 : 18}px ${selected ? 70 : 44}px -22px ${t.glow}, inset 0 1px 0 oklch(1 0 0 / 22%), inset 0 0 0 1px oklch(1 0 0 / 8%)` }}>
      <span aria-hidden className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <span aria-hidden className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-black/25 blur-2xl" />
      <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.12]" viewBox="0 0 200 126" preserveAspectRatio="none"><path d="M-10 90 C 40 50, 80 130, 130 80 S 190 40, 215 70" stroke="white" strokeWidth="1.2" fill="none" /><path d="M-10 105 C 50 70, 90 140, 140 95 S 195 60, 215 88" stroke="white" strokeWidth="1" fill="none" /></svg>
      <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ animation: "fin-sheen 4.5s ease-in-out infinite" }} />
      <span aria-hidden className="absolute inset-0 opacity-0 mix-blend-overlay transition-opacity duration-500 group-hover:opacity-60" style={{ background: "conic-gradient(from 200deg at 70% 30%, var(--cyan), var(--violet), var(--pink), var(--amber), var(--emerald), var(--cyan))" }} />
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div><p className="text-[0.62rem] uppercase tracking-[0.22em] text-white/65">Crédito</p><p className="font-display text-lg font-semibold leading-tight">{card.name}</p></div>
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M8.5 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M15.5 3.5a12 12 0 0 1 0 17" /></svg>
        </div>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 40 30" className="h-8 w-auto" aria-hidden><defs><linearGradient id={`chip-${card.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e3a6" /><stop offset="1" stopColor="#c9a24e" /></linearGradient></defs><rect x="1" y="1" width="38" height="28" rx="6" fill={`url(#chip-${card.id})`} /><path d="M1 10h38M1 20h38M14 1v28M26 1v28" stroke="#7a5d1a" strokeOpacity=".5" strokeWidth="1" fill="none" /></svg>
          <span className="font-mono text-sm tracking-[0.28em] text-white/90">•••• {card.last4}</span>
        </div>
        <div className="flex items-end justify-between">
          <div className="min-w-0"><p className="text-[0.6rem] uppercase tracking-[0.18em] text-white/60">Vence dia {card.dueDay} · fecha {card.closingDay}</p>
            {usedPct !== undefined && <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-white/85" style={{ width: `${Math.min(100, usedPct)}%`, transition: "width .9s" }} /></div>}
          </div>
          <BrandMark brand={card.brand} />
        </div>
      </div>
    </Tag>
  );
}

const KIND_ICON = { banco: Landmark, carteira: Wallet, dinheiro: Banknote, investimento: PiggyBank, cofrinho: PiggyBank } as const;
export const KIND_LABEL = { banco: "Conta bancária", carteira: "Carteira digital", dinheiro: "Dinheiro", investimento: "Investimento", cofrinho: "Cofrinho" } as const;

/** Conta ou carteira: ícone com brilho na cor da marca e o saldo em destaque. */
export function AccountTile({ account, balance, selected = false, onClick }: { account: Account; balance: number; selected?: boolean; onClick?: () => void }) {
  const t = TONES[account.tone], I = KIND_ICON[account.kind];
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} aria-label={`Conta ${account.name}`}
      className={`group relative w-full overflow-hidden rounded-[1.4rem] border p-4 text-left transition duration-500 hover:-translate-y-1 ${selected ? "bg-white/[0.08]" : "bg-white/[0.035] hover:bg-white/[0.06]"}`}
      style={{ borderColor: `color-mix(in oklab, ${t.glow} ${selected ? 60 : 24}%, transparent)`, boxShadow: selected ? `0 18px 50px -24px ${t.glow}` : undefined }}>
      <span aria-hidden className="absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-45" style={{ background: t.glow }} />
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-lg" style={{ background: t.bg, boxShadow: `0 8px 24px -10px ${t.glow}` }}><I size={19} /></span>
        <div className="min-w-0"><p className="truncate font-medium">{account.name}</p><p className="text-xs text-muted-foreground">{KIND_LABEL[account.kind]}</p></div>
      </div>
      <p className={`relative mt-4 font-display text-2xl font-semibold tabular-nums ${balance < 0 ? "text-destructive" : ""}`}>{brl(balance)}</p>
    </button>
  );
}
