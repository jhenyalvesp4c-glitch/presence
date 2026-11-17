/** Anexos da conversa por texto com o Orion: monta o conteúdo da mensagem para a IA (imagens, PDF, texto) e tira o peso antes de devolver o estado ao navegador. */
export type Anexo = { name: string; mime: string; data: string };
export const MAX_ANEXOS = 6;
export const MAX_ANEXOS_CHARS = 4_000_000; // base64 somado; o corpo da função na Vercel aceita ~4,5 MB

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

const decodeText = (b64: string) => Buffer.from(b64, "base64").toString("utf-8").slice(0, 60_000);

/** Mensagem do usuário com anexos (formato de chat da OpenAI). Sem anexos devolve só o texto. */
export function buildUserContent(text: string, files: Anexo[]): string | ChatPart[] {
  if (!files.length) return text;
  const parts: ChatPart[] = [], texts: string[] = [];
  for (const f of files) {
    if (f.mime.startsWith("image/")) parts.push({ type: "image_url", image_url: { url: `data:${f.mime};base64,${f.data}` } });
    else if (f.mime === "application/pdf") parts.push({ type: "file", file: { filename: f.name, file_data: `data:application/pdf;base64,${f.data}` } });
    else texts.push(`Arquivo "${f.name}":\n${decodeText(f.data)}`);
  }
  const names = files.map((f) => f.name).join(", ");
  const head = `${text.trim() || "(sem texto digitado: considere só os arquivos)"}\n\n[Arquivos enviados agora: ${names}]${texts.length ? `\n\n${texts.join("\n\n")}` : ""}`;
  return [{ type: "text", text: head }, ...parts];
}

/** Troca imagens e PDFs por um aviso curto (para o estado que volta ao navegador não carregar megabytes). */
export function stripBinary<T extends Record<string, unknown>>(messages: T[]): T[] {
  return messages.map((m) => {
    const c = m["content"];
    if (!Array.isArray(c)) return m;
    const kept = (c as ChatPart[]).map((p) => (p.type === "text" ? p : { type: "text", text: p.type === "image_url" ? "[imagem enviada]" : `[arquivo ${p.file.filename} enviado]` }));
    return { ...m, content: kept };
  });
}

export const anexosTotal = (files: Anexo[]) => files.reduce((n, f) => n + f.data.length, 0);
