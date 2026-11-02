import { Button } from "@/components/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Dumbbell, Plus, X, Trash2, Check, CalendarDays, Library,
  ListPlus, Sparkles, GripVertical, Scan,
} from "lucide-react";
import { BodyMap } from "@/components/body-map";
import { HealthTabs } from "@/components/health-tabs";
import { useHealthPreview } from "@/components/health-preview-provider";
import { HealthLoading } from "@/components/health-loading";


export const Route = createFileRoute("/treino_/exercicios")({
  validateSearch: (search: Record<string, unknown>) => ({
    nome: typeof search["nome"] === "string" ? search["nome"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Montar treinos — Presence Saúde" },
      { name: "description", content: "Monte os treinos A, B, C da sua ficha: escolha exercícios de peito, costas, pernas e mais." },
      { property: "og:title", content: "Montar treinos — Presence Saúde" },
      { property: "og:description", content: "Adicione sessões A, B, C e escolha exercícios por grupo muscular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MontarTreinos,
});

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const LETRAS = "ABCDEFGHIJ".split("");

const grupos = [
  "Peito", "Costas", "Pernas", "Glúteos", "Ombros", "Bíceps", "Tríceps", "Abdômen", "Cardio",
] as const;

const biblioteca: Record<(typeof grupos)[number], string[]> = {
  "Peito": [
    "Supino Reto com Barra", "Supino Reto com Halteres", "Supino Inclinado com Barra",
    "Supino Inclinado com Halteres", "Supino Declinado", "Crucifixo com Halteres",
    "Crucifixo no Cabo", "Peck Deck", "Crossover na Polia", "Flexão de Braço",
  ],
  "Costas": [
    "Barra Fixa", "Puxada Frontal", "Remada Curvada", "Remada Baixa",
    "Remada Unilateral com Halter", "Levantamento Terra", "Pull-over na Polia", "Serrote",
  ],
  "Pernas": [
    "Agachamento Livre", "Agachamento no Smith", "Leg Press", "Leg Extension", "Leg Curl",
    "Cadeira Adutora", "Cadeira Abdutora", "Afundo", "Stiff", "Panturrilha em Pé",
  ],
  "Glúteos": [
    "Elevação Pélvica", "Hip Thrust com Barra", "Coice na Máquina", "Coice com Halteres",
    "Agachamento Búlgaro", "Abdução deitada com Faixa", "Passada Lateral com Faixa",
    "Elevação de Perna em 4 Apoios",
  ],
  "Ombros": [
    "Desenvolvimento com Halteres", "Desenvolvimento Militar", "Elevação Lateral",
    "Elevação Frontal", "Encolhimento de Ombros", "Crucifixo Inverso", "Press Arnold",
  ],
  "Bíceps": [
    "Rosca Direta", "Rosca Alternada", "Rosca Martelo", "Rosca Scott",
    "Rosca na Máquina", "Rosca Concentrada", "Rosca na Polia",
  ],
  "Tríceps": [
    "Tríceps na Polia", "Tríceps Francês", "Tríceps Testa", "Tríceps Coice",
    "Mergulho entre Bancos", "Tríceps na Máquina",
  ],
  "Abdômen": [
    "Abdominal Crunch", "Abdominal na Máquina", "Abdominal Remador", "Elevação de Pernas",
    "Prancha", "Prancha Lateral", "Abdominal Bicicleta",
  ],
  "Cardio": [
    "Esteira", "Bicicleta Ergométrica", "Elíptico", "Remo Ergômetro", "Pular Corda",
    "Escada", "Corrida Externa",
  ],
};

type Exercicio = { nome: string; grupo: string };
type Sessao = { id: number; nome: string; dias: string[]; exercicios: Exercicio[] };

function novaSessao(id: number, indice: number): Sessao {
  return { id, nome: `Treino ${LETRAS[indice] ?? indice + 1}`, dias: [], exercicios: [] };
}

/** Espera as fichas carregarem do banco antes de montar o formulário (que lê os valores iniciais uma única vez). */
function MontarTreinos() {
  const { ready } = useHealthPreview();
  return ready ? <MontarTreinosForm /> : <HealthLoading />;
}

function MontarTreinosForm() {
  const { workout, setWorkout } = useHealthPreview();
  const navigate = useNavigate();
  const { nome: searchName } = Route.useSearch();
  const nomeFicha = searchName ?? "";
  const [sessoes, setSessoes] = useState<Sessao[]>(() => workout?.sessoes ?? [novaSessao(1, 0)]);
  const [ativaId, setAtivaId] = useState<number>(1);
  const [grupo, setGrupo] = useState<(typeof grupos)[number]>("Peito");
  const [busca, setBusca] = useState("");
  const [salvo, setSalvo] = useState(false);

  const proximoId = useMemo(() => Math.max(0, ...sessoes.map((s) => s.id)) + 1, [sessoes]);
  const ativa = sessoes.find((s) => s.id === ativaId) ?? sessoes[0];
  const totalExercicios = sessoes.reduce((n, s) => n + s.exercicios.length, 0);

  const exerciciosFiltrados = useMemo(() => {
    const lista = biblioteca[grupo];
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((e) => e.toLowerCase().includes(q));
  }, [grupo, busca]);

  function adicionarSessao() {
    if (sessoes.length >= LETRAS.length) return;
    const s = novaSessao(proximoId, sessoes.length);
    setSessoes((prev) => [...prev, s]);
    setAtivaId(s.id);
  }

  function removerSessao(id: number) {
    const restantes = sessoes.filter((s) => s.id !== id);
    const finais = restantes.length ? restantes : [novaSessao(proximoId + 1, 0)];
    setSessoes(finais);
    const primeira = finais[0];
    if (primeira && (ativaId === id || !finais.some((s) => s.id === ativaId))) setAtivaId(primeira.id);
  }

  function renomearSessao(id: number, nome: string) {
    setSessoes((prev) => prev.map((s) => (s.id === id ? { ...s, nome } : s)));
  }

  function alternarDia(id: number, dia: string) {
    setSessoes((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, dias: s.dias.includes(dia) ? s.dias.filter((d) => d !== dia) : [...s.dias, dia] }
          : s,
      ),
    );
  }

  function adicionarExercicio(nome: string, g: string) {
    if (!ativa) return;
    setSessoes((prev) =>
      prev.map((s) =>
        s.id === ativa.id && !s.exercicios.some((e) => e.nome === nome)
          ? { ...s, exercicios: [...s.exercicios, { nome, grupo: g }] }
          : s,
      ),
    );
  }

  function removerExercicio(sessaoId: number, nomeEx: string) {
    setSessoes((prev) =>
      prev.map((s) =>
        s.id === sessaoId ? { ...s, exercicios: s.exercicios.filter((e) => e.nome !== nomeEx) } : s,
      ),
    );
  }

  function descartar() {
    setSessoes([novaSessao(proximoId + 1, 0)]);
    setAtivaId(proximoId + 1);
    setSalvo(false);
  }

  return (
    <div className="health-area relative min-h-screen overflow-hidden bg-background font-body text-foreground">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-8 md:px-10">
        <HealthTabs active="saude" />

        <header className="mb-10 flex items-center gap-5">
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
            <Dumbbell className="h-7 w-7 text-primary-foreground" />
            <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 [animation-duration:3s]" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-normal text-primary">Módulo · Performance</p>
            <h1 className="font-display-h text-4xl font-semibold tracking-normal md:text-5xl">
              Montar treinos<span className="text-primary">.</span>
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Adicione as sessões A, B, C… e escolha os exercícios de cada treino.
              {nomeFicha.trim() && (
                <span className="rounded-full border border-primary/50 bg-primary/10 px-3 py-0.5 font-mono text-[10px] uppercase tracking-normal text-primary">
                  {nomeFicha}
                </span>
              )}
            </p>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Sessões */}
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-normal text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                {sessoes.length} {sessoes.length === 1 ? "sessão" : "sessões"} · {totalExercicios} {totalExercicios === 1 ? "exercício" : "exercícios"}
              </div>
              <Button variant="unstyled" size="unstyled"
                onClick={adicionarSessao}
                disabled={sessoes.length >= LETRAS.length}
                className="group inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-all duration-300 hover:shadow-glow"
              >
                <Plus className="h-4 w-4 transition group-hover:rotate-90" />
                Nova sessão
              </Button>
            </div>

            {sessoes.map((s, i) => {
              const ativaAgora = s.id === ativa?.id;
              return (
                <article
                  key={s.id}
                  onMouseEnter={() => setAtivaId(s.id)}
                  className={`tone relative overflow-hidden rounded-3xl border bg-card/50 p-5 transition-all duration-500 md:p-6 ${
                    ativaAgora
                      ? "border-primary/60 shadow-glow"
                      : "border-border hover:border-primary/40"
                  }`}
                  data-tone={["violet", "emerald", "cyan"][i % 3]}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display-h text-sm font-semibold ${ativaAgora ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-card/60 text-muted-foreground"}`}>
                        {LETRAS[i] ?? i + 1}
                      </span>
                      <input
                        value={s.nome}
                        onChange={(e) => renomearSessao(s.id, e.target.value)}
                        onFocus={() => setAtivaId(s.id)}
                        className="w-full min-w-0 max-w-[220px] rounded-xl border border-transparent bg-transparent px-2 py-1.5 font-display-h text-lg font-medium outline-none transition focus:border-primary/50 focus:bg-card/60"
                        aria-label={`Nome da sessão ${LETRAS[i] ?? i + 1}`}
                      />
                    </div>
                    <Button variant="unstyled" size="unstyled"
                      onClick={() => removerSessao(s.id)}
                      aria-label={`Remover ${s.nome}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mb-5">
                    <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      Dias da semana · toque nos dias que esse treino acontece
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {DIAS.map((d) => {
                        const marcado = s.dias.includes(d);
                        return (
                          <Button variant="unstyled" size="unstyled"
                            key={d}
                            onClick={() => alternarDia(s.id, d)}
                            className={`rounded-xl border px-3.5 py-2 font-mono text-[11px] uppercase tracking-normal transition-all duration-300 ${
                              marcado
                                ? "border-primary/70 bg-primary/15 text-primary shadow-glow"
                                : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                          >
                            {d}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/40 p-3">
                    {s.exercicios.length === 0 ? (
                      <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Nenhum exercício ainda · escolha na biblioteca ao lado
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {s.exercicios.map((e, idx) => (
                          <li
                            key={e.nome}
                            className="group/ex flex items-center gap-3 rounded-xl border border-border bg-card/50 px-3 py-2.5 transition hover:border-primary/50"
                          >
                            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                            <span className="font-mono text-[10px] text-muted-foreground/70">{String(idx + 1).padStart(2, "0")}</span>
                            <span className="flex-1 truncate text-sm font-medium">{e.nome}</span>
                            <span className="hidden rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-normal text-primary sm:inline">
                              {e.grupo}
                            </span>
                            <Button variant="unstyled" size="unstyled"
                              onClick={() => removerExercicio(s.id, e.nome)}
                              aria-label={`Remover ${e.nome}`}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          {/* Biblioteca de exercícios */}
          <aside className="glass-h sticky top-6 rounded-3xl p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                <Library className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display-h text-base font-medium">Biblioteca de exercícios</h2>
                <p className="text-xs text-muted-foreground">
                  {ativa ? `Adicionando em ${ativa.nome || "sessão ativa"}` : "Selecione uma sessão"}
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-normal text-muted-foreground">
                  <Scan className="h-3.5 w-3.5 text-primary" />
                  Mapa muscular
                </p>
                <span className="rounded-full border border-primary/50 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-normal text-primary">
                  {grupo}
                </span>
              </div>
              <BodyMap grupo={grupo} />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {grupos.map((g) => (
                <Button variant="unstyled" size="unstyled"
                  key={g}
                  onClick={() => { setGrupo(g); setBusca(""); }}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300 ${
                    grupo === g
                      ? "border-primary/70 bg-primary/15 text-primary shadow-glow"
                      : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {g}
                </Button>
              ))}
            </div>

            <div className="relative mb-4">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={`Outro exercício de ${grupo.toLowerCase()}…`}
                className="w-full rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:shadow-glow"
              />
              {busca.trim() && (
                <Button variant="unstyled" size="unstyled"
                  onClick={() => { adicionarExercicio(busca.trim(), grupo); setBusca(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
                >
                  Adicionar
                </Button>
              )}
            </div>

            <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
              {exerciciosFiltrados.map((nome) => {
                const jaAdicionado = ativa?.exercicios.some((e) => e.nome === nome);
                return (
                  <li key={nome}>
                    <Button variant="unstyled" size="unstyled"
                      onClick={() => adicionarExercicio(nome, grupo)}
                      disabled={jaAdicionado}
                      className={`group/e flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-300 ${
                        jaAdicionado
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-card/40 text-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10"
                      }`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-sm bg-primary shadow-glow" />
                      <span className="flex-1">{nome}</span>
                      {jaAdicionado ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover/e:text-primary" />
                      )}
                    </Button>
                  </li>
                );
              })}
              {exerciciosFiltrados.length === 0 && (
                <li className="px-2 py-4 text-sm text-muted-foreground">Nenhum exercício encontrado · use o campo acima para adicionar o seu.</li>
              )}
            </ul>
          </aside>
        </div>
      </main>

      <div className="pointer-events-none sticky bottom-0 z-20 px-5 pb-6 md:px-10">
        <div className="glass-h pointer-events-auto mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            {salvo ? "Ficha pronta · prévia" : "alterações não salvas"}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="unstyled" size="unstyled"
              onClick={descartar}
              className="rounded-2xl border border-border bg-card/40 px-6 py-3 text-sm font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
            >
              Descartar
            </Button>
            <Button variant="unstyled" size="unstyled"
              onClick={() => { setWorkout({ nome: nomeFicha.trim() || workout?.nome || "Minha ficha de treino", sessoes }); setSalvo(true); navigate({ to: "/hoje" }); }}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow transition hover:brightness-110"
            >
              <span className="health-shine absolute inset-0" />
              {salvo ? <Check className="relative h-4 w-4" /> : <ListPlus className="relative h-4 w-4" />}
              <span className="relative">{salvo ? "Ficha salva" : "Salvar ficha"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
