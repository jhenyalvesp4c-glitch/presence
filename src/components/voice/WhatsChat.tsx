import { Fragment, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AtSign, Users, X } from "lucide-react";

import type { ChatMsg, Panel } from "@/lib/voice/agent";

const COLORS = ["#53bdeb", "#e8a14d", "#c58af9", "#7bd88f", "#ff7eb6", "#f6c744", "#5ed4c8", "#f08a6b"];
const colorOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]!; };
const KIND: Record<string, string> = { imagem: "📷 Imagem", video: "🎬 Vídeo", audio: "🎤 Áudio", "audio de voz": "🎤 Mensagem de voz", documento: "📄 Documento", figurinha: "Figurinha", contato: "👤 Contato", localizacao: "📍 Localização", enquete: "📊 Enquete", outro: "Mensagem" };

function dayLabel(dia: string): string {
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const now = new Date();
  if (dia === fmt(now)) return "Hoje";
  if (dia === fmt(new Date(now.getTime() - 86_400_000))) return "Ontem";
  return dia;
}

function Bubble({ m, group, showName }: { m: ChatMsg; group: boolean; showName: boolean }) {
  const mine = m.minha;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${showName ? "mt-2" : "mt-0.5"}`}>
      <div className={`relative max-w-[86%] rounded-2xl px-3 pb-1.5 pt-1.5 shadow-sm ${mine ? "rounded-tr-md bg-[#005c4b] text-white" : "rounded-tl-md bg-[oklch(0.26_0.02_265)] text-foreground"} ${m.marcou ? "ring-1 ring-amber/60" : ""}`}>
        {group && !mine && showName && <p className="mb-0.5 text-[0.78rem] font-semibold leading-tight" style={{ color: colorOf(m.quem) }}>{m.quem}</p>}
        {m.marcou && <p className="mb-0.5 flex items-center gap-1 text-[0.65rem] font-medium text-amber"><AtSign size={10} /> marcou ou respondeu a você</p>}
        <p className={`whitespace-pre-wrap break-words text-[0.9rem] leading-snug ${m.texto ? "" : "italic text-foreground/70"}`}>{m.texto || KIND[m.tipo] || "Mensagem"}</p>
        {m.marcados && m.marcados.length > 0 && <p className="mt-1 flex flex-wrap items-center gap-1 text-[0.68rem] text-sky-300/90" data-testid="whats-marcados"><AtSign size={10} /> Marcou: {m.marcados.join(", ")}</p>}
        <p className={`mt-0.5 text-right text-[0.65rem] leading-none ${mine ? "text-white/60" : "text-muted-foreground"}`}>{m.hora}</p>
      </div>
    </div>
  );
}

/** A conversa do WhatsApp mostrada como no aplicativo: mensagens uma embaixo da outra, com nome, horário e dia. Somente leitura. */
export function WhatsChat({ panel, onClose }: { panel: Panel; onClose: () => void }) {
  const chat = panel.chat!;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const t = setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 60);
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; clearTimeout(t); };
  }, [onClose]);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-background/70 p-3 backdrop-blur-md sm:p-6" onClick={onClose} data-testid="voz-painel">
      <div role="dialog" aria-label={`Conversa ${chat.nome}`} onClick={(e) => e.stopPropagation()} data-testid="whats-chat"
        className="relative flex h-[min(88vh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[oklch(0.14_0.02_190)] shadow-[0_40px_120px_-30px_var(--emerald)]" style={{ animation: "vp-in .45s cubic-bezier(.2,.8,.2,1) both" }}>
        <header className="flex items-center gap-3 border-b border-white/10 bg-[oklch(0.2_0.03_190)] px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald/20 text-emerald">{chat.grupo ? <Users size={18} /> : <span className="font-semibold uppercase">{chat.nome.slice(0, 1)}</span>}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold" data-testid="whats-nome">{chat.nome || "Conversa"}</h2>
            <p className="text-xs text-muted-foreground">{chat.grupo ? "Grupo" : "Conversa"} · {chat.mensagens.length} mensagem{chat.mensagens.length === 1 ? "" : "s"} · somente leitura</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"><X size={17} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 [background:radial-gradient(circle_at_20%_10%,oklch(0.2_0.04_190/0.5),transparent_60%),oklch(0.12_0.015_200)]" data-testid="whats-mensagens">
          <div className="flex min-h-full flex-col justify-end">
          {chat.mensagens.map((m, i) => {
            const prev = chat.mensagens[i - 1];
            const newDay = !prev || prev.dia !== m.dia;
            const showName = newDay || !prev || prev.quem !== m.quem || prev.minha !== m.minha;
            return (
              <Fragment key={i}>
                {newDay && <div className="my-3 flex justify-center"><span className="rounded-full bg-white/10 px-3 py-1 text-[0.7rem] text-muted-foreground">{dayLabel(m.dia)}</span></div>}
                <Bubble m={m} group={chat.grupo} showName={showName} />
              </Fragment>
            );
          })}
          <div ref={end} />
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-[oklch(0.2_0.03_190)] px-4 py-2.5 text-[0.7rem] text-muted-foreground">
          <span>O Presence só lê: não envia nem marca como lida no WhatsApp.</span>
          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-foreground transition hover:border-emerald/50 hover:text-emerald">Fechar</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
