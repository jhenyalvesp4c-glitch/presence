import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CreditCard, Gauge, Layers, LayoutDashboard, MoreHorizontal, Plus, Receipt, Sparkles, Target } from "lucide-react";
import { Briefing } from "@/components/finance/Briefing";
import { AccountsView, type Sel } from "@/components/finance/Accounts";
import { Dashboard } from "@/components/finance/Dashboard";
import { GoalsView } from "@/components/finance/Goals";
import { InstallmentsView } from "@/components/finance/Installments";
import { QuickAddModal } from "@/components/finance/QuickAdd";
import { TransactionsView } from "@/components/finance/Transactions";
import { ConfirmDelete, btn } from "@/components/finance/ui";
import { monthName, ymOf } from "@/lib/finance/calc";
import type { Draft } from "@/lib/finance/parse";
import { FinanceProvider, useFinance } from "@/lib/finance/store";

const TABS = ["visao", "contas", "parcelas", "movimentacoes", "metas"] as const;
type Tab = (typeof TABS)[number];
const TAB_META: Record<Tab, { label: string; icon: typeof Gauge }> = {
  visao: { label: "Visão geral", icon: LayoutDashboard }, contas: { label: "Contas e cartões", icon: CreditCard }, parcelas: { label: "Parcelas", icon: Layers },
  movimentacoes: { label: "Movimentações", icon: Receipt }, metas: { label: "Metas", icon: Target },
};

