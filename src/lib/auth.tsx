import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { authClient, setClientOwner } from "@/lib/supabase";

export type Account = { owner: string; name: string; principal: boolean; email: string };
type Status = "loading" | "out" | "ready" | "blocked";
type Result = { ok: true; message?: string } | { ok: false; error: string };
type Auth = {
  status: Status; account: Account | null; blocked: string;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (name: string, email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
};
const Ctx = createContext<Auth | null>(null);
export const useAuth = (): Auth => { const v = useContext(Ctx); if (!v) throw new Error("useAuth fora do AuthProvider"); return v; };

/** Só para testes locais sem login. Nunca defina em produção. */
const DISABLED = (import.meta.env as Record<string, string | undefined>)["VITE_AUTH_DISABLED"] === "1";
const NAME_KEY = "presence.signup.name";

const explain = (m: string): string => {
  const t = m.toLowerCase();
  if (t.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (t.includes("already registered") || t.includes("already been registered")) return "Já existe uma conta com esse e-mail. Use “Entrar”.";
  if (t.includes("not confirmed")) return "Confirme seu e-mail pelo link que enviamos e depois entre.";
  if (t.includes("password") && (t.includes("6") || t.includes("short") || t.includes("weak"))) return "A senha precisa ter pelo menos 6 caracteres.";
  if (t.includes("valid email") || t.includes("invalid email")) return "Esse e-mail não parece válido.";
  if (t.includes("rate limit") || t.includes("too many")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (t.includes("network") || t.includes("fetch")) return "Sem conexão com o servidor. Confira a internet.";
  return m;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(DISABLED ? "ready" : "loading");
  const [account, setAccount] = useState<Account | null>(null);
  const [blocked, setBlocked] = useState("");

  const claim = useCallback(async (session: Session) => {
    let name: string | null = null;
    try { name = localStorage.getItem(NAME_KEY) || (session.user.user_metadata?.["name"] as string | undefined) || null; } catch { /* sem armazenamento */ }
    const { data, error } = await authClient.rpc("claim_account", { p_name: name });
    if (error || !data) {
      setBlocked(/limite/i.test(error?.message ?? "") ? "Este Presence já tem o número máximo de contas. Fale com quem administra." : (error?.message ?? "Não foi possível abrir sua conta."));
      setStatus("blocked");
      return;
    }
    const d = data as { owner_id: string; nome: string | null; principal: boolean };
    try { localStorage.removeItem(NAME_KEY); } catch { /* sem armazenamento */ }
    setClientOwner(d.owner_id);
    setAccount({ owner: d.owner_id, name: d.nome ?? "Você", principal: d.principal, email: session.user.email ?? "" });
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (DISABLED) return;
    let alive = true;
    const apply = (s: Session | null) => {
      if (!alive) return;
      if (!s) { setClientOwner(undefined); setAccount(null); setStatus("out"); return; }
      void claim(s);
    };
    authClient.auth.getSession().then(({ data }) => apply(data.session)).catch(() => apply(null));
    const { data: sub } = authClient.auth.onAuthStateChange((ev, s) => {
      // Renovação do token não precisa refazer a vinculação.
      if (ev === "TOKEN_REFRESHED") return;
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "INITIAL_SESSION") setTimeout(() => apply(s), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [claim]);

  const signIn = useCallback<Auth["signIn"]>(async (email, password) => {
    const { error } = await authClient.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { ok: false, error: explain(error.message) } : { ok: true };
  }, []);

  const signUp = useCallback<Auth["signUp"]>(async (name, email, password) => {
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* sem armazenamento */ }
    const { data, error } = await authClient.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
    if (error) return { ok: false, error: explain(error.message) };
    if (!data.session) return { ok: true, message: "Conta criada! Enviamos um e-mail de confirmação: abra o link e depois volte para entrar." };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    try { await authClient.auth.signOut(); } catch { /* sem rede */ }
    setClientOwner(undefined);
    if (typeof window !== "undefined") window.location.assign("/");
  }, []);

  const value = useMemo<Auth>(() => ({ status, account, blocked, signIn, signUp, signOut }), [status, account, blocked, signIn, signUp, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
