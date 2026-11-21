/** Armazenamento local do progresso (localStorage), com validação e backup. Nada sai do navegador. */
export const BACKUP_VERSION = 1
export const storageKey = (courseId: string) => (courseId === 'meta-academy' ? 'orion.cursos.meta-academy.v1' : `orion.cursos.${courseId}.v1`)

export type Store = {
  completed: string[]
  notes: string
  answers: Record<number, number>
  bestScore: number
  caseNotes: Record<number, string>
  /** Histórico das últimas provas (data ISO e nota em %). */
  attempts: { at: string; score: number }[]
}
export const empty: Store = { completed: [], notes: '', answers: {}, bestScore: 0, caseNotes: {}, attempts: [] }

type Rec = { data?: unknown; completed?: unknown; notes?: unknown; answers?: unknown; bestScore?: unknown; caseNotes?: unknown; attempts?: unknown; app?: unknown; version?: unknown; course?: unknown; at?: unknown; score?: unknown }
const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const numMap = (v: unknown): Record<number, number> => {
  const out: Record<number, number> = {}
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (Number.isInteger(Number(k)) && typeof x === 'number' && Number.isFinite(x)) out[Number(k)] = x
  return out
}
const strMap = (v: unknown): Record<number, string> => {
  const out: Record<number, string> = {}
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (Number.isInteger(Number(k)) && typeof x === 'string') out[Number(k)] = x
  return out
}

/** Aceita só dados no formato esperado; qualquer campo inválido volta ao valor vazio. `validLessons` descarta aulas que não existem mais. */
export function sanitize(raw: unknown, validLessons?: string[]): Store {
  const o = isObj(raw) ? (isObj(raw.data) ? raw.data : raw) : {}
  const completed = Array.isArray(o.completed) ? [...new Set(o.completed.filter((x): x is string => typeof x === 'string'))] : []
  const attempts = Array.isArray(o.attempts) ? o.attempts.flatMap((a) => (isObj(a) && typeof a.at === 'string' && typeof a.score === 'number' ? [{ at: a.at, score: Math.max(0, Math.min(100, Math.round(a.score))) }] : [])).slice(-30) : []
  return {
    completed: validLessons ? completed.filter((id) => validLessons.includes(id)) : completed,
    notes: typeof o.notes === 'string' ? o.notes : '',
    answers: numMap(o.answers),
    bestScore: typeof o.bestScore === 'number' && Number.isFinite(o.bestScore) ? Math.max(0, Math.min(100, Math.round(o.bestScore))) : 0,
    caseNotes: strMap(o.caseNotes),
    attempts,
  }
}

export function load(courseId: string, validLessons?: string[]): Store {
  try { return sanitize(JSON.parse(localStorage.getItem(storageKey(courseId)) || '{}'), validLessons) } catch { return { ...empty } }
}
/** Devolve false se o navegador recusou gravar (cota cheia, modo privado). */
export function save(courseId: string, s: Store): boolean {
  try { localStorage.setItem(storageKey(courseId), JSON.stringify(s)); return true } catch { return false }
}

export function backupJson(courseId: string, s: Store): string {
  return JSON.stringify({ app: 'orion-cursos', course: courseId, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: s }, null, 2)
}
/** Lê um arquivo de backup; lança erro com mensagem em português se o formato não for reconhecido. */
export function parseBackup(courseId: string, text: string, validLessons?: string[]): Store {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('O arquivo não é um JSON válido.') }
  if (!isObj(raw)) throw new Error('Formato de backup não reconhecido.')
  if (raw.app !== undefined && raw.app !== 'meta-academy' && raw.app !== 'orion-cursos') throw new Error('Este backup é de outro aplicativo.')
  if (typeof raw.course === 'string' && raw.course !== courseId) throw new Error('Este backup é de outro curso.')
  if (typeof raw.version === 'number' && raw.version > BACKUP_VERSION) throw new Error('Este backup é de uma versão mais nova do app.')
  if (!isObj(raw.data) && !('completed' in raw)) throw new Error('O arquivo não contém dados de progresso.')
  return sanitize(raw, validLessons)
}
