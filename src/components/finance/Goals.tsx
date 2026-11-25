import { useState } from "react";
import { CalendarDays, CreditCard, Gauge, PiggyBank, Plus, Pencil, Shield, Target, Trash2, TrendingUp } from "lucide-react";
import { brl, dateBR, expensesOf, monthEntries, monthsBetween, total, ymOf } from "@/lib/finance/calc";
import { catOf } from "@/lib/finance/categories";
import { useFinance } from "@/lib/finance/store";
import type { Goal, GoalKind } from "@/lib/finance/types";
import { Money, RadialRings, Ring } from "./charts";
import { HeroPanel, SectionTitle, Tilt } from "./fx";
import { GoalForm, goalKindLabel } from "./forms";
import { ConfirmDelete, Empty, Field, Modal, MoneyInput, Pill, btn } from "./ui";

const ICON: Record<GoalKind, typeof Target> = { guardar: PiggyBank, reserva: Shield, quitar_cartao: CreditCard, economizar_mensal: TrendingUp, limite_categoria: Gauge };
const COLOR: Record<GoalKind, string> = { guardar: "var(--cyan)", reserva: "var(--emerald)", quitar_cartao: "var(--violet)", economizar_mensal: "var(--amber)", limite_categoria: "oklch(0.72 0.18 10)" };
const ROSE = "oklch(0.72 0.18 10)";

