/** Semana e comparação: avaliação semanal (terminal), qual opção funciona melhor e a evolução das medidas. */
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Trophy } from "lucide-react";

import { AreaChart, Meter } from "@/components/finance/charts";
import type { DietBundle } from "@/components/diet/DietHub";
import { compareOptions, waterTrend, type DietWeekly } from "@/lib/diet-plan";

const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const num = (s: string) => { const n = Number(s.replace(",", ".")); return s.trim() && Number.isFinite(n) ? n : null; };
const fmt = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const field = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition focus:border-emerald/60";
const MEAS: { k: "weight" | "waist" | "abdomen" | "hip"; label: string; unit: string; color: string }[] = [{ k: "weight", label: "Peso", unit: "kg", color: "var(--cyan)" }, { k: "waist", label: "Cintura", unit: "cm", color: "var(--emerald)" }, { k: "abdomen", label: "Abdômen", unit: "cm", color: "var(--violet)" }, { k: "hip", label: "Quadril", unit: "cm", color: "var(--amber)" }];
const SC: { k: "energy" | "training" | "difficulty" | "digestive" | "satiety"; label: string }[] = [{ k: "energy", label: "Energia" }, { k: "training", label: "Desempenho no treino" }, { k: "difficulty", label: "Dificuldade do plano" }, { k: "digestive", label: "Desconforto digestivo" }, { k: "satiety", label: "Saciedade" }];

