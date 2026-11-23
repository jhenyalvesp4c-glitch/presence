/** Configurações → "Avisos no celular": liga as notificações deste aparelho (com o app fechado) e manda um teste. */
import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from "@/lib/push/client";

const btn = "flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm transition duration-300 hover:-translate-y-0.5 hover:border-cyan/50 hover:text-cyan active:scale-95 disabled:opacity-50";

export function PushSettings() {
  const [st, setSt] = useState<PushState | null>(null), [busy, setBusy] = useState(false);
  const refresh = useCallback(() => { void pushState().then(setSt); }, []);
  useEffect(refresh, [refresh]);

  const turnOn = async () => { setBusy(true); const e = await enablePush(); setBusy(false); if (e) toast.error(e); else toast.success("Avisos ligados neste aparelho"); refresh(); };
  const turnOff = async () => { setBusy(true); await disablePush(); setBusy(false); toast.message("Avisos desligados neste aparelho"); refresh(); };
  const test = async () => {
    setBusy(true); const r = await sendTestPush(); setBusy(false);
    if (!r) toast.error("Não consegui enviar o teste."); else if (!r.enviados) toast.error(r.aparelhos ? "O aviso não chegou. Tente desligar e ligar de novo." : "Nenhum aparelho com avisos ligados."); else toast.success(`Aviso enviado para ${r.enviados} aparelho${r.enviados === 1 ? "" : "s"}`);
  };

  const needInstall = !!st && st.ios && !st.standalone;
  return (
    <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6" data-testid="cfg-avisos">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[var(--violet)] opacity-15 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-2xl border border-violet/50" style={{ animation: "pulse-ring 2.8s ease-out infinite" }} />
          <span className="icon-tile h-12 w-12 !rounded-2xl" style={{ ["--glow" as string]: "var(--violet)" }}><BellRing size={20} /></span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">Avisos no celular</h2>
          <p className="mt-1 text-sm text-muted-foreground">Receba notificações mesmo com o Orion fechado: <b className="text-foreground">lembretes na hora</b>, <b className="text-foreground">fatura fechando ou vencendo</b> e <b className="text-foreground">assinatura renovando</b> (1 dia antes e no dia, às 9h).</p>

          {!st ? <p className="mt-3 text-xs text-muted-foreground"><Loader2 size={12} className="mr-1 inline animate-spin" /> Verificando este aparelho…</p>
            : !st.supported ? <p className="mt-3 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber">{st.ios ? "Neste iPhone, os avisos só funcionam depois de instalar o Orion: no Safari, toque em Compartilhar → “Adicionar à Tela de Início” e abra o app pelo ícone. (Precisa do iOS 16.4 ou mais novo.)" : "Este navegador não permite avisos. No Android, use o Chrome."}</p>
            : !st.prod ? <p className="mt-3 text-xs text-muted-foreground">Disponível só no app publicado (não no modo de desenvolvimento).</p>
            : (
              <div className="mt-3 space-y-3">
                {needInstall && <p className="rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber"><Smartphone size={12} className="mr-1 inline" /> No iPhone, instale o Orion na tela inicial primeiro (Safari → Compartilhar → “Adicionar à Tela de Início”) e ligue os avisos de dentro do app.</p>}
                {st.permission === "denied" && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador (ou do app) e volte aqui.</p>}
                {st.subscribed
                  ? <p className="flex items-center gap-2 text-sm text-emerald" data-testid="avisos-ligados"><CheckCircle2 size={15} /> Avisos ligados neste aparelho</p>
                  : <p className="text-xs text-muted-foreground">Desligados neste aparelho.</p>}
                <div className="flex flex-wrap gap-2">
                  {!st.subscribed
                    ? <button className={btn} disabled={busy || st.permission === "denied"} onClick={() => void turnOn()} data-testid="avisos-ligar">{busy ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} Ligar avisos neste aparelho</button>
                    : <>
                        <button className={btn} disabled={busy} onClick={() => void test()} data-testid="avisos-testar">{busy ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} Enviar aviso de teste</button>
                        <button className={`${btn} hover:!border-destructive/50 hover:!text-destructive`} disabled={busy} onClick={() => void turnOff()} data-testid="avisos-desligar">Desligar</button>
                      </>}
                </div>
              </div>)}
        </div>
      </div>
    </section>
  );
}
