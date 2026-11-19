/**
 * Acerto de contas → "Ler extrato": a IA lê a foto/PDF/print do extrato ou da fatura do cartão e devolve as COMPRAS linha a linha.
 * Quem é dono de cada compra é a pessoa quem decide na tela (a IA só sugere, se ela explicar no campo de instrução).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const file = z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), size: z.number().int().min(0), data: z.string().max(4_000_000) });
const input = z.object({ files: z.array(file).max(4).default([]), texto: z.string().max(30000).default(""), instrucao: z.string().max(1500).default(""), hoje: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export type StatementLine = { data: string; descricao: string; valor: number; parcela: string; parteDaOutra: number | null };
export type StatementResult = { ok: true; linhas: StatementLine[]; nota: string } | { ok: false; error: string };

const TOOL = "devolver_compras";
const SYSTEM = (hoje: string) => `Você lê fotos, prints e PDFs de extrato ou fatura de cartão e devolve as COMPRAS, uma por linha, chamando a função ${TOOL}.
REGRAS
- Só compras/débitos (o que foi gasto). Ignore pagamentos da fatura, créditos, estornos, saldo, limite, total, juros e tarifas do próprio cartão (a não ser que sejam uma compra clara).
- "descricao": o nome do estabelecimento/compra como está escrito, sem inventar. "valor": número POSITIVO em reais (89,90 → 89.9; "1.234,56" → 1234.56).
- "data": AAAA-MM-DD. Se só houver dia/mês, use o ano mais provável considerando que hoje é ${hoje}; se não houver data, deixe vazio.
- "parcela": como aparece ("2/5", "02 de 05"→"2/5"); vazio se não for parcelada.
- Se a pessoa explicou de quem é cada compra (instrução abaixo do pedido), preencha "parte_da_outra" com a % da compra que é DA OUTRA PESSOA (0 = tudo de quem tem o cartão, 100 = tudo da outra pessoa, 50 = dividido). Se ela não explicou ou você não tem certeza, deixe null. NUNCA adivinhe.
- Não repita a mesma linha. Se uma linha estiver cortada ou ilegível, deixe-a de fora e avise na "nota".
- Não devolva números de cartão, CPF nem senhas.`;

export const readStatement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<StatementResult> => {
    if (!data.files.length && !data.texto.trim()) return { ok: false, error: "Envie a foto ou o arquivo do extrato, ou cole o texto." };
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A leitura por IA ainda não está ligada (falta OPENAI_API_KEY no servidor). Lance as compras à mão." };
    const { makeCreate, OpenAIError, explain } = await import("./../mcp/openai");
    const { DEFAULT_MODEL, userContent } = await import("./../mcp/interpret");
    const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
    const item = { type: "object", properties: {
      data: { type: "string" }, descricao: { type: "string" }, valor: { type: "number" }, parcela: { type: "string" },
      parte_da_outra: { type: ["integer", "null"], minimum: 0, maximum: 100 },
    }, required: ["descricao", "valor"] };
    const parameters = { type: "object", properties: { compras: { type: "array", items: item }, nota: { type: "string" } }, required: ["compras"] };
    try {
      const res = await makeCreate()({
        model, instructions: SYSTEM(data.hoje),
        input: [{ role: "user", content: userContent(`Leia o extrato e devolva as compras.${data.texto.trim() ? `\n\nTEXTO DO EXTRATO:\n${data.texto.trim()}` : ""}${data.instrucao.trim() ? `\n\nINSTRUÇÃO DA PESSOA sobre de quem é cada compra:\n${data.instrucao.trim()}` : ""}`, data.files) }],
        tools: [{ type: "function", name: TOOL, description: "Devolve as compras lidas.", parameters, strict: false }],
        tool_choice: { type: "function", name: TOOL }, max_output_tokens: 12000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL);
      if (!call) return { ok: false, error: "A IA não devolveu as compras. Tente de novo com uma foto mais nítida." };
      const args = JSON.parse(String(call["arguments"])) as { compras?: unknown; nota?: unknown };
      const linhas: StatementLine[] = [];
      for (const c of Array.isArray(args.compras) ? args.compras : []) {
        const o = c as Record<string, unknown>, valor = Number(o["valor"]);
        if (!Number.isFinite(valor) || valor <= 0 || typeof o["descricao"] !== "string") continue;
        const d = typeof o["data"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o["data"]) ? o["data"] : "";
        const p = typeof o["parte_da_outra"] === "number" ? Math.min(100, Math.max(0, Math.round(o["parte_da_outra"]))) : null;
        linhas.push({ data: d, descricao: o["descricao"].trim().slice(0, 120), valor: Math.round(Math.abs(valor) * 100) / 100, parcela: typeof o["parcela"] === "string" ? o["parcela"].trim().slice(0, 20) : "", parteDaOutra: p });
      }
      return { ok: true, linhas, nota: typeof args.nota === "string" ? args.nota.slice(0, 300) : "" };
    } catch (error) {
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, model) };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Envie menos arquivos ou uma foto menor." };
      return { ok: false, error: "Não consegui ler o extrato agora. Lance as compras à mão." };
    }
  });
