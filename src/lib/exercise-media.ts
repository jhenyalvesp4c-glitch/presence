/** Vídeos curtos de execução dos exercícios (arquivos em public/exercicios). Para ligar um novo: ponha o .mp4 lá e acrescente a linha com o nome do exercício em minúsculas, sem acento e com hífens. */
import { slugOf } from "./program";

export const EXERCISE_MEDIA: Record<string, { src: string }> = {
  "coice-de-gluteo-na-polia": { src: "/exercicios/coice-de-gluteo-na-polia.mp4" },
  "abducao-de-quadril-na-polia": { src: "/exercicios/abducao-de-quadril-na-polia.mp4" },
  "supino-com-halteres-no-banco": { src: "/exercicios/supino-com-halteres-no-banco.mp4" },
  "remada-na-polia": { src: "/exercicios/remada-na-polia.mp4" },
  "remada-baixa-na-polia": { src: "/exercicios/remada-na-polia.mp4" }, // mesma remada sentada na polia
  "face-pull-na-polia": { src: "/exercicios/face-pull-na-polia.mp4" },
  "prancha-lateral": { src: "/exercicios/prancha-lateral.mp4" },
  "puxada-alta-na-polia": { src: "/exercicios/puxada-alta-na-polia.mp4" },
  "agachamento-goblet": { src: "/exercicios/agachamento-goblet.mp4" },
  "elevacao-pelvica-com-halter": { src: "/exercicios/elevacao-pelvica-com-halter.mp4" },
  "dead-bug": { src: "/exercicios/dead-bug.mp4" },
  "crunch-abdominal": { src: "/exercicios/crunch-abdominal.mp4" },
};
export const mediaFor = (ex: { id: string; nome: string }) => EXERCISE_MEDIA[ex.id] ?? EXERCISE_MEDIA[slugOf(ex.nome)] ?? null;
