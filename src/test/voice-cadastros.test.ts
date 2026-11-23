import { describe, expect, it } from "vitest";
import { matchByName } from "@/lib/voice/match";
import { streakOf } from "@/lib/voice/habits-tool";
import { TOOLS, PAGES } from "@/lib/voice/agent";
import { fillerFor } from "@/lib/voice/filler";
import { weekdayOf } from "@/lib/voice/workout-tool";

describe("achar por nome aproximado", () => {
  const l = [{ n: "Novo Hamburgo" }, { n: "Porto Alegre" }, { n: "Porto Seguro" }];
  it("exato, começo e palavras", () => {
    expect(matchByName(l, "novo hamburgo", (x) => x.n).item?.n).toBe("Novo Hamburgo");
    expect(matchByName(l, "hamburgo", (x) => x.n).item?.n).toBe("Novo Hamburgo");
    expect(matchByName(l, "porto alegre", (x) => x.n).item?.n).toBe("Porto Alegre");
  });
  it("ambíguo devolve as opções e vazio não acha", () => {
    expect(matchByName(l, "porto", (x) => x.n).ambiguo?.length).toBe(2);
    expect(matchByName(l, "xyz", (x) => x.n)).toEqual({});
    expect(matchByName(l, "", (x) => x.n)).toEqual({});
  });
});

describe("sequência de hábito", () => {
  it("conta dias seguidos até hoje ou ontem", () => {
    expect(streakOf(new Set(["2026-11-23", "2026-11-22", "2026-11-21"]), "2026-11-23")).toBe(3);
    expect(streakOf(new Set(["2026-11-22", "2026-11-21"]), "2026-11-23")).toBe(2);
    expect(streakOf(new Set(["2026-11-20"]), "2026-11-23")).toBe(0);
  });
});

describe("autonomia da voz", () => {
  const names = TOOLS.map((t) => (t as { function: { name: string } }).function.name);
  it("tem as ferramentas novas", () => { for (const n of ["cadastros", "habitos", "gravar_reuniao", "treino", "dieta", "documentacao", "ler_documento", "documentar", "buscar_no_orion", "juntar_demandas", "verificar_whatsapp_demandas"]) expect(names, n).toContain(n); });
  it("abre central do dia, clientes, reuniões e cursos", () => { for (const k of ["central", "clientes", "reunioes", "cursos", "mapa", "configuracoes", "documentacao"]) expect(PAGES[k], k).toBeTruthy(); });
  it("avisa ao mexer em cadastros e hábitos", () => { expect(fillerFor(["cadastros"], "a")).not.toBe(""); expect(fillerFor(["habitos"], "a")).not.toBe(""); });
});

describe("treino: dia da semana", () => {
  it("entende os dias falados", () => {
    expect(weekdayOf("segunda")).toBe(1); expect(weekdayOf("Terça-feira")).toBe(2); expect(weekdayOf("sábado")).toBe(6); expect(weekdayOf("domingo")).toBe(0); expect(weekdayOf("quinta")).toBe(4);
    expect(weekdayOf("xis")).toBeNull();
  });
});
