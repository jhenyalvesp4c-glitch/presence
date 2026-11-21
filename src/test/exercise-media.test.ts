import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EXERCISE_MEDIA, mediaFor } from "../lib/exercise-media";
import { RECOMP_12 } from "../lib/program-recomp";

describe("vídeos de execução", () => {
  it("todo vídeo cadastrado existe em public e é achado pelo nome do exercício do programa", () => {
    for (const m of Object.values(EXERCISE_MEDIA)) expect(existsSync(join(process.cwd(), "public", m.src))).toBe(true);
    const exs = RECOMP_12().dias.flatMap((d) => d.exercicios);
    for (const nome of ["Coice de glúteo na polia", "Abdução de quadril na polia", "Supino com halteres no banco", "Remada na polia", "Remada baixa na polia", "Face pull na polia", "Prancha lateral", "Agachamento goblet", "Elevação pélvica com halter", "Dead bug", "Crunch abdominal"]) { const ex = exs.find((e) => e.nome === nome); expect(ex, nome).toBeTruthy(); expect(mediaFor(ex!), nome).not.toBeNull(); }
    expect(mediaFor({ id: "x", nome: "Peck deck" })).toBeNull();
  });
});
