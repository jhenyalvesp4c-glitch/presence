import { ownerId, SINGLE_USER_ID } from "./supabase";
/**
 * Dossiês: unidades de trabalho dentro de um projeto (no P4C são os polos; em outro projeto podem ser
 * clientes, turmas etc.). Só front por enquanto: fica no localStorage, uma lista por projeto.
 */
export type Dossier = { id: string; name: string; desc: string };
export type DossierLabel = { singular: string; plural: string };
export type DossierState = { label: DossierLabel; dossiers: Dossier[]; v?: number };
/** Versão do formato salvo. Sem `v` (primeira versão), o nome volta ao padrão "Dossiês". */
const VERSION = 2;

/** Projeto padrão da página de Demandas (quando não vem `?projeto=`). */
export const P4C_ID = "p4c";
/** Projeto padrão de quem está logado: "p4c" para a conta principal (dados legados) e um id próprio para as demais. */
export const defaultProjectId = (): string => { const o = ownerId(); return o === SINGLE_USER_ID ? P4C_ID : `${P4C_ID}-${o.slice(0, 8)}`; };
export const DEFAULT_LABEL: DossierLabel = { singular: "Dossiê", plural: "Dossiês" };
export const LABEL_PRESETS: DossierLabel[] = [
  { singular: "Dossiê", plural: "Dossiês" },
  { singular: "Polo", plural: "Polos" },
  { singular: "Cliente", plural: "Clientes" },
  { singular: "Turma", plural: "Turmas" },
];

const P4C_NAMES = [
  "Alagoinhas", "Barra da Tijuca", "BH Centro", "Cachoeiro", "Caxias RJ", "Floresta", "Fortaleza", "Itanhaém",
  "Juiz de Fora", "Lauro", "Maceió", "Niterói", "Petrolina", "Santos", "São Vicente", "Volta Redonda",
];

export const seedDossiers = (projectId: string): DossierState =>
  projectId === P4C_ID
    ? { label: DEFAULT_LABEL, dossiers: P4C_NAMES.map((name, i) => ({ id: `d${i + 1}`, name, desc: "" })) }
    : { label: DEFAULT_LABEL, dossiers: [] };

const key = (projectId: string) => `presence.dossiers.${projectId}`;

export function loadDossierState(projectId: string): DossierState {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return seedDossiers(projectId);
    const s = JSON.parse(raw) as DossierState;
    if (!Array.isArray(s.dossiers) || !s.label?.plural) return seedDossiers(projectId);
    return s.v === VERSION ? s : { ...s, label: DEFAULT_LABEL };
  } catch {
    return seedDossiers(projectId);
  }
}

export function saveDossierState(projectId: string, state: DossierState) {
  try {
    localStorage.setItem(key(projectId), JSON.stringify({ ...state, v: VERSION }));
  } catch {
    /* sem armazenamento: segue só em memória */
  }
}

/** Concordância de gênero (heurística: nome no singular terminando em "a" é feminino): Um/Uma, Vários/Várias, Todos/Todas. */
export function gender(l: DossierLabel) {
  const fem = /a$/i.test(l.singular.trim());
  return { um: fem ? "Uma" : "Um", varios: fem ? "Várias" : "Vários", todos: fem ? "Todas" : "Todos" };
}

/** Cor estável de um dossiê pela posição na lista. */
export const dossierColor = (names: string[], name: string) => ["cyan", "pink", "violet", "amber", "emerald"][Math.max(0, names.indexOf(name)) % 5] ?? "cyan";
