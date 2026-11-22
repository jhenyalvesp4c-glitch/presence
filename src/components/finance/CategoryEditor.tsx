/** Editor de categorias do financeiro: renomear, trocar cor/ícone, esconder, criar e apagar. Vale para cartão, débito, assinaturas, metas… tudo. */
import { useState } from "react";
import * as Icons from "lucide-react";
import { Check, EyeOff, Eye, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_CATS, PROTECTED_CATS, buildCategories, type Cat, type CatDef } from "@/lib/finance/categories";
import { categoryUsage, newCategoryId } from "@/lib/finance/category-edit";
import { useFinance } from "@/lib/finance/store";
import { CatBadge, CatIcon, Field, Modal, Segmented, TextInput, btn } from "./ui";

const COLORS = ["oklch(0.72 0.17 290)", "oklch(0.8 0.16 160)", "oklch(0.78 0.16 55)", "oklch(0.78 0.13 235)", "oklch(0.74 0.2 15)", "oklch(0.82 0.14 210)", "oklch(0.76 0.19 330)", "oklch(0.7 0.18 270)", "oklch(0.8 0.15 90)", "oklch(0.82 0.17 155)", "oklch(0.8 0.15 190)", "oklch(0.75 0.2 40)", "oklch(0.7 0.03 260)", "oklch(0.85 0.12 120)"];
const ICONS = ["Home", "ShoppingCart", "Utensils", "Car", "HeartPulse", "GraduationCap", "Clapperboard", "Repeat", "ShoppingBag", "Banknote", "Sparkles", "Plane", "Gift", "PawPrint", "Baby", "Dumbbell", "Wrench", "Shirt", "Fuel", "Bus", "Coffee", "Beer", "Gamepad2", "Music", "BookOpen", "Smartphone", "Wifi", "Zap", "Droplets", "Scissors", "Pill", "Stethoscope", "Briefcase", "PiggyBank", "Landmark", "Receipt", "Church", "Heart", "Bike", "TreePine", "Tv", "Laptop", "Building2", "Truck", "Umbrella", "Tag", "Wallet", "CreditCard", "Percent", "Camera", "Palette", "Hammer", "Sofa", "Pizza", "IceCream", "Wine", "Ticket", "Hotel", "Train", "Bed", "Flower2", "Glasses", "Handshake", "HandCoins", "TrendingUp", "Coins", "Gem", "Star", "CircleEllipsis"];

