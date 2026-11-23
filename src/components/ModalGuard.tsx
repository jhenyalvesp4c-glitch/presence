/**
 * No celular, quando uma janela (modal) está aberta, esconde a barra de baixo e os botões flutuantes:
 * eles ficariam por cima da janela e tapariam o botão de salvar. Funciona para qualquer janela, mesmo as que
 * ficam presas dentro de um bloco com animação (que não conseguem passar por cima da barra).
 */
import { useEffect } from "react";

const isOverlay = (el: Element): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.matches("[role=dialog], [role=alertdialog]")) return true;
  const cs = getComputedStyle(el);
  if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") return false;
  const z = Number.parseInt(cs.zIndex, 10);
  if (!(z >= 50)) return false;
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth - 2 && r.height >= window.innerHeight - 2; // cobre a tela toda
};

export function ModalGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const open = [...document.body.querySelectorAll("[role=dialog], [role=alertdialog], div.fixed")].some(isOverlay);
        if (open) root.dataset["modal"] = "1"; else delete root.dataset["modal"];
      });
    };
    run();
    const mo = new MutationObserver(run);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); delete root.dataset["modal"]; };
  }, []);
  return null;
}
