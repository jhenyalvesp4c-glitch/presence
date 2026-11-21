/** Copia para a área de transferência; se o navegador bloquear a API moderna (janela sem foco, contexto restrito), usa o método antigo. */
export async function copyText(v: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(v); return true; } } catch { /* tenta o método antigo */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = v; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, v.length);
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}
