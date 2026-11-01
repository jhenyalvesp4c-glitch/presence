// Mocked planning data — frontend only, no backend.
export type Disposicao = "alta" | "normal" | "baixa";
export type Tempo = "completo" | "manha" | "tarde" | "pouco";

export type PlanInput = { disposicao: Disposicao; tempo: Tempo; prioridade: string; pausas: boolean };

export type IconKey = "sun" | "laptop" | "food" | "layers" | "dumbbell" | "shower" | "book" | "moon" | "star" | "coffee" | "calendar" | "sprout";
export type Activity = {
  id: string; time: string; title: string; desc: string; tag: string; color: "cyan" | "violet" | "emerald" | "amber" | "rose";
  icon: IconKey; kind: "tarefa" | "compromisso" | "habito" | "treino" | "autocuidado" | "pausa" | "extra"; done?: boolean;
};

export const tempoLabels: Record<Tempo, string> = {
  completo: "Dia completo (flexível)", manha: "Só a manhã", tarde: "Tarde e noite", pouco: "Pouco tempo (até 3h)",
};

export const baseDay: Activity[] = [
  { id: "a1", time: "07:00", title: "Rotina da manhã", desc: "Higiene • Skincare • Café • Organização", tag: "Rotina", color: "emerald", icon: "sun", kind: "habito" },
  { id: "a2", time: "08:00", title: "Hábito: leitura 20 min", desc: "Livro atual: Hábitos Atômicos", tag: "Hábito", color: "emerald", icon: "sprout", kind: "habito" },
  { id: "a3", time: "09:00", title: "Trabalho e demandas", desc: "Responder demandas, alinhar pontos e priorizar tarefas.", tag: "Foco", color: "violet", icon: "laptop", kind: "tarefa" },
  { id: "a4", time: "11:00", title: "Reunião com cliente", desc: "Alinhamento semanal · Google Meet", tag: "Compromisso", color: "cyan", icon: "calendar", kind: "compromisso" },
  { id: "a5", time: "12:30", title: "Almoço e pausa", desc: "Alimentação, descanso e desconexão.", tag: "Pausa", color: "amber", icon: "food", kind: "pausa" },
  { id: "a6", time: "14:00", title: "Projetos da Presence", desc: "Avançar nas implementações e revisar pendências.", tag: "Projeto", color: "emerald", icon: "layers", kind: "tarefa" },
  { id: "a7", time: "16:00", title: "Pagar fatura do cartão", desc: "Vence hoje · já adiada 2 vezes", tag: "Financeiro", color: "rose", icon: "star", kind: "tarefa" },
  { id: "a8", time: "16:30", title: "Treino", desc: "Ficha: Glúteos e Posterior • ~60 min", tag: "Saúde", color: "violet", icon: "dumbbell", kind: "treino" },
  { id: "a9", time: "18:00", title: "Autocuidado", desc: "Banho, cabelo e cuidados pessoais.", tag: "Bem-estar", color: "rose", icon: "shower", kind: "autocuidado" },
  { id: "a10", time: "19:00", title: "Consulta com nutricionista", desc: "Online · levar registro alimentar", tag: "Compromisso", color: "cyan", icon: "calendar", kind: "compromisso" },
  { id: "a11", time: "20:00", title: "Tempo livre", desc: "Leitura, série ou hobby.", tag: "Equilíbrio", color: "emerald", icon: "book", kind: "habito" },
  { id: "a12", time: "22:00", title: "Rotina noturna", desc: "Planejar amanhã, skincare e descanso.", tag: "Rotina", color: "cyan", icon: "moon", kind: "habito" },
];

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h! * 60 + m!; };
export const sortByTime = (l: Activity[]) => [...l].sort((a, b) => toMin(a.time) - toMin(b.time));

export function buildPlan(input: PlanInput): Activity[] {
  let list = baseDay.map((a) => ({ ...a }));
  if (input.disposicao === "baixa") {
    list = list.map((a) => a.kind === "treino" ? { ...a, title: "Treino leve", desc: "Alongamento e mobilidade • ~30 min" } : a);
  }
  if (input.disposicao === "alta") {
    list.push({ id: "x-foco", time: "10:00", title: "Bloco de foco profundo", desc: "Aproveite a energia alta para a tarefa mais difícil.", tag: "Foco", color: "violet", icon: "layers", kind: "extra" });
  }
  const p = input.prioridade.trim();
  if (p) list.push({ id: "x-prio", time: "09:30", title: `Prioridade: ${p}`, desc: "Adicionada por você antes de gerar o plano.", tag: "Prioridade", color: "amber", icon: "star", kind: "extra" });
  if (input.pausas) {
    list.push(
      { id: "x-p1", time: "10:45", title: "Pausa para café", desc: "10 min longe das telas.", tag: "Pausa", color: "amber", icon: "coffee", kind: "pausa" },
      { id: "x-p2", time: "15:30", title: "Alongamento e água", desc: "Respire e se hidrate.", tag: "Pausa", color: "amber", icon: "coffee", kind: "pausa" },
    );
  }
  const range: Record<Tempo, [number, number]> = { completo: [0, 1440], manha: [0, 12 * 60 + 30], tarde: [12 * 60, 1440], pouco: [0, 1440] };
  const [lo, hi] = range[input.tempo];
  list = list.filter((a) => { const m = toMin(a.time); return (m >= lo && m <= hi) || a.kind === "compromisso" || a.id === "x-prio"; });
  if (input.tempo === "pouco") list = list.filter((a) => a.kind !== "habito" || a.id === "a1");
  return sortByTime(list);
}

export function parseInput(s: Record<string, unknown>): PlanInput {
  const d = s["disposicao"], t = s["tempo"];
  return {
    disposicao: d === "alta" || d === "baixa" ? d : "normal",
    tempo: t === "manha" || t === "tarde" || t === "pouco" ? t : "completo",
    prioridade: typeof s["prioridade"] === "string" ? s["prioridade"].slice(0, 120) : "",
    pausas: s["pausas"] !== false && s["pausas"] !== "false",
  };
}

export function todayLabel(d = new Date()) {
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
