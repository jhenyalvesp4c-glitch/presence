/**
 * Documentação → Logins → "Ler de um print": a IA lê o print (ou PDF) e devolve SÓ os e-mails da lista de acessos.
 * Senhas nunca são pedidas nem devolvidas: o app monta a senha pelo padrão combinado, neste navegador.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const file = z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), size: z.number().int().min(0), data: z.string().max(4_000_000) });
const input = z.object({ files: z.array(file).min(1).max(4) });

export type LoginEmailsResult = { ok: true; emails: string[]; nota: string } | { ok: false; error: string };

const TOOL = "devolver_emails";
const SYSTEM = `Você lê prints e documentos com uma lista de ACESSOS por polo (e-mails de login). Devolva, chamando a função ${TOOL}, TODOS os endereços de e-mail da lista, exatamente como estão escritos (sem corrigir, sem inventar, sem repetir). Ignore e-mails que não fazem parte da lista de acessos (conversas, remetentes). NUNCA devolva senhas, mesmo que apareçam; só e-mails. Se uma linha estiver cortada ou ilegível, deixe-a de fora e diga na "nota".`;

export const readLoginEmails = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<LoginEmailsResult> => {
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A leitura por IA ainda não está ligada (falta OPENAI_API_KEY no servidor). Cole os e-mails no texto." };
    const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
    const { DEFAULT_MODEL, userContent } = await import("./mcp/interpret");
    const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
    const parameters = { type: "object", properties: { emails: { type: "array", items: { type: "string" }, description: "Os e-mails da lista de acessos, na ordem em que aparecem." }, nota: { type: "string", description: "Avisos curtos (linhas cortadas, dúvidas de leitura). Vazio se não houver." } }, required: ["emails"] };
    try {
      const res = await makeCreate()({
        model, instructions: SYSTEM,
        input: [{ role: "user", content: userContent("Leia a lista de acessos destes arquivos e devolva os e-mails.", data.files) }],
        tools: [{ type: "function", name: TOOL, description: "Devolve os e-mails lidos.", parameters, strict: false }],
        tool_choice: { type: "function", name: TOOL }, max_output_tokens: 3000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL);
      if (!call) return { ok: false, error: "A IA não devolveu os e-mails. Tente de novo ou cole o texto." };
      const args = JSON.parse(String(call["arguments"])) as { emails?: unknown; nota?: unknown };
      const emails = (Array.isArray(args.emails) ? args.emails : []).filter((e): e is string => typeof e === "string").map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      return { ok: true, emails: [...new Set(emails)], nota: typeof args.nota === "string" ? args.nota.slice(0, 300) : "" };
    } catch (error) {
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, model) };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Tente com um print menor." };
      return { ok: false, error: "Não consegui ler o print agora. Cole os e-mails no texto." };
    }
  });
