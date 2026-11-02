export type Project = {
  id: string;
  name: string;
  desc: string;
  color: "cyan" | "violet" | "emerald" | "amber" | "rose";
  progress: number;
  demands: number;
  done: number;
  due: string;
  status: "Ativo" | "Planejando" | "Pausado";
};

const KEY = "presence.projects";

export const seedProjects: Project[] = [
  { id: "p1", name: "Lançamento Presence", desc: "App do assistente pessoal", color: "cyan", progress: 72, demands: 18, done: 13, due: "2026-12-15", status: "Ativo" },
  { id: "p2", name: "Marca pessoal", desc: "Conteúdo e redes sociais", color: "violet", progress: 45, demands: 11, done: 5, due: "2026-11-30", status: "Ativo" },
  { id: "p3", name: "Reforma do estúdio", desc: "Espaço de trabalho em casa", color: "emerald", progress: 20, demands: 9, done: 2, due: "2027-01-20", status: "Planejando" },
  { id: "p4", name: "Curso de UX", desc: "Estudos e certificação", color: "amber", progress: 88, demands: 8, done: 7, due: "2026-11-10", status: "Ativo" },
];

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project[]) : seedProjects;
  } catch {
    return seedProjects;
  }
}

export function saveProjects(list: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}
