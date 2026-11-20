/** Avaliação semanal (como na ficha) e medidas/fotos (a cada 2 e 4 semanas). */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, Loader2, Ruler } from "lucide-react";

import { healthKeys, saveMeasurementDb, type MeasurementEntry } from "@/lib/data/health";
import { useProgramActions } from "@/lib/data/program";
import { BodyPanel } from "@/components/health-body";
import type { SpotKey } from "@/lib/body";
import { MEASURE_FIELDS, PHOTO_SLOTS, adherence, checkinDue, withLegacyKeys, type Program, type SetLog, type Weekly } from "@/lib/program";

const field = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition focus:border-cyan/60";
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const Scale5 = ({ value, onChange, labels, name }: { value: number | null; onChange: (n: number) => void; labels: string[]; name: string }) => (
  <div className="grid gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label={name}>{labels.map((l, i) => <button key={l} type="button" role="radio" aria-checked={value === i + 1} onClick={() => onChange(i + 1)} className={`rounded-xl border px-2 py-2 text-xs transition ${value === i + 1 ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-white/10 text-muted-foreground hover:text-foreground"}`} data-testid={`${name}-${i + 1}`}><b className="block text-sm">{i + 1}</b>{l}</button>)}</div>
);

export function WeeklyTab({ program, week, logs, weeklies, actions, lastWeight }: { program: Program; week: number; logs: SetLog[]; weeklies: Weekly[]; actions: ReturnType<typeof useProgramActions>; lastWeight: number | null }) {
  const [wk, setWk] = useState(Math.min(Math.max(week, 1), program.semanas)), cur = weeklies.find((w) => w.week === wk);
  const auto = adherence(program, logs, wk).feitos;
  const [weight, setWeight] = useState(""), [days, setDays] = useState<number | null>(null), [energy, setEnergy] = useState<number | null>(null), [recovery, setRecovery] = useState<number | null>(null), [notes, setNotes] = useState(""), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState("");
  // ao trocar de semana, carrega o que já foi respondido (ou prepara um formulário novo)
  if (loaded !== `${wk}:${cur?.date ?? ""}`) { setLoaded(`${wk}:${cur?.date ?? ""}`); setWeight(cur?.weight !== null && cur?.weight !== undefined ? String(cur.weight).replace(".", ",") : lastWeight !== null ? String(lastWeight).replace(".", ",") : ""); setDays(cur?.daysTrained ?? auto); setEnergy(cur?.energy ?? null); setRecovery(cur?.recovery ?? null); setNotes(cur?.notes ?? ""); }
  const w = Number(weight.replace(",", "."));
  const save = async () => {
    setBusy(true);
    try { await actions.saveWeekly.mutateAsync({ week: wk, date: new Date().toISOString().slice(0, 10), weight: weight.trim() && Number.isFinite(w) && w > 0 ? w : null, daysTrained: days, energy, recovery, notes }); toast.success(`Avaliação da semana ${wk} salva`); }
    catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <section className="glass rounded-3xl p-5 sm:p-6" data-testid="avaliacao-semanal">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">Avaliação semanal de treinamento</h2><p className="text-xs text-muted-foreground">Toda semana, para o Orion ajustar cargas, repetições e volume.</p></div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Semana<select value={wk} onChange={(e) => setWk(Number(e.target.value))} className={`${field} !w-20 !py-1.5`} data-testid="semana-select">{Array.from({ length: program.semanas }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}{weeklies.some((x) => x.week === n) ? " ✓" : ""}</option>)}</select></label></div>
        <div className="mt-4 grid gap-4">
          <label className="block text-xs text-muted-foreground">Peso atual (kg)<input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={`${field} mt-1 max-w-xs`} data-testid="semana-peso" /></label>
          <div><p className="mb-1.5 text-xs text-muted-foreground">Quantos dias conseguiu treinar? <span className="opacity-70">(o Orion contou {auto} pelo que você registrou)</span></p><div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Dias treinados">{[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <button key={n} type="button" role="radio" aria-checked={days === n} onClick={() => setDays(n)} className={`h-9 w-9 rounded-full border text-sm transition ${days === n ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-white/10 text-muted-foreground hover:text-foreground"}`} data-testid={`dias-${n}`}>{n}</button>)}</div></div>
          <div><p className="mb-1.5 text-xs text-muted-foreground">Como estava sua disposição durante os treinos?</p><Scale5 name="disposicao" value={energy} onChange={setEnergy} labels={["Muito baixa", "Baixa", "Moderada", "Boa", "Excelente"]} /></div>
          <div><p className="mb-1.5 text-xs text-muted-foreground">Como foi sua recuperação muscular?</p><Scale5 name="recuperacao" value={recovery} onChange={setRecovery} labels={["Muito ruim", "Ruim", "Regular", "Boa", "Excelente"]} /></div>
          <label className="block text-xs text-muted-foreground">Observações da semana<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} placeholder="Ex.: aumentei carga na extensora, senti cansaço, tive dificuldade no leg press…" className={`${field} mt-1 resize-y`} data-testid="semana-obs" /></label>
        </div>
        <button type="button" onClick={() => void save()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-5 py-2.5 text-sm font-medium text-cyan transition hover:bg-cyan/20 disabled:opacity-50" data-testid="semana-salvar">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {cur ? "Atualizar avaliação" : "Enviar avaliação semanal"}</button>
      </section>
      {weeklies.length > 0 && <section className="glass rounded-3xl p-5"><h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em]">Avaliações anteriores</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead><tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 font-medium">Semana</th><th className="pb-1 font-medium">Peso</th><th className="pb-1 font-medium">Dias</th><th className="pb-1 font-medium">Disposição</th><th className="pb-1 font-medium">Recuperação</th><th className="pb-1 font-medium">Observações</th></tr></thead>
          <tbody>{[...weeklies].reverse().map((x) => <tr key={x.week} className="border-t border-white/10 align-top"><td className="py-1.5">{x.week}</td><td className="py-1.5 tabular-nums">{x.weight ?? "—"}</td><td className="py-1.5">{x.daysTrained ?? "—"}</td><td className="py-1.5">{x.energy ?? "—"}</td><td className="py-1.5">{x.recovery ?? "—"}</td><td className="py-1.5 text-muted-foreground">{x.notes || "—"}</td></tr>)}</tbody></table></div></section>}
    </div>
  );
}

