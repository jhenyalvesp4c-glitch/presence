import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowDownRight, ArrowUpRight, CalendarDays, Camera, History, Ruler, Scale, ScanLine, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthTabs } from "@/components/health-tabs";
import { useHealthPreview } from "@/components/health-preview-provider";
import { HealthLoading } from "@/components/health-loading";
import { todayIso } from "@/lib/dates";
import { NovaFichaMedidas } from "@/components/health-measurement-builder";
import { measurementLabels, toNumber, formatDate } from "@/lib/health-preview";
import bodyAsset from "@/assets/hoje-corpo.jpg";

/** Shows the first-time sheet builder, or the check-in screen once a sheet exists. */
export function MedidasScreen(props: { embedded?: boolean; onCancel?: () => void } = {}) {
  const { measurements, ready } = useHealthPreview();
  if (!ready) return <HealthLoading />;
  return measurements ? <MeasurementCheckIn {...props} /> : <NovaFichaMedidas {...props} />;
}

function Delta({ now, before, unit }: { now: number | null; before: number | null; unit: string }) {
  if (now === null || before === null) return null;
  const d = now - before;
  if (Math.abs(d) < 0.05) return <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">= 0</span>;
  const Icon = d < 0 ? ArrowDownRight : ArrowUpRight;
  return <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary"><Icon className="h-3 w-3" />{d > 0 ? "+" : ""}{d.toFixed(1)}{unit}</span>;
}

