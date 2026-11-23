import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { authClient, setClientOwner } from "@/lib/supabase";

export type Account = { owner: string; name: string; principal: boolean; email: string };
type Status = "loading" | "out" | "ready" | "blocked";
type Result = { ok: true; message?: string } | { ok: false; error: string };
type Auth = {
  status: Status; account: Account | null; blocked: string; recovering: boolean;
  /** `login` = nome de usuário (ou o e-mail das contas antigas). */
  signIn: (login: string, password: string) => Promise<Result>;
  signUp: (name: string, user: string, password: string) => Promise<Result>;
  setNewPassword: (password: string) => Promise<Result>;
  signOut: () => Promise<void>;
};
const Ctx = createContext<Auth | null>(null);
export const useAuth = (): Auth => { const v = useContext(Ctx); if (!v) throw new Error("useAuth fora do AuthProvider"); return v; };

/** Só para testes locais sem login. Nunca defina em produção. */
const DISABLED = (import.meta.env as Record<string, string | undefined>)["VITE_AUTH_DISABLED"] === "1";
const NAME_KEY = "presence.signup.name";

/** Contas novas são só usuário+senha: por baixo viram o e-mail interno "<usuario>@orion.local" (nada é enviado). */
const LOCAL_DOMAIN = "@orion.local";
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const loginToEmail = (login: string): string => { const t = login.trim().toLowerCase(); return t.includes("@") ? t : t + LOCAL_DOMAIN; };
/** O que mostrar para a pessoa: o usuário (sem o domínio interno) ou o e-mail de contas antigas. */
export const displayLogin = (email: string): string => email.endsWith(LOCAL_DOMAIN) ? email.slice(0, -LOCAL_DOMAIN.length) : email;

const explain = (m: string): string => {
  const t = m.toLowerCase();
  if (t.includes("invalid login")) return "Usuário ou senha incorretos.";
  if (t.includes("already registered") || t.includes("already been registered")) return "Já existe uma conta com esse e-mail. Use “Entrar”.";
  if (t.includes("password") && (t.includes("6") || t.includes("short") || t.includes("weak"))) return "A senha precisa ter pelo menos 6 caracteres.";
  if (t.includes("valid email") || t.includes("invalid email")) return "Esse usuário não parece válido.";
  if (t.includes("rate limit") || t.includes("too many")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (t.includes("network") || t.includes("fetch")) return "Sem conexão com o servidor. Confira a internet.";
  return m;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(DISABLED ? "ready" : "loading");
  const [account, setAccount] = useState<Account | null>(null);
  const [blocked, setBlocked] = useState("");
  const [recovering, setRecovering] = useState(false);
  const statusRef = useRef<Status>(status); statusRef.current = status;

  const claim = useCallback(async (session: Session) => {
    let name: string | null = null;
    try { name = localStorage.getItem(NAME_KEY) || (session.user.user_metadata?.["name"] as string | undefined) || null; } catch { /* sem armazenamento */ }
    const { data, error } = await authClient.rpc("claim_account", { p_name: name });
    if (error || !data) {
      setBlocked(/limite/i.test(error?.message ?? "") ? "Este Orion já tem o número máximo de contas. Fale com quem administra." : (error?.message ?? "Não foi possível abrir sua conta."));
      setStatus("blocked");
      return;
    }
    const d = data as { owner_id: string; nome: string | null; principal: boolean };
    try { localStorage.removeItem(NAME_KEY); } catch { /* sem armazenamento */ }
    setClientOwner(d.owner_id);
    setAccount({ owner: d.owner_id, name: d.nome ?? "Você", principal: d.principal, email: displayLogin(session.user.email ?? "") });
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (DISABLED) return;
    (window as unknown as { __orionOk?: boolean }).__orionOk = true; // o app carregou no navegador (desarma o aviso de "não carregou")
    // se abrir a conta travar (rede, bloqueio de armazenamento), não fica para sempre na tela de abertura
    const stuck = setTimeout(() => { if (statusRef.current === "loading") { setBlocked("Demorou demais para abrir a sua conta. Confira a internet e tente de novo."); setStatus("blocked"); } }, 15000);
    let alive = true;
    let claimedFor: string | null = null; // o login avisa 2-3 vezes ao abrir; abre a conta uma vez só (menos espera)
    const apply = (s: Session | null) => {
      if (!alive) return;
      if (!s) { claimedFor = null; setClientOwner(undefined); setAccount(null); setStatus("out"); return; }
      if (claimedFor === s.user.id) return;
      claimedFor = s.user.id;
      void claim(s).catch(() => { claimedFor = null; });
    };
    authClient.auth.getSession().then(({ data }) => apply(data.session)).catch(() => apply(null));
    const { data: sub } = authClient.auth.onAuthStateChange((ev, s) => {
      // Renovação do token não precisa refazer a vinculação.
      if (ev === "TOKEN_REFRESHED") return;
      if (ev === "PASSWORD_RECOVERY") setRecovering(true); // abriu o link de "esqueci a senha": pede a senha nova antes de entrar
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "INITIAL_SESSION") setTimeout(() => apply(s), 0);
    });
    return () => { alive = false; clearTimeout(stuck); sub.subscription.unsubscribe(); };
  }, [claim]);

  const signIn = useCallback<Auth["signIn"]>(async (login, password) => {
    const { error } = await authClient.auth.signInWithPassword({ email: loginToEmail(login), password });
    return error ? { ok: false, error: explain(error.message) } : { ok: true };
  }, []);

  const signUp = useCallback<Auth["signUp"]>(async (name, user, password) => {
    const u = user.trim().toLowerCase();
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* sem armazenamento */ }
    // cria o login direto no banco, já confirmado (sem e-mail); depois entra normalmente
    const { error } = await authClient.rpc("create_login", { p_user: u, p_password: password, p_name: name.trim() });
    if (error) return { ok: false, error: explain(error.message) };
    const r = await authClient.auth.signInWithPassword({ email: loginToEmail(u), password });
    return r.error ? { ok: false, error: explain(r.error.message) } : { ok: true };
  }, []);

  const setNewPassword = useCallback<Auth["setNewPassword"]>(async (password) => {
    if (password.length < 6) return { ok: false, error: "A senha precisa ter pelo menos 6 caracteres." };
    const { error } = await authClient.auth.updateUser({ password });
    if (error) return { ok: false, error: explain(error.message) };
    setRecovering(false);
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    try { await authClient.auth.signOut(); } catch { /* sem rede */ }
    setClientOwner(undefined);
    if (typeof window !== "undefined") window.location.assign("/");
  }, []);

  const value = useMemo<Auth>(() => ({ status, account, blocked, recovering, signIn, signUp, setNewPassword, signOut }), [status, account, blocked, recovering, signIn, signUp, setNewPassword, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