export function GoalCard({ goal, onEdit, onDelete, onAdd, index = 0 }: { goal: Goal; onEdit?: (g: Goal) => void; onDelete?: (g: Goal) => void; onAdd?: (g: Goal) => void; index?: number }) {
  const fin = useFinance(), { state, today } = fin, I = ICON[goal.kind];
  const limit = goal.kind === "limite_categoria";
  const current = limit ? total(expensesOf(monthEntries(state, ymOf(today))).filter((e) => e.category === goal.category)) : goal.current;
  const pct = goal.target ? (current / goal.target) * 100 : 0, over = limit && current > goal.target, color = over ? ROSE : COLOR[goal.kind];
  const left = Math.max(0, goal.target - current);
  const months = goal.deadline ? Math.max(1, monthsBetween(ymOf(today), goal.deadline.slice(0, 7))) : 0;
  return (
    <article className="glass relative h-full overflow-hidden rounded-[1.6rem] p-5" style={{ animation: `fin-pop .55s ${Math.min(index, 8) * 0.07}s both`, boxShadow: `inset 0 1px 0 oklch(1 0 0 / 6%), 0 20px 50px -34px ${color}` }} data-testid="fin-meta-card">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      {pct >= 100 && !limit && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.6rem]" style={{ boxShadow: `inset 0 0 0 1px ${color}, 0 0 40px -10px ${color}`, animation: "fin-breathe 3s ease-in-out infinite" }} />}
      <div className="relative flex items-start gap-4">
        <Ring pct={Math.min(100, pct)} color={color} size={88} thickness={8}><span className="text-center leading-tight"><b className="block text-lg tabular-nums" style={{ color: over ? ROSE : undefined }}>{Math.round(pct)}%</b></span></Ring>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.13em]" style={{ color }}><I size={13} />{goalKindLabel(goal.kind)}</p>
          <h4 className="mt-0.5 truncate font-display text-lg font-semibold">{goal.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground"><b className="text-foreground tabular-nums" data-testid="fin-meta-atual">{brl(current)}</b> de <span className="tabular-nums">{brl(goal.target)}</span>{limit ? " este mês" : goal.kind === "economizar_mensal" ? " guardados no mês" : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {over ? <Pill color={ROSE}>passou {brl(current - goal.target)}</Pill> : <Pill color={color}>{limit ? `ainda pode gastar ${brl(left)}` : pct >= 100 ? "meta atingida 🎉" : `faltam ${brl(left)}`}</Pill>}
            {goal.deadline && !limit && <Pill color="var(--violet)"><CalendarDays size={11} /> até {dateBR(goal.deadline).slice(3)}</Pill>}
          </div>
          {onEdit && (
            <button type="button" role="switch" aria-checked={!!goal.reserve} onClick={() => fin.upsertGoal({ ...goal, reserve: !goal.reserve })} data-testid="fin-meta-descontar-card" title="Liga ou desliga o desconto desta meta na sobra de caixa" className="mt-2 flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground">
              <span className={`relative h-4 w-7 rounded-full border transition ${goal.reserve ? "border-emerald bg-emerald/30" : "border-white/15 bg-white/10"}`}><span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${goal.reserve ? "left-[0.95rem]" : "left-0.5"}`} /></span>
              {goal.reserve ? "Desconta da sobra de caixa" : "Não desconta da sobra"}
            </button>
          )}
        </div>
      </div>
      {goal.deadline && !limit && left > 0 && <p className="relative mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground">Para chegar lá, guarde cerca de <b className="text-foreground tabular-nums">{brl(left / months)}</b> por mês durante {months} {months === 1 ? "mês" : "meses"}.</p>}
      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2">
        {!limit && onAdd ? <button className={btn.ghost} onClick={() => onAdd(goal)} data-testid="fin-meta-aporte"><Plus size={14} /> Registrar valor</button> : <span />}
        <span className="flex gap-1.5">{onEdit && <button className={btn.icon} aria-label={`Editar ${goal.title}`} onClick={() => onEdit(goal)}><Pencil size={14} /></button>}{onDelete && <button className={`${btn.icon} hover:!border-destructive/50 hover:!text-destructive`} aria-label={`Excluir ${goal.title}`} onClick={() => onDelete(goal)}><Trash2 size={14} /></button>}</span>
      </div>
    </article>
  );
}

/** Topo da aba: anéis de todas as metas e o total já guardado. */
function GoalsHero() {
  const { state, today } = useFinance();
  const rows = state.goals.map((g) => {
    const limit = g.kind === "limite_categoria", cur = limit ? total(expensesOf(monthEntries(state, ymOf(today))).filter((e) => e.category === g.category)) : g.current;
    return { g, limit, cur, pct: g.target ? (cur / g.target) * 100 : 0 };
  });
  const saving = rows.filter((r) => !r.limit), saved = saving.reduce((a, r) => a + r.cur, 0), target = saving.reduce((a, r) => a + r.g.target, 0), done = saving.filter((r) => r.pct >= 100).length;
  return (
    <HeroPanel glow="var(--emerald)" data-testid="fin-metas-hero">
      <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <RadialRings size={250} thickness={8} items={rows.slice(0, 5).map((r) => ({ id: r.g.id, label: r.g.title, color: r.limit && r.cur > r.g.target ? ROSE : COLOR[r.g.kind], pct: r.pct }))}
          center={<div><p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Concluídas</p><p className="font-display text-2xl font-semibold">{done}/{saving.length}</p></div>} />
        <div className="min-w-0">
          <p className="mono-caps">Já guardado nas metas</p>
          <p className="mt-1 whitespace-nowrap font-display text-4xl font-semibold tracking-tight md:text-5xl"><span className="text-gradient"><Money value={saved} /></span></p>
          <p className="mt-1 text-sm text-muted-foreground">de {brl(target)} somando todas as metas de guardar</p>
          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {rows.slice(0, 6).map((r, i) => (
              <li key={r.g.id} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm" style={{ animation: `fin-rise .5s ${0.1 + i * 0.06}s both` }}>
                <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR[r.g.kind], boxShadow: `0 0 8px ${COLOR[r.g.kind]}` }} />
                <span className="min-w-0 flex-1 truncate">{r.g.title}</span><b className="tabular-nums" style={{ color: r.limit && r.cur > r.g.target ? ROSE : undefined }}>{Math.round(r.pct)}%</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </HeroPanel>
  );
}

export function GoalsView() {
  const f = useFinance(), { state } = f;
  const [edit, setEdit] = useState<Goal | "new" | null>(null), [del, setDel] = useState<Goal | null>(null), [add, setAdd] = useState<Goal | null>(null), [val, setVal] = useState<number | undefined>();
  return (
    <div className="space-y-5" data-testid="fin-metas">
      <SectionTitle kicker="Objetivos" title="Suas" accent="metas" sub="Guardar, quitar, economizar e controlar categorias."
        right={<button className={btn.primary} onClick={() => setEdit("new")} data-testid="fin-add-meta"><Plus size={16} /> Nova meta</button>} />
      {state.goals.length > 0 && <GoalsHero />}
      {state.goals.length === 0 ? <Empty icon={Target} title="Nenhuma meta ainda" hint="Crie uma reserva de emergência, um limite de gastos ou uma meta para guardar dinheiro." action={<button className={btn.primary} onClick={() => setEdit("new")}><Plus size={16} /> Criar a primeira meta</button>} /> : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">{state.goals.map((g, i) => <Tilt key={g.id} max={7}><GoalCard goal={g} index={i} onEdit={setEdit} onDelete={setDel} onAdd={(x) => { setAdd(x); setVal(undefined); }} /></Tilt>)}</div>
      )}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "Nova meta" : "Editar meta"} width="max-w-xl">{edit !== null && <GoalForm initial={edit === "new" ? undefined : edit} onCancel={() => setEdit(null)} onSave={(g) => { f.upsertGoal(g); setEdit(null); }} />}</Modal>
      <Modal open={!!add} onClose={() => setAdd(null)} title="Registrar valor" subtitle={add ? `Quanto entrou em “${add.title}”?` : undefined} width="max-w-sm"
        footer={<><button className={btn.ghost} onClick={() => setAdd(null)}>Cancelar</button><button className={btn.primary} disabled={!val} data-testid="fin-meta-aporte-ok" onClick={() => { if (add && val) f.upsertGoal({ ...add, current: Math.round((add.current + val) * 100) / 100 }); setAdd(null); }}>Somar</button></>}>
        <Field label="Valor (pode ser negativo para retirar)"><MoneyInput value={val} onChange={setVal} data-testid="fin-meta-aporte-valor" /></Field>
        {add && <p className="mt-3 text-xs text-muted-foreground">Agora: {brl(add.current)}{val ? ` → ${brl(add.current + val)}` : ""}. {add.category ? catOf(add.category).name : ""}</p>}
      </Modal>
      <ConfirmDelete open={!!del} what={del ? `a meta “${del.title}”` : ""} onCancel={() => setDel(null)} onConfirm={() => { if (del) f.removeGoal(del.id); setDel(null); }} />
    </div>
  );
}
