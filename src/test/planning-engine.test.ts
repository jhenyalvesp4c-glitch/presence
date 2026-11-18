import { describe, expect, it } from "vitest";
import { toMin } from "@/lib/dates";
import { DEFAULT_SETTINGS, DEFAULT_SOURCES, planDay, sameThing, type EngineInput, type RoutineIn, type TaskIn } from "@/lib/planning/engine";

const D = "2026-11-17"; // terça (2)
const routine = (o: Partial<RoutineIn> & { time: string; title: string }): RoutineIn => ({ id: o.title, description: "", tag: "Rotina", color: "cyan", icon: "star", kind: "habito", durationMin: 30, weekdays: [0, 1, 2, 3, 4, 5, 6], active: true, ...o });
const task = (o: Partial<TaskIn> & { id: string; title: string }): TaskIn => ({ description: null, priority: "media", dueDate: D, dueTime: null, endTime: null, place: null, done: false, isCompromisso: false, color: null, categoryName: null, ...o });
const base = (o: Partial<EngineInput> = {}): EngineInput => ({ date: D, weekday: 2, settings: DEFAULT_SETTINGS, opts: { disposicao: "normal", tempo: "completo", prioridade: "", pausas: false }, routine: [], tasks: [], habits: [], workout: null, meals: [], finance: [], demands: [], ...o });
const overlap = (p: ReturnType<typeof planDay>) => { const b = p.blocks.map((x) => [toMin(x.time), toMin(x.time) + x.durationMin] as const).sort((a, c) => a[0] - c[0]); return b.some((x, i) => i > 0 && x[0] < b[i - 1]![1]); };
const titles = (p: ReturnType<typeof planDay>) => p.blocks.map((b) => b.title);

describe("planejamento: só entra o que está ligado e o que é real", () => {
  it("dia vazio gera plano vazio (nada inventado)", () => { const p = planDay(base()); expect(p.blocks).toHaveLength(0); expect(p.overload).toBe(false); });
  it("compromisso e tarefa com horário entram fixos, com duração pelo fim", () => {
    const p = planDay(base({ tasks: [task({ id: "c", title: "Reunião", isCompromisso: true, dueTime: "11:00:00", endTime: "12:00:00" }), task({ id: "t", title: "Ligar", dueTime: "15:00:00" })] }));
    expect(p.blocks.find((b) => b.title === "Reunião")).toMatchObject({ time: "11:00", durationMin: 60, kind: "compromisso", fixed: true });
    expect(p.blocks.find((b) => b.title === "Ligar")).toMatchObject({ time: "15:00", kind: "tarefa" });
  });
  it("desligar uma fonte tira o que vem dela", () => {
    const tasks = [task({ id: "c", title: "Reunião", isCompromisso: true, dueTime: "11:00:00" }), task({ id: "t", title: "Estudar" })];
    expect(titles(planDay(base({ tasks, settings: { ...DEFAULT_SETTINGS, sources: { ...DEFAULT_SOURCES, calendario: false } } })))).toEqual(["Estudar"]);
    expect(titles(planDay(base({ tasks, settings: { ...DEFAULT_SETTINGS, sources: { ...DEFAULT_SOURCES, tarefas: false } } })))).toEqual(["Reunião"]);
  });
  it("compromisso com local ganha o bloco 'Sair para…' antes dele", () => {
    const p = planDay(base({ tasks: [task({ id: "c", title: "Dentista", isCompromisso: true, dueTime: "14:00:00", place: "Centro" })], settings: { ...DEFAULT_SETTINGS, travelMin: 40 } }));
    expect(p.blocks.find((b) => b.title === "Sair para Dentista")).toMatchObject({ time: "13:20", durationMin: 40 });
  });
});

