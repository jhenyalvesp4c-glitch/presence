import type { MouseEvent, PointerEvent } from "react";

/**
 * Fechar a janela clicando no fundo escuro — mas só quando o clique COMEÇOU e TERMINOU no fundo.
 * Sem isso, apertar o mouse dentro de um campo, arrastar (por exemplo para selecionar texto) e soltar
 * fora da janela dispara um "clique" no fundo e a janela some.
 * Uso: <div {...backdropProps(onClose)} className="fixed inset-0 ...">
 */
let downTarget: EventTarget | null = null;

export const backdropProps = (onClose: () => void) => ({
  onPointerDown: (e: PointerEvent) => { downTarget = e.target; },
  onClick: (e: MouseEvent) => {
    if (e.target === e.currentTarget && downTarget === e.currentTarget) onClose();
    downTarget = null;
  },
});
