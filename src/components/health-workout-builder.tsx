import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { TreinoBuilder, novaSessao } from "@/components/treino-builder";
import { useHealthPreview } from "@/components/health-preview-provider";
import type { WorkoutSession } from "@/lib/health-preview";
import { useState } from "react";
import {
  Dumbbell, Tag, Target, CalendarDays, FileText, ListPlus,
  PersonStanding, Bike, Waves, Footprints, Ellipsis, Flame, Heart, Zap,
  Sparkles, ClipboardList, Check, Pencil,
} from "lucide-react";
import treinoHeroAsset from "@/assets/treino-hero.jpg";
import { HealthTabs } from "@/components/health-tabs";

const treinoHero = treinoHeroAsset;


const tipos = [
  { icon: Dumbbell, label: "Musculação" },
  { icon: PersonStanding, label: "Corrida" },
  { icon: Bike, label: "Bike" },
  { icon: Waves, label: "Natação" },
  { icon: Footprints, label: "Caminhada" },
  { icon: Ellipsis, label: "Outro" },
];

const objetivos = [
  { icon: Dumbbell, label: "Hipertrofia" },
  { icon: Flame, label: "Emagrecimento" },
  { icon: Heart, label: "Resistência" },
  { icon: Zap, label: "Condicionamento" },
  { icon: Sparkles, label: "Saúde" },
];

const divisao = [
  { nome: "Agachamento no Smith", detalhe: "3 séries x 12 repetições" },
  { nome: "Leg Press", detalhe: "3 séries x 12 repetições" },
  { nome: "Cadeira Abdutora", detalhe: "3 séries x 15 repetições" },
  { nome: "Afundo", detalhe: "3 séries x 12 repetições" },
];

