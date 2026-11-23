import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarRange, CreditCard, Gauge, Handshake, Layers, LayoutDashboard, MoreHorizontal, Plus, Receipt, Repeat, Sparkles, Target } from "lucide-react";
import { Briefing } from "@/components/finance/Briefing";
import { AccountsView, type Sel } from "@/components/finance/Accounts";
import { Dashboard } from "@/components/finance/Dashboard";
import { GoalsView } from "@/components/finance/Goals";
import { InstallmentsView } from "@/components/finance/Installments";
import { QuickAddModal } from "@/components/finance/QuickAdd";
import { TransactionsView } from "@/components/finance/Transactions";
import { SubscriptionsView } from "@/components/finance/Subscriptions";
import { MonthsView } from "@/components/finance/Months";
import { SettleView } from "@/components/finance/Settle";
import { FinanceAssistant } from "@/components/finance/Assistant";
import { ConfirmDelete, btn } from "@/components/finance/ui";
import { FinBackdrop, LiveDot } from "@/components/finance/fx";
import { monthName, ymOf } from "@/lib/finance/calc";
import type { Draft } from "@/lib/finance/parse";
import { FinanceProvider, useFinance } from "@/lib/finance/store";

const TABS = ["visao", "contas", "parcelas", "meses", "movimentacoes", "assinaturas", "acerto", "metas"] as const;
type Tab = (typeof TABS)[number];
const TAB_META: Record<Tab, { label: string; icon: typeof Gauge }> = {
  visao: { label: "Visão geral", icon: LayoutDashboard }, contas: { label: "Contas e cartões", icon: CreditCard }, parcelas: { label: "Parcelas", icon: Layers }, meses: { label: "Próximos meses", icon: CalendarRange },
  movimentacoes: { label: "Movimentações", icon: Receipt }, assinaturas: { label: "Assinaturas", icon: Repeat }, acerto: { label: "Acerto de contas", icon: Handshake }, metas: { label: "Metas", icon: Target },
};

/** Indicador de onde os dados estão sendo guardados. */
function SyncDot() {
  const { sync } = useFinance();
  const m = { idle: ["var(--cyan)", "Carregando…"], saving: ["var(--cyan)", "Salvando…"], saved: ["var(--emerald)", "Salvo na nuvem"], local: ["var(--amber)", "Só neste aparelho · entre na conta para guardar"], error: ["oklch(0.7 0.2 25)", "Não consegui salvar · tento de novo no próximo lançamento"] }[sync];
  return <span data-testid="fin-sync" data-sync={sync}><LiveDot color={m[0]!} label={m[1]!} /></span>;
}

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
  const tabsRef = useRef<HTMLElement>(null);
  // leva a aba ativa para o meio da barra (assim "Metas" e as últimas abas sempre aparecem)
  useEffect(() => { tabsRef.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [tab, f.ready]);
  const go = (t: Tab, i?: string) => void navigate({ to: "/financeiro", search: { ...(t !== "visao" ? { aba: t } : {}), ...(i ? { item: i } : {}) }, replace: false });
  const sel: Sel = item ? { type: item.startsWith("card:") ? "card" : "acc", id: item.split(":")[1]! } : null;
  const open = (d?: Draft) => { setPreset(d ?? null); setAdding(true); };

  if (!f.ready) return <main className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-4"><span className="mono-caps animate-pulse">Carregando financeiro…</span></main>;
  const onboarding = !f.state.onboarded || refazer === "1";

  return (
    <main className="relative mx-auto min-h-screen max-w-[1500px] px-4 pb-40 pt-6 md:py-10" data-testid="financeiro">
      <FinBackdrop />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3"><p className="mono-caps">Finanças pessoais · {monthName(ymOf(f.today))}</p>{!onboarding && <SyncDot />}</div>
          <h1 className="relative mt-2 font-serif text-6xl leading-[0.9] md:text-7xl" style={{ animation: "fin-rise .7s both" }}>Meu <span className="text-gradient italic drop-shadow-[0_0_30px_color-mix(in_oklab,var(--cyan)_45%,transparent)]">financeiro</span></h1>
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
          {/* a moldura de luz fica numa caixa fixa; só o miolo rola (senão a borda rola junto e "acaba" antes das últimas abas) */}
          <div className="glass fin-frame sticky top-3 z-20 mb-7 flex items-center gap-1 rounded-2xl">
          <nav ref={tabsRef} aria-label="Seções do financeiro" className="scroll-thin flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-2xl p-1.5" role="tablist" data-testid="fin-abas">
            {TABS.map((t) => { const M = TAB_META[t], on = t === tab; return (
              <button key={t} role="tab" aria-selected={on} onClick={() => go(t)} data-testid={`fin-aba-${t}`}
                className={`relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm transition ${on ? "text-cyan shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cyan)_45%,transparent),0_0_28px_-6px_var(--cyan)]" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}>
                {on && <span aria-hidden className="absolute inset-0 bg-gradient-to-br from-cyan/20 via-cyan/5 to-violet/20" style={{ animation: "fin-fade .35s both" }} />}
                {on && <span aria-hidden className="absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan to-transparent" />}
                <M.icon size={16} className="relative" /><span className="relative">{M.label}</span></button>); })}

          </nav>
          <button className="mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-brand text-[#04121a] shadow-[0_8px_24px_-8px_var(--cyan)] md:hidden" onClick={() => open()} aria-label="Adicionar movimentação (atalho)" data-testid="fin-adicionar-rapido"><Plus size={18} /></button>
          </div>
          <div key={tab + (item ?? "")} style={{ animation: "fin-rise .5s both" }}>
            {tab === "visao" && <Dashboard onOpenCard={(id) => go("contas", `card:${id}`)} onOpenAccount={(id) => go("contas", `acc:${id}`)} onAdd={() => open()} onTab={(t) => go(t as Tab)} onDraft={(d) => open(d)} />}
            {tab === "contas" && <AccountsView sel={sel} onSel={(s) => go("contas", s ? `${s.type}:${s.id}` : undefined)} />}
            {tab === "parcelas" && <InstallmentsView />}
            {tab === "meses" && <MonthsView />}
            {tab === "movimentacoes" && <TransactionsView onAdd={() => open()} />}
            {tab === "assinaturas" && <SubscriptionsView />}
            {tab === "acerto" && <SettleView />}
            {tab === "metas" && <GoalsView />}
          </div>
          <div className="mt-6"><FinanceAssistant key={tab === "acerto" ? "a" : "b"} defaultOpen={tab === "acerto"} /></div>
        </>
      )}
      <QuickAddModal open={adding} onClose={() => { setAdding(false); setPreset(null); }} preset={preset} />
      <ConfirmDelete open={wipe} what="todos os dados financeiros deste navegador" onCancel={() => setWipe(false)} onConfirm={() => { f.resetAll(); setWipe(false); void navigate({ to: "/financeiro", search: {} }); }} />
    </main>
  );
}