describe("planejamento: tarefas sem horário vão para as vagas livres", () => {
  it("encaixa sem conflito, por prioridade, depois dos compromissos", () => {
    const tasks = [task({ id: "a", title: "Baixa", priority: "baixa" }), task({ id: "b", title: "Alta", priority: "alta" }), task({ id: "c", title: "Reunião", isCompromisso: true, dueTime: "07:00:00", endTime: "09:00:00" })];
    const p = planDay(base({ tasks }));
    expect(overlap(p)).toBe(false);
    const alta = p.blocks.find((b) => b.title === "Alta")!, baixa = p.blocks.find((b) => b.title === "Baixa")!;
    expect(toMin(alta.time)).toBeGreaterThanOrEqual(9 * 60); expect(toMin(alta.time)).toBeLessThan(toMin(baixa.time));
  });
  it("tarefas atrasadas vêm primeiro e com etiqueta", () => {
    const p = planDay(base({ tasks: [task({ id: "n", title: "De hoje", priority: "alta" }), task({ id: "o", title: "Velha", priority: "baixa", dueDate: "2026-11-10" })] }));
    expect(toMin(p.blocks.find((b) => b.title === "Velha")!.time)).toBeLessThan(toMin(p.blocks.find((b) => b.title === "De hoje")!.time));
    expect(p.blocks.find((b) => b.title === "Velha")!.tag).toBe("Atrasada");
  });
  it("hoje, nada é colocado antes do horário de agora", () => {
    const p = planDay(base({ from: "14:07", tasks: [task({ id: "a", title: "X" })] }));
    expect(toMin(p.blocks[0]!.time)).toBeGreaterThanOrEqual(14 * 60 + 10);
  });
  it("dia cheio: o que não cabe vai para 'fora do dia', com aviso", () => {
    const many = Array.from({ length: 20 }, (_, i) => task({ id: `t${i}`, title: `Tarefa ${i}`, priority: "alta" }));
    const p = planDay(base({ tasks: many }));
    expect(p.blocks.length).toBeLessThanOrEqual(8); expect(p.unplaced.length).toBe(12); expect(p.warnings.join(" ")).toContain("de fora");
  });
  it("disposição baixa encurta e limita; alta adiciona foco profundo", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task({ id: `t${i}`, title: `T${i}`, priority: "alta" }));
    expect(planDay(base({ tasks, opts: { disposicao: "baixa", tempo: "completo", prioridade: "", pausas: false } })).blocks.length).toBe(5);
    expect(titles(planDay(base({ tasks, opts: { disposicao: "alta", tempo: "completo", prioridade: "", pausas: false } }))).some((t) => t.startsWith("Foco profundo"))).toBe(true);
  });
  it("tempo 'pouco': no máximo 3 tarefas e 1 hábito; 'manhã' não passa de 12:30", () => {
    const tasks = Array.from({ length: 6 }, (_, i) => task({ id: `t${i}`, title: `T${i}` }));
    const habits = ["Leitura", "Água", "Yoga"].map((n, i) => ({ id: `h${i}`, name: n, icon: "star", color: "emerald" as const, doneToday: false }));
    const p = planDay(base({ tasks, habits, opts: { disposicao: "normal", tempo: "pouco", prioridade: "", pausas: false } }));
    expect(p.blocks.filter((b) => b.kind === "tarefa")).toHaveLength(3); expect(p.blocks.filter((b) => b.kind === "habito")).toHaveLength(1);
    const m = planDay(base({ tasks, opts: { disposicao: "normal", tempo: "manha", prioridade: "", pausas: false } }));
    expect(m.blocks.every((b) => toMin(b.time) + b.durationMin <= 12 * 60 + 30)).toBe(true);
  });
});

