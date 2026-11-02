import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Leaf, Heart, Flame, Target, TrendingUp, Scale, Tag, SlidersHorizontal, Coffee, Utensils, Plus, Trash2, Clock3, FileText, Check, X, ClipboardList, Wheat, Droplets, Beef, Pencil, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import dietAthleteAsset from "@/assets/dieta-atleta.jpg";
import { HealthTabs } from "@/components/health-tabs";
import { useHealthPreview } from "@/components/health-preview-provider";
import { HealthLoading } from "@/components/health-loading";

const dietAthlete = dietAthleteAsset;


type Meal = { id: number; name: string; time: string; foods: string[] };
const goals = [
  { label: "Emagrecimento", icon: Flame }, { label: "Definição", icon: Target },
  { label: "Ganho de massa", icon: TrendingUp }, { label: "Manutenção", icon: Scale }, { label: "Saúde", icon: Heart },
];
const samples: Record<string, { name: string; portion: string; kcal: number }[]> = {
  "Café da manhã": [ { name: "Overnight oats", portion: "1 pote individual", kcal: 320 }, { name: "Tapioca com frango", portion: "1 unidade", kcal: 280 }, { name: "Iogurte com frutas", portion: "1 porção", kcal: 250 }, { name: "Vitamina de banana com whey", portion: "1 copo", kcal: 300 } ],
  "Almoço": [ { name: "Frango, arroz e salada", portion: "1 prato", kcal: 450 }, { name: "Salmão com legumes", portion: "1 prato", kcal: 420 }, { name: "Bowl de quinoa", portion: "1 bowl", kcal: 380 } ],
  "Lanche": [ { name: "Fruta com castanhas", portion: "1 porção", kcal: 180 }, { name: "Sanduíche integral", portion: "1 unidade", kcal: 260 } ],
  "Jantar": [ { name: "Omelete com salada", portion: "1 prato", kcal: 310 }, { name: "Sopa de legumes", portion: "1 bowl", kcal: 230 } ],
};
const macroFields = [
  { key: "calories", label: "Calorias", unit: "kcal", placeholder: "1400", icon: Flame, color: "text-primary" },
  { key: "protein", label: "Proteína", unit: "g", placeholder: "130", icon: Beef, color: "text-nutrition-protein" },
  { key: "carbs", label: "Carboidrato", unit: "g", placeholder: "120", icon: Wheat, color: "text-nutrition-carb" },
  { key: "fat", label: "Gordura", unit: "g", placeholder: "45", icon: Droplets, color: "text-nutrition-fat" },
] as const;

function SectionHeading({ number, icon: Icon, title, optional }: { number: string; icon: LucideIcon; title: string; optional?: boolean }) {
  return <div className="mb-5 flex items-center gap-3"><span className="font-mono text-xs text-primary/60">{number}</span><Icon className="h-4 w-4 text-primary" /><h2 className="font-display-h text-base font-medium">{title}</h2>{optional && <span className="ml-auto text-xs text-muted-foreground">Opcional</span>}</div>;
}

type DietBuilderProps = { embedded?: boolean; onCancel?: () => void };
/** Espera as fichas carregarem do banco antes de montar o formulário (que lê os valores iniciais uma única vez). */
export function DietBuilder(props: DietBuilderProps) {
  const { ready } = useHealthPreview();
  return ready ? <DietBuilderForm {...props} /> : <HealthLoading />;
}

