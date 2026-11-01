import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

import { createServerClient, SINGLE_USER_ID, type Demand } from "./supabase";

const MODEL = "claude-opus-5-5";
const HISTORY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 5;

const askInput = z.object({
  message: z.string().trim().min(1).max(4000),
});

export type AskResult =
  | { ok: true; reply: string; demandsCreated: Demand[] }
  | { ok: false; error: string };

// Prompt estável primeiro (cacheável); dados voláteis (data, nome, demandas) vêm depois.
const SYSTEM_PROMPT = `Você é a Presence, assistente pessoal da usuária para rotina, saúde, foco, finanças e projetos.
Fale sempre em português do Brasil, de forma calorosa, direta e breve (no máximo 3 parágrafos curtos, a menos que ela peça detalhes).

Você tem acesso às demandas dela pelas ferramentas:
- registrar_demanda: use quando ela pedir para anotar, registrar, lembrar ou criar uma demanda/pendência.
- listar_demandas: use quando ela perguntar sobre demandas, pendências ou o que tem para fazer.

Ainda não há dados de tarefas, hábitos, agenda, treino ou financeiro neste app. Se ela perguntar sobre isso,
diga com honestidade que esses módulos ainda não estão conectados e ofereça registrar o pedido como demanda.
Nunca invente dados que não vieram das ferramentas.`;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "registrar_demanda",
    description: "Registra uma nova demanda (pendência) para a usuária.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título curto e claro da demanda." },
        descricao: { type: ["string", "null"], description: "Detalhes opcionais." },
      },
      required: ["titulo", "descricao"],
      additionalProperties: false,
    },
  },
  {
    name: "listar_demandas",
    description: "Lista as demandas da usuária, das mais recentes para as mais antigas.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["nova", "em_andamento", "concluida", null],
          description: "Filtra por status; null para todas.",
        },
      },
      required: ["status"],
      additionalProperties: false,
    },
  },
];

const registrarInput = z.object({
  titulo: z.string().trim().min(1).max(300),
  descricao: z.string().max(5000).nullable(),
});
const listarInput = z.object({
  status: z.enum(["nova", "em_andamento", "concluida"]).nullable(),
});

type UserClient = ReturnType<typeof createServerClient>;

async function runTool(
  db: UserClient,
  userId: string,
  name: string,
  rawInput: unknown,
  created: Demand[],
): Promise<{ content: string; isError: boolean }> {
  if (name === "registrar_demanda") {
    const input = registrarInput.safeParse(rawInput);
    if (!input.success) return { content: "Entrada inválida para registrar_demanda.", isError: true };
    const { data, error } = await db
      .from("demands")
      .insert({ user_id: userId, title: input.data.titulo, description: input.data.descricao, source: "assistente" })
      .select("id, title, description, source, status, created_at")
      .single();
    if (error) return { content: `Erro ao salvar: ${error.message}`, isError: true };
    created.push(data as Demand);
    return { content: JSON.stringify({ registrada: true, demanda: data }), isError: false };
  }

  if (name === "listar_demandas") {
    const input = listarInput.safeParse(rawInput);
    if (!input.success) return { content: "Entrada inválida para listar_demandas.", isError: true };
    let query = db
      .from("demands")
      .select("title, description, status, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (input.data.status) query = query.eq("status", input.data.status);
    const { data, error } = await query;
    if (error) return { content: `Erro ao buscar: ${error.message}`, isError: true };
    return { content: JSON.stringify({ total: data.length, demandas: data }), isError: false };
  }

  return { content: `Ferramenta desconhecida: ${name}`, isError: true };
}

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => askInput.parse(data))
  .handler(async ({ data }): Promise<AskResult> => {
    const db = createServerClient();
    const userId = SINGLE_USER_ID;

    if (!process.env["ANTHROPIC_API_KEY"]) {
      return { ok: false, error: "A assistente ainda não está configurada (falta ANTHROPIC_API_KEY no servidor)." };
    }

    // Histórico anterior + perfil, antes de salvar a nova mensagem.
    const [{ data: history }, { data: profile }] = await Promise.all([
      db
        .from("assistant_messages")
        .select("role, content")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      db.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    ]);

    const { error: saveError } = await db
      .from("assistant_messages")
      .insert({ user_id: userId, role: "user", content: data.message });
    if (saveError) return { ok: false, error: `Não consegui salvar sua mensagem: ${saveError.message}` };

    const messages: Anthropic.Beta.BetaMessageParam[] = [];
    for (const m of (history ?? []).reverse()) {
      // A API exige que a conversa comece pela usuária.
      if (messages.length === 0 && m.role !== "user") continue;
      messages.push({ role: m.role as "user" | "assistant", content: m.content });
    }
    messages.push({ role: "user", content: data.message });

    const now = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
    const name = profile?.display_name || "usuária";

    const { default: AnthropicClient } = await import("@anthropic-ai/sdk");
    const client = new AnthropicClient();
    const created: Demand[] = [];
    let reply = "";

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await client.beta.messages.create({
          model: MODEL,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low" },
          system: [
            { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
            { type: "text", text: `Agora: ${now} (horário de Brasília). Nome da usuária: ${name}.` },
          ],
          tools,
          messages,
        });

        if (response.stop_reason === "refusal") {
          reply = "Desculpe, não consigo ajudar com esse pedido.";
          break;
        }

        messages.push({ role: "assistant", content: response.content });

        if (response.stop_reason === "pause_turn") continue;

        const toolUses = response.content.filter(
          (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
        );
        if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
          reply = response.content
            .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
          break;
        }

        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const use of toolUses) {
          const result = await runTool(db, userId, use.name, use.input, created);
          results.push({ type: "tool_result", tool_use_id: use.id, content: result.content, is_error: result.isError });
        }
        messages.push({ role: "user", content: results });
      }
    } catch (error) {
      if (error instanceof AnthropicClient.RateLimitError) {
        return { ok: false, error: "Muitas mensagens seguidas. Tente de novo em instantes." };
      }
      if (error instanceof AnthropicClient.AuthenticationError) {
        return { ok: false, error: "A chave da API da assistente é inválida." };
      }
      if (error instanceof AnthropicClient.APIError) {
        console.error("Claude API error", error.status, error.message);
        return { ok: false, error: "A assistente está indisponível agora. Tente novamente." };
      }
      throw error;
    }

    if (!reply) reply = "Pronto!";

    await db.from("assistant_messages").insert({ user_id: userId, role: "assistant", content: reply.slice(0, 20000) });

    return { ok: true, reply, demandsCreated: created };
  });
