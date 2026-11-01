export type Disposicao = "alta" | "normal" | "baixa";
export type Tempo = "completo" | "manha" | "tarde" | "pouco";

export type IconKey = "sun" | "laptop" | "food" | "layers" | "dumbbell" | "shower" | "book" | "moon" | "star" | "coffee" | "calendar" | "sprout";

export const tempoLabels: Record<Tempo, string> = {
  completo: "Dia completo (flexível)", manha: "Só a manhã", tarde: "Tarde e noite", pouco: "Pouco tempo (até 3h)",
};

export function todayLabel(d = new Date()) {
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