export function CategoryEditor({ open, onClose, income: startIncome = false }: { open: boolean; onClose: () => void; income?: boolean }) {
  const { state, saveCategories } = useFinance();
  const [tab, setTab] = useState<"despesa" | "receita">(startIncome ? "receita" : "despesa");
  const [editing, setEditing] = useState<string | null>(null);
  const defs = state.categories;
  const { all } = buildCategories(defs);
  const hiddenIds = new Set(defs.filter((d) => d.hidden).map((d) => d.id));
  const list = all.filter((c) => !!c.income === (tab === "receita"));
  const isCustom = (id: string) => defs.some((d) => d.id === id && d.custom);
  const edited = (id: string) => defs.some((d) => d.id === id && !d.custom);

  const patch = (c: Cat, p: Partial<CatDef>) => {
    const has = defs.some((d) => d.id === c.id);
    const next = has ? defs.map((d) => (d.id === c.id ? { ...d, ...p } : d)) : [...defs, { id: c.id, ...p }];
    saveCategories(next);
  };
  const add = () => {
    const id = newCategoryId(), income = tab === "receita";
    saveCategories([...defs, { id, custom: true, name: "Nova categoria", color: COLORS[(defs.filter((d) => d.custom).length + 3) % COLORS.length]!, icon: "Tag", ...(income ? { income: true } : {}), words: [] }]);
    setEditing(id);
  };
  const remove = (c: Cat) => {
    const n = categoryUsage(state, c.id);
    if (!window.confirm(`Apagar a categoria "${c.name}"?${n ? ` Os ${n} lançamento(s) dela passam para "${c.income ? "Renda extra" : "Outros"}".` : ""}`)) return;
    saveCategories(defs.filter((d) => d.id !== c.id), [{ id: c.id, income: !!c.income }]);
    setEditing(null); toast.success(`Categoria "${c.name}" apagada`);
  };
  const reset = (c: Cat) => { saveCategories(defs.filter((d) => d.id !== c.id)); toast.success(`"${c.name}" voltou ao padrão`); };

  return (
    <Modal open={open} onClose={onClose} title="Categorias" subtitle="Vale para cartão de crédito, débito, assinaturas, metas e tudo mais." width="max-w-2xl"
      footer={<button className={btn.primary} onClick={onClose} data-testid="fin-categorias-fechar"><Check size={15} /> Pronto</button>}>
      <div className="space-y-4" data-testid="fin-categorias">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented value={tab} onChange={(v) => { setTab(v); setEditing(null); }} options={[{ value: "despesa", label: "Despesas" }, { value: "receita", label: "Receitas" }]} />
          <button className={btn.ghost} onClick={add} data-testid="fin-categoria-nova"><Plus size={14} /> Nova categoria</button>
        </div>
        <ul className="space-y-2">
          {list.map((c, i) => {
            const on = editing === c.id, hidden = hiddenIds.has(c.id) && !PROTECTED_CATS.has(c.id), n = categoryUsage(state, c.id);
            const def = defs.find((d) => d.id === c.id);
            return (
              <li key={c.id} className="ex-card ex-glass" style={{ ["--rail" as string]: c.color, animation: `fin-rise .4s ${Math.min(i, 10) * 0.03}s both`, opacity: hidden ? 0.55 : 1 }} data-testid={`fin-categoria-${c.id}`}>
                <div className="flex items-center gap-3 px-3.5 py-2.5">
                  <CatBadge id={c.id} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}{hidden && <span className="ml-2 text-[0.65rem] text-muted-foreground">oculta</span>}{isCustom(c.id) && <span className="ml-2 rounded-full border border-cyan/40 px-1.5 text-[0.6rem] text-cyan">sua</span>}</p>
                    <p className="text-[0.68rem] text-muted-foreground">{n ? `usada em ${n} lançamento${n === 1 ? "" : "s"}` : "sem lançamentos ainda"}</p>
                  </div>
                  <button className={btn.icon} aria-label={`Editar ${c.name}`} aria-pressed={on} onClick={() => setEditing(on ? null : c.id)}><Pencil size={14} /></button>
                  {!PROTECTED_CATS.has(c.id) && !isCustom(c.id) && <button className={btn.icon} aria-label={hidden ? `Mostrar ${c.name}` : `Ocultar ${c.name}`} title={hidden ? "Mostrar de novo" : "Ocultar das escolhas"} onClick={() => patch(c, { hidden: !hidden })}>{hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button>}
                  {isCustom(c.id) && <button className={`${btn.icon} hover:!border-destructive/50 hover:!text-destructive`} aria-label={`Apagar ${c.name}`} onClick={() => remove(c)}><Trash2 size={14} /></button>}
                </div>
                {on && (
                  <div className="space-y-3 border-t border-white/10 px-3.5 py-3.5" style={{ animation: "fin-fade .3s both" }}>
                    <Field label="Nome"><TextInput value={def?.name ?? c.name} maxLength={40} onChange={(e) => patch(c, { name: e.target.value })} data-testid="fin-categoria-nome" /></Field>
                    <Field group label="Cor">
                      <div className="flex flex-wrap gap-2">{COLORS.map((col) => <button key={col} type="button" aria-label="Escolher cor" aria-pressed={c.color === col} onClick={() => patch(c, { color: col })} className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${c.color === col ? "border-white" : "border-transparent"}`} style={{ background: col, boxShadow: c.color === col ? `0 0 14px ${col}` : undefined }} />)}</div>
                    </Field>
                    <Field group label="Ícone">
                      <div className="scroll-thin grid max-h-36 grid-cols-8 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-10">{ICONS.map((ic) => { const I = (Icons as unknown as Record<string, typeof Icons.Home>)[ic] ?? Icons.Tag; const sel = c.icon === ic; return (
                        <button key={ic} type="button" aria-label={ic} aria-pressed={sel} onClick={() => patch(c, { icon: ic })} className={`grid h-9 place-items-center rounded-xl border transition hover:scale-110 ${sel ? "border-white/60 bg-white/10" : "border-white/10"}`} style={{ color: sel ? c.color : undefined }}><I size={16} /></button>); })}</div>
                    </Field>
                    <Field label="Palavras para sugerir sozinha" hint="Separe por vírgula. Ao digitar uma descrição com uma dessas palavras, o Orion já escolhe esta categoria.">
                      <TextInput value={(def?.words ?? c.words).join(", ")} onChange={(e) => patch(c, { words: e.target.value.split(",").map((w) => w.trim()).filter(Boolean) })} placeholder="Ex.: pet shop, ração, veterinário" />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      {edited(c.id) && DEFAULT_CATS.some((d) => d.id === c.id) && <button className={btn.ghost} onClick={() => reset(c)}><RotateCcw size={13} /> Voltar ao padrão</button>}
                      <button className={btn.ghost} onClick={() => setEditing(null)}><Check size={13} /> Ok</button>
                    </div>
                  </div>
                )}
              </li>);
          })}
        </ul>
        <p className="text-xs text-muted-foreground"><CatIcon id="outros" size={12} className="mr-1 inline" /> "Outros" e "Renda extra" ficam sempre: recebem os lançamentos de uma categoria apagada. Ocultar só tira das escolhas; o histórico continua com o nome.</p>
      </div>
    </Modal>
  );
}