export function DietWeek({ b }: { b: DietBundle }) {
  const { plan, logs, weeklies, week, today } = b, cur = weeklies.find((w) => w.week === week) ?? null;
  const [f, setF] = useState<Record<string, string>>(() => ({ weight: fmt(cur?.weight ?? null), waist: fmt(cur?.waist ?? null), abdomen: fmt(cur?.abdomen ?? null), hip: fmt(cur?.hip ?? null), bowelCount: fmt(cur?.bowelCount ?? null), waterL: fmt(cur?.waterL ?? null) }));
  const [sc, setSc] = useState<Record<string, number | null>>({ energy: cur?.energy ?? null, training: cur?.training ?? null, difficulty: cur?.difficulty ?? null, digestive: cur?.digestive ?? null, satiety: cur?.satiety ?? null });
  const [notes, setNotes] = useState(cur?.notes ?? ""), [busy, setBusy] = useState(false);
  const stats = compareOptions(plan, logs), wt = waterTrend(logs, today), best = stats.filter((s) => s.dias >= 3).sort((a, b2) => (b2.adherence - a.adherence) || ((b2.protein ?? 0) - (a.protein ?? 0)))[0];
  const save = async () => {
    setBusy(true);
    const w: DietWeekly = { week, date: today, weight: num(f["weight"] ?? ""), waist: num(f["waist"] ?? ""), abdomen: num(f["abdomen"] ?? ""), hip: num(f["hip"] ?? ""), bowelCount: num(f["bowelCount"] ?? ""), waterL: num(f["waterL"] ?? ""), energy: sc["energy"] ?? null, training: sc["training"] ?? null, difficulty: sc["difficulty"] ?? null, digestive: sc["digestive"] ?? null, satiety: sc["satiety"] ?? null, notes };
    try { await b.actions.saveWeekly.mutateAsync(w); toast.success("Avaliação semanal salva"); } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); }
    setBusy(false);
  };
  return (
    <div className="space-y-5" data-testid="dieta-semana">
      <section className="ex-card px-5 py-5" data-testid="dieta-comparar"><h3 className="font-display text-lg font-semibold">Qual opção funciona melhor para você?</h3>
        <p className="mb-4 text-xs text-muted-foreground">{plan.comparar.nota || "Marque a opção do dia em Hoje e registre o que comeu; aqui aparecem as médias."}</p>
        <div className="grid gap-4 md:grid-cols-2">{stats.map((s, i) => { const c = i === 0 ? "var(--cyan)" : "var(--emerald)"; return (
          <article key={s.id} className="rounded-2xl border bg-black/20 p-4" style={{ borderColor: `color-mix(in oklab, ${c} 35%, transparent)` }}>
            <div className="flex items-center justify-between"><h4 className="font-display text-base font-semibold" style={{ color: c }}>{s.nome}</h4><span className="text-xs text-muted-foreground">{s.dias} {s.dias === 1 ? "dia" : "dias"}</span>{best?.id === s.id && <Trophy size={16} className="text-amber" />}</div>
            {s.dias ? <dl className="mt-3 space-y-2 text-xs"><div><div className="mb-0.5 flex justify-between"><dt className="text-muted-foreground">Refeições cumpridas</dt><dd className="font-mono">{s.adherence}%</dd></div><Meter pct={s.adherence} color={c} warn={false} height={5} /></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Calorias médias</dt><dd className="font-mono">{s.kcal ?? "—"} kcal</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Proteína média</dt><dd className="font-mono">{s.protein ?? "—"} g</dd></div></dl>
              : <p className="mt-3 text-xs text-muted-foreground">Ainda sem dias com esta opção.</p>}</article>); })}</div>
        {best && <p className="mt-4 rounded-xl border border-emerald/30 bg-emerald/10 px-3 py-2 text-sm text-emerald">Até agora, <b>{best.nome}</b> é a que você mais cumpre. Leve isso para o nutricionista.</p>}
        {wt.avg !== null && <p className="mt-3 text-xs text-muted-foreground">Água: média de {(wt.avg / 1000).toFixed(1).replace(".", ",")} L nos últimos 7 dias ({wt.days} {wt.days === 1 ? "dia registrado" : "dias registrados"}).</p>}</section>

      <section className="ex-card px-5 py-5" data-testid="dieta-semanal"><h3 className="font-display text-lg font-semibold">Avaliação da semana {week}</h3><p className="mb-4 text-xs text-muted-foreground">{plan.semanal.join(" · ")}</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{[...MEAS.map((m) => ({ k: m.k as string, label: `${m.label} (${m.unit})`, color: m.color })), { k: "bowelCount", label: "Evacuações", color: "var(--violet)" }, { k: "waterL", label: "Água (L/dia)", color: "var(--cyan)" }].map((m) => (
          <label key={m.k} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground transition focus-within:border-emerald/50">{m.label}<input inputMode="decimal" value={f[m.k] ?? ""} onChange={(e) => setF((x) => ({ ...x, [m.k]: e.target.value.replace(/[^\d.,]/g, "") }))} data-testid={`semanal-${m.k}`} className="mt-1 block w-full bg-transparent text-center font-display text-2xl font-semibold normal-case tabular-nums outline-none" style={{ color: f[m.k] ? m.color : undefined }} placeholder="—" /></label>))}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{SC.map((s) => <div key={s.k}><p className="mb-1 text-xs">{s.label}</p><div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => { const on = sc[s.k] === n; return <button key={n} type="button" aria-pressed={on} onClick={() => setSc((x) => ({ ...x, [s.k]: on ? null : n }))} data-testid={`semanal-${s.k}-${n}`} className={`h-9 flex-1 rounded-lg border text-sm font-semibold transition active:scale-90 ${on ? "border-emerald bg-emerald/20 text-emerald shadow-[0_0_14px_-4px_var(--emerald)]" : "border-white/10"}`}>{n}</button>; })}</div></div>)}</div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} placeholder="Observações da semana…" className={`${field} mt-4 resize-y`} data-testid="semanal-obs" />
        <button type="button" onClick={() => void save()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/10 px-5 py-2.5 text-sm font-medium text-emerald transition hover:bg-emerald/20 disabled:opacity-50" data-testid="semanal-salvar">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {cur ? "Atualizar avaliação" : "Enviar avaliação semanal"}</button></section>

      {weeklies.length > 0 && <section className="ex-card px-5 py-5"><h3 className="mb-3 mono-caps !text-[0.68rem]">Evolução</h3>
        <div className="grid gap-4 md:grid-cols-2">{MEAS.map((m) => { const pts = weeklies.filter((w) => w[m.k] !== null).map((w) => ({ label: `S${w.week}`, value: w[m.k] as number })); return pts.length >= 2 ? <div key={m.k}><p className="mb-1 text-xs text-muted-foreground">{m.label} ({m.unit})</p><AreaChart points={pts} format={(n) => `${String(n).replace(".", ",")} ${m.unit}`} height={150} color={m.color} /></div> : null; })}</div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 font-medium">Sem.</th><th className="pb-1 font-medium">Data</th><th className="pb-1 font-medium">Peso</th><th className="pb-1 font-medium">Cintura</th><th className="pb-1 font-medium">Abdômen</th><th className="pb-1 font-medium">Quadril</th><th className="pb-1 font-medium">Evac.</th></tr></thead>
          <tbody>{[...weeklies].reverse().map((w) => <tr key={w.week} className="border-t border-white/10"><td className="py-1.5">{w.week}</td><td className="py-1.5">{dm(w.date)}</td>{[w.weight, w.waist, w.abdomen, w.hip, w.bowelCount].map((v, i) => <td key={i} className="py-1.5 tabular-nums">{v ?? "—"}</td>)}</tr>)}</tbody></table></div></section>}
    </div>
  );
}
