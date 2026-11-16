import { useState } from "react";
import { Check, Loader2, Send, X } from "lucide-react";
import { sendImprovement } from "@/lib/data/improvements";
import type { Confirmar } from "@/lib/voice/agent";

/** Cartão para conferir, corrigir e confirmar o pedido que o Orion vai enviar ao Claude. */
export function ConfirmRequest({ data, onClose }: { data: Confirmar; onClose: () => void }) {
  const [titulo, setTitulo] = useState(data.titulo);
  const [detalhes, setDetalhes] = useState(data.detalhes);
  const [estado, setEstado] = useState<"conferindo" | "enviando" | "enviado" | "erro">("conferindo");
  const [erro, setErro] = useState("");

  async function enviar() {
    setEstado("enviando"); setErro("");
    try { await sendImprovement({ title: titulo, request: data.pedido, details: detalhes, area: data.area }); setEstado("enviado"); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não consegui enviar."); setEstado("erro"); }
  }

  if (estado === "enviado") {
    return (
      <div className="rounded-2xl border border-emerald/40 bg-emerald/10 p-5 text-center" data-testid="pedido-enviado">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald/20 text-emerald"><Check size={20} /></span>
        <p className="mt-3 font-medium">Pedido enviado ao Claude</p>
        <p className="mt-1 text-sm text-muted-foreground">Ficou na fila: “{titulo}”. Você acompanha o andamento perguntando ao Orion “como estão os meus pedidos?”.</p>
        <button onClick={onClose} className="mt-4 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm transition hover:border-cyan/50 hover:text-cyan">Fechar</button>
      </div>
    );
  }
  const busy = estado === "enviando";
  return (
    <div className="space-y-4" data-testid="confirmar-pedido">
      <p className="text-sm text-muted-foreground">Confira se foi isso mesmo que você quis. Pode corrigir antes de enviar. Só vai para o Claude depois que você confirmar.</p>
      <label className="block">
        <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan">O que você pediu</span>
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm">{data.pedido}</p>
      </label>
      <label className="block">
        <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan">Título</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} disabled={busy} className="w-full rounded-2xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm outline-none focus:border-cyan/50" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan">Como eu entendi que deve ficar</span>
        <textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)} rows={6} maxLength={6000} disabled={busy} className="w-full resize-y rounded-2xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm leading-snug outline-none focus:border-cyan/50" />
      </label>
      {data.area && <p className="text-xs text-muted-foreground">Área: {data.area}</p>}
      {estado === "erro" && <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" role="alert">Não consegui enviar: {erro}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:border-destructive/50 hover:text-destructive"><X size={14} /> Não é isso, cancelar</button>
        <button onClick={() => void enviar()} disabled={busy || !titulo.trim()} data-testid="confirmar-enviar" className="flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/15 px-5 py-2 text-sm font-medium text-cyan transition hover:bg-cyan/25 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Confirmar e enviar ao Claude
        </button>
      </div>
    </div>
  );
}
