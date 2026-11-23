/** Financeiro → "Orion do financeiro": conversa dentro da própria tela para mandar prints, PDFs ou texto e pedir para lançar, editar, dividir e excluir. */
import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { OrionChat } from "@/components/orion/OrionChat";
import { Head, Panel } from "./ui";

const EXEMPLOS = [
  "Segue o extrato do meu cartão. O mercado e a farmácia são da Ana; o resto é meu.",
  "As contas da casa deste mês: luz 312,40, internet 120, condomínio 1.200. O Pedro pagou; eu fico com metade.",
  "Dividi a lava-louças em 10x de 300 no Nubank com o Pedro, 50% cada.",
  "Como está o acerto com a Ana? Gera o extrato para eu mandar.",
];

export function FinanceAssistant({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Panel glow="var(--violet)" data-testid="fin-orion">
      <Head icon={Sparkles} title="Orion do financeiro" sub="Mande prints, PDFs ou escreva (com uma explicação, se quiser). Ele lança, edita, divide e exclui por você."
        right={<button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Recolher" : "Abrir"} data-testid="fin-orion-abrir" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-muted-foreground transition hover:text-foreground"><ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} /></button>} />
      {open ? (
        <div className="max-h-[75dvh] overflow-y-auto" data-testid="fin-orion-chat"><OrionChat /></div>
      ) : (
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {EXEMPLOS.map((e) => <li key={e} className="rounded-xl border border-white/8 bg-black/15 px-3 py-2">“{e}”</li>)}
        </ul>
      )}
    </Panel>
  );
}