function DietBuilderForm({ embedded = false, onCancel }: { embedded?: boolean; onCancel?: () => void } = {}) {
  const { diet, setDiet } = useHealthPreview();
  const navigate = useNavigate();
  const [name, setName] = useState(diet?.name ?? "");
  const [goal, setGoal] = useState(diet?.goal ?? "Emagrecimento");
  const [macros, setMacros] = useState(diet?.macros ?? { calories: "", protein: "", carbs: "", fat: "" });
  const [notes, setNotes] = useState(diet?.notes ?? "");
  const [meals, setMeals] = useState<Meal[]>(diet?.meals ?? [{ id: 1, name: "Café da manhã", time: "07:00", foods: [] }, { id: 2, name: "Almoço", time: "12:00", foods: [] }]);
  const [tab, setTab] = useState("Café da manhã");
  const [editing, setEditing] = useState<number | null>(null);
  const [food, setFood] = useState("");
  const [complete, setComplete] = useState(false);
  const activeMeal = meals.find(m => m.id === editing);
  const updateMeal = (id: number, update: Partial<Meal>) => setMeals(current => current.map(m => m.id === id ? { ...m, ...update } : m));
  const addFood = () => {
    if (!activeMeal || !food.trim()) return;
    updateMeal(activeMeal.id, { foods: [...activeMeal.foods, food.trim()] });
    setFood("");
  };

  return <div className={`health-area nutrition-page relative ${embedded ? "min-h-full" : "min-h-screen"} overflow-hidden bg-background font-body text-foreground`}>
    <div className="aurora pointer-events-none absolute inset-0" />
    <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
    <main className="relative z-10 mx-auto max-w-7xl px-5 pb-12 pt-7 sm:px-8 lg:px-12">
      {!embedded && <HealthTabs active="saude" />}
      <header className="mb-9 flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow"><Leaf className="h-7 w-7 text-primary-foreground" /></div>
        <div><p className="mb-1 font-mono text-[10px] uppercase text-primary">Nutrição / Nova ficha</p><h1 className="font-display-h text-3xl font-semibold sm:text-4xl">Nova ficha de dieta<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Sua alimentação, no ritmo dos seus objetivos.</p></div>
      </header>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_350px] xl:gap-16">
        <form onSubmit={e => { e.preventDefault(); setDiet({ name, goal, macros, notes, meals }); navigate({ to: "/hoje" }); }} className="min-w-0">
          <section className="border-b border-border pb-7">
            <SectionHeading number="01" icon={Tag} title="Nome da ficha" />
            <label htmlFor="diet-name" className="sr-only">Nome da ficha</label><input id="diet-name" className="nutrition-input" placeholder="Ex: Dieta para definição" value={name} onChange={e => setName(e.target.value)} />
          </section>
          <section className="border-b border-border py-7">
            <SectionHeading number="02" icon={Target} title="Objetivo da dieta" />
            <div className="flex flex-wrap gap-2">{goals.map(g => <Button key={g.label} type="button" variant="outline" aria-pressed={goal === g.label} onClick={() => setGoal(g.label)} className={`h-10 px-3 text-xs ${goal === g.label ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card/40 text-muted-foreground"}`}><g.icon />{g.label}</Button>)}</div>
          </section>
          <section className="border-b border-border py-7">
            <SectionHeading number="03" icon={SlidersHorizontal} title="Metas diárias" optional />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{macroFields.map(m => <div key={m.key}><label htmlFor={m.key} className={`mb-2 flex items-center gap-2 text-xs ${m.color}`}><m.icon className="h-3.5 w-3.5" />{m.label}</label><div className="relative"><input id={m.key} type="number" min="0" step="any" className="nutrition-input pr-12" placeholder={m.placeholder} value={macros[m.key]} onChange={e => setMacros({ ...macros, [m.key]: e.target.value })} /><span className="pointer-events-none absolute right-3 top-3.5 text-xs text-muted-foreground">{m.unit}</span></div></div>)}</div>
          </section>
          <section className="border-b border-border py-7">
            <SectionHeading number="04" icon={Utensils} title="Refeições do dia" />
            <div className="space-y-3">{meals.map((meal, index) => <article key={meal.id} className="rounded-lg border border-border bg-card/50 p-4 transition-colors hover:border-primary/30">
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{index === 0 ? <Coffee className="h-5 w-5" /> : <Utensils className="h-5 w-5" />}</div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{meal.name}</p><p className="mt-1 text-xs text-muted-foreground">{meal.foods.length ? `${meal.foods.length} alimento${meal.foods.length > 1 ? "s" : ""}` : "Nenhum alimento adicionado"}</p></div>
                <span className="font-mono text-xs text-primary">{meal.time}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${meal.name}`} title={`Editar ${meal.name}`} onClick={() => { setEditing(meal.id); setFood(""); }}><Pencil className="text-muted-foreground" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Excluir ${meal.name}`} title={`Excluir ${meal.name}`} onClick={() => setMeals(current => current.filter(m => m.id !== meal.id))}><Trash2 className="text-muted-foreground" /></Button>
              </div>
              {meal.foods.length > 0 && <ul className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{meal.foods.map((f, i) => <li key={i} className="py-1">{f}</li>)}</ul>}
              <Button type="button" variant="ghost" size="sm" className="mt-3 h-8 text-primary" onClick={() => { setEditing(meal.id); setFood(""); }}><Plus />Adicionar alimento</Button>
            </article>)}</div>
            <Button type="button" variant="outline" className="mt-4 w-full border-dashed bg-transparent text-primary" onClick={() => { const id = Date.now(); setMeals(current => [...current, { id, name: "Nova refeição", time: "15:00", foods: [] }]); setEditing(id); }}><Plus />Adicionar refeição</Button>
          </section>
          <section className="py-7"><SectionHeading number="05" icon={FileText} title="Observações" optional /><label htmlFor="diet-notes" className="sr-only">Observações</label><textarea id="diet-notes" className="nutrition-input min-h-28 resize-y" placeholder="Preferências alimentares, restrições ou lembretes…" value={notes} onChange={e => setNotes(e.target.value)} /></section>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-6"><Button asChild variant="ghost" className="text-muted-foreground"><Link to="/saude" onClick={e => { if (onCancel) { e.preventDefault(); onCancel(); } }}>Cancelar</Link></Button><Button type="submit" className="h-12 gap-3 rounded-2xl bg-gradient-primary px-6 shadow-glow"><ClipboardList />Criar ficha de dieta<ArrowRight /></Button></div>
        </form>

        <aside className="min-w-0 space-y-7">
          <div className="relative"><img src={dietAthlete} alt="Atleta com bowl de salada e detalhes holográficos de nutrição" width={1024} height={768} className="nutrition-art aspect-[4/3] w-full rounded-lg object-cover" /><span className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-primary/30 bg-background/80 px-3 py-1.5 font-mono text-[10px] text-primary"><Leaf className="h-3 w-3" />Nutrição & equilíbrio</span></div>
          <section className="border-y border-border py-6" aria-label="Prévia da ficha">
            <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 font-display-h text-base"><ClipboardList className="h-4 w-4 text-primary" />Prévia da ficha</h2><span className="h-1.5 w-1.5 rounded-full bg-primary" /></div>
            <h3 className="break-words font-display-h text-xl font-medium">{name.trim() || "Sua nova rotina"}</h3>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4 text-primary" />{goal}</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Utensils className="h-4 w-4 text-primary" />{meals.length} refeições por dia</p>
            {macros.calories && <div className="mt-5 flex items-baseline gap-2 border-t border-border pt-5"><span className="font-display-h text-3xl text-primary">{macros.calories}</span><span className="text-xs text-muted-foreground">kcal / dia</span></div>}
            <div className="mt-4 grid grid-cols-3 gap-3">{macroFields.slice(1).map(m => <div key={m.key}><p className={`font-display-h text-lg ${m.color}`}>{macros[m.key] || "—"}<span className="ml-1 text-xs">g</span></p><p className="mt-1 text-[10px] text-muted-foreground">{m.label}</p></div>)}</div>
            {notes.trim() && <p className="mt-4 break-words border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{notes}</p>}
          </section>
          <section><h2 className="mb-4 flex items-center gap-2 font-display-h text-base"><Clock3 className="h-4 w-4 text-primary" />Inspiração para suas refeições</h2>
            <div role="tablist" aria-label="Exemplos de refeições" className="mb-4 flex flex-wrap gap-1 border-b border-border pb-3">{Object.keys(samples).map(t => <Button key={t} type="button" role="tab" aria-selected={tab === t} variant="ghost" size="sm" className={`px-2 text-[11px] ${tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} onClick={() => setTab(t)}>{t}</Button>)}</div>
            <div role="tabpanel" aria-label={tab} className="space-y-2">{samples[tab]?.map(s => <article key={s.name} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Utensils className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-medium">{s.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{s.portion} · ~{s.kcal} kcal</p></div><Button type="button" variant="ghost" size="icon" aria-label={`Adicionar ${s.name}`} title={`Adicionar ${s.name}`} onClick={() => { const meal = meals.find(m => m.name === tab) ?? meals[0]; if (meal) updateMeal(meal.id, { foods: [...meal.foods, s.name] }); else setMeals([{ id: Date.now(), name: tab, time: "07:00", foods: [s.name] }]); }}><Plus className="text-primary" /></Button></article>)}</div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Exemplos ilustrativos. Valores nutricionais aproximados.</p>
          </section>
        </aside>
      </div>
    </main>
    <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="health-area nutrition-page border-border bg-card text-foreground sm:max-w-lg"><DialogHeader><DialogTitle className="font-display-h">Editar refeição</DialogTitle><DialogDescription>Refeição e alimentos</DialogDescription></DialogHeader>{activeMeal && <div className="space-y-5"><div className="grid grid-cols-[1fr_110px] gap-3"><div><label className="mb-2 block text-xs text-muted-foreground" htmlFor="meal-name">Nome da refeição</label><input id="meal-name" className="nutrition-input" value={activeMeal.name} onChange={e => updateMeal(activeMeal.id, { name: e.target.value })} /></div><div><label className="mb-2 block text-xs text-muted-foreground" htmlFor="meal-time">Horário</label><input id="meal-time" type="time" className="nutrition-input" value={activeMeal.time} onChange={e => updateMeal(activeMeal.id, { time: e.target.value })} /></div></div><div className="flex gap-2"><label htmlFor="food-name" className="sr-only">Alimento</label><input id="food-name" className="nutrition-input" placeholder="Ex: Banana com aveia" value={food} onChange={e => setFood(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFood(); } }} /><Button aria-label="Adicionar alimento" size="icon" className="h-11 w-11 shrink-0" disabled={!food.trim()} onClick={addFood}><Plus /></Button></div><ul className="space-y-2">{activeMeal.foods.map((f, i) => <li key={i} className="flex items-center justify-between gap-2 border-b border-border py-2 text-sm"><span className="break-words">{f}</span><Button variant="ghost" size="icon" aria-label={`Remover ${f}`} onClick={() => updateMeal(activeMeal.id, { foods: activeMeal.foods.filter((_, index) => index !== i) })}><X /></Button></li>)}</ul><Button className="w-full" onClick={() => setEditing(null)}><Check />Concluir</Button></div>}</DialogContent></Dialog>
    <Dialog open={complete} onOpenChange={setComplete}><DialogContent className="health-area nutrition-page border-border bg-card text-foreground"><DialogHeader><DialogTitle className="font-display-h">Sua ficha está pronta para revisão</DialogTitle><DialogDescription>Esta é uma prévia visual. A ficha não foi salva.</DialogDescription></DialogHeader><p className="break-words font-display-h text-xl text-primary">{name.trim() || "Sua nova rotina"}</p><p className="text-sm text-muted-foreground">{goal} · {meals.length} refeições</p><Button onClick={() => setComplete(false)}><Pencil />Continuar editando</Button></DialogContent></Dialog>
  </div>;
}