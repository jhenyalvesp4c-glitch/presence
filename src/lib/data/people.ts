/** Pessoas de cada cliente (nome + função): ficha do cliente e "Para quem?" nas tarefas. Só as linhas do dono. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { must, supabase } from "./db";
import { createTaskRow, ensureClientCategory, nextClientOrder } from "./tasks";

export type Person = { id: string; client_id: string; name: string; role: string };
const COLS = "id, client_id, name, role";
const KEY = ["client-people"] as const;

export const useAllPeople = () => useQuery({ queryKey: KEY, queryFn: async () => must(await supabase.from("client_people").select(COLS).order("created_at")) as Person[] });

export async function createPerson(clientId: string, name: string, role = ""): Promise<Person> {
  return must(await supabase.from("client_people").insert({ client_id: clientId, name: name.trim().slice(0, 120), role: role.trim().slice(0, 120) }).select(COLS).single()) as Person;
}

export function usePeopleActions() {
  const qc = useQueryClient(), done = () => { void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ["tasks"] }); };
  return {
    add: useMutation({ mutationFn: (p: { clientId: string; name: string; role: string }) => createPerson(p.clientId, p.name, p.role), onSuccess: done }),
    update: useMutation({ mutationFn: async (p: { id: string; name: string; role: string }) => { must(await supabase.from("client_people").update({ name: p.name.trim().slice(0, 120), role: p.role.trim().slice(0, 120) }).eq("id", p.id).select("id")); }, onSuccess: done }),
    remove: useMutation({ mutationFn: async (id: string) => { must(await supabase.from("client_people").delete().eq("id", id).select("id")); }, onSuccess: done }),
  };
}

/** Passos de um novo usuário, já ligados à pessoa e ao cliente (na ordem). */
export const newUserSteps = (name: string) => [`Criar usuário — ${name}`, `Enviar acessos — ${name}`, `Confirmar acesso — ${name}`];

export async function createNewUserTasks(clientId: string, person: Person): Promise<number> {
  const category_id = await ensureClientCategory().catch(() => null);
  const base = await nextClientOrder(clientId).catch(() => null);
  let i = 0;
  for (const title of newUserSteps(person.name)) await createTaskRow({ title, category_id, due_date: null, due_time: null }, { client_id: clientId, person_id: person.id, ...(base !== null ? { client_order: base + i++ } : {}) });
  return 3;
}
