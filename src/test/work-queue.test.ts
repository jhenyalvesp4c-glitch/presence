import { describe, expect, it } from "vitest";
import { bucketOf, chipCounts, isWorkTask, matchesChip, matchesPolo, matchesSearch, sortQueue, type QTask } from "@/lib/work-queue";

const HOJE = "2026-11-27";
const t = (id: string, o: Partial<QTask> = {}): QTask => ({ id, title: id, done: false, ...o });

describe("Fila de trabalho", () => {
  const work = new Set(["trab", "dem"]);
  it("é trabalho se tem polo ou está numa categoria de trabalho; rotina pessoal fica de fora", () => {
    expect(isWorkTask(t("a", { client_id: "c1" }), work)).toBe(true);
    expect(isWorkTask(t("b", { category_id: "trab" }), work)).toBe(true);
    expect(isWorkTask(t("c", { category_id: "rotina" }), work)).toBe(false);
    expect(isWorkTask(t("d"), work)).toBe(false);
  });
  it("separa atrasadas, hoje, próximas, sem data e feitas", () => {
    expect(bucketOf(t("a", { due_date: "2026-11-20" }), HOJE)).toBe("atrasadas");
    expect(bucketOf(t("b", { due_date: HOJE }), HOJE)).toBe("hoje");
    expect(bucketOf(t("c", { due_date: "2026-12-01" }), HOJE)).toBe("proximas");
    expect(bucketOf(t("d"), HOJE)).toBe("semdata");
    expect(bucketOf(t("e", { done: true, due_date: "2026-11-01" }), HOJE)).toBe("feitas");
  });
  it("ordena do mais urgente ao menos e conta cada filtro", () => {
    const list = [t("sem"), t("feita", { done: true }), t("prox", { due_date: "2026-12-05" }), t("hoje", { due_date: HOJE, due_time: "09:00" }), t("atras", { due_date: "2026-11-10" })];
    expect(sortQueue(list, HOJE).map((x) => x.id)).toEqual(["atras", "hoje", "prox", "sem", "feita"]);
    expect(chipCounts(list, HOJE)).toEqual({ pendentes: 4, atrasadas: 1, hoje: 1, semdata: 1, feitas: 1 });
    expect(list.filter((x) => matchesChip(x, "pendentes", HOJE)).length).toBe(4);
    expect(list.filter((x) => matchesChip(x, "feitas", HOJE)).map((x) => x.id)).toEqual(["feita"]);
  });
  it("filtra por polo (ou só geral) e busca sem acento", () => {
    const a = t("a", { client_id: "c1" }), b = t("b");
    expect(matchesPolo(a, "c1")).toBe(true); expect(matchesPolo(a, "geral")).toBe(false); expect(matchesPolo(b, "geral")).toBe(true); expect(matchesPolo(a, "todos")).toBe(true);
    expect(matchesSearch(t("Criar usuários"), "usuarios")).toBe(true); expect(matchesSearch(t("x"), "poa", "Poá")).toBe(true); expect(matchesSearch(t("x"), "zzz")).toBe(false);
  });
});
