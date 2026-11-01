import type { PostgrestError } from "@supabase/supabase-js";

export { supabase, SINGLE_USER_ID } from "../supabase";

/** Lança se a consulta falhou; devolve os dados já sem `null`. */
export function must<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
