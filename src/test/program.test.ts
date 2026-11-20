import { describe, expect, it } from "vitest";
import { RECOMP_12 } from "@/lib/program-recomp";
import { adherence, checkinDue, cleanProgram, e1rm, faseDaSemana, insights, loadSeries, personalRecords, sessionsOf, suggest, volumeByMuscle, weekOf, withLegacyKeys, type ProgExercise, type SetLog } from "@/lib/program";

const p = RECOMP_12();
const leg = p.dias[0]!.exercicios[0]!; // Leg press sentado, 3 × 10–12, máquina (+2,5 kg)
const log = (date: string, week: number, load: number | null, reps: number[], extra: Partial<SetLog> = {}): SetLog[] => reps.map((r, i) => ({ exerciseId: "x", exerciseName: "Leg press", date, week, set: i + 1, load, reps: r, rir: null, warmup: false, flags: [], ...extra }));
const ex = { ...leg, id: "x" } as ProgExercise;

describe("A ficha da recomposição", () => {
  it("tem os 7 dias, os exercícios e as regras certas", () => {
    expect(p.dias.map((d) => d.titulo)).toEqual(["Inferiores A", "Superiores A", "Cardio + abdômen", "Inferiores B", "Superiores B + glúteos", "Descanso ou caminhada", "Descanso"]);
    expect(p.dias.map((d) => d.exercicios.length)).toEqual([5, 6, 5, 5, 6, 0, 0]);
    expect(leg).toMatchObject({ nome: "Leg press sentado", series: 3, repsMin: 10, repsMax: 12, descansoS: 120, equip: "maquina", incrementoKg: 2.5, progressao: "dupla" });
    expect(p.fases).toHaveLength(12); expect(p.regras).toHaveLength(6); expect(p.metas).toHaveLength(7); expect(p.rirEscala.map((r) => r.rir)).toEqual([4, 3, 2, 1, 0]);
    expect(p.dias[2]!.exercicios.filter((e) => e.tipo === "cardio")).toHaveLength(2);
  });
  it("semanas contam do início e as fases vêm da tabela", () => {
    expect(weekOf("2026-11-23", "2026-11-22")).toBe(0); expect(weekOf("2026-11-23", "2026-11-23")).toBe(1); expect(weekOf("2026-11-23", "2026-11-29")).toBe(1); expect(weekOf("2026-11-23", "2026-11-30")).toBe(2);
    expect(faseDaSemana(p, 4)?.objetivo).toBe("Consolidar"); expect(faseDaSemana(p, 13)).toBeNull();
  });
  it("o mesmo exercício em dois dias divide o histórico (leg press na segunda e na quinta)", () => {
    const legs = p.dias.flatMap((d) => d.exercicios).filter((e) => e.nome === "Leg press sentado");
    expect(legs).toHaveLength(2); expect(legs[0]!.id).toBe(legs[1]!.id); expect(legs[0]!.id).toBe("leg-press-sentado");
    const ids = p.dias.flatMap((d) => d.exercicios.map((e) => e.id)); expect(new Set(ids).size).toBeLessThan(ids.length);
  });
  it("limpa ficha inválida sem quebrar", () => { expect(cleanProgram(null)).toBeNull(); expect(cleanProgram({ dias: [] })).toBeNull(); expect(cleanProgram({ dias: [{ dia: 9, exercicios: [] }] })).toBeNull(); });
});

