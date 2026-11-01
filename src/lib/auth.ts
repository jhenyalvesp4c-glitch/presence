import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./supabase";

/** Sessão atual. `undefined` enquanto carrega (e sempre no SSR), `null` sem login. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}