describe("planejamento: dados reais das outras áreas", () => {
  it("hábitos reais (só os não feitos hoje) viram blocos; hábito com o mesmo nome da rotina não duplica", () => {
    const habits = [{ id: "h1", name: "Leitura", icon: "book", color: "emerald" as const, doneToday: false }, { id: "h2", name: "Água", icon: "drop", color: "cyan" as const, doneToday: true }, { id: "h3", name: "Yoga", icon: "star", color: "violet" as const, doneToday: false }];
    const p = planDay(base({ habits, routine: [routine({ time: "08:00", title: "Leitura 20 min" })] }));
    expect(titles(p)).toContain("Leitura 20 min"); expect(titles(p)).not.toContain("Leitura"); expect(titles(p)).not.toContain("Água"); expect(titles(p)).toContain("Yoga");
  });
  it("treino: a ficha real do dia substitui o treino fixo da rotina; em dia de descanso ele some", () => {
    const r = [routine({ time: "16:30", title: "Treino", kind: "treino" })];
    const real = planDay(base({ routine: r, workout: { title: "Glúteo e Posterior", durationMin: 60 } }));
    expect(real.blocks.find((b) => b.kind === "treino")).toMatchObject({ title: "Glúteo e Posterior", time: "16:30", durationMin: 60, source: "saude" });
    expect(planDay(base({ routine: r, workout: "descanso" })).blocks.some((b) => b.kind === "treino")).toBe(false);
    expect(planDay(base({ routine: r, workout: null })).blocks.find((b) => b.kind === "treino")?.title).toBe("Treino"); // sem informação: mantém
    expect(planDay(base({ routine: r, workout: "descanso", settings: { ...DEFAULT_SETTINGS, sources: { ...DEFAULT_SOURCES, saude: false } } })).blocks.some((b) => b.kind === "treino")).toBe(true);
  });
  it("treino real sem treino na rotina entra no horário padrão da tarde", () => {
    const p = planDay(base({ workout: { title: "Costas", durationMin: 50 } }));
    expect(p.blocks.find((b) => b.kind === "treino")).toMatchObject({ time: "17:30", durationMin: 50 });
  });
  it("refeições da dieta entram nos horários; financeiro entra cedo; demandas com prazo hoje entram", () => {
    const p = planDay(base({ meals: [{ name: "Almoço", time: "12:30" }], finance: [{ id: "f1", title: "Pagar fatura Nubank", detail: "Vence hoje · R$ 1.113,56" }], demands: [{ code: "D-12", title: "Enviar relatório", priority: "alta" }] }));
    expect(p.blocks.find((b) => b.title === "Almoço")).toMatchObject({ time: "12:30", kind: "pausa" });
    expect(toMin(p.blocks.find((b) => b.title === "Pagar fatura Nubank")!.time)).toBeLessThanOrEqual(10 * 60);
    expect(p.blocks.find((b) => b.title === "Enviar relatório")?.source).toBe("demandas");
  });
  it("rotina: só nos dias da semana escolhidos e só se ativa", () => {
    const r = [routine({ time: "07:00", title: "Só segunda", weekdays: [1] }), routine({ time: "08:00", title: "Desligada", active: false }), routine({ time: "09:00", title: "Todo dia" })];
    expect(titles(planDay(base({ routine: r })))).toEqual(["Todo dia"]);
    expect(titles(planDay(base({ routine: r, weekday: 1 })))).toEqual(["Só segunda", "Todo dia"]);
  });
  it("fonte 'minha rotina' desligada ignora a rotina", () => {
    expect(planDay(base({ routine: [routine({ time: "07:00", title: "X" })], settings: { ...DEFAULT_SETTINGS, sources: { ...DEFAULT_SOURCES, rotina: false } } })).blocks).toHaveLength(0);
  });
});

describe("planejamento: peso do dia, prioridade e nomes", () => {
  it("avisa quando o dia passa de 9 horas de blocos", () => {
    const r = [routine({ time: "07:00", title: "Trabalho", durationMin: 600 })];
    expect(planDay(base({ routine: r })).overload).toBe(true);
  });
  it("a prioridade digitada vira bloco logo cedo", () => { const p = planDay(base({ opts: { disposicao: "normal", tempo: "completo", prioridade: "Fechar proposta", pausas: false } })); expect(toMin(p.blocks[0]!.time)).toBeLessThanOrEqual(9 * 60); expect(p.blocks[0]!.title).toBe("Prioridade: Fechar proposta"); });
  it("pausas só entram se pedidas e nunca em cima de outro bloco", () => {
    const withPausas = planDay(base({ opts: { disposicao: "normal", tempo: "completo", prioridade: "", pausas: true }, routine: [routine({ time: "10:30", title: "Bloco", durationMin: 60 })] }));
    expect(withPausas.blocks.filter((b) => b.kind === "pausa")).toHaveLength(2); expect(overlap(withPausas)).toBe(false);
  });
  it("nomes parecidos", () => { expect(sameThing("Leitura 20 min", "Leitura")).toBe(true); expect(sameThing("Treino", "Leitura")).toBe(false); });
});