export const Route = createFileRoute("/financeiro")({
  validateSearch: (s: Record<string, unknown>): { aba?: Tab; item?: string; refazer?: "1" } => ({
    ...(TABS.includes(s["aba"] as Tab) && s["aba"] !== "visao" ? { aba: s["aba"] as Tab } : {}),
    ...(typeof s["item"] === "string" && /^(card|acc):[\w-]+$/.test(s["item"]) ? { item: s["item"] } : {}),
    ...(s["refazer"] === "1" ? { refazer: "1" as const } : {}),
  }),
  head: () => ({ meta: [{ title: "Orion · Financeiro" }, { name: "description", content: "Contas, cartões, parcelas, metas e um painel para entender para onde vai o seu dinheiro." }, { property: "og:title", content: "Orion · Financeiro" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <FinanceProvider><FinancePage /></FinanceProvider>,
});

function FinancePage() {
  const f = useFinance(), navigate = useNavigate(), { aba, item, refazer } = Route.useSearch();
  const tab: Tab = aba ?? "visao", [adding, setAdding] = useState(false), [preset, setPreset] = useState<Draft | null>(null), [menu, setMenu] = useState(false), [wipe, setWipe] = useState(false);
  const go = (t: Tab, i?: string) => void navigate({ to: "/financeiro", search: { ...(t !== "visao" ? { aba: t } : {}), ...(i ? { item: i } : {}) }, replace: false });
  const sel: Sel = item ? { type: item.startsWith("card:") ? "card" : "acc", id: item.split(":")[1]! } : null;
  const open = (d?: Draft) => { setPreset(d ?? null); setAdding(true); };

  if (!f.ready) return <main className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-4"><span className="mono-caps animate-pulse">Carregando financeiro…</span></main>;
  const onboarding = !f.state.onboarded || refazer === "1";

  return (
    <main className="relative mx-auto min-h-screen max-w-6xl px-4 pb-40 pt-6 md:py-10 md:pl-24" data-testid="financeiro">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><span className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-[var(--violet)] opacity-[0.10] blur-3xl" style={{ animation: "fin-aurora 18s ease-in-out infinite" }} /><span className="absolute -right-24 top-1/2 h-96 w-96 rounded-full bg-[var(--cyan)] opacity-[0.08] blur-3xl" style={{ animation: "fin-aurora 22s ease-in-out infinite reverse" }} /></div>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-caps">Finanças pessoais · {monthName(ymOf(f.today))}</p>
          <h1 className="mt-1 font-serif text-5xl leading-none md:text-6xl">Meu <span className="text-gradient italic">financeiro</span></h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{onboarding ? "Responda ao briefing e o Orion monta o seu painel." : "Para onde o dinheiro vai, o que já está comprometido e como estão as suas metas."}</p>
        </div>
        <div className="relative flex items-center gap-2">
          {!onboarding && <button className={btn.primary} onClick={() => open()} data-testid="fin-adicionar"><Plus size={16} /> Adicionar movimentação</button>}
          <button className={btn.icon} onClick={() => setMenu(!menu)} aria-label="Opções do financeiro" aria-expanded={menu} data-testid="fin-opcoes"><MoreHorizontal size={17} /></button>
          {menu && (
            <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.17_0.03_262/0.97)] p-1.5 shadow-2xl backdrop-blur-xl" style={{ animation: "fin-pop .25s both" }} role="menu">
              {[{ l: "Refazer o briefing", i: Sparkles, a: () => { void navigate({ to: "/financeiro", search: { refazer: "1" } }); } }, { l: "Carregar dados de exemplo", i: Gauge, a: () => { f.loadMock(); go("visao"); } }].map((m) => (
                <button key={m.l} role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.07]" onClick={() => { setMenu(false); m.a(); }}><m.i size={15} className="text-cyan" />{m.l}</button>
              ))}
              <button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-destructive transition hover:bg-destructive/10" onClick={() => { setMenu(false); setWipe(true); }} data-testid="fin-limpar">Apagar todos os dados</button>
            </div>
          )}
        </div>
      </header>

      {onboarding ? (
        <>
          {f.state.onboarded && <button className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => go("visao")}><ArrowLeft size={16} /> Voltar ao painel</button>}
          <Briefing onDone={() => go("visao")} />
        </>
      ) : (
        <>
          <nav aria-label="Seções do financeiro" className="glass sticky top-3 z-20 mb-6 flex gap-1 overflow-x-auto rounded-2xl p-1.5 scroll-neon" role="tablist" data-testid="fin-abas">
            {TABS.map((t) => { const M = TAB_META[t], on = t === tab; return (
              <button key={t} role="tab" aria-selected={on} onClick={() => go(t)} data-testid={`fin-aba-${t}`}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${on ? "bg-cyan/12 text-cyan shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cyan)_45%,transparent),0_0_24px_-8px_var(--cyan)]" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}><M.icon size={16} />{M.label}</button>); })}
            <button className="sticky right-0 ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-brand text-[#04121a] shadow-[0_8px_24px_-8px_var(--cyan)] md:hidden" onClick={() => open()} aria-label="Adicionar movimentação (atalho)" data-testid="fin-adicionar-rapido"><Plus size={18} /></button>
          </nav>
          <div key={tab + (item ?? "")} style={{ animation: "fin-fade .4s both" }}>
            {tab === "visao" && <Dashboard onOpenCard={(id) => go("contas", `card:${id}`)} onOpenAccount={(id) => go("contas", `acc:${id}`)} onAdd={() => open()} onTab={(t) => go(t as Tab)} onDraft={(d) => open(d)} />}
            {tab === "contas" && <AccountsView sel={sel} onSel={(s) => go("contas", s ? `${s.type}:${s.id}` : undefined)} />}
            {tab === "parcelas" && <InstallmentsView />}
            {tab === "movimentacoes" && <TransactionsView onAdd={() => open()} />}
            {tab === "metas" && <GoalsView />}
          </div>
        </>
      )}
      <QuickAddModal open={adding} onClose={() => { setAdding(false); setPreset(null); }} preset={preset} />
      <ConfirmDelete open={wipe} what="todos os dados financeiros deste navegador" onCancel={() => setWipe(false)} onConfirm={() => { f.resetAll(); setWipe(false); void navigate({ to: "/financeiro", search: {} }); }} />
    </main>
  );
}
