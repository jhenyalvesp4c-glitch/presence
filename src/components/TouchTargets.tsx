/**
 * Em telas de toque, aumenta a área de clique de botões e links pequenos (abaixo de 40 px) para uns 40 px, SEM mudar o desenho:
 * o aumento é uma área invisível ao redor do elemento (::after). Só roda quando o aparelho é de toque (pointer: coarse).
 */
import { useEffect } from "react";

const MIN = 40;
const SELECTOR = "button, a[href], [role=button], [role=tab], [role=radio], [role=switch], summary, input[type=checkbox], input[type=radio]";

function scan(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    if (el.dataset["tp"]) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return; // escondido: tenta de novo na próxima
    if (r.width >= MIN && r.height >= MIN) { el.dataset["tp"] = "0"; return; }
    const cs = getComputedStyle(el);
    // não mexe em quem corta o que sai da caixa, nem em quem já usa o ::after
    if (cs.overflow !== "visible" || getComputedStyle(el, "::after").content !== "none") { el.dataset["tp"] = "0"; return; }
    if (cs.position === "static") el.style.position = "relative";
    el.style.setProperty("--tp-x", `${Math.max(0, (MIN - r.width) / 2)}px`);
    el.style.setProperty("--tp-y", `${Math.max(0, (MIN - r.height) / 2)}px`);
    el.dataset["tp"] = "1";
  });
}

export function TouchTargets() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => scan(document)); };
    run();
    const mo = new MutationObserver(run);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
