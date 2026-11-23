import { useState, type FormEvent, type ReactNode } from "react";
import { AtSign, Eye, EyeOff, Loader2, LogOut, Lock, User } from "lucide-react";

import { USERNAME_RE, useAuth } from "@/lib/auth";

const FIELD = "w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-cyan/60 focus:bg-white/[0.07]";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 [background:radial-gradient(60%_50%_at_50%_20%,color-mix(in_oklab,var(--violet)_14%,transparent),transparent_70%),oklch(0.11_0.025_265)]">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[var(--violet)] opacity-25 blur-3xl" style={{ animation: "vp-aurora 14s ease-in-out infinite" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-[var(--cyan)] opacity-20 blur-3xl" style={{ animation: "vp-aurora 17s ease-in-out infinite reverse" }} />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-6 flex flex-col items-center gap-3 text-center">
      <span className="relative grid h-16 w-16 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, var(--cyan), var(--violet), var(--emerald), var(--cyan))", animation: "vp-spin 6s linear infinite", mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))", WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))" }} />
        <span aria-hidden className="absolute inset-2 rounded-full bg-[var(--cyan)] opacity-25 blur-md" />
        <span className="relative h-8 w-8 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, var(--cyan), color-mix(in oklab, var(--violet) 70%, black))", boxShadow: "0 0 24px -2px var(--cyan)" }} />
      </span>
      <span className="font-display text-xl font-semibold tracking-[0.35em] text-cyan">ORION</span>
    </div>
  );
}

function Login() {
  const auth = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState(""), [login, setLogin] = useState(""), [pw, setPw] = useState(""), [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [info, setInfo] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(""); setInfo("");
    if (mode === "up" && name.trim().length < 2) return void setError("Como podemos te chamar?");
    const l = login.trim().toLowerCase();
    if (!l) return void setError("Digite o seu usuário.");
    if (mode === "up" && !USERNAME_RE.test(l)) return void setError("Usuário: de 3 a 30 letras minúsculas, números, ponto, hífen ou _ (sem espaço).");
    if (pw.length < 6) return void setError("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    const r = mode === "in" ? await auth.signIn(l, pw) : await auth.signUp(name, l, pw);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else if (r.message) { setInfo(r.message); setMode("in"); setPw(""); }
  }

  return (
    <Shell>
      <Brand />
      <form noValidate onSubmit={(e) => void submit(e)} className="glass space-y-4 rounded-3xl p-6 sm:p-7" data-testid="login-form" style={{ animation: "vp-in .55s cubic-bezier(.2,.8,.2,1) both" }}>
        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1" role="tablist">
          {([["in", "Entrar"], ["up", "Criar conta"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setError(""); setInfo(""); }} data-testid={`login-aba-${k}`}
              className={`rounded-full py-2 text-sm font-medium transition ${mode === k ? "bg-gradient-brand text-primary-foreground shadow-[0_0_20px_-6px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>

        {mode === "up" && (
          <label className="relative block">
            <User size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className={FIELD} placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} data-testid="login-nome" />
          </label>
        )}
        <label className="relative block">
          <AtSign size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={FIELD} type="text" placeholder={mode === "up" ? "Escolha um usuário (ex.: jheny)" : "Usuário"} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={80} data-testid="login-usuario" />
        </label>
        <label className="relative block">
          <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={`${FIELD} pr-10`} type={show ? "text" : "password"} placeholder="Senha (mínimo 6 caracteres)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} data-testid="login-senha" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </label>

        {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="login-erro">{error}</p>}
        {info && <p className="rounded-xl border border-emerald/40 bg-emerald/10 px-3 py-2 text-xs text-emerald" data-testid="login-info">{info}</p>}

        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-brand py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60" data-testid="login-enviar">
          {busy && <Loader2 size={15} className="animate-spin" />} {mode === "in" ? "Entrar" : "Criar minha conta"}
        </button>
        <p className="text-center text-[0.72rem] text-muted-foreground">{mode === "in" ? "Contas antigas também entram com o e-mail no lugar do usuário." : "Sem e-mail e sem confirmação: a conta já fica pronta para usar."}</p>
      </form>
    </Shell>
  );
}

function NewPassword() {
  const { setNewPassword } = useAuth();
  const [pw, setPw] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(""); setBusy(true);
    const r = await setNewPassword(pw);
    setBusy(false);
    if (!r.ok) setError(r.error);
  }
  return (
    <Shell>
      <Brand />
      <form noValidate onSubmit={(e) => void submit(e)} className="glass space-y-4 rounded-3xl p-6 sm:p-7" data-testid="nova-senha-form">
        <p className="text-sm">Crie a sua senha nova para continuar.</p>
        <label className="relative block">
          <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={FIELD} type="password" placeholder="Senha nova (mínimo 6 caracteres)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" data-testid="nova-senha" />
        </label>
        {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-brand py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60" data-testid="nova-senha-salvar">{busy && <Loader2 size={15} className="animate-spin" />} Salvar senha nova</button>
      </form>
    </Shell>
  );
}

/** Mostra a tela de entrada até a pessoa estar logada; depois libera o app. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, blocked, recovering, signOut } = useAuth();
  if (recovering) return <NewPassword />;
  if (status === "ready") return <>{children}</>;
  if (status === "loading") return <Shell><Brand /><div className="grid place-items-center"><Loader2 className="animate-spin text-cyan" size={20} /></div></Shell>;
  if (status === "blocked") {
    return (
      <Shell>
        <Brand />
        <div className="glass space-y-4 rounded-3xl p-6 text-center" role="alert" data-testid="conta-bloqueada">
          <p className="text-sm">{blocked}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => window.location.reload()} data-testid="conta-tentar-de-novo" className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground">Tentar de novo</button>
            <button onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm hover:border-cyan/50 hover:text-cyan"><LogOut size={14} /> Sair</button>
          </div>
        </div>
      </Shell>
    );
  }
  return <Login />;
}
