import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, Ruler, UserRound, CalendarDays, Camera, ImagePlus,
  Lightbulb, Info, PenLine, Scale, CheckCircle2, Plus, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import heroAsset from "@/assets/medidas-hero.jpg";
import { HealthTabs } from "@/components/health-tabs";
import { useHealthPreview } from "@/components/health-preview-provider";
import { HealthLoading } from "@/components/health-loading";

const hero = heroAsset;


const medidas = [
  { key: "braco", label: "Braço", dica: "Meça a parte mais larga do braço, relaxado." },
  { key: "peito", label: "Peito", dica: "Meça a parte mais larga do busto." },
  { key: "cintura", label: "Cintura", dica: "Meça a parte mais fina da cintura." },
  { key: "abdomen", label: "Abdômen", dica: "Meça na altura do umbigo." },
  { key: "quadril", label: "Quadril", dica: "Meça a parte mais larga do quadril." },
  { key: "gluteo", label: "Glúteo", dica: "Meça a parte mais larga do bumbum." },
  { key: "coxa", label: "Coxa", dica: "Meça a parte mais larga da coxa." },
] as const;

const fotos = ["Frente", "Lado", "Costas", "Outras fotos"] as const;

function Field({
  label, suffix, value, onChange, type = "text", placeholder, icon: Icon,
}: {
  label: string; suffix?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; icon?: typeof Ruler;
}) {
  return (
    <label className="group block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-normal text-muted-foreground transition group-focus-within:text-primary">
        {label}
      </span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />}
        <input
          aria-label={label}
          type={type}
          inputMode={type === "text" ? undefined : "decimal"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-2xl border border-border bg-card/60 py-3.5 text-sm outline-none backdrop-blur transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:shadow-glow ${Icon ? "pl-11" : "pl-4"} ${suffix ? "pr-12" : "pr-4"}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

type NovaFichaMedidasProps = { embedded?: boolean; onCancel?: () => void };
/** Espera as fichas carregarem do banco antes de montar o formulário (que lê os valores iniciais uma única vez). */
export function NovaFichaMedidas(props: NovaFichaMedidasProps) {
  const { ready } = useHealthPreview();
  return ready ? <NovaFichaMedidasForm {...props} /> : <HealthLoading />;
}

function NovaFichaMedidasForm({ embedded = false, onCancel }: { embedded?: boolean; onCancel?: () => void } = {}) {
  const { measurements, setMeasurements } = useHealthPreview();
  const navigate = useNavigate();
  const [nome, setNome] = useState(measurements?.nome ?? "");
  const [data, setData] = useState(measurements?.data ?? "");
  const [altura, setAltura] = useState(measurements?.altura ?? "");
  const [peso, setPeso] = useState(measurements?.peso ?? "");
  const [valores, setValores] = useState<Record<string, string>>(measurements?.valores ?? {});
  const [obs, setObs] = useState(measurements?.obs ?? "");
  const [fotosPrev, setFotosPrev] = useState<Record<string, string>>(measurements?.fotos ?? {});
  const [pronto, setPronto] = useState(false);

  const preenchidas = medidas.filter((m) => valores[m.key]?.trim()).length;

  const setMedida = (key: string, v: string) =>
    setValores((prev) => ({ ...prev, [key]: v }));

  const onFoto = (slot: string, file: File | undefined) => {
    if (!file) return;
    setFotosPrev((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]);
      return { ...prev, [slot]: URL.createObjectURL(file) };
    });
  };

  return (
    <div className={`health-area relative ${embedded ? "min-h-full" : "min-h-screen"} overflow-hidden bg-background font-body text-foreground`}>
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />

      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 md:px-10">
        {!embedded && <HealthTabs active="saude" />}

        <header className="mb-10 flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
              <Scale className="h-7 w-7 text-primary-foreground" />
              <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 [animation-duration:3s]" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-normal text-primary">Módulo · Evolução</p>
              <h1 className="font-display-h text-3xl font-semibold tracking-normal md:text-4xl">
                Nova ficha de medidas<span className="text-primary">.</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Acompanhe a evolução do seu corpo registrando medidas, peso e fotos.
              </p>
            </div>
          </div>
          <div className="glass-h flex items-center gap-3 rounded-full px-5 py-2.5 font-mono text-[11px] uppercase tracking-normal text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            {preenchidas}/{medidas.length} medidas
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Coluna principal */}
          <div className="space-y-6">
            <section className="glass-h rounded-[2rem] p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display-h text-lg font-medium">Informações básicas</h2>
                  <p className="text-xs text-muted-foreground">Preencha seus dados atuais.</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Nome da ficha" value={nome} onChange={setNome} placeholder="Meu progresso 2026" />
                <Field label="Data da medição" type="date" value={data} onChange={setData} icon={CalendarDays} />
                <Field label="Altura" suffix="m" value={altura} onChange={setAltura} placeholder="1,70" />
                <Field label="Peso atual" suffix="kg" value={peso} onChange={setPeso} placeholder="80,0" />
              </div>
            </section>

            <section className="glass-h rounded-[2rem] p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <Ruler className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display-h text-lg font-medium">Medidas corporais</h2>
                  <p className="text-xs text-muted-foreground">Tire as medidas conforme o guia ao lado.</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {medidas.map((m) => (
                  <Field
                    key={m.key}
                    label={m.label}
                    suffix="cm"
                    value={valores[m.key] ?? ""}
                    onChange={(v) => setMedida(m.key, v)}
                    placeholder="0"
                  />
                ))}
              </div>
            </section>

            <section className="glass-h rounded-[2rem] p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display-h text-lg font-medium">Fotos do seu progresso</h2>
                  <p className="text-xs text-muted-foreground">Adicione fotos para acompanhar sua evolução visual.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {fotos.map((slot) => {
                  const preview = fotosPrev[slot];
                  return (
                    <label
                      key={slot}
                      className="group relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-dashed border-border bg-card/40 transition-all hover:border-primary/60 hover:shadow-glow"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => onFoto(slot, e.target.files?.[0])}
                      />
                      {preview ? (
                        <>
                          <img src={preview} alt={slot} className="absolute inset-0 h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 font-mono text-[10px] uppercase tracking-normal text-primary backdrop-blur">
                            <CheckCircle2 className="h-3 w-3" /> {slot}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="grid h-12 w-12 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary transition group-hover:scale-110">
                            {slot === "Outras fotos" ? <ImagePlus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">{slot}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Adicionar foto</p>
                          </div>
                        </>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="glass-h rounded-[2rem] p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <PenLine className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display-h text-lg font-medium">Observações <span className="text-muted-foreground">(opcional)</span></h2>
                  <p className="text-xs text-muted-foreground">Registre informações importantes sobre sua medição.</p>
                </div>
              </div>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={4}
                placeholder="Ex: Como estou me sentindo, mudanças que percebi, observações sobre treino e alimentação..."
                className="w-full resize-none rounded-2xl border border-border bg-card/60 px-4 py-3.5 text-sm outline-none backdrop-blur transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:shadow-glow"
              />
            </section>

            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <Link
                to="/saude"
                onClick={e => { if (onCancel) { e.preventDefault(); onCancel(); } }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-8 py-4 text-sm font-medium text-muted-foreground backdrop-blur transition hover:border-foreground/30 hover:text-foreground"
              >
                <X className="h-4 w-4" /> Cancelar
              </Link>
              <Button variant="unstyled" size="unstyled"
                onClick={() => { setMeasurements({ nome, data, altura, peso, valores, obs, fotos: fotosPrev }); navigate({ to: "/hoje" }); }}
                className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-110"
              >
                <span className="health-shine absolute inset-0" />
                <span className="relative">Criar ficha de medidas</span>
                <ArrowRight className="relative h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Coluna lateral */}
          <aside className="space-y-6">
            <div className="group relative overflow-hidden rounded-[2rem] border border-border">
              <img
                src={hero}
                alt="Análise corporal futurista"
                width={1024}
                height={1280}
                className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="font-mono text-[10px] uppercase tracking-normal text-primary">Scan · Analyze · Optimize</p>
                <p className="mt-1 font-display-h text-lg font-medium">Seu corpo, em dados.</p>
              </div>
            </div>

            <section className="glass-h rounded-[2rem] p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <h2 className="font-display-h text-lg font-medium">Como tirar suas medidas?</h2>
              </div>
              <ul className="space-y-4">
                {medidas.map((m) => (
                  <li key={m.key} className="flex items-start gap-3">
                    <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10">
                      <Ruler className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{m.dica}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass-h rounded-[2rem] border-primary/20 p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <Info className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display-h text-base font-medium text-primary">Dica</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Para um acompanhamento mais preciso, faça sempre as medidas no mesmo horário e com pouca roupa.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <Dialog open={pronto} onOpenChange={setPronto}>
        <DialogContent className="glass-h rounded-[2rem] border-border sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
              <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center font-display-h text-2xl">
              Sua ficha está pronta<span className="text-primary">.</span>
            </DialogTitle>
            <DialogDescription className="text-center">
              {nome.trim() || "Sua ficha de medidas"} foi criada com {preenchidas} medida{preenchidas === 1 ? "" : "s"} registrada{preenchidas === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <Link
            to="/saude"
                onClick={e => { if (onCancel) { e.preventDefault(); onCancel(); } }}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-110"
          >
            Saúde <ArrowRight className="h-4 w-4" />
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