describe("Progressão dupla (a regra da ficha)", () => {
  const sug = (...days: SetLog[][]) => suggest(ex, sessionsOf(days.flat(), "x"));
  it("sem histórico: achar a carga inicial", () => { expect(sug().acao).toBe("aferir"); expect(sug().motivo).toContain("10–12"); });
  it("primeiro treino 60 kg: 10, 10, 10 → manter", () => { const s = sug(log("2026-11-23", 1, 60, [10, 10, 10])); expect(s.acao).toBe("manter"); expect(s.cargaAlvo).toBe(60); });
  it("60 kg: 12, 11, 10 → manter e tentar mais repetições", () => { const s = sug(log("2026-11-23", 1, 60, [10, 10, 10]), log("2026-11-26", 1, 60, [12, 11, 10])); expect(s.acao).toBe("subir_reps"); });
  it("60 kg: 12, 12, 12 com 2 de reserva → aumentar para 62,5", () => {
    const s = sug(log("2026-11-23", 1, 60, [12, 12, 12], { rir: 2 })); expect(s.acao).toBe("aumentar"); expect(s.cargaAlvo).toBe(62.5); expect(s.titulo).toContain("62,5");
  });
  it("máximo em todas as séries, mas sem folga (RIR 1): manter", () => { expect(sug(log("2026-11-23", 1, 60, [12, 12, 12], { rir: 1 })).acao).toBe("manter"); });
  it("máximo sem informar o RIR: pede confirmar a reserva antes de subir", () => { const s = sug(log("2026-11-23", 1, 60, [12, 12, 12])); expect(s.acao).toBe("aumentar"); expect(s.motivo).toContain("2 repetições"); });
  it("depois de subir a carga, reconstrói as repetições", () => { const s = sug(log("2026-11-23", 1, 60, [12, 12, 12], { rir: 2 }), log("2026-11-26", 1, 62.5, [10, 10, 10])); expect(s.acao).toBe("manter"); expect(s.titulo).toContain("Reconstruir"); });
  it("abaixo do mínimo: reduzir; postura/impulso: reduzir; dor: interromper", () => {
    expect(sug(log("2026-11-23", 1, 60, [10, 9, 8])).acao).toBe("reduzir");
    expect(sug(log("2026-11-23", 1, 60, [12, 12, 12], { flags: ["impulso"] })).acao).toBe("reduzir");
    expect(sug(log("2026-11-23", 1, 60, [12, 12, 12], { flags: ["dor"] })).acao).toBe("interromper");
  });
  it("aquecimento não conta", () => { expect(sessionsOf([...log("2026-11-23", 1, 20, [10, 10], { warmup: true }), ...log("2026-11-23", 1, 60, [10, 10, 10])], "x")[0]!.sets).toHaveLength(3); });
  it("cardio e exercícios por tempo seguem a prescrição", () => { expect(suggest(p.dias[2]!.exercicios[0]!, []).acao).toBe("fixo"); });
});

describe("Análises", () => {
  const logs = [...log("2026-11-23", 1, 60, [10, 10, 10]), ...log("2026-11-26", 1, 60, [12, 12, 12], { rir: 2 }), ...log("2026-12-07", 3, 62.5, [11, 10, 10])];
  it("carga estimada de 1 repetição e recordes", () => { expect(e1rm(60, 10)).toBe(80); expect(e1rm(80, 1)).toBe(80); const pr = personalRecords(logs)[0]!; expect(pr).toMatchObject({ load: 62.5, reps: 11 }); });
  it("série de carga por treino", () => { expect(loadSeries(logs, "x").map((s) => s.load)).toEqual([60, 60, 62.5]); expect(loadSeries(logs, "x")[1]!.tonnage).toBe(2160); });
  it("volume por músculo por semana (um exercício pode somar em mais de um grupo)", () => {
    const v = volumeByMuscle(logs, () => "Quadríceps e glúteos"); expect(v.filter((x) => x.week === 1 && x.grupo === "Quadríceps")[0]!.series).toBe(6); expect(v.some((x) => x.grupo === "Glúteos")).toBe(true);
  });
  it("aderência: dias com treino na semana contra os planejados (5)", () => { const a = adherence(p, logs, 1); expect(a.feitos).toBe(2); expect(a.planejados).toBe(5); });
  it("insights: subiu de carga e estagnou", () => {
    expect(insights({ ...p, dias: [{ ...p.dias[0]!, exercicios: [ex] }] }, logs)[0]!.texto).toContain("60 kg → 62,5 kg");
    const parado = [...log("2026-11-23", 1, 60, [10, 10, 10]), ...log("2026-11-26", 1, 60, [10, 10, 10]), ...log("2026-11-30", 2, 60, [10, 10, 10])];
    expect(insights({ ...p, dias: [{ ...p.dias[0]!, exercicios: [ex] }] }, parado)[0]!.tom).toBe("atencao");
  });
  it("prazos: medidas a cada 2 semanas, fotos a cada 4", () => {
    expect(checkinDue("2026-11-23", "2026-11-23", [], [])).toMatchObject({ medidas: { due: true }, fotos: { due: true } });
    const c = checkinDue("2026-11-23", "2026-12-06", ["2026-11-23"], ["2026-11-23"]);
    expect(c.medidas).toEqual({ due: false, proxima: "2026-12-07" }); expect(c.fotos).toEqual({ due: false, proxima: "2026-12-21" });
    expect(checkinDue("2026-11-23", "2026-12-08", ["2026-11-23"], ["2026-11-23"]).medidas.due).toBe(true);
  });
  it("medidas: braço e coxa viram a média dos dois lados para a Análise já existente", () => { const v = withLegacyKeys({ braco_d: "30", braco_e: "29", coxa_d: "52" }); expect(v["braco"]).toBe("29,5"); expect(v["coxa"]).toBe("52"); });
});