export function MeasuresTab({ program, startDate, measures, today }: { program: Program; startDate: string; measures: MeasurementEntry[]; today: string }) {
  const qc = useQueryClient();
  const inProgram = useMemo(() => measures.filter((m) => m.measuredOn >= startDate), [measures, startDate]);
  const due = checkinDue(startDate, today, inProgram.map((m) => m.measuredOn), inProgram.filter((m) => Object.keys(m.photoPaths).length).map((m) => m.measuredOn));
  const existing = measures.find((m) => m.measuredOn === today) ?? null;
  const [vals, setVals] = useState<Record<string, string>>(() => ({ ...(existing?.sheet.valores ?? {}) })), [peso, setPeso] = useState(existing?.sheet.peso ?? ""), [obs, setObs] = useState(existing?.sheet.obs ?? "");
  const [photos, setPhotos] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [focus, setFocus] = useState<SpotKey | null>(null);
  const week = Math.max(1, Math.floor((new Date(today).getTime() - new Date(startDate).getTime()) / (7 * 86_400_000)) + 1);
  const save = async () => {
    setBusy(true);
    try {
      await saveMeasurementDb({ nome: `Semana ${week} — ${program.nome}`.slice(0, 120), data: today, altura: program.perfil.alturaM ? String(program.perfil.alturaM).replace(".", ",") : "", peso, valores: withLegacyKeys(vals), obs, fotos: { ...(existing?.sheet.fotos ?? {}), ...photos } }, existing);
      await qc.invalidateQueries({ queryKey: healthKeys.measurement }); setPhotos({});
      toast.success("Medidas salvas", { description: "A Análise de saúde já usa esses números." });
    } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); }
    setBusy(false);
  };
  const first = inProgram[0], list = [...inProgram].reverse();
  const delta = (k: string, m: MeasurementEntry) => { const a = Number((first?.sheet.valores[k] ?? "").replace(",", ".")), b = Number((m.sheet.valores[k] ?? "").replace(",", ".")); return first && m !== first && a > 0 && b > 0 ? Math.round((b - a) * 10) / 10 : null; };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">{([["Peso e medidas", "a cada 2 semanas", due.medidas, Ruler], ["Fotos de frente, lado e costas", "a cada 4 semanas", due.fotos, Camera]] as const).map(([t, s, d, I]) => (
        <div key={t} className={`glass flex items-center gap-3 rounded-2xl p-4 ${d.due ? "border-amber/40" : ""}`} data-testid={d.due ? "prazo-vencido" : "prazo-ok"}><span className={`grid h-10 w-10 place-items-center rounded-xl ${d.due ? "bg-amber/20 text-amber" : "bg-emerald/15 text-emerald"}`}><I size={18} /></span><div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-muted-foreground">{s} · {d.due ? "está na hora de registrar" : `próxima em ${dm(d.proxima)}`}</p></div></div>))}</div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
      <section className="glass rounded-3xl p-5 sm:p-6" data-testid="medidas-form">
        <h2 className="font-display text-xl font-semibold">Registrar medidas · semana {week}</h2><p className="text-xs text-muted-foreground">Sempre nas mesmas condições (horário, sem roupa apertada). Uma medida isolada não diz nada: o que importa é a tendência.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-muted-foreground">Peso (kg)<input inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} className={`${field} mt-1`} data-testid="medida-peso" /></label>
          {MEASURE_FIELDS.map((f) => <label key={f.key} className="block text-xs text-muted-foreground">{f.label} (cm)<input inputMode="decimal" value={vals[f.key] ?? ""} onFocus={() => setFocus(f.key as SpotKey)} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} className={`${field} mt-1`} data-testid={`medida-${f.key}`} /></label>)}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{PHOTO_SLOTS.map((s) => { const src = photos[s] ?? existing?.sheet.fotos[s]; return (
          <label key={s} className="group relative grid h-36 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-black/20 text-xs text-muted-foreground transition hover:border-cyan/50">
            {src ? <img src={src} alt={`Foto ${s}`} className="absolute inset-0 h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1"><Camera size={18} />Foto de {s.toLowerCase()}</span>}
            <input type="file" accept="image/*" className="sr-only" data-testid={`foto-${s}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotos((p) => ({ ...p, [s]: URL.createObjectURL(f) })); }} />
          </label>); })}</div>
        <label className="mt-3 block text-xs text-muted-foreground">Observações<textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={`${field} mt-1 resize-y`} /></label>
        <button type="button" onClick={() => void save()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-5 py-2.5 text-sm font-medium text-cyan transition hover:bg-cyan/20 disabled:opacity-50" data-testid="medidas-salvar">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {existing ? "Atualizar registro de hoje" : "Salvar medidas"}</button>
      </section>
      <aside className="glass relative overflow-hidden rounded-3xl p-4 lg:sticky lg:top-24" data-testid="corpo-ao-vivo"><p className="mb-1 text-center text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Seu corpo ao vivo</p><BodyPanel history={measures.map((m) => m.sheet)} live={vals} focus={focus} onFocus={setFocus} compact /></aside>
      </div>
      {list.length > 0 && <section className="glass rounded-3xl p-5"><h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em]">Histórico (mudança desde o início)</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 pr-3 font-medium">Data</th><th className="pb-1 pr-3 font-medium">Peso</th>{MEASURE_FIELDS.map((f) => <th key={f.key} className="pb-1 pr-3 font-medium">{f.label.replace("direito", "D").replace("esquerdo", "E").replace("direita", "D").replace("esquerda", "E")}</th>)}</tr></thead>
          <tbody>{list.map((m) => <tr key={m.measuredOn} className="border-t border-white/10"><td className="py-1.5 pr-3">{dm(m.measuredOn)}</td><td className="py-1.5 pr-3 tabular-nums">{m.sheet.peso || "—"}</td>{MEASURE_FIELDS.map((f) => { const d = delta(f.key, m); return <td key={f.key} className="py-1.5 pr-3 tabular-nums">{m.sheet.valores[f.key] || "—"}{d !== null && d !== 0 && <span className={`ml-1 text-[0.65rem] ${d < 0 ? "text-emerald" : "text-amber"}`}>{d > 0 ? "+" : ""}{String(d).replace(".", ",")}</span>}</td>; })}</tr>)}</tbody></table></div>
        <div className="mt-4 flex flex-wrap gap-2">{list.filter((m) => Object.keys(m.sheet.fotos).length).slice(0, 4).map((m) => <div key={m.measuredOn} className="flex gap-1">{Object.entries(m.sheet.fotos).map(([s, u]) => <a key={s} href={u} target="_blank" rel="noreferrer" title={`${s} · ${dm(m.measuredOn)}`}><img src={u} alt={`${s} ${dm(m.measuredOn)}`} className="h-16 w-12 rounded-lg object-cover" /></a>)}</div>)}</div></section>}
    </div>
  );
}
