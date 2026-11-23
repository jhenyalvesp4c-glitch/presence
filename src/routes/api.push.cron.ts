import { createFileRoute } from "@tanstack/react-router";

/** Rotina de avisos: chamada pelo banco (pg_cron) a cada minuto com o segredo. Descobre o que avisar, envia e marca como enviado. */
async function run(request: Request): Promise<Response> {
  const { anonClient, json, sendOne } = await import("@/lib/push/server");
  const secret = request.headers.get("x-cron-secret") ?? "";
  if (secret.length < 20) return json(401, { error: "sem segredo" });
  const db = anonClient();
  const ok = await db.rpc("push_check", { p_secret: secret });
  if (ok.data !== true) return json(401, { error: "segredo inválido" });

  const due = await db.rpc("push_due", { p_secret: secret });
  const rows = (due.data ?? []) as { user_id: string; dedupe_key: string; title: string; body: string; url: string; endpoint: string; p256dh: string; auth: string }[];
  if (!rows.length) return json(200, { avisos: 0, enviados: 0 });
  const v = await db.rpc("push_vapid", { p_secret: secret });
  const vapid = v.data as { public: string; private: string } | null;
  if (!vapid?.public || !vapid.private) return json(503, { error: "chaves ainda não geradas" });

  const gone = new Set<string>(), sentKeys = new Map<string, { user_id: string; key: string }>(), good = new Set<string>();
  await Promise.all(rows.map(async (r) => {
    const res = await sendOne({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, { title: r.title, body: r.body, url: r.url, tag: r.dedupe_key }, vapid);
    if (res === "ok") { good.add(r.endpoint); sentKeys.set(`${r.user_id}|${r.dedupe_key}`, { user_id: r.user_id, key: r.dedupe_key }); }
    else if (res === "gone") gone.add(r.endpoint);
  }));
  // marca como enviado só o que chegou a algum aparelho (o resto tenta de novo no minuto seguinte)
  if (sentKeys.size) await db.rpc("push_mark", { p_secret: secret, p_items: [...sentKeys.values()] });
  if (good.size) await db.rpc("push_touch", { p_secret: secret, p_endpoints: [...good] });
  if (gone.size) await db.rpc("push_drop", { p_secret: secret, p_endpoints: [...gone] });
  return json(200, { avisos: sentKeys.size, enviados: good.size, removidos: gone.size });
}

export const Route = createFileRoute("/api/push/cron")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