function SectionTitle({ icon: Icon, title, hint }: { icon: typeof Tag; title: string; hint: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="font-display-h text-base font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function NovaFichaTreino({ embedded = false, onCancel }: { embedded?: boolean; onCancel?: () => void } = {}) {
  const { workout, setWorkout } = useHealthPreview();
  const [nome, setNome] = useState(workout?.nome ?? "");
  const [tipo, setTipo] = useState("Musculação");
  const [objetivo, setObjetivo] = useState("Hipertrofia");
  const [freq, setFreq] = useState(3);
  const [obs, setObs] = useState("");
  const [sessoes, setSessoes] = useState<WorkoutSession[]>(() => workout?.sessoes ?? [novaSessao(1, 0)]);
  const navigate = useNavigate();
  const totalEx = sessoes.reduce((t, s) => t + s.exercicios.length, 0);

  return (
    <div className={`health-area relative ${embedded ? "min-h-full" : "min-h-screen"} overflow-hidden bg-background font-body text-foreground`}>
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-8 md:px-10">
        {!embedded && <HealthTabs active="saude" />}

        <header className="mb-10 flex items-start gap-4 [&>div:last-child]:min-w-0">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
            <Dumbbell className="h-7 w-7 text-primary-foreground" />
            <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 [animation-duration:3s]" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-normal text-primary">Módulo · Performance</p>
            <h1 className="font-display-h text-4xl font-semibold tracking-normal md:text-5xl">
              Nova ficha de treino<span className="text-primary">.</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie sua ficha de treino para organizar seus exercícios, séries e acompanhar sua evolução.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Formulário */}
          <section className="glass-h relative rounded-[2rem] p-6 md:p-10">
            <div className="mb-10">
              <SectionTitle icon={Tag} title="Nome da ficha" hint="Dê um nome para sua ficha de treino." />
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                aria-label="Nome da ficha" placeholder="Ex: Treino Academia - Hipertrofia Glúteos"
                className="w-full rounded-2xl border border-border bg-card/60 px-5 py-4 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:shadow-glow"
              />
            </div>

            <div className="mb-10">
              <SectionTitle icon={Dumbbell} title="Tipo de treino" hint="Escolha o tipo principal do seu treino." />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {tipos.map((t) => {
                  const active = tipo === t.label;
                  return (
                    <Button variant="unstyled" size="unstyled"
                      key={t.label}
                      onClick={() => setTipo(t.label)}
                      className={`group flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-xs transition-all duration-300 ${
                        active
                          ? "border-primary/70 bg-primary/15 text-primary shadow-glow"
                          : "border-border bg-card/40 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <t.icon className="h-5 w-5" />
                      {t.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="mb-10">
              <SectionTitle icon={Target} title="Objetivo do treino" hint="Qual é o seu principal objetivo?" />
              <div className="flex flex-wrap gap-3">
                {objetivos.map((o) => {
                  const active = objetivo === o.label;
                  return (
                    <Button variant="unstyled" size="unstyled"
                      key={o.label}
                      onClick={() => setObjetivo(o.label)}
                      className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-all duration-300 ${
                        active
                          ? "border-primary/70 bg-primary/15 text-primary shadow-glow"
                          : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <o.icon className="h-4 w-4" />
                      {o.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="mb-10">
              <SectionTitle icon={CalendarDays} title="Frequência semanal" hint="Quantas vezes por semana pretende treinar?" />
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Button variant="unstyled" size="unstyled"
                    key={n}
                    onClick={() => setFreq(n)}
                    className={`grid h-12 w-12 place-items-center rounded-2xl border font-display-h text-sm font-medium transition-all duration-300 ${
                      freq === n
                        ? "border-primary/70 bg-primary/15 text-primary shadow-glow"
                        : "border-border bg-card/40 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mb-10">
              <SectionTitle icon={FileText} title="Observações (opcional)" hint="Adicione informações importantes para sua ficha." />
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex: Foco em glúteos e posteriores. Priorize progressão de carga."
                rows={3}
                className="w-full resize-none rounded-2xl border border-border bg-card/60 px-5 py-4 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:shadow-glow"
              />
            </div>

            <div className="mb-10">
              <SectionTitle icon={ListPlus} title="Adicionar exercícios" hint="Monte o Treino A, B, C… escolhendo pelo mapa muscular." />
              <TreinoBuilder sessoes={sessoes} onChange={setSessoes} />
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to="/saude"
                onClick={e => { if (onCancel) { e.preventDefault(); onCancel(); } }}
                className="inline-flex items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-3.5 text-sm font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
              >
                Cancelar
              </Link>
              <Button variant="unstyled" size="unstyled"
                type="button"
                onClick={() => { setWorkout({ nome: nome.trim() || "Minha ficha de treino", sessoes }); navigate({ to: "/hoje" }); }}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:brightness-110"
              >
                <span className="health-shine absolute inset-0" />
                <Check className="relative h-4 w-4" />
                <span className="relative">Criar ficha de treino</span>
              </Button>
            </div>
          </section>

          {/* Coluna lateral */}
          <aside className="flex flex-col gap-6">
            <div className="tone group relative overflow-hidden rounded-3xl border border-border" data-tone="cyan">
              <img
                src={treinoHero}
                alt="Atleta com anéis holográficos"
                width={768}
                height={1024}
                className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
              <span className="glass-h absolute left-4 top-4 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-normal text-primary">
                01 · Performance
              </span>
            </div>

            <div className="glass-h relative rounded-3xl p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <h3 className="font-display-h text-base font-medium">Prévia da ficha</h3>
                </div>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mb-4 font-display-h text-lg font-medium">
                {nome.trim() ? nome : <span className="text-muted-foreground">Sem nome ainda</span>}
              </p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <Dumbbell className="h-4 w-4 text-primary" /> Tipo: <span className="text-foreground">{tipo}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Target className="h-4 w-4 text-primary" /> Objetivo: <span className="text-foreground">{objetivo}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 text-primary" /> Frequência: <span className="text-foreground">{freq} {freq === 1 ? "dia" : "dias"} por semana</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <ListPlus className="h-4 w-4 text-primary" /> Exercícios: <span className="text-foreground">{sessoes.length} {sessoes.length === 1 ? "treino" : "treinos"} · {totalEx} {totalEx === 1 ? "exercício" : "exercícios"}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-primary" /> Observações: <span className="text-foreground">{obs.trim() ? "adicionadas" : "nenhuma"}</span>
                </li>
              </ul>
            </div>

            <div className="glass-h relative rounded-3xl p-6">
              <div className="mb-2 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="font-display-h text-base font-medium">Exemplo de divisão (opcional)</h3>
              </div>
              <p className="mb-5 text-xs text-muted-foreground">Você poderá personalizar depois.</p>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-primary/60 bg-primary/15 px-3 py-1 font-mono text-[10px] uppercase tracking-normal text-primary">A - Glúteos</span>
                <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-normal text-muted-foreground">B - Pernas</span>
                <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-normal text-muted-foreground">C - Posteriores</span>
              </div>
              <ul className="space-y-3">
                {divisao.map((d) => (
                  <li key={d.nome} className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3 transition hover:border-primary/40">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                      <Dumbbell className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{d.nome}</p>
                      <p className="text-xs text-muted-foreground">{d.detalhe}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