export function MeasurementCheckIn({ embedded = false, onCancel }: { embedded?: boolean; onCancel?: () => void } = {}) {
  const { measurements: last, measurementHistory, setMeasurements } = useHealthPreview();
  const navigate = useNavigate();
  const [data, setData] = useState("");
  const [peso, setPeso] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [obs, setObs] = useState("");
  const [fotos, setFotos] = useState<Record<string, string>>({});
  useEffect(() => { setData(todayIso()); }, []);
  if (!last) return null;
  const filled = Object.values(valores).filter(v => v.trim()).length + (peso.trim() ? 1 : 0);
  const total = Object.keys(measurementLabels).length + 1;
  const save = () => {
    setMeasurements({ nome: last.nome, altura: last.altura, data, peso: peso || last.peso, valores: Object.fromEntries(Object.keys(measurementLabels).map(k => [k, valores[k]?.trim() || last.valores[k] || ""])), obs, fotos });
    if (onCancel) onCancel();
    navigate({ to: "/progresso" });
  };
  const onFoto = (slot: string, file?: File) => { if (file) setFotos(p => ({ ...p, [slot]: URL.createObjectURL(file) })); };

  return <div className={`health-area relative ${embedded ? "min-h-full" : "min-h-screen"} overflow-hidden bg-background font-body text-foreground`}>
    <div className="aurora pointer-events-none absolute inset-0" /><div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
    <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 md:px-10">
      {!embedded && <HealthTabs active="saude" />}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow"><Scale className="h-7 w-7 text-primary-foreground" /><span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 [animation-duration:3s]" /></div>
          <div><p className="font-mono text-[11px] uppercase text-primary">{last.nome || "Peso e medidas"} · Registro nº {measurementHistory.length + 1}</p><h1 className="font-display-h text-3xl font-semibold md:text-4xl">Nova medição<span className="text-primary">.</span></h1><p className="mt-1 text-sm text-muted-foreground">Último registro em {formatDate(last.data)} · compare em tempo real.</p></div>
        </div>
        <div className="flex gap-2"><Button asChild variant="outline" className="rounded-full bg-card/40"><Link to="/progresso"><TrendingUp />Ver progresso</Link></Button></div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <div className="glass-h relative overflow-hidden rounded-[2rem]">
            <img src={bodyAsset} alt="Corpo holográfico em análise" width={768} height={1024} className="aspect-[3/4] w-full object-contain" />
            <div className="pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/25 to-transparent motion-safe:animate-[health-scan_4s_ease-in-out_infinite]" />
            <div className="absolute left-5 top-5"><p className="font-mono text-[9px] uppercase text-primary">Scan em andamento</p><p className="font-display-h text-3xl">{peso || last.peso || "—"}<span className="ml-1 text-xs text-muted-foreground">kg</span></p><div className="mt-1"><Delta now={toNumber(peso)} before={toNumber(last.peso)} unit="kg" /></div></div>
            <ScanLine className="absolute right-5 top-5 h-5 w-5 text-primary motion-safe:animate-pulse" />
            <div className="absolute inset-x-5 bottom-5"><div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground"><span>Preenchido</span><span>{filled}/{total}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-gradient-primary shadow-glow transition-all duration-700" style={{ width: `${(filled / total) * 100}%` }} /></div></div>
          </div>
          <section className="glass-h rounded-[2rem] p-5"><h2 className="mb-4 flex items-center gap-2 font-display-h text-base"><History className="h-4 w-4 text-primary" />Histórico</h2>
            <ol className="relative ml-2 space-y-3 border-l border-primary/20">{[...measurementHistory].reverse().slice(0, 5).map((m, i) => <li key={m.data} className="relative pl-5"><span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-primary shadow-glow" : "bg-border"}`} /><p className="font-mono text-[10px] text-primary">{formatDate(m.data)}</p><p className="text-sm">{m.peso || "—"} kg</p></li>)}</ol>
          </section>
        </aside>

        <div className="space-y-6">
          <section className="glass-h rounded-[2rem] p-6 md:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block"><span className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground"><CalendarDays className="h-3 w-3" />Data da medição</span><input aria-label="Data da medição" type="date" value={data} onChange={e => setData(e.target.value)} className="w-full rounded-2xl border border-border bg-card/60 px-4 py-3.5 text-sm outline-none focus:border-primary/60 focus:shadow-glow" /></label>
              <label className="block"><span className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground"><span className="flex items-center gap-2"><Scale className="h-3 w-3" />Peso</span><span>antes {last.peso || "—"} kg</span></span><div className="relative"><input aria-label="Peso" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)} placeholder={last.peso || "0"} className="w-full rounded-2xl border border-border bg-card/60 px-4 py-3.5 pr-12 text-sm outline-none focus:border-primary/60 focus:shadow-glow" /><span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">kg</span></div></label>
            </div>
          </section>

          <section className="glass-h rounded-[2rem] p-6 md:p-8">
            <h2 className="mb-6 flex items-center gap-3 font-display-h text-lg"><span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10"><Ruler className="h-5 w-5 text-primary" /></span>Medidas corporais</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(measurementLabels).map(([key, label]) => { const v = valores[key] ?? ""; return <label key={key} className={`group block rounded-2xl border p-4 transition-all ${v ? "border-primary/40 bg-primary/5 shadow-glow" : "border-border bg-card/30 hover:border-primary/30"}`}>
                <div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">{label}</span><Delta now={toNumber(v)} before={toNumber(last.valores[key])} unit="" /></div>
                <div className="flex items-end gap-2"><input aria-label={label} inputMode="decimal" value={v} onChange={e => setValores(p => ({ ...p, [key]: e.target.value }))} placeholder={last.valores[key] || "0"} className="w-full bg-transparent font-display-h text-3xl outline-none placeholder:text-muted-foreground/30" /><span className="pb-1 font-mono text-xs text-muted-foreground">cm</span></div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">anterior · {last.valores[key] || "—"} cm</p>
              </label>; })}
            </div>
          </section>

          <section className="glass-h rounded-[2rem] p-6 md:p-8">
            <h2 className="mb-5 flex items-center gap-3 font-display-h text-lg"><span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10"><Camera className="h-5 w-5 text-primary" /></span>Fotos <span className="text-sm text-muted-foreground">(opcional)</span></h2>
            <div className="grid grid-cols-3 gap-3">{["Frente", "Lado", "Costas"].map(slot => <label key={slot} className="relative grid aspect-[3/4] cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-card/30 transition hover:border-primary/50">
              <input type="file" accept="image/*" className="sr-only" aria-label={`Foto ${slot}`} onChange={e => onFoto(slot, e.target.files?.[0])} />
              {fotos[slot] ? <img src={fotos[slot]} alt={slot} className="absolute inset-0 h-full w-full object-cover" /> : <div className="text-center"><Camera className="mx-auto mb-2 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{slot}</p></div>}
            </label>)}</div>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="Como você está se sentindo?" className="mt-5 w-full resize-none rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm outline-none focus:border-primary/60" />
          </section>

          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <Button variant="outline" className="h-auto rounded-2xl bg-card/60 px-8 py-4" onClick={() => onCancel ? onCancel() : navigate({ to: "/progresso" })}><X />Cancelar</Button>
            <Button variant="unstyled" size="unstyled" disabled={!data} onClick={save} className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-110 disabled:opacity-50"><span className="health-shine absolute inset-0" /><span className="relative">Salvar medição</span><ArrowRight className="relative h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </main>
  </div>;
}
