import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plus, X, Check, Sparkles, Scan, Search, PencilLine, Trash2 } from "lucide-react";
import { BodyMap, type Sexo } from "@/components/body-map";
import type { WorkoutSession } from "@/lib/health-preview";


const LETRAS = "ABCDEFGHIJ".split("");

export const grupos = [
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


export function novaSessao(id: number, indice: number): WorkoutSession {
  return { id, nome: `Treino ${LETRAS[indice] ?? indice + 1}`, dias: [], exercicios: [] };
}

type Props = { sessoes: WorkoutSession[]; onChange: (s: WorkoutSession[]) => void };

export function TreinoBuilder({ sessoes, onChange }: Props) {
  const [ativaId, setAtivaId] = useState(sessoes[0]?.id ?? 1);
  const [grupo, setGrupo] = useState<(typeof grupos)[number]>("Peito");
  const [busca, setBusca] = useState("");
  const [sexo, setSexo] = useState<Sexo>("feminino");
  const [personalizado, setPersonalizado] = useState("");
  const ativa = sessoes.find((s) => s.id === ativaId) ?? sessoes[0];
  const q = busca.trim().toLowerCase();
  const lista = biblioteca[grupo].filter((e) => !q || e.toLowerCase().includes(q));

  const update = (fn: (s: WorkoutSession) => WorkoutSession) =>
    onChange(sessoes.map((s) => (s.id === ativa?.id ? fn(s) : s)));
  const alternar = (nome: string, g: string) =>
    update((s) => s.exercicios.some((e) => e.nome === nome)
      ? { ...s, exercicios: s.exercicios.filter((e) => e.nome !== nome) }
      : { ...s, exercicios: [...s.exercicios, { nome, grupo: g }] });
  const novoTreino = () => {
    if (sessoes.length >= LETRAS.length) return;
    const id = Math.max(0, ...sessoes.map((s) => s.id)) + 1;
    onChange([...sessoes, novaSessao(id, sessoes.length)]);
    setAtivaId(id);
  };
  const removerTreino = (id: number) => {
    const resto = sessoes.filter((s) => s.id !== id).map((s, i) => ({ ...s, nome: /^Treino [A-J]$/.test(s.nome) ? `Treino ${LETRAS[i]}` : s.nome }));
    const finais = resto.length ? resto : [novaSessao(id + 1, 0)];
    onChange(finais);
    setAtivaId(finais[0]?.id ?? 1);
  };
  const addPersonalizado = () => {
    const n = personalizado.trim();
    if (!n || ativa?.exercicios.some((e) => e.nome === n)) return;
    update((s) => ({ ...s, exercicios: [...s.exercicios, { nome: n, grupo }] }));
    setPersonalizado("");
  };

  return (
    <div className="rounded-3xl border border-primary/25 bg-card/30 p-4 md:p-5">
      {/* Abas de treinos */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {sessoes.map((s, i) => {
          const on = s.id === ativa?.id;
          return (
            <div key={s.id} className={`group/t flex items-center rounded-2xl border transition-all duration-300 ${on ? "border-primary/70 bg-primary/15 shadow-glow" : "border-border bg-card/40 hover:border-primary/40"}`}>
              <Button variant="unstyled" size="unstyled" type="button" onClick={() => setAtivaId(s.id)} className={`flex items-center gap-2 py-2 pl-3 pr-2 text-sm font-medium ${on ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-lg font-display-h text-xs ${on ? "bg-primary text-primary-foreground" : "bg-muted/60"}`}>{LETRAS[i]}</span>
                {s.nome}
                <span className="font-mono text-[10px] opacity-70">{s.exercicios.length}</span>
              </Button>
              {sessoes.length > 1 && (
                <Button variant="unstyled" size="unstyled" type="button" aria-label={`Remover ${s.nome}`} onClick={() => removerTreino(s.id)} className="mr-1.5 grid h-6 w-6 place-items-center rounded-lg text-muted-foreground opacity-60 transition hover:text-destructive hover:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
        {sessoes.length < LETRAS.length && (
          <Button variant="unstyled" size="unstyled" type="button" onClick={novoTreino} className="group inline-flex items-center gap-2 rounded-2xl border border-dashed border-primary/50 px-3.5 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 hover:shadow-glow">
            <Plus className="h-4 w-4 transition group-hover:rotate-90" /> Treino {LETRAS[sessoes.length]}
          </Button>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,240px)_1fr]">
        {/* Mapa do corpo */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-background/50 p-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 to-transparent" />
          <p className="relative mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-normal text-muted-foreground">
            <span className="flex items-center gap-1.5"><Scan className="h-3.5 w-3.5 text-primary" />Mapa muscular</span>
            <span key={grupo} className="muscle-pop text-primary">{grupo}</span>
          </p>
          <div className="relative mb-3 grid grid-cols-2 gap-1 rounded-full border border-border bg-background/60 p-1">
            {(["feminino", "masculino"] as const).map((s) => (
              <Button variant="unstyled" size="unstyled" key={s} type="button" onClick={() => setSexo(s)} aria-pressed={sexo === s}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${sexo === s ? "bg-primary/20 text-primary shadow-glow" : "text-muted-foreground hover:text-foreground"}`}>
                {s}
              </Button>
            ))}
          </div>
          <BodyMap grupo={grupo} sexo={sexo} />
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            {grupos.map((g) => (
              <Button variant="unstyled" size="unstyled" type="button" key={g} onClick={() => { setGrupo(g); setBusca(""); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300 ${grupo === g ? "border-primary/70 bg-primary/15 text-primary shadow-glow" : "border-border bg-card/40 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"}`}>
                {g}
              </Button>
            ))}
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar em ${grupo.toLowerCase()}…`}
              className="w-full rounded-2xl border border-border bg-card/60 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:shadow-glow" />
          </div>
          <ul key={grupo} className="muscle-pop grid max-h-[260px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {lista.map((nome) => {
              const sel = ativa?.exercicios.some((e) => e.nome === nome);
              return (
                <li key={nome}>
                  <Button variant="unstyled" size="unstyled" type="button" onClick={() => alternar(nome, grupo)} aria-pressed={sel}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-300 ${sel ? "border-primary/60 bg-primary/15 text-primary shadow-glow" : "border-border bg-card/40 hover:border-primary/50 hover:bg-primary/10"}`}>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${sel ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {sel ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
                    </span>
                    <span className="flex-1 leading-tight">{nome}</span>
                  </Button>
                </li>
              );
            })}
            {lista.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">Não achou? Crie o seu abaixo.</li>}
          </ul>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <PencilLine className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <input value={personalizado} onChange={(e) => setPersonalizado(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPersonalizado(); } }}
                placeholder={`Criar exercício personalizado de ${grupo.toLowerCase()}`}
                className="w-full rounded-2xl border border-dashed border-primary/40 bg-card/40 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/70 focus:shadow-glow" />
            </div>
            <Button variant="unstyled" size="unstyled" type="button" onClick={addPersonalizado} disabled={!personalizado.trim()}
              className="rounded-2xl bg-gradient-primary px-4 text-sm font-medium text-primary-foreground shadow-glow transition hover:brightness-110 disabled:opacity-40">
              Criar
            </Button>
          </div>
        </div>
      </div>

      {/* Exercícios do treino ativo */}
      <div className="mt-5 rounded-2xl border border-border bg-background/40 p-3">
        <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-normal text-muted-foreground">{ativa?.nome} · {ativa?.exercicios.length ?? 0} exercícios</p>
        {!ativa || ativa.exercicios.length === 0 ? (
          <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" />Escolha um grupo muscular e selecione os exercícios.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {ativa.exercicios.map((e, i) => (
              <li key={e.nome} className="muscle-pop flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-1.5 pl-3 pr-1.5 text-sm">
                <span className="font-mono text-[10px] text-primary">{String(i + 1).padStart(2, "0")}</span>
                {e.nome}
                <span className="font-mono text-[9px] uppercase text-muted-foreground">{e.grupo}</span>
                <Button variant="unstyled" size="unstyled" type="button" aria-label={`Remover ${e.nome}`} onClick={() => alternar(e.nome, e.grupo)} className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
