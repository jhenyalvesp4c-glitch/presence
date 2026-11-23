/* Service worker do Orion: deixa o app instalável e mais rápido, sem arriscar mostrar dado velho.
 * - Páginas: sempre da rede (dados sempre atuais); sem internet, mostra /offline.html.
 * - Arquivos do app (/assets/*, com nome que muda a cada versão): guardados para abrir mais rápido.
 * - Nada de API, Supabase, voz ou login passa por aqui. */
const VERSION = "orion-v2";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // só o próprio app
  if (url.pathname.startsWith("/api/")) return; // dados, voz e login: sempre direto na rede

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) void c.put(req, res.clone());
      return res;
    }));
  }
});

/* Avisos (Web Push): o servidor manda { title, body, url, tag }; aqui vira uma notificação. */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Orion", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Orion", {
    body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: d.tag || undefined,
    data: { url: d.url || "/assistente" }, renotify: false,
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/assistente";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate(url).catch(() => undefined); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
