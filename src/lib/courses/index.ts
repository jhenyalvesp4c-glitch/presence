/** Catálogo de cursos do Orion. Cada curso traz módulos/aulas com fontes oficiais e data de verificação; o progresso fica só no navegador. */
import { cases, flashcards, glossary, modules, quiz } from "./meta-academy-content";

export type { Lesson, Module, Source } from "./meta-academy-content";
export type Course = {
  id: string; title: string; tagline: string; tone: "cyan" | "violet" | "emerald" | "amber" | "pink"; audience: string;
  modules: typeof modules; glossary: typeof glossary; flashcards: typeof flashcards; quiz: typeof quiz; cases: typeof cases;
};

export const COURSES: Course[] = [
  { id: "meta-academy", title: "Meta Academy", tagline: "Ecossistema Meta, WhatsApp Business Platform, políticas e suporte técnico.", tone: "cyan", audience: "Suporte e implantação", modules, glossary, flashcards, quiz, cases },
];

export const lessonsOf = (c: Course) => c.modules.flatMap((m) => m.lessons);
export const minutesOf = (duration: string) => parseInt(duration, 10) || 0;
