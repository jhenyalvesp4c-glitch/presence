import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/entrar")({
  head: () => ({ meta: [{ title: "Entrar · Presence" }] }),
  component: Entrar,
});

function Entrar() {
  const session = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate({ to: "/assistente" });
  }, [session, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (data.session && data.user) {
        await supabase.from("profiles").upsert({ id: data.user.id, display_name: name.trim() || null });
      } else {
        setInfo("Conta criada! Confirme pelo link que enviamos para o seu e-mail e depois entre.");
        setMode("entrar");
      }
    }
    setBusy(false);
  }

  const input = "w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none transition focus:border-cyan";

  return (
    <div className="grid min-h-screen place-items-center p-4 [background:radial-gradient(60%_50%_at_50%_30%,color-mix(in_oklab,var(--cyan)_7%,transparent),transparent_70%),oklch(0.11_0.025_265)]">
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 rounded-3xl p-7 animate-rise">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan shadow-[0_0_12px_var(--cyan)]" />
          <span className="font-display text-lg font-semibold tracking-[0.35em] text-cyan">PRESENCE</span>
        </div>
        <h1 className="font-serif text-3xl">{mode === "entrar" ? "Bem-vinda de volta" : "Criar conta"}</h1>

        {mode === "criar" && (
          <input className={input} placeholder="Como quer ser chamada?" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        )}
        <input className={input} type="email" placeholder="E-mail" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" placeholder="Senha" required minLength={6}
          autoComplete={mode === "entrar" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-emerald">{info}</p>}

        <button type="submit" disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          style={{ background: "linear-gradient(90deg, var(--cyan), oklch(0.66 0.19 265) 55%, var(--violet))" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {mode === "entrar" ? "Entrar" : "Criar conta"}
        </button>

        <button type="button" onClick={() => { setMode(mode === "entrar" ? "criar" : "entrar"); setError(null); }}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
          {mode === "entrar" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </form>
    </div>
  );
}
