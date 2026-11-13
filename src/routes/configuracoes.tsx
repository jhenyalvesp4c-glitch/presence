import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Bell, Check, Loader2, LogOut, MessageCircle, Pause, Play, Settings, ShieldCheck, Sparkles, Trash2, Unplug, Volume2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { openBriefing, useBriefingSafe } from "@/lib/use-briefing";
import { directEnabled, enableDirect, waGet, waPost, waPrefs, type WaStatus } from "@/lib/whatsapp/client";

export const Route = createFileRoute("/configuracoes")({ component: Configuracoes, head: () => ({ meta: [{ title: "Configurações · Presence" }] }) });

const card = "glass relative overflow-hidden rounded-3xl p-5 sm:p-6";
const btn = "flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm transition hover:border-cyan/50 hover:text-cyan disabled:opacity-50";

function Toggle({ on, onChange, label, hint, Icon }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string; Icon: typeof Bell }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left transition hover:border-white/20">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan/10 text-cyan"><Icon size={16} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-emerald/70" : "bg-white/15"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[1.35rem]" : "left-0.5"}`} /></span>
    </button>
  );
}

function WhatsApp() {
  const [st, setSt] = useState<WaStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const [why, setWhy] = useState("");
  const [direct, setDirect] = useState(true);
  useEffect(() => { setDirect(directEnabled()); }, []);
  const [busy, setBusy] = useState(false);
  const [alerts, setAlerts] = useState(true), [voice, setVoice] = useState(true);
  useEffect(() => { setAlerts(waPrefs.alerts()); setVoice(waPrefs.voice()); }, []);

  const load = useCallback(async () => {
    const r = await waGet<WaStatus>("status");
    if (r.ok) { setSt(r.data); setOffline(false); setWhy(""); } else { setSt(null); setOffline(true); setWhy(r.erro); }
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), st?.phase === "aguardando_qr" ? 2500 : 6000); return () => clearInterval(t); }, [load, st?.phase]);

  const act = async (r: string, params: Record<string, string> = {}, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true); await waPost(r, params); await load(); setBusy(false);
  };
  const connected = st?.phase === "conectado" || st?.phase === "pausado";

  return (
    <section className={card} data-testid="cfg-whatsapp">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald opacity-15 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald/15 text-emerald"><MessageCircle size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">WhatsApp</h2>
          <p className="text-xs text-muted-foreground">O Presence lê as suas conversas e grupos (só leitura), avisa quando marcarem você e conta o que foi dito.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${connected ? "bg-emerald/15 text-emerald" : st?.phase === "aguardando_qr" ? "bg-amber/15 text-amber" : "bg-white/10 text-muted-foreground"}`} data-testid="wa-estado">
          {offline ? "Ponte desligada" : st?.phase === "conectado" ? "Conectado" : st?.phase === "pausado" ? "Pausado" : st?.phase === "aguardando_qr" ? "Aguardando leitura do QR" : st?.phase === "conectando" ? "Conectando…" : st ? "Desconectado" : "Verificando…"}
        </span>
      </div>

      <div className="relative mt-5 space-y-4">
        {offline && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm" data-testid="wa-offline">
            <p className="font-medium">Para ligar:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Na pasta do Presence no seu computador, dê dois cliques em <b className="text-foreground">whatsapp.cmd</b> (precisa do Node 22.18 ou mais novo).</li>
              <li>Deixe aquela janela preta aberta enquanto usar o WhatsApp aqui.</li>
              <li>Volte a esta tela: o QR Code aparece sozinho.</li>
            </ol>
            {!direct ? (
              <div className="mt-3 rounded-xl border border-cyan/30 bg-cyan/5 p-3 text-xs">
                <p className="text-foreground/90">Já ligou a ponte? Este site precisa de permissão para falar com ela, que roda no seu computador. O navegador pode perguntar se deixa este site acessar dispositivos na rede local: clique em <b>Permitir</b>.</p>
                <button className={`${btn} mt-2`} data-testid="wa-procurar" onClick={() => { enableDirect(); setDirect(true); void load(); }}>Procurar a ponte neste computador</button>
              </div>
            ) : <p className="mt-3 text-xs text-muted-foreground">Se o navegador perguntar se este site pode acessar dispositivos na rede local, clique em <b>Permitir</b>.</p>}
            {why && <p className="mt-2 break-words rounded-xl border border-white/10 px-3 py-2 text-xs text-muted-foreground" data-testid="wa-motivo">Detalhe técnico: {why}</p>}
          </div>
        )}

        {st && !connected && st.phase !== "aguardando_qr" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm" data-testid="wa-aguardando">
            <p className="flex items-center gap-2 font-medium"><Loader2 size={15} className="animate-spin text-cyan" /> A ponte está ligada e tentando conectar ao WhatsApp…</p>
            <p className="mt-1 text-xs text-muted-foreground">O QR Code costuma aparecer em até 20 segundos. Se passar disso, olhe a janela preta do whatsapp.cmd: ela mostra o que está acontecendo.</p>
            {st.erro && <p className="mt-2 break-words rounded-xl border border-amber/30 bg-amber/5 px-3 py-2 text-xs text-amber" data-testid="wa-erro">{st.erro}</p>}
          </div>
        )}

        {st?.phase === "aguardando_qr" && (
          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[auto_1fr]" data-testid="wa-qr">
            {st.qr ? <img src={st.qr} alt="QR Code para conectar o WhatsApp" className="h-56 w-56 rounded-2xl bg-white p-2" /> : <div className="grid h-56 w-56 place-items-center"><Loader2 className="animate-spin text-cyan" /></div>}
            <div className="text-sm">
              <p className="font-medium">Leia com o seu celular:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground"><li>Abra o WhatsApp no celular.</li><li>Toque em <b className="text-foreground">Configurações → Aparelhos conectados</b>.</li><li>Toque em <b className="text-foreground">Conectar um aparelho</b> e aponte para o QR.</li></ol>
              <p className="mt-3 text-xs text-muted-foreground">O código muda a cada poucos segundos. Se não funcionar, aguarde ele atualizar.</p>
            </div>
          </div>
        )}

        {connected && st && (
          <div className="space-y-3" data-testid="wa-conectado">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
              <p className="flex items-center gap-2 font-medium"><Check size={15} className="text-emerald" /> Conectado{st.phone ? ` como +${st.phone}` : ""}{st.name ? ` (${st.name})` : ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">{st.chats} conversas e {st.messages} mensagens guardadas neste computador.</p>
            </div>
            <Toggle on={alerts} onChange={(v) => { setAlerts(v); waPrefs.setAlerts(v); }} Icon={Bell} label="Avisar quando me marcarem" hint="Mostra um aviso e notificação quando alguém me marcar ou responder a uma mensagem minha em um grupo." />
            <Toggle on={voice} onChange={(v) => { setVoice(v); waPrefs.setVoice(v); }} Icon={Volume2} label="Ler o aviso em voz alta" hint="O Presence fala quem marcou e o que foi dito." />
            <div className="flex flex-wrap gap-2 pt-1">
              <button className={btn} disabled={busy} onClick={() => void act("pause", { on: st.phase === "pausado" ? "0" : "1" })}>{st.phase === "pausado" ? <><Play size={14} /> Retomar leitura</> : <><Pause size={14} /> Pausar leitura</>}</button>
              <button className={btn} disabled={busy} onClick={() => void act("clear", {}, "Apagar todas as mensagens guardadas neste computador? O seu WhatsApp não muda.")}><Trash2 size={14} /> Apagar histórico local</button>
              <button className={`${btn} hover:!border-destructive/50 hover:!text-destructive`} disabled={busy} onClick={() => void act("logout", {}, "Desconectar o WhatsApp do Presence?")}><Unplug size={14} /> Desconectar</button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-amber/30 bg-amber/5 p-4 text-xs leading-relaxed text-foreground/85" data-testid="wa-aviso">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber"><AlertTriangle size={15} /> Leia antes de ligar</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><b>Não é uma integração oficial.</b> O WhatsApp só oferece acesso oficial para empresas. Aqui o Presence entra como um “aparelho conectado”, igual ao WhatsApp Web. O WhatsApp pode não gostar de acessos automáticos e, em casos raros, limitar o número. Use por sua conta e risco.</li>
            <li><b>Só leitura.</b> O Presence não envia mensagens, não marca como lida e não aparece online. O seu celular continua recebendo as notificações normalmente.</li>
            <li><b>As mensagens ficam no seu computador</b> (pasta .presence do seu usuário), apagadas depois de 30 dias. Elas não vão para a nuvem do Presence.</li>
            <li><b>Quando você pede para ler ou analisar</b> uma conversa, o trecho pedido é enviado à OpenAI (a IA do Presence) para ser resumido ou lido. Evite pedir sobre conversas que você não quer compartilhar com ela.</li>
            <li>Quem tiver a pasta .presence do seu computador consegue acessar essas mensagens. Para parar de vez: <i>Desconectar</i> e depois <i>Apagar histórico local</i>.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Configuracoes() {
  const { account, signOut } = useAuth();
  const briefing = useBriefingSafe();
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-5 px-4 py-6 pb-32 md:py-10" data-testid="configuracoes">
      <header className="flex items-center gap-3">
        <Link to="/assistente" aria-label="Voltar" className="icon-tile h-10 w-10 !rounded-full"><ArrowLeft size={16} /></Link>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan/10 text-cyan"><Settings size={20} /></span>
        <div><h1 className="font-display text-2xl font-semibold">Configurações</h1><p className="text-xs text-muted-foreground">Conta, jeito do Presence e integrações.</p></div>
      </header>

      <section className={card}>
        <h2 className="font-display text-lg font-semibold">Conta e personalização</h2>
        <p className="mt-1 text-sm text-muted-foreground">{account ? <>Você está como <b className="text-foreground">{account.name}</b> ({account.email}).</> : "Modo de teste."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {briefing?.available && <button className={btn} onClick={openBriefing} data-testid="cfg-briefing"><Sparkles size={14} /> Meu briefing</button>}
          <button className={`${btn} hover:!border-destructive/50 hover:!text-destructive`} onClick={() => void signOut()}><LogOut size={14} /> Sair da conta</button>
        </div>
      </section>

      <WhatsApp />

      <p className="flex items-center justify-center gap-1.5 pb-4 text-center text-xs text-muted-foreground"><ShieldCheck size={13} /> Nada daqui envia mensagens por você.</p>
    </main>
  );
}
