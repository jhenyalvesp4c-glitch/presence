/** Acorda a rotina do Claude (gatilho por API) assim que a pessoa confirma um pedido de melhoria, em vez de esperar a verificação agendada. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type FireResult = { ok: true; sessao?: string } | { ok: false; motivo: "nao_configurado" | "sem_pedido" | "recusado" | "erro"; detalhe?: string };

/** Só aceita o endereço oficial da API (evita desviar o token para outro lugar por engano de configuração). */
export const isFireUrl = (u: string) => /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[A-Za-z0-9_]+\/fire$/.test(u);

export const fireImprovement = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<FireResult> => {
    const url = process.env["ORION_ROUTINE_FIRE_URL"]?.trim(), token = process.env["ORION_ROUTINE_FIRE_TOKEN"]?.trim();
    if (!url || !token) return { ok: false, motivo: "nao_configurado" };
    if (!isFireUrl(url)) return { ok: false, motivo: "erro", detalhe: "O endereço ORION_ROUTINE_FIRE_URL não é o da API de rotinas do Claude." };
    try {
      // confere que o pedido existe, está na fila e é de quem está logado (a regra de acesso do banco filtra pelo dono)
      const { supabase } = await import("./supabase");
      const { data: rows, error } = await supabase.from("improvement_requests").select("id").eq("id", data.id).eq("status", "na_fila").limit(1);
      if (error || !rows?.length) return { ok: false, motivo: "sem_pedido" };
      const res = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "anthropic-beta": "experimental-cc-routine-2026-04-01", "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ text: `Pedido de melhoria na fila para processar agora: ${data.id}` }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return { ok: false, motivo: res.status === 401 || res.status === 403 ? "recusado" : "erro", detalhe: `HTTP ${res.status}` };
      const j = (await res.json().catch(() => null)) as { claude_code_session_url?: string } | null;
      return { ok: true, ...(j?.claude_code_session_url ? { sessao: j.claude_code_session_url } : {}) };
    } catch (e) { return { ok: false, motivo: "erro", detalhe: e instanceof Error ? e.message : "erro" }; }
  });
