/** Logins e senhas: ficam SÓ neste navegador (localStorage), nunca no banco, na IA ou no segundo cérebro. A ficha do cliente e a Documentação ("Logins dos Dossiês") leem e gravam o mesmo lugar. */
export const LOGINS_KEY = "presence.logins.v1";
export type StoredLogin = { id: string; title: string; desc: string; kind: string; color: string; updated: string; fav?: boolean; login?: { user: string; pass: string; owner: string; dossier?: string } };

export function readLoginDocs(): StoredLogin[] {
  try { const v = JSON.parse(localStorage.getItem(LOGINS_KEY) ?? "null"); return Array.isArray(v) ? (v as StoredLogin[]) : []; } catch { return []; }
}
export function writeLoginDocs(list: StoredLogin[]) {
  try { localStorage.setItem(LOGINS_KEY, JSON.stringify(list)); window.dispatchEvent(new Event("orion:logins")); } catch { /* sem armazenamento */ }
}
/** O login criado a partir de um acesso da ficha do cliente (id estável: dá para achar, atualizar e apagar junto). */
export const accessLoginId = (accessId: string) => `a-${accessId}`;

/** Cria (ou atualiza) o login na lista de Logins e senhas, ligado ao dossiê do cliente. */
export function saveAccessLogin(v: { accessId: string; label: string; user: string; pass: string; owner: string; dossier: string; note?: string }) {
  const id = accessLoginId(v.accessId);
  const doc: StoredLogin = { id, title: v.label.trim() || "Acesso", desc: v.note?.trim() ? v.note.trim() : `Acesso de ${v.dossier} (cadastrado na ficha do cliente).`, kind: "Login", color: "amber", updated: "agora", login: { user: v.user.trim(), pass: v.pass, owner: v.owner.trim(), dossier: v.dossier.trim() } };
  const all = readLoginDocs();
  writeLoginDocs(all.some((d) => d.id === id) ? all.map((d) => (d.id === id ? doc : d)) : [doc, ...all]);
}
export function removeAccessLogin(accessId: string) { writeLoginDocs(readLoginDocs().filter((d) => d.id !== accessLoginId(accessId))); }
export const passwordOfAccess = (accessId: string): string | null => readLoginDocs().find((d) => d.id === accessLoginId(accessId))?.login?.pass ?? null;

/** Logins de um dossiê (com a senha), do mais novo ao mais antigo na lista. */
export function loginsOfDossier(dossier: string): { id: string; title: string; user: string; owner: string; pass: string }[] {
  const key = dossier.trim().toLowerCase();
  return readLoginDocs().filter((d) => d.login && (d.login.dossier?.trim() || d.title || "").toLowerCase() === key).map((d) => ({ id: d.id, title: d.title, user: d.login!.user, owner: d.login!.owner, pass: d.login!.pass }));
}
