/** Atualiza o app de verdade: esquece caches e service workers antigos e recarrega a página (o que o Ctrl+Shift+R faz). */
export async function refreshApp(): Promise<void> {
  try { await Promise.all([navigator.serviceWorker?.getRegistrations().then((r) => Promise.all(r.map((x) => x.unregister()))), window.caches?.keys().then((k) => Promise.all(k.map((x) => caches.delete(x))))]); } catch { /* segue para recarregar */ }
  const u = new URL(window.location.href); u.searchParams.set("_v", String(Date.now()));
  window.location.replace(u.toString());
}
