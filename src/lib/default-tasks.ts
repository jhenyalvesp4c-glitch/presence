/** Tarefas padrão de cada cliente: o modelo que nasce com o Orion (editável) e as regras puras de quando criar. */
export const SEED_DEFAULT_TASKS = [
  "Realizar a implantação das configurações",
  "Enviar os acessos ao gestor",
  "Criar usuários",
  "Perguntar quais são os gestores e vendedores",
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Quais títulos do modelo ainda faltam para o cliente (não repete os que ele já tem). */
export const missingTitles = (template: string[], existing: string[]): string[] => {
  const have = new Set(existing.map(norm));
  const seen = new Set<string>();
  return template.map((t) => t.trim()).filter((t) => { const k = norm(t); if (!k || have.has(k) || seen.has(k)) return false; seen.add(k); return true; });
};

/** Limpa o que a pessoa editou: tira vazios e repetidos, mantém a ordem. */
export const cleanTemplate = (titles: string[]): string[] => missingTitles(titles, []).map((t) => t.slice(0, 200));
