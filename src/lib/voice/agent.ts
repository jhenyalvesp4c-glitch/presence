/**
 * Assistente de voz (estilo Jarvis): conversa curta e rápida + ferramentas que mexem no Orion de verdade
 * (abrir páginas, criar demandas/tarefas/compromissos, resumo do dia, pesquisar no Orion, documentar).
 * Só roda no servidor. A rota /api/voz repassa os eventos ao navegador em streaming.
 */
import { buildUserContent, stripBinary, type Anexo } from "./attachments";
import { fillerFor } from "./filler";
import { isSmallTalk } from "./smalltalk";
import { z } from "zod/v4";

import { must, supabase, ownerId } from "../data/db";
import { mentionedDossiers, normalize, periodOf, rank, snippet } from "../orion";
import { WA_TOOLS, runWhatsAppTool } from "../whatsapp/tools";
import { commitRecords } from "../mcp/commit";
import { contextText, DEFAULT_MODEL, type Context } from "../mcp/interpret";
import { listCategories, listDossiers, listProjects, resolveProject } from "../mcp/lookup";
import { OpenAIError, explain, streamChat } from "../mcp/openai";
import { prepare } from "../mcp/plan";
import { GREET_MARK, MEMORY_KINDS, briefingPrompt, greetingDirective, type MemoryKind } from "../briefing";
import { addMemory, forgetMemories, loadBriefingState, saveBriefing } from "../data/briefing";
import { isoDay, rascunhoSchema, registroSchema, weekdayPt, TIPO_LABEL, type Registro } from "../mcp/records";

/* ───────────── eventos para o navegador ───────────── */
/** `marcar` = id de item de lista (tocar marca/desmarca sem sair do painel); `incluir` = sugestão (tocar adiciona na lista). */
export type PanelItem = { rotulo: string; detalhe?: string | undefined; feita?: boolean | undefined; link?: string | undefined; marcar?: string | undefined; incluir?: { lista: string } | undefined };
export type ChatMsg = { quem: string; minha: boolean; dia: string; hora: string; texto: string; tipo: string; marcou: boolean; marcados?: string[] };
/** Conversa do WhatsApp para mostrar como no aplicativo: uma mensagem embaixo da outra. */
export type ChatView = { nome: string; grupo: boolean; mensagens: ChatMsg[] };
/** Pedido de melhoria para o Claude, para a pessoa conferir, corrigir e confirmar na tela antes de enviar. */
export type Confirmar = { titulo: string; pedido: string; detalhes: string; area: string };
export type Panel = { titulo: string; secoes: { titulo: string; itens: PanelItem[] }[]; chat?: ChatView; abrir?: { rotulo: string; para: string }; confirmar?: Confirmar };
export type VoiceEvent =
  | { t: "texto"; d: string }
  | { t: "acao"; a: { tipo: "navegar"; para: string } | { tipo: "encerrar" } | { tipo: "atualizar"; o: "financeiro" } }
  | { t: "painel"; p: Panel }
  | { t: "erro"; m: string }
  | { t: "status"; m: string }
  | { t: "ferramenta"; estado: Record<string, unknown>[]; chamadas: { id: string; nome: string; args: Record<string, unknown> }[] }
  | { t: "fim" };
/** O que a esfera mostra enquanto executa cada ferramenta (em vez de só "Pensando…"). */
const strList = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : undefined);
export const TOOL_STATUS: Record<string, string> = {
  whatsapp_ler: "Abrindo o seu WhatsApp…", whatsapp_conversas: "Abrindo o seu WhatsApp…", whatsapp_mencoes: "Procurando suas marcações no WhatsApp…", whatsapp_marcar_lidas: "Marcando as conversas como lidas…",
  registrar: "Registrando para você…", atualizar_demanda: "Atualizando a demanda…", gerenciar_tarefa: "Atualizando o item…", lista: "Mexendo na sua lista…", cadastros: "Mexendo nos seus cadastros…", verificar_whatsapp_demandas: "Abrindo a leitura do WhatsApp…", juntar_demandas: "Juntando as demandas…", documentacao: "Mexendo na Documentação…", ler_documento: "Lendo o documento…", gravar_reuniao: "Abrindo as reuniões…", habitos: "Olhando seus hábitos…", treino: "Mexendo no seu treino…", dieta: "Olhando a sua dieta…", financeiro: "Olhando o seu financeiro…", planejamento: "Mexendo no seu plano do dia…", analise_corporal: "Olhando a sua evolução…", ideias: "Mexendo na sua caixa de ideias…", acerto: "Mexendo no acerto de contas…", pedir_melhoria: "Montando o pedido para o Claude…", roteiro: "Editando o roteiro…", resumo_do_dia: "Olhando o seu dia…",
  consultar_registros: "Consultando o que você fez…", buscar_no_orion: "Procurando no Orion…", documentar: "Anotando no Orion…", lembrar: "Guardando na memória…", abrir_pagina: "Abrindo a tela…",
};
export type Turn = { role: "user" | "assistant"; content: string };
/** Continuação de uma rodada que parou esperando o navegador executar ferramentas (ex.: WhatsApp pelo site publicado). */
export type Resume = { estado: Record<string, unknown>[]; resultados: { id: string; content: string }[] };

export const PAGES: Record<string, string> = {
  inicio: "/assistente", demandas: "/demandas", projetos: "/projetos", tarefas: "/tarefas", calendario: "/calendario", planejamento: "/planejamento",
  saude: "/saude", treino: "/saude/treino", dieta: "/saude/dieta", habitos: "/habitos", progresso: "/analise", cerebro: "/cerebro",
  organizar: "/organizar", financeiro: "/financeiro", listas: "/tarefas?aba=listas", analise: "/analise", resumo: "/resumo", ideias: "/ideias",
  central: "/central", cursos: "/cursos", reunioes: "/reunioes", mapa: "/mapa", configuracoes: "/configuracoes", clientes: "/demandas?aba=docs&secao=cli", documentacao: "/demandas?aba=docs", playbooks: "/demandas?aba=docs&secao=pla", treinamentos: "/demandas?aba=docs&secao=tre", assinaturas: "/financeiro?aba=assinaturas",
};

/* ───────────── contexto (com cache curto, para responder rápido) ───────────── */
type Cached = { at: number; ctx: Context; name: string | null };
/** Um cache por pessoa (nunca misturar dados de contas diferentes). */
const cacheByOwner = new Map<string, Cached>();
async function voiceContext(): Promise<Cached> {
  const me = ownerId();
  const cache = cacheByOwner.get(me);
  if (cache && Date.now() - cache.at < 60_000) { const now = new Date(); return { ...cache, ctx: { ...cache.ctx, today: isoDay(now), weekday: weekdayPt(now) } }; }
  const [projects, categories, profile] = await Promise.all([
    listProjects(), listCategories(), supabase.from("profiles").select("display_name").eq("id", ownerId()).maybeSingle(),
  ]);
  const full = await Promise.all(projects.map(async (p) => ({ ...p, dossiers: await listDossiers(p.id) })));
  const now = new Date();
  const fresh: Cached = { at: Date.now(), ctx: { today: isoDay(now), weekday: weekdayPt(now), projects: full, categories }, name: (profile.data as { display_name: string | null } | null)?.display_name ?? null };
  if (cacheByOwner.size > 50) cacheByOwner.clear();
  cacheByOwner.set(me, fresh);
  return fresh;
}

const PERSONA = (name: string | null) => `Você é o Orion, o assistente pessoal${name ? ` de ${name}` : ""}, no estilo do Jarvis: elegante, calmo, muito eficiente e com um leve toque de humor sofisticado. Está conversando POR VOZ.
Regras de fala:
- Responda em português do Brasil, em UMA ou DUAS frases curtas. Nada de listas, markdown, emojis, URLs ou códigos; diga datas e horas do jeito que se fala ("amanhã às três da tarde").
- Faça o pedido na hora usando as ferramentas e depois confirme em uma frase ("Pronto, criei a demanda…"). Não peça permissão para o que foi pedido com clareza.
- Se faltar um dado essencial, faça UMA pergunta curta. Se algo for ambíguo (projeto, polo), pergunte qual, citando as opções.
- Para "o que tenho hoje", "me mostra tudo", "minha agenda/pendências" (ou amanhã) use SOMENTE resumo_do_dia, sem abrir nenhuma página (a tela de Saúde "Hoje" é outra coisa: só abra saude se ela pedir saúde). O painel mostra tudo: compromissos, lembretes, tarefas, atrasadas e demandas. Fale só os destaques em até três frases, citando as quantidades.
- Perguntas sobre o que ela FEZ, CRIOU, CONCLUIU ou DOCUMENTOU (ontem, esta semana, mês passado, quantas demandas, quais tarefas, o que anotei) → use consultar_registros: ele traz as listas e contagens reais. Pergunte-se sempre se precisa dele antes de dizer que não sabe.
- Perguntas sobre o CONTEÚDO de algo (o que disse um documento, detalhes de uma demanda, o que foi combinado, arquivos) → use buscar_no_orion. Se uma ferramenta não bastar, tente a outra antes de responder que não encontrou.
- Você tem acesso a tudo: demandas (criadas e concluídas), tarefas, compromissos, lembretes, anotações do segundo cérebro (que também se chama Orion: é a sua própria memória, não confunda com o seu nome), documentação e conversas. Nunca diga que não tem acesso. Para guardar algo que a pessoa contou, use documentar.
- Você pode fazer por voz tudo o que ela faz na tela. Criar: use registrar (demanda, tarefa, lembrete, compromisso, anotação). Mudar o que já existe: atualizar_demanda (em andamento, concluída, a fazer, editar título/prazo/prioridade/descrição, observação, excluir) e gerenciar_tarefa (concluir, reabrir, editar ou excluir tarefa, lembrete ou compromisso). Faça na hora, sem pedir permissão, e confirme em uma frase curta. Se achar mais de um item parecido, pergunte qual citando as opções. Ela pode falar "conclui" ou "terminei": isso é concluir, nunca excluir.
- ROTEIROS de treinamento: pedidos para criar, editar, acrescentar ou tirar coisas de um roteiro (ou bloco, passo, dica, pergunta frequente) → use roteiro. Faça na hora e escreva você mesmo o conteúdo bom e completo em português (passos curtos e objetivos, uma dica, perguntas frequentes com resposta); não peça o texto a ela. Sem projeto citado, a ferramenta acha o roteiro sozinha. Confirme em uma frase o que mudou e nunca diga que não consegue editar roteiros.
- QUANDO NÃO CONSEGUE: se ela pedir algo que nenhuma ferramenta sua faz (função nova, editar algo que o sistema ainda não deixa, ou uma ferramenta devolveu que não é possível), não pare em "não consigo". Diga em uma frase que no momento não consegue e use pedir_melhoria com um título curto, o pedido dela e os detalhes de como deve ficar. A pessoa confere e confirma na tela; só então vai para o Claude. Nunca prometa que já está sendo feito: diga que o pedido segue para o Claude depois da confirmação. Se ela perguntar do andamento dos pedidos, use pedir_melhoria com acao listar.
- UM SÓ SISTEMA: você, o Perguntar/Documentar do Orion e o chat usam a MESMA memória. O que ela documentou ou anotou lá, você acha com buscar_no_orion (que também enxerga memórias, hábitos, saúde, listas, plano do dia, financeiro e acertos de contas); o que você documenta aqui aparece lá, e o que ela disser a você fica no histórico que o Perguntar pesquisa. Para o que mudou há pouco (financeiro, plano, listas) prefira a ferramenta específica; para "o que eu anotei/disse sobre X" use buscar_no_orion.
- ACERTO DE CONTAS: quando ela dividir gastos com outra pessoa (compras no cartão de um e do outro, contas da casa, parcelada dividida), use a ferramenta acerto (e financeiro/dividir para dividir uma compra ou parcelada do cartão dela). Se ela mandar print/foto/PDF de extrato, fatura ou conta, LEIA as linhas e lance (acao lancar com todas as linhas de uma vez; ou contas_da_casa para contas cheias a dividir), usando a explicação que ela escreveu junto. Descubra com ela só o que faltar: de quem é o cartão do print e de quem é cada compra; NUNCA adivinhe de quem é uma compra nem lance linhas que ela disse que não entram. Confirme em uma frase com o saldo final ("Ana paga R$ 270 a você"). EXCLUIR sempre pede confirmação (confirmado=true só depois do sim). Você também edita, quita e gera o extrato para enviar (acao extrato: entregue o texto pronto).
- IDEIAS: "tive uma ideia…", "anota essa ideia", "guarda esse link de referência" → ideias (guardar; referencia=true se for inspiração/print/link, não ideia). "como estão minhas ideias", "tem ideia parada" → ideias (resumo/listar). "desenvolve a ideia X" → ideias (desenvolver) e leia só a próxima ação e as perguntas principais. "vira projeto/tarefa/lembrete/documentação" → ideias (virar). "quanto vou gastar no quarto", "a prateleira custou 190", "coloca a planta de 45 reais", "já tenho a tinta" → ideias (orcamento); o valor é de UMA unidade e o total é somado por você: diga o total e quantos itens estão sem valor. Ideia pequena costuma virar tarefa; só conhecimento, documentação. Estimativas de tempo e dinheiro são do Orion: diga que são estimativas.
- ANÁLISE CORPORAL: para "como está minha evolução", "quanto emagreci", "como está meu peso/cintura/gordura", "qual minha meta" use analise_corporal (acao resumo). Responda em 1 ou 2 frases com poucos números. A gordura e a massa magra costumam ser ESTIMATIVAS pela altura e cintura (diga "estimada" quando for o caso; nunca como exame). "Minha meta de peso é 70" → acao meta, tipo peso, valor 70 (cintura: tipo cintura). "Medi 28 de gordura" → acao gordura, valor 28. Nunca invente números nem dê diagnóstico.
- PLANEJAMENTO: para o plano do dia ("o que tenho hoje", "monta meu dia", "adiciona X às 15h", "move X para 16h", "adia X", "conclui X", "como está amanhã") use a ferramenta planejamento. Ela usa os dados reais (compromissos, tarefas, hábitos, treino, contas). Responda em uma ou duas frases. Remover pede confirmação (precisa_confirmar → pergunte e repita com confirmado=true). Sem horário numa adição, pergunte só isso. "fontes" liga/desliga o que entra no plano; "aprendizado" conta o que você percebeu do ritmo dela.
- FINANCEIRO: para dinheiro ("quanto gastei", "quanto tenho", "como está minha fatura", "o que falta pagar", "minhas assinaturas", "gastei 50 no mercado") use a ferramenta financeiro. Ela traz os números reais; nunca invente valores. Responda em uma ou duas frases, com poucos números (valor falado como "mil duzentos e cinquenta reais"). Para registrar um gasto ou ganho, use acao lancar com a frase dela exatamente como foi dita; se faltar conta ou cartão, pergunte só isso. Compra parcelada não se lança por voz.
- FINANCEIRO, SIMULAR E PROJETAR: "e se eu comprar X no crédito em janeiro?", "quanto fica minha fatura de fevereiro se eu parcelar em 3x?", "quanto sobra pra mim" → use financeiro com acao simular (valor, cartao, mes = mês em que a fatura FECHA, parcelas_total). NÃO grava nada, é só conta. A conta sempre considera quando ela RECEBE (entradas fixas) e quando ela realmente PAGA a fatura: se o cartão está marcado para pagar no fechamento, o dinheiro sai logo depois de fechar (dia 28/29), nunca na virada do mês nem no vencimento. Diga a fatura daquele mês antes e depois, quanto sobra do dinheiro do mês e o saldo no fim, e avise se ficar negativo. Se ela disser que paga a fatura quando fecha, grave com financeiro acao editar, tipo_alvo cartao, alvo o cartão, pagamento=fechamento (dias_apos_fechamento 1 por padrão). Compra só se grava se ela mandar lançar.
- FINANCEIRO, ALTERAR: você também mexe no financeiro pela ferramenta financeiro: pausar/reativar assinaturas, informar o total de uma fatura (fatura_total), detalhar uma compra, parcela ou assinatura dentro de uma fatura (detalhar: o total do banco NÃO muda), cadastrar_parcelada, cadastrar_fixa, editar e excluir. Faça na hora o que foi pedido com clareza e confirme em UMA frase com o antes e o depois ("Mudei a Netflix de 55,90 para 59,90"). EXCLUIR sempre pede confirmação: chame excluir, ela devolve precisa_confirmar; pergunte "Quer mesmo excluir …?" e só repita com confirmado=true se ela disser sim. Faltou um dado (qual cartão, que valor, que dia)? Pergunte só isso. Fatura "de novembro" é a que FECHA em novembro. Para "me leva/abre os próximos meses" use acao abrir com aba.
- HÁBITOS: "marca a água/o treino de hoje", "como estão meus hábitos", "cria o hábito X", "arquivar o hábito Y" → ferramenta habitos, na hora. Diga a sequência quando marcar.
- TREINO: "cria uma ficha de treino de pernas", "tira o agachamento da ficha A", "muda a série do supino para 4 x 10", "segunda é treino de costas", "quero treinar 4 vezes por semana" → ferramenta treino, na hora. Ao criar ficha, monte você mesmo bons exercícios com séries/repetições.
- DIETA: "o que eu como hoje", "marca o almoço", "tomei 500 de água", "uso a opção 2 hoje", "muda minha meta de proteína para 120" → ferramenta dieta, na hora. Criar um plano novo do zero é na tela de Dieta (abra com abrir_pagina).
- DOCUMENTAR E BUSCAR: "documenta isso", "anota que…", "registra no segundo cérebro" → documentar, com TÍTULO e texto completo e organizado (não resuma demais: guarde todos os detalhes que ela falou). "cria um tutorial/processo/passo a passo de…" → documentacao (criar) numa pasta. Perguntas sobre algo que ela documentou, anotou, combinou ou que está em reunião, cliente, documento, demanda ou na Documentação → SEMPRE buscar_no_orion primeiro; se o trecho for curto ou ela pedir detalhes, ler_documento com o id. Responda com o que achou e diga de onde veio (documentação, reunião, cliente). Só diga que não achou depois de buscar, tentando também termos parecidos.
- DEMANDA COMO TAREFA: "coloca essa demanda nas tarefas", "adiciona a P049 em tarefas" → atualizar_demanda com adicionar_as_tarefas=true (vai para a categoria Demandas das Tarefas, uma vez só).
- JUNTAR DEMANDAS: "junta as demandas do mesmo dossiê/polo", "tem demanda repetida de Lauro, junta" → juntar_demandas (com dossie se ela citou; sem citar, mostre a previa e peça o ok). Cada grupo vira UMA demanda com checklist. Checklist de uma demanda: atualizar_demanda com checklist_adicionar/marcar/desmarcar/remover (ex.: "marca o passo da fila como feito").
- DEMANDAS DO WHATSAPP: "vê se mandaram mais informação das demandas", "puxa as demandas do grupo", "chegou a base?" → verificar_whatsapp_demandas. Ela marca na tela o que é demanda e o Orion organiza: atualiza a demanda já aberta do mesmo dossiê (checklist + detalhes) ou cria uma, nunca duplica por dossiê.
- GRAVAR REUNIÃO: "grava a reunião", "vou entrar numa entrevista, grava", "começa a gravar o treinamento" → use gravar_reuniao com o tipo certo; a conversa por voz termina e a gravação começa sozinha.
- CADASTROS (projetos, dossiês e clientes): "cria o dossiê X em Clientes", "cadastra o cliente X", "muda o status do cliente", "coloca o roteiro de implantação no cliente", "registra que falei com o cliente", "cria/edita/exclui projeto ou dossiê" → use a ferramenta cadastros e faça na hora. Cliente novo já ganha o dossiê ligado e o roteiro padrão. Excluir pede confirmação. Nunca use pedir_melhoria para isso.
- LISTAS: para "preciso levar/organizar/montar uma lista de…", "checklist…" use a ferramenta lista (ela fica salva na página Listas). Se ela só deu o tema ("vou à praia"), monte você mesmo uma lista completa, agrupada por tema, sem perguntar antes. Se ela citou itens, crie com eles. Sempre passe sugestoes (4 a 6 ideias que ainda não estão) e diga em UMA frase curta duas ou três delas, perguntando se quer incluir. Depois ela vai ajustando ("tira o biquíni", "coloca protetor", "marca a toalha como pronto"): use adicionar, remover, marcar. Sem dizer o nome, a lista é a mais recente. Se ela aceitar sugestões ("coloca todas"), adicione-as.
- EXCLUIR sempre pede confirmação: chame a ferramenta com excluir/acao=excluir, ela devolve precisa_confirmar; pergunte "Quer mesmo excluir …?" e só repita com confirmado=true se ela disser sim.
- Nunca diga que não consegue concluir, editar ou excluir algo: use as ferramentas. Se falhar, diga o motivo real.
- Se ela disser como quer ser chamada, como prefere que você fale ou como começar a conversa, use ajustar_perfil. Quando ela contar algo duradouro sobre si ou pedir "lembra que…", use lembrar; "esquece que…", use esquecer.
- Para "marcar tudo como lido" / "zerar as novas" no WhatsApp use whatsapp_marcar_lidas e explique que é o controle do Orion (não muda o WhatsApp dela).
- WhatsApp (somente leitura, só no app do computador): "o que o grupo X mandou", "tem mensagem no grupo?", "analise as conversas" → use whatsapp_ler (com so_novas=true para o que ainda não foi lido); "alguém me marcou?" → whatsapp_mencoes; "quais conversas têm novidade" → whatsapp_conversas. Primeiro diga se há mensagens e quantas; leia citando quem falou e o que disse (e quem foi marcado, quando houver pessoas_marcadas); se forem muitas, resuma e ofereça ler tudo. Se a ponte estiver desligada, diga isso e que ela liga em Configurações. Você NUNCA envia mensagens no WhatsApp.
- CONVERSA NORMAL: se ela só estiver conversando (cumprimento, "tudo bem?", "como você está", agradecimento, opinião, brincadeira), responda DIRETO e rápido, em uma frase natural, como uma pessoa: sem ferramenta e sem dizer que vai verificar, buscar ou olhar nada. Responda ao que ela perguntou (se ela perguntou como você está, diga como está e devolva a pergunta com naturalidade) e não repita o que ela já disse.
- AVISO ANTES DE DEMORAR: só quando você REALMENTE for usar uma ferramenta que leva alguns segundos (WhatsApp, buscar ou consultar dados, registrar, atualizar), diga UMA frase curta avisando, sem usar o nome dela e sem repetir a mesma sempre. Varie: "Já estou buscando.", "Vou dar uma olhada para você.", "Deixa eu ver isso.", "Estou procurando aqui.", "Já estou abrindo o WhatsApp.", "Estou criando agora." Só depois chame a ferramenta, e na resposta final conte o resultado sem repetir o aviso. Nunca diga "vou verificar" em conversa comum nem em pergunta que você mesmo responde de cabeça. Para abrir uma tela basta "Claro, abrindo."
- O NOME DELA: use no máximo na saudação inicial e, depois, só de vez em quando (no máximo uma vez a cada várias respostas). Nunca em duas respostas seguidas, nunca no aviso antes de demorar e quase nunca em confirmações curtas. Falar o nome toda hora soa artificial.
- Para abrir telas use abrir_pagina. Quando a pessoa se despedir ou pedir para parar, use encerrar_conversa.
- Nunca invente dados: se a ferramenta não trouxer, diga que não encontrou.
${name ? `Você sabe o nome dela (${name}), mas quase nunca precisa dizê-lo: só na saudação e raramente depois.` : ""}`;

/* ───────────── ferramentas ───────────── */
const fn = (name: string, description: string, parameters: Record<string, unknown>) => ({ type: "function", function: { name, description, parameters } });
const schemaOf = (z_: z.ZodType) => { const { $schema: _s, ...rest } = z.toJSONSchema(z_, { target: "draft-2020-12" }) as Record<string, unknown>; return rest; };

export const TOOLS = [
  fn("abrir_pagina", "Abre uma tela do Orion para a pessoa.", { type: "object", properties: {
    pagina: { type: "string", enum: Object.keys(PAGES), description: "inicio, demandas, projetos, tarefas, calendario, planejamento, saude, treino, dieta, habitos, progresso, cerebro (segundo cérebro/Orion), organizar, analise, resumo, ideias" },
    projeto: { type: "string", description: "Só para demandas: nome do projeto, se ela pedir um específico." },
  }, required: ["pagina"] }),
  fn("registrar", "Cria registros reais no Orion (demanda, tarefa, compromisso, lembrete, rotina, anotação). Use os nomes EXATOS de projetos e polos do contexto. Datas em AAAA-MM-DD, horas em HH:MM.", schemaOf(z.object({
    itens: z.array(rascunhoSchema).min(1).max(8),
    permitir_duplicado: z.boolean().optional().describe("true só se a pessoa pediu para criar mesmo já existindo algo igual."),
  }))),
  fn("resumo_do_dia", "Traz o que a pessoa tem para um dia (compromissos, tarefas, atrasadas) e as demandas em andamento. A tela mostra o painel completo.", { type: "object", properties: { quando: { type: "string", description: "hoje, amanha ou AAAA-MM-DD. Padrão: hoje." } } }),
  fn("atualizar_demanda", "Muda, edita ou exclui uma demanda que já existe: coloca em andamento, conclui, reabre, troca título, descrição, prazo ou prioridade, adiciona observação, conclui só um dossiê (demanda para vários) ou exclui. Identifique pelo código (ex.: P049, G042) ou por palavras do título.", { type: "object", properties: {
    demanda: { type: "string", description: "Código (P049, #G042) ou palavras do título." },
    status: { type: "string", enum: ["todo", "doing", "done"], description: "todo = a fazer/reabrir, doing = em andamento, done = concluída." },
    dossie: { type: "string", description: "Só para demanda de vários dossiês: muda o status apenas desse dossiê." },
    titulo: { type: "string" }, descricao: { type: "string" }, prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
    prazo: { type: "string", description: "AAAA-MM-DD ou dd/mm." }, nota: { type: "string", description: "Observação a acrescentar." },
    excluir: { type: "boolean", description: "true para excluir a demanda (pede confirmação)." },
    confirmado: { type: "boolean", description: "true só depois de ela confirmar a exclusão." },
    adicionar_as_tarefas: { type: "boolean", description: "true para colocar a demanda também na lista de Tarefas (categoria Demandas)." },
    checklist_adicionar: { type: "array", items: { type: "string" }, description: "Passos novos para o checklist da demanda." },
    checklist_marcar: { type: "array", items: { type: "string" }, description: "Passos do checklist para marcar como feitos (nomes aproximados; 'todos' marca tudo)." },
    checklist_desmarcar: { type: "array", items: { type: "string" } }, checklist_remover: { type: "array", items: { type: "string" } },
  }, required: ["demanda"] }),
  fn("gerenciar_tarefa", "Conclui, reabre, edita ou exclui uma tarefa, lembrete ou compromisso que já existe (para criar um novo use registrar). Identifique pelo título aproximado.", { type: "object", properties: {
    item: { type: "string", description: "Título (aproximado) do item." },
    tipo: { type: "string", enum: ["tarefa", "lembrete", "compromisso", "qualquer"], description: "Padrão: qualquer." },
    acao: { type: "string", enum: ["concluir", "reabrir", "editar", "excluir"] },
    novo_titulo: { type: "string" }, nova_data: { type: "string", description: "AAAA-MM-DD" }, nova_hora: { type: "string", description: "HH:MM" },
    prioridade: { type: "string", enum: ["alta", "media", "baixa"] }, local: { type: "string" },
    confirmado: { type: "boolean", description: "true só depois de ela confirmar a exclusão." },
  }, required: ["item", "acao"] }),
  fn("acerto", "ACERTO DE CONTAS entre ela e outra pessoa (compras no cartão de um e do outro, contas da casa, pix já feitos) e o valor final. Ações: listar, ver (um acerto), extrato (texto pronto para mandar), criar (pessoa), lancar (compras: `itens` com descricao, valor, data, no_cartao_de 'eu'|'outro', parte_da_outra em % e parcela), contas_da_casa (contas CHEIAS em `itens` + quem_pagou + divisao_da_pessoa em %), pix (quem_pagou + valor), editar (item + o que mudar), excluir (item; pede confirmação), divisao_padrao (valor %), quitar, reabrir, excluir_acerto (pede confirmação). parte_da_outra = % do valor que é DA OUTRA PESSOA (100 = toda dela(e), 50 = dividida, 0 = toda dela mesma). Tudo o que ela faz na tela você faz aqui.", { type: "object", properties: {
    acao: { type: "string", enum: ["listar", "ver", "extrato", "criar", "lancar", "contas_da_casa", "pix", "editar", "excluir", "divisao_padrao", "quitar", "reabrir", "excluir_acerto"] },
    pessoa: { type: "string", description: "Com quem é o acerto. Sem nome, usa o único acerto aberto." },
    itens: { type: "array", items: { type: "object", properties: { descricao: { type: "string" }, valor: { type: "number", description: "Valor cheio da compra/conta em reais." }, data: { type: "string", description: "AAAA-MM-DD" }, no_cartao_de: { type: "string", enum: ["eu", "outro"], description: "De quem é o cartão em que foi pago." }, parte_da_outra: { type: "number", description: "% do valor que é DA OUTRA PESSOA (0–100)." }, parcela: { type: "string", description: "Ex.: 2/5" } }, required: ["descricao", "valor"] }, description: "Linhas a lançar (lancar e contas_da_casa)." },
    quem_pagou: { type: "string", enum: ["eu", "outro"], description: "contas_da_casa: quem pagou as contas cheias. pix: quem fez o pix." },
    divisao_da_pessoa: { type: "number", description: "contas_da_casa: % que fica com a outra pessoa (padrão: a divisão padrão do acerto, ou 50)." },
    valor: { type: "number", description: "pix: valor. editar: novo valor. divisao_padrao: % da outra pessoa." }, data: { type: "string" }, descricao: { type: "string", description: "editar: nova descrição. pix: observação." },
    item: { type: "string", description: "editar/excluir: descrição (aproximada) do lançamento." }, no_cartao_de: { type: "string", enum: ["eu", "outro"] }, parte_da_outra: { type: "number" }, parcela: { type: "string" }, divisao_padrao: { type: "number", description: "criar: divisão padrão das contas da casa (% da outra pessoa)." },
    confirmado: { type: "boolean", description: "true SÓ depois que ela confirmar uma exclusão." },
  }, required: ["acao"] }),
  fn("analise_corporal", "Evolução do CORPO da pessoa (Saúde → Análise): peso, cintura, gordura, massa magra, pontuação, indicadores, ritmo e metas. Ações: resumo (padrão; `periodo` opcional: 'mês', '3 meses', '6 meses', 'ano', 'tudo'), meta (define a meta de peso ou de cintura; sem `valor` só mostra as metas), gordura (registra o % de gordura medido, na última medição), medida (registra o peso e/ou medidas de hoje: peso em kg; cintura, abdomen, quadril, peito, braco, gluteo, coxa em cm; data opcional AAAA-MM-DD). 'Pesei 68,5' ou 'minha cintura está 82' → medida.", { type: "object", properties: {
    acao: { type: "string", enum: ["resumo", "meta", "gordura", "medida"] },
    peso: { type: "number" }, cintura: { type: "number" }, abdomen: { type: "number" }, quadril: { type: "number" }, peito: { type: "number" }, braco: { type: "number" }, gluteo: { type: "number" }, coxa: { type: "number" }, data: { type: "string" },
    periodo: { type: "string", description: "Período do resumo, em palavras." },
    tipo: { type: "string", enum: ["peso", "cintura"], description: "Qual meta (acao meta)." },
    valor: { type: "number", description: "Meta em kg/cm (acao meta) ou % de gordura medido (acao gordura)." },
  }, required: ["acao"] }),
  fn("ideias", "CAIXA DE IDEIAS da pessoa (Projetos e ideias). Ações: guardar (titulo + texto; area 'pessoal' ou 'negocios'; referencia=true para print/link de inspiração), listar (status opcional), resumo (quantas há e quais estão paradas há mais de 30 dias), estado (item + status: solta, explorando, validando, fazendo, arquivada), desenvolver (item: monta perguntas que faltam, riscos, primeiros passos e o que precisa; são estimativas), virar (item + tipo: projeto, tarefa, lembrete com data/hora, ou documentacao), orcamento (item da ideia; sem `compra` só mostra a lista e o total; com `compra` + valor/link/quantidade/status adiciona ou atualiza um item de compra, e item que já tem não entra na soma), excluir (pede confirmação).", { type: "object", properties: {
    acao: { type: "string", enum: ["guardar", "listar", "resumo", "estado", "desenvolver", "virar", "orcamento", "excluir"] },
    compra: { type: "string", description: "orcamento: nome do item de compra." }, valor: { type: "number", description: "orcamento: preço de UMA unidade em reais." }, quantidade: { type: "number" }, link: { type: "string" },
    titulo: { type: "string" }, texto: { type: "string", description: "Detalhes da ideia." }, area: { type: "string", enum: ["pessoal", "negocios"] }, referencia: { type: "boolean" },
    item: { type: "string", description: "Nome (aproximado) da ideia existente." }, status: { type: "string" }, tipo: { type: "string", enum: ["projeto", "tarefa", "lembrete", "documentacao"] },
    data: { type: "string", description: "lembrete: AAAA-MM-DD." }, hora: { type: "string" }, confirmado: { type: "boolean", description: "true SÓ depois do sim a uma exclusão." },
  }, required: ["acao"] }),
  fn("planejamento", "Vê e ajusta o PLANO DO DIA real da pessoa. Ações: ver (plano salvo ou prévia de hoje/amanhã/data), gerar (monta o plano com os dados reais), adicionar (titulo + hora + duracao_min), mover (titulo + hora nova), concluir, adiar (passa para o dia seguinte), remover (pede confirmação), fontes (lista ou liga/desliga uma fonte: calendário, tarefas, hábitos, saúde, financeiro, demandas, rotina), aprendizado (o que o Orion percebeu do ritmo dela).", { type: "object", properties: {
    acao: { type: "string", enum: ["ver", "gerar", "adicionar", "mover", "concluir", "adiar", "remover", "fontes", "aprendizado"] },
    data: { type: "string", description: "'hoje' (padrão), 'amanhã', dia da semana ou AAAA-MM-DD." },
    titulo: { type: "string", description: "Nome (aproximado) da atividade." }, hora: { type: "string", description: "HH:MM (24h)." }, duracao_min: { type: "number" },
    disposicao: { type: "string", enum: ["alta", "normal", "baixa"] }, tempo: { type: "string", enum: ["completo", "manha", "tarde", "pouco"] }, prioridade: { type: "string" }, pausas: { type: "boolean" },
    fonte: { type: "string", description: "Fonte do plano (acao fontes)." }, ligada: { type: "boolean", description: "Ligar (true) ou desligar (false) a fonte." },
    confirmado: { type: "boolean", description: "true só depois de ela confirmar a remoção." },
  }, required: ["acao"] }),
  fn("financeiro", "Consulta o FINANCEIRO real da pessoa (contas, cartões, parcelas, assinaturas) e lança gastos/ganhos. Ações: resumo (saldo, o que entrou e saiu, o que falta pagar, alertas), detalhe (POR QUE sobra ou falta dinheiro: a conta completa com faturas), meses (projeção dos PRÓXIMOS MESES: quanto entra, sai, sobra e o saldo de cada mês; use `quantidade`), simular (E SE EU COMPRAR: valor + cartao + mes em que a fatura FECHA + parcelas_total; mostra a fatura antes e depois, quanto sobra do dinheiro daquele mês e o saldo no fim; NÃO grava nada), categorias (onde gastou), saldo (por conta), fatura (cartão), parcelas, assinaturas, ultimos (movimentações, com busca opcional), lancar (grava uma despesa/receita a partir de uma frase), fixas (contas fixas), parcela_detalhe (parcela por parcela de uma compra), metas, abrir (abre uma aba: aba=meses…), pausar/reativar (assinatura ou fixa), fatura_total (informa o total do banco numa fatura), detalhar (cadastra uma compra, parcela ou assinatura DENTRO de uma fatura sem mudar o total), cadastrar_parcelada, cadastrar_fixa, dividir (divide uma compra, parcelada ou conta fixa com outra pessoa: a parte dela vira receita a receber), editar (valor, nome, dia, data, saldo de conta, limite de cartão, meta) e excluir (pede confirmação).", { type: "object", properties: {
    acao: { type: "string", enum: ["resumo", "detalhe", "meses", "simular", "categorias", "saldo", "fatura", "parcelas", "assinaturas", "ultimos", "lancar", "fixas", "parcela_detalhe", "metas", "abrir", "pausar", "reativar", "fatura_total", "detalhar", "dividir", "editar", "excluir", "cadastrar_parcelada", "cadastrar_fixa"] },
    mes: { type: "string", description: "Mês (na acao fatura é o mês de FECHAMENTO: a fatura \"de novembro\" fecha em novembro; sem mês = fatura aberta): 'dezembro', 'mês passado' ou AAAA-MM. Vazio = mês atual." },
    conta: { type: "string", description: "Nome da conta (acao saldo)." }, cartao: { type: "string", description: "Nome do cartão (acao fatura)." },
    busca: { type: "string", description: "Texto ou categoria para filtrar (acao ultimos)." }, quantidade: { type: "number" },
    alvo: { type: "string", description: "Nome (aproximado) do item a pausar, reativar, editar, excluir ou ver em detalhe (a Netflix, o notebook, a conta Nubank…)." },
    tipo_alvo: { type: "string", enum: ["movimentacao", "fixa", "assinatura", "parcelada", "conta", "cartao", "meta"], description: "Que tipo de item é o alvo (ajuda a desempatar nomes iguais)." },
    valor: { type: "number", description: "Valor em reais: total da fatura (fatura_total), parcela (detalhar/cadastrar_parcelada), valor mensal (cadastrar_fixa), novo valor ou novo saldo/guardado (editar)." },
    descricao: { type: "string", description: "Descrição ou novo nome (detalhar, cadastrar_*, editar)." },
    parcelas_total: { type: "number" }, parcela_atual: { type: "number", description: "Qual parcela está na fatura (detalhar)." }, parcelas_pagas: { type: "number", description: "Quantas parcelas já pagou (cadastrar_parcelada)." },
    forma: { type: "string", description: "detalhar: parcelada | avista | assinatura. cadastrar_fixa: despesa | receita | assinatura." },
    dia: { type: "number", description: "Dia do mês da cobrança (1 a 31)." }, data: { type: "string", description: "AAAA-MM-DD (editar movimentação)." }, categoria: { type: "string" },
    disponivel: { type: "number", description: "Limite disponível certo do cartão (editar cartão)." }, limite: { type: "number" }, fechamento: { type: "number" }, vencimento: { type: "number" }, pagamento: { type: "string", enum: ["fechamento", "vencimento"], description: "editar cartão: quando ela PAGA a fatura (no fechamento ou no vencimento)." }, dias_apos_fechamento: { type: "number", description: "editar cartão com pagamento=fechamento: quantos dias depois de fechar ela paga (0 a 10; padrão 1)." }, objetivo: { type: "number" },
    aba: { type: "string", description: "Aba a abrir (acao abrir): visao, contas, parcelas, meses, movimentacoes, assinaturas ou metas." },
    valor_atual: { type: "number", description: "Valor do lançamento, para desempatar quando há vários com o mesmo nome." }, data_atual: { type: "string" },
    confirmado: { type: "boolean", description: "true SÓ depois que ela confirmar uma exclusão." },
    dividir_com: { type: "string", description: "Nome da pessoa com quem a compra/parcelada/fixa é DIVIDIDA (lancar, cadastrar_parcelada, cadastrar_fixa, detalhar). O total do banco não muda; a parte da pessoa entra como receita a receber." },
    percentual_dela: { type: "number", description: "Quantos % do valor ficam com a outra pessoa (padrão 50)." }, pessoa: { type: "string", description: "acao dividir: nome da pessoa; vazio ou 'remover' tira a divisão." },
    frase: { type: "string", description: "A frase dela, como falou (acao lancar). Ex.: 'gastei 50 no mercado no débito pelo Nubank'." },
  }, required: ["acao"] }),
  fn("cadastros", "Cria, edita, exclui e lista PROJETOS, DOSSIÊS (polos) e CLIENTES, igual às telas Projetos, Demandas e Clientes. Para 'cria o dossiê X em Clientes' use entidade cliente (o dossiê é criado junto e ligado). Entidade projeto: criar (nome, descricao, prazo), editar (alvo, novo_nome, descricao, prazo, status Ativo/Planejando/Pausado), excluir, listar. Entidade dossie: criar/editar/excluir/listar dentro de um projeto (sem projeto = Demandas gerais). Entidade cliente: criar (nome + segmento, contato, email, telefone, plano, valor_mensal, status), editar (alvo + campos), registrar_contato (alvo + texto), aplicar_roteiro (alvo: coloca o roteiro padrão de implantação), excluir, listar. EXCLUIR sempre pede confirmação (precisa_confirmar).", { type: "object", properties: {
    entidade: { type: "string", enum: ["projeto", "dossie", "cliente"] },
    acao: { type: "string", enum: ["criar", "editar", "excluir", "listar", "registrar_contato", "aplicar_roteiro"] },
    nome: { type: "string" }, alvo: { type: "string", description: "Nome aproximado do item existente (editar/excluir/registrar_contato/aplicar_roteiro)." }, novo_nome: { type: "string" },
    projeto: { type: "string", description: "Projeto onde está o dossiê ou cliente; vazio = Demandas gerais." },
    descricao: { type: "string" }, prazo: { type: "string", description: "AAAA-MM-DD" }, status: { type: "string" },
    segmento: { type: "string" }, contato: { type: "string" }, email: { type: "string" }, telefone: { type: "string" }, plano: { type: "string" }, valor_mensal: { type: "number" }, observacoes: { type: "string" },
    texto: { type: "string", description: "registrar_contato: o que aconteceu." }, data: { type: "string", description: "AAAA-MM-DD, opcional." },
    com_roteiro: { type: "boolean", description: "cliente criar: false para não aplicar o roteiro padrão (padrão: aplica)." },
    confirmado: { type: "boolean", description: "true só depois de ela confirmar a exclusão." },
  }, required: ["entidade", "acao"] }),
  fn("gravar_reuniao", "COMEÇA a gravar uma reunião, entrevista, treinamento ou conversa livre: abre a página de Reuniões e a gravação começa sozinha assim que esta conversa por voz termina (para não gravar a sua fala). Diga em uma frase: 'Abrindo as reuniões, a gravação começa já. Quando acabar, toque em finalizar que eu organizo tudo.' Não dá para parar a gravação por voz: ela termina no botão Finalizar.", { type: "object", properties: {
    tipo: { type: "string", enum: ["reuniao", "entrevista", "treinamento", "livre"], description: "Padrão: reuniao." },
  } }),
  fn("habitos", "HÁBITOS da pessoa (tela Hábitos): listar com a sequência de dias, criar, marcar como feito (hoje ou outro dia), desmarcar, renomear e arquivar. Ações: listar, criar (nome), marcar/desmarcar (alvo, data opcional AAAA-MM-DD), renomear (alvo, novo_nome), arquivar (alvo; pede confirmação).", { type: "object", properties: {
    acao: { type: "string", enum: ["listar", "criar", "marcar", "desmarcar", "renomear", "arquivar"] }, nome: { type: "string" }, alvo: { type: "string" }, novo_nome: { type: "string" },
    data: { type: "string" }, confirmado: { type: "boolean" },
  }, required: ["acao"] }),
  fn("treino", "FICHAS DE TREINO (Saúde → Treino): listar, ver, criar, editar, excluir, divisão da semana e meta semanal. Ações: listar; ver (alvo); criar (nome, duracao_min, musculos, exercicios [{nome, musculo, series_reps '3 x 12', descanso_s}]) — monte você mesmo exercícios bons quando ela só disser o foco; editar (alvo + novo_nome, duracao_min, musculos, adicionar [exercícios], remover [nomes], alterar [{alvo, series_reps, descanso_s, musculo}]); excluir (alvo; pede confirmação); semana (mostra a divisão); definir_dia (dia 'segunda'…, alvo = ficha ou 'livre'); meta_semanal (valor 1 a 14).", { type: "object", properties: {
    acao: { type: "string", enum: ["listar", "ver", "criar", "editar", "excluir", "semana", "definir_dia", "meta_semanal"] }, nome: { type: "string" }, alvo: { type: "string" }, novo_nome: { type: "string" },
    duracao_min: { type: "number" }, musculos: { type: "array", items: { type: "string" } }, dia: { type: "string" }, valor: { type: "number" }, titulo: { type: "string" },
    exercicios: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, musculo: { type: "string" }, series_reps: { type: "string" }, descanso_s: { type: "number" } }, required: ["nome"] } },
    adicionar: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, musculo: { type: "string" }, series_reps: { type: "string" }, descanso_s: { type: "number" } }, required: ["nome"] } },
    remover: { type: "array", items: { type: "string" } },
    alterar: { type: "array", items: { type: "object", properties: { alvo: { type: "string" }, series_reps: { type: "string" }, descanso_s: { type: "number" }, musculo: { type: "string" } }, required: ["alvo"] } },
    confirmado: { type: "boolean" },
  }, required: ["acao"] }),
  fn("dieta", "DIETA do dia (Saúde → Dieta): ver o plano de hoje, marcar/desmarcar refeições feitas, registrar água, escolher a opção do dia e mudar as metas. Ações: hoje; marcar_refeicao / desmarcar_refeicao (alvo = nome da refeição ou 'todas'); agua (ml, pode ser negativo para corrigir); escolher_opcao (alvo = nome da opção); metas (kcal, proteina_g, carbo_g, gordura_g; sem valores só mostra).", { type: "object", properties: {
    acao: { type: "string", enum: ["hoje", "marcar_refeicao", "desmarcar_refeicao", "agua", "escolher_opcao", "metas"] }, alvo: { type: "string" }, ml: { type: "number" },
    kcal: { type: "number" }, proteina_g: { type: "number" }, carbo_g: { type: "number" }, gordura_g: { type: "number" },
  }, required: ["acao"] }),
  fn("juntar_demandas", "JUNTA demandas do MESMO dossiê/polo (as 'por dossiê' ainda abertas) numa demanda só, com um CHECKLIST dos passos para ela ir riscando. Ex.: 'junta as demandas de Lauro', 'junte as que são do mesmo polo'. Ações: previa (só mostra os grupos que dá para juntar) e juntar (executa). Com dossie citado, juntar executa na hora; sem dossie, pede confirmação (precisa_confirmar) antes. Opcional: titulo da demanda nova, projeto. As demandas absorvidas ficam dentro da nova (texto, histórico, observações e anexos).", { type: "object", properties: {
    acao: { type: "string", enum: ["previa", "juntar"] }, dossie: { type: "string", description: "Nome do dossiê/polo (ex.: Lauro de Freitas, Maceió); vazio = todos." }, projeto: { type: "string" }, titulo: { type: "string" }, confirmado: { type: "boolean" },
  }, required: ["acao"] }),
  fn("verificar_whatsapp_demandas", "VERIFICA o WhatsApp (grupos e conversas) atrás de pedidos novos e de INFORMAÇÕES NOVAS sobre as demandas já criadas (base, template, data, arquivo). Abre a tela de Demandas do WhatsApp e a leitura começa sozinha; ela marca o que é demanda e toca em 'Organizar nas demandas': o que já tem demanda do mesmo dossiê só é atualizado (passos no checklist e tudo detalhado nas observações); se não existe, cria. Use em 'vê no WhatsApp se mandaram mais alguma coisa', 'puxa as demandas do grupo', 'chegou a base de Maceió?'. Diga em uma frase que está lendo e que ela escolhe na tela o que é demanda.", { type: "object", properties: {} }),
  fn("lista", "Cria e ajusta LISTAS/CHECKLISTS salvas (o que levar para a praia, compras, preparar uma viagem, passos de algo). Ações: criar (com titulo e itens agrupados), adicionar, remover, marcar (feito), desmarcar, mostrar, listar, renomear, excluir. Em criar/adicionar/mostrar passe sempre `sugestoes` com 4 a 6 ideias úteis que ainda NÃO estão na lista. Quando ela pedir uma lista sem dizer os itens, monte você mesmo uma lista completa e bem pensada, agrupada por tema.", { type: "object", properties: {
    acao: { type: "string", enum: ["criar", "adicionar", "remover", "marcar", "desmarcar", "mostrar", "listar", "renomear", "excluir"] },
    lista: { type: "string", description: "Nome (aproximado) da lista. Vazio = a lista mais recente." },
    titulo: { type: "string", description: "Nome da lista (criar) ou novo nome (renomear)." },
    itens: { type: "array", items: { type: "object", properties: { texto: { type: "string" }, grupo: { type: "string", description: "Tema curto: Roupas, Comida, Documentos…" } }, required: ["texto"] }, description: "Itens a criar/adicionar." },
    itens_alvo: { type: "array", items: { type: "string" }, description: "Nomes (aproximados) dos itens a remover, marcar ou desmarcar." },
    todos: { type: "boolean", description: "true para marcar/desmarcar/remover todos os itens." },
    sugestoes: { type: "array", items: { type: "string" }, description: "Ideias do que mais incluir, que ainda não estão na lista." },
    confirmado: { type: "boolean", description: "true só depois de ela confirmar excluir a lista ou remover todos." },
  }, required: ["acao"] }),
  fn("roteiro", "Cria e edita ROTEIROS DE TREINAMENTO (Documentação → Treinamentos) do projeto: criar roteiro com blocos, adicionar bloco, editar bloco (título, duração, o que mostrar, dica, o que falar, por quês, perguntas frequentes), tirar bloco ou passo, mudar título/público/objetivo, mostrar ou listar roteiros, excluir. Identifique roteiro e bloco pelo nome aproximado. Quando ela pedir 'coloca mais coisas no roteiro' ou 'cria um bloco sobre X', escreva você mesmo o conteúdo completo e útil (passos objetivos, dica, perguntas frequentes) em português e use adicionar_bloco ou editar_bloco.", { type: "object", properties: {
    acao: { type: "string", enum: ["listar", "mostrar", "criar", "editar", "adicionar_bloco", "editar_bloco", "remover_bloco", "excluir"] },
    roteiro: { type: "string", description: "Título (aproximado) do roteiro." },
    projeto: { type: "string", description: "Nome do projeto (só se ela citar ou houver mais de um)." },
    titulo: { type: "string", description: "Título do roteiro novo, ou do bloco novo em adicionar_bloco." },
    publico: { type: "string" }, objetivo: { type: "string" },
    blocos: { type: "array", description: "Blocos a criar (criar ou adicionar_bloco).", items: { type: "object", properties: {
      titulo: { type: "string" }, minutos: { type: "number" }, mostrar: { type: "array", items: { type: "string" }, description: "Passos de 'o que mostrar'." },
      dica: { type: "string" }, falar: { type: "string", description: "Texto para o apresentador falar." }, porque: { type: "array", items: { type: "string" } },
      perguntas: { type: "array", items: { type: "object", properties: { pergunta: { type: "string" }, resposta: { type: "string" } }, required: ["pergunta", "resposta"] } },
    }, required: ["titulo"] } },
    bloco: { type: "string", description: "Título (aproximado) do bloco a editar ou tirar." },
    depois_de: { type: "string", description: "Em adicionar_bloco: título do bloco depois do qual entra." },
    novo_titulo: { type: "string", description: "Novo título (do roteiro em editar, do bloco em editar_bloco)." },
    minutos: { type: "number" }, dica: { type: "string" }, falar: { type: "string" },
    mostrar_incluir: { type: "array", items: { type: "string" }, description: "Passos a acrescentar em 'o que mostrar'." },
    mostrar_tirar: { type: "array", items: { type: "string" }, description: "Passos (aproximados) a tirar." },
    porque_incluir: { type: "array", items: { type: "string" } },
    perguntas_incluir: { type: "array", items: { type: "object", properties: { pergunta: { type: "string" }, resposta: { type: "string" } }, required: ["pergunta", "resposta"] } },
    confirmado: { type: "boolean", description: "true só depois de ela confirmar excluir roteiro ou tirar bloco." },
  }, required: ["acao"] }),
  fn("pedir_melhoria", "Use quando a pessoa pedir algo que você NÃO consegue fazer com as ferramentas que tem (uma função nova, editar algo que não é possível, um recurso que não existe, ou uma ferramenta que falhou por falta de capacidade). Monta um pedido para o Claude implementar: a pessoa confere, corrige e confirma na tela antes de enviar. Só envia depois da confirmação dela. acao=pedir cria o pedido; acao=listar mostra os pedidos e o andamento.", { type: "object", properties: {
    acao: { type: "string", enum: ["pedir", "listar"], description: "Padrão: pedir." },
    titulo: { type: "string", description: "Título curto do que precisa ser feito (ex.: Editar blocos de roteiros por voz)." },
    pedido: { type: "string", description: "O que a pessoa pediu, nas palavras dela." },
    detalhes: { type: "string", description: "Como entendeu que deve ficar: escopo, passos e o resultado esperado, claros o bastante para o Claude implementar sem perguntar de novo." },
    area: { type: "string", description: "Tela ou área do sistema envolvida (ex.: Treinamentos, Tarefas, WhatsApp)." },
  }, required: [] }),
  fn("buscar_no_orion", "Pesquisa em TUDO que o Orion sabe: segundo cérebro (anotações e documentações), a Documentação (Biblioteca de documentos e pastas), clientes, reuniões, demandas, tarefas, roteiros, conversas, memórias, saúde, treino, dieta, finanças e ideias. Devolve os trechos mais relevantes, cada um com um `id`. Para ler um item inteiro (documento longo, ata completa) chame ler_documento com esse id. Use SEMPRE que ela perguntar sobre algo que ela documentou, anotou, combinou ou guardou, antes de dizer que não sabe.", { type: "object", properties: { pergunta: { type: "string", description: "A pergunta ou os assuntos, com os nomes importantes (cliente, projeto, pessoa)." } }, required: ["pergunta"] }),
  fn("ler_documento", "Lê o texto COMPLETO de um item achado em buscar_no_orion (documento da Documentação, anotação, ata de reunião, ficha de cliente, demanda). Passe o id exato do resultado da busca.", { type: "object", properties: { id: { type: "string" } }, required: ["id"] }),
  fn("consultar_registros", "Lista e conta, com datas, o que a pessoa criou, concluiu ou documentou: demandas, tarefas/compromissos/lembretes e anotações do segundo cérebro. Use para 'o que fiz ontem', 'quais demandas concluí esta semana', 'quantas tarefas criei', 'o que documentei'. A tela mostra o painel completo.", { type: "object", properties: {
    assunto: { type: "string", enum: ["tudo", "demandas", "tarefas", "anotacoes"], description: "Padrão: tudo." },
    situacao: { type: "string", enum: ["concluidas", "criadas", "abertas", "todas"], description: "concluidas = finalizadas; criadas = registradas no período; abertas = ainda pendentes. Padrão: todas." },
    periodo: { type: "string", description: "hoje, ontem, anteontem, esta semana, semana passada, este mes, mes passado. Vazio = sem limite de data." },
    de: { type: "string", description: "AAAA-MM-DD (opcional, no lugar de periodo)." }, ate: { type: "string", description: "AAAA-MM-DD (opcional)." },
    texto: { type: "string", description: "Filtra por palavra no título/projeto/polo (opcional)." },
  } }),
  fn("documentar", "DOCUMENTA no segundo cérebro (Orion): guarda anotações, ocorrências, decisões, combinados, resumos, aprendizados, qualquer coisa que ela pedir para documentar, com a data do acontecimento. Escreva um texto COMPLETO e organizado (pode ser longo), sem perder detalhes que ela falou; dê um titulo curto. Se citar projeto ou dossiês/clientes, passe em projeto e dossies. Para documento estruturado (tutorial, processo, passo a passo) numa pasta da Documentação, use a ferramenta documentacao. Nunca guarde senhas.", { type: "object", properties: { texto: { type: "string" }, titulo: { type: "string", description: "Título curto (até 80 caracteres)." }, data: { type: "string", description: "AAAA-MM-DD; padrão hoje." }, projeto: { type: "string" }, dossies: { type: "array", items: { type: "string" }, description: "Nomes de dossiês/clientes citados." } }, required: ["texto"] }),
  fn("documentacao", "A DOCUMENTAÇÃO (Biblioteca de documentos e pastas, tela Documentação): listar pastas e documentos, ler, CRIAR documento estruturado (tutorial, processo, guia, checklist, manual), editar, mover entre pastas, excluir, criar e excluir pasta. Para criar: titulo, descricao (texto completo), tipo (Tutorial/Processo/Guia/Checklist/Manual/Documento), regras [], passos [], pasta (nome; padrão Documentos Gerais). Para editar: alvo + novo_titulo/descricao/acrescentar/regras/passos/adicionar_passos/tipo. Excluir pede confirmação. NUNCA guarde senhas ou chaves.", { type: "object", properties: {
    acao: { type: "string", enum: ["listar", "ler", "criar", "editar", "mover", "excluir", "criar_pasta", "excluir_pasta"] }, titulo: { type: "string" }, alvo: { type: "string" }, novo_titulo: { type: "string" }, descricao: { type: "string" }, acrescentar: { type: "string" },
    tipo: { type: "string", enum: ["Tutorial", "Processo", "Guia", "Checklist", "Manual", "Documento"] }, pasta: { type: "string" }, nome: { type: "string" },
    regras: { type: "array", items: { type: "string" } }, passos: { type: "array", items: { type: "string" } }, adicionar_passos: { type: "array", items: { type: "string" } }, confirmado: { type: "boolean" },
  }, required: ["acao"] }),
  fn("lembrar", "Guarda na memória algo DURADOURO sobre a pessoa (preferência, rotina, regra, fato do trabalho, pessoa importante) para lembrar nas próximas conversas. Não use para pedidos do momento.", { type: "object", properties: {
    texto: { type: "string", description: "A informação, em uma frase clara, na 3ª pessoa. Ex.: Prefere resumos curtos pela manhã." },
    tipo: { type: "string", enum: MEMORY_KINDS, description: "aprendizado, preferencia, rotina, pessoa ou regra." },
  }, required: ["texto"] }),
  fn("esquecer", "Apaga da memória o que combina com um trecho, quando a pessoa pedir para você esquecer algo.", { type: "object", properties: { sobre: { type: "string", description: "Palavra ou trecho do que deve ser esquecido." } }, required: ["sobre"] }),
  fn("ajustar_perfil", "Muda como a pessoa quer ser chamada, o jeito de você conversar ou como começar a conversa (quando ela pedir).", { type: "object", properties: {
    nome: { type: "string", description: "Como chamá-la." }, jeito: { type: "string", description: "Tom e jeito de conversar, em uma frase." },
    saudacao: { type: "string", enum: ["esperar", "saudacao", "saudacao_hoje", "saudacao_pergunta"], description: "Como iniciar a conversa." },
  } }),
  fn("whatsapp_conversas", "Lista as conversas e grupos do WhatsApp da pessoa, com quantas mensagens novas há em cada (novas = ainda não lidas por você). Só funciona no app do computador, com a ponte do WhatsApp ligada.", { type: "object", properties: { busca: { type: "string", description: "Parte do nome de um grupo ou contato (opcional)." } } }),
  fn("whatsapp_ler", "Lê as mensagens de uma conversa ou grupo do WhatsApp (somente leitura). Use para 'o que o grupo X mandou', 'tem mensagem no grupo?', 'analise as conversas'. Com so_novas=true traz só o que ainda não foi lido por você e marca como lido AQUI (não muda nada no WhatsApp dela).", { type: "object", properties: {
    conversa: { type: "string", description: "Nome (aproximado) do grupo ou contato." },
    desde: { type: "string", description: "hoje, ontem, esta semana ou AAAA-MM-DD (opcional)." },
    so_novas: { type: "boolean", description: "true = só as mensagens novas desde a última leitura." },
    buscar: { type: "string", description: "Palavra a procurar nas mensagens (opcional)." },
    limite: { type: "number", description: "Quantas mensagens trazer (padrão 30, máximo 60)." },
  }, required: ["conversa"] }),
  fn("whatsapp_mencoes", "Mostra as mensagens em que alguém marcou a pessoa ou respondeu a uma mensagem dela no WhatsApp.", { type: "object", properties: { desde: { type: "string", description: "hoje, ontem, esta semana ou AAAA-MM-DD. Padrão: últimas 24 horas." } } }),
  fn("whatsapp_marcar_lidas", "Marca como lidas PELO ORION todas as conversas (ou só uma) do WhatsApp, para que 'mensagens novas' passe a contar só o que chegar daqui para frente. Não muda nada no WhatsApp da pessoa (as mensagens continuam como estão no celular).", { type: "object", properties: { conversa: { type: "string", description: "Nome de uma conversa/grupo. Vazio = todas." } } }),
  fn("encerrar_conversa", "Encerra a conversa por voz quando a pessoa se despedir ou pedir para parar.", { type: "object", properties: {} }),
];

type Emit = (e: VoiceEvent) => void;

const parseArgs = (s: string): Record<string, unknown> => { try { const v = JSON.parse(s || "{}"); return v && typeof v === "object" ? (v as Record<string, unknown>) : {}; } catch { return {}; } };
const resolveDay = (q: unknown, today: string) => {
  const s = String(q ?? "hoje").toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(`${today}T12:00:00Z`);
  if (/amanh/.test(s)) d.setUTCDate(d.getUTCDate() + 1);
  else if (/ontem/.test(s)) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const ptDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : undefined);

export async function runTool(name: string, args: Record<string, unknown>, emit: Emit, ctx: Context): Promise<unknown> {
  switch (name) {
    case "abrir_pagina": {
      const base = PAGES[String(args["pagina"])];
      if (!base) return { ok: false, erro: "Página desconhecida." };
      let to = base;
      if (args["pagina"] === "demandas" && args["projeto"]) {
        try { to = `/demandas?projeto=${encodeURIComponent((await resolveProject(String(args["projeto"]))).id)}`; }
        catch (e) { return { ok: false, erro: e instanceof Error ? e.message : "Projeto não encontrado." }; }
      }
      emit({ t: "acao", a: { tipo: "navegar", para: to } });
      return { ok: true, aberta: String(args["pagina"]) };
    }

    case "encerrar_conversa": emit({ t: "acao", a: { tipo: "encerrar" } }); return { ok: true };

    case "registrar": {
      const raw = Array.isArray(args["itens"]) ? (args["itens"] as unknown[]) : [];
      const valid: Registro[] = [], problems: string[] = [];
      raw.forEach((r, i) => {
        const p = registroSchema.safeParse({ ...(r as object), ...(args["permitir_duplicado"] ? { permitir_duplicado: true } : {}) });
        if (p.success) valid.push(p.data); else problems.push(`item ${i + 1}: ${p.error.issues.map((x) => `${x.path.join(".") || "registro"}: ${x.message}`).join("; ")}`);
      });
      if (problems.length || !valid.length) return { ok: false, faltando: problems.length ? problems : ["nada para registrar"], dica: "Pergunte à pessoa o que falta, em uma frase." };
      const prep = await prepare(valid);
      if (prep.problems.length) return { ok: false, faltando: prep.problems.slice(0, 5), dica: "Pergunte à pessoa o que falta ou qual opção, em uma frase." };
      const active = prep.resolved.filter((r) => !r._ignorar);
      if (!active.length) return { ok: false, duplicado: prep.resolved.map((r) => r._duplicado).filter(Boolean), dica: "Já existe algo equivalente. Pergunte se ela quer criar mesmo assim (então chame registrar de novo com permitir_duplicado=true)." };
      const r = await commitRecords(prep.resolved, { client: "Orion · Voz", summary: prep.summary });
      if (r.status === "erro") return { ok: false, erro: r.failed.join(" | ") };
      const link = (tipo: string, pid?: string) => (tipo === "demanda" || tipo === "anotacao" ? `/demandas${pid ? `?projeto=${encodeURIComponent(pid)}` : ""}` : tipo === "compromisso" ? "/calendario" : "/tarefas");
      emit({ t: "painel", p: { titulo: "Registrado", secoes: [{ titulo: `${r.created.length} item(ns) criado(s)`, itens: r.created.map((c) => ({ rotulo: c.rotulo, detalhe: c.modulo, link: link(c.tipo, c.projeto_id) })) }] } });
      return { ok: true, criados: r.created.map((c) => ({ tipo: TIPO_LABEL[c.tipo as keyof typeof TIPO_LABEL] ?? c.tipo, titulo: c.rotulo })), ignorados_por_duplicidade: r.skipped, falhas: r.failed };
    }

    case "resumo_do_dia": {
      const day = resolveDay(args["quando"], ctx.today);
      const [tasks, dem, cats] = await Promise.all([
        supabase.from("tasks").select("id, title, due_date, due_time, end_time, place, done, kind, priority").or(`due_date.eq.${day}${day === ctx.today ? `,and(due_date.lt.${day},done.eq.false)` : ""}`).order("due_time", { nullsFirst: true }).limit(60),
        supabase.from("project_demands").select("code, title, status, priority, dossier_name, project_id").neq("status", "done").order("updated_at", { ascending: false }).limit(60),
        listCategories(),
      ]);
      void cats;
      const t = must(tasks) as { id: string; title: string; due_date: string; due_time: string | null; end_time: string | null; place: string | null; done: boolean; kind: string; priority: string }[];
      const d = must(dem) as { code: string; title: string; status: string; priority: string; dossier_name: string | null; project_id: string }[];
      const hoje = t.filter((x) => x.due_date === day), atrasadas = t.filter((x) => x.due_date < day && !x.done);
      const doing = d.filter((x) => x.status === "doing"), high = d.filter((x) => x.priority === "alta" && x.status !== "doing");
      const todo = d.filter((x) => x.status !== "doing" && x.priority !== "alta");
      const item = (x: (typeof t)[number]): PanelItem => ({ rotulo: x.title, detalhe: [hhmm(x.due_time) ? `${hhmm(x.due_time)}${x.end_time ? `–${hhmm(x.end_time)}` : ""}` : "", x.place ?? ""].filter(Boolean).join(" · ") || undefined, feita: x.done, link: x.kind === "evento" ? "/calendario" : "/tarefas" } as PanelItem);
      const dem_ = (x: (typeof d)[number]): PanelItem => ({ rotulo: `${x.code} ${x.title}`, detalhe: x.dossier_name ?? undefined, link: `/demandas?projeto=${encodeURIComponent(x.project_id)}` });
      const compromissos = hoje.filter((x) => x.kind === "evento"), lembretes = hoje.filter((x) => x.kind === "lembrete"), tarefas = hoje.filter((x) => x.kind !== "evento" && x.kind !== "lembrete");
      const secoes: Panel["secoes"] = [
        { titulo: "Compromissos", itens: compromissos.map(item) },
        { titulo: "Lembretes", itens: lembretes.map(item) },
        { titulo: "Tarefas", itens: tarefas.map(item) },
        ...(atrasadas.length ? [{ titulo: "Atrasadas", itens: atrasadas.slice(0, 20).map((x) => ({ ...item(x), detalhe: `era para ${x.due_date.split("-").reverse().join("/")}` })) }] : []),
        { titulo: "Demandas em andamento", itens: doing.slice(0, 20).map(dem_) },
        { titulo: "Demandas de prioridade alta", itens: high.slice(0, 20).map(dem_) },
        { titulo: "Demandas a fazer", itens: todo.slice(0, 15).map(dem_) },
      ].filter((s) => s.itens.length);
      emit({ t: "painel", p: { titulo: ptDate(day), secoes: secoes.length ? secoes : [{ titulo: "Agenda", itens: [{ rotulo: "Nada marcado para este dia." }] }] } });
      return {
        data: day, compromissos: compromissos.map((x) => ({ titulo: x.title, hora: hhmm(x.due_time) })), lembretes: lembretes.map((x) => ({ titulo: x.title, hora: hhmm(x.due_time) })), tarefas: tarefas.map((x) => ({ titulo: x.title, hora: hhmm(x.due_time), feita: x.done })), atrasadas: atrasadas.length, demandas_a_fazer: todo.length,
        demandas_em_andamento: doing.slice(0, 5).map((x) => `${x.code} ${x.title}`), demandas_alta_prioridade: high.slice(0, 5).map((x) => `${x.code} ${x.title}`), demandas_abertas_total: d.length,
      };
    }

    case "atualizar_demanda": {
      const { changeDemand } = await import("./manage");
      const r = await changeDemand({
        demanda: String(args["demanda"] ?? ""), status: ["todo", "doing", "done"].includes(String(args["status"])) ? (args["status"] as "todo" | "doing" | "done") : undefined,
        titulo: args["titulo"] as string | undefined, descricao: args["descricao"] as string | undefined, prioridade: args["prioridade"] as "alta" | "media" | "baixa" | undefined,
        prazo: args["prazo"] as string | undefined, nota: args["nota"] as string | undefined, dossie: args["dossie"] as string | undefined,
        excluir: args["excluir"] === true, confirmado: args["confirmado"] === true,
        adicionarTarefa: args["adicionar_as_tarefas"] === true,
        checklistAdicionar: strList(args["checklist_adicionar"]), checklistMarcar: strList(args["checklist_marcar"]), checklistDesmarcar: strList(args["checklist_desmarcar"]), checklistRemover: strList(args["checklist_remover"]),
      }).catch((e): Record<string, unknown> => ({ ok: false, erro: e instanceof Error ? e.message : "Não consegui alterar a demanda." }));
      if (r["ok"]) emit({ t: "painel", p: { titulo: r["acao"] === "excluida" ? "Demanda excluída" : "Demanda atualizada", secoes: [{ titulo: String(r["acao"] === "excluida" ? "Excluída" : (r["status_agora"] ?? "Atualizada")), itens: [{ rotulo: String(r["demanda"]), detalhe: Array.isArray(r["mudou"]) ? (r["mudou"] as string[]).join(" · ") : undefined, link: r["acao"] === "excluida" ? undefined : "/demandas" }] }] } });
      return r;
    }

    case "gerenciar_tarefa": {
      const { changeTask } = await import("./manage");
      const r = await changeTask({
        item: String(args["item"] ?? ""), tipo: (args["tipo"] as "tarefa" | "lembrete" | "compromisso" | "qualquer" | undefined), acao: String(args["acao"]) as "concluir" | "reabrir" | "editar" | "excluir",
        novo_titulo: args["novo_titulo"] as string | undefined, nova_data: args["nova_data"] as string | undefined, nova_hora: args["nova_hora"] as string | undefined,
        prioridade: args["prioridade"] as "alta" | "media" | "baixa" | undefined, local: args["local"] as string | undefined, confirmado: args["confirmado"] === true,
      }).catch((e): Record<string, unknown> => ({ ok: false, erro: e instanceof Error ? e.message : "Não consegui alterar o item." }));
      return r;
    }

    case "acerto": {
      const { runSettleTool } = await import("./settle-tool");
      const out = await runSettleTool(args).catch((e): { result: Record<string, unknown>; panel?: undefined; navegar?: undefined; mudou?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer no acerto de contas." } }));
      if (out.panel) emit({ t: "painel", p: out.panel });
      if (out.navegar && !out.mudou) emit({ t: "acao", a: { tipo: "navegar", para: out.navegar } });
      if (out.mudou) emit({ t: "acao", a: { tipo: "atualizar", o: "financeiro" } });
      return out.result;
    }

    case "analise_corporal": {
      const { runAnalysisTool } = await import("./analysis-tool");
      const out = await runAnalysisTool(args).catch((e): { result: Record<string, unknown>; panel?: undefined; navegar?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui olhar a sua evolução." } }));
      if (out.panel) emit({ t: "painel", p: out.panel });
      return out.result;
    }

    case "ideias": {
      const { runIdeasTool } = await import("./ideas-tool");
      const out = await runIdeasTool(args).catch((e): { result: Record<string, unknown>; panel?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer nas ideias." } }));
      if (out.panel) emit({ t: "painel", p: out.panel });
      return out.result;
    }

    case "planejamento": {
      const m = await import("./planning-tool");
      const a = String(args["acao"] ?? "");
      const run = a === "fontes" || a === "aprendizado" ? m.runPlanningSettings(args) : m.runPlanningTool(args);
      const out = await run.catch((e): { result: Record<string, unknown>; panel?: undefined; navegar?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer no plano." } }));
      if (out.panel) emit({ t: "painel", p: out.panel });
      if ("navegar" in out && out.navegar) emit({ t: "acao", a: { tipo: "navegar", para: out.navegar } });
      return out.result;
    }

    case "financeiro": {
      const { runFinanceTool } = await import("./finance-tool");
      const out = await runFinanceTool(args).catch((e): { result: Record<string, unknown>; panel?: undefined; navegar?: undefined; mudou?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui olhar o financeiro." } }));
      if (out.panel) emit({ t: "painel", p: out.panel });
      if (out.navegar) emit({ t: "acao", a: { tipo: "navegar", para: out.navegar } });
      if (out.mudou) emit({ t: "acao", a: { tipo: "atualizar", o: "financeiro" } });
      return out.result;
    }

    case "gravar_reuniao": {
      const t = ["reuniao", "entrevista", "treinamento", "livre"].includes(String(args["tipo"])) ? String(args["tipo"]) : "reuniao";
      emit({ t: "acao", a: { tipo: "navegar", para: `/reunioes?gravar=1&tipo=${t}` } });
      emit({ t: "acao", a: { tipo: "encerrar" } });
      return { ok: true, acao: "gravação vai começar ao fim desta conversa", tipo: t };
    }

    case "habitos": {
      const { runHabitTool } = await import("./habits-tool");
      const out = await runHabitTool(args, ctx.today).catch((e): { result: Record<string, unknown> } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer nos hábitos." } }));
      return out.result;
    }

    case "treino": {
      const { runWorkoutTool } = await import("./workout-tool");
      const out = await runWorkoutTool(args).catch((e): { result: Record<string, unknown> } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer no treino." } }));
      return out.result;
    }

    case "dieta": {
      const { runDietTool } = await import("./diet-tool");
      const out = await runDietTool(args, ctx.today).catch((e): { result: Record<string, unknown> } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer na dieta." } }));
      return out.result;
    }

    case "juntar_demandas": {
      const { runMergeTool } = await import("./merge-tool");
      const out = await runMergeTool(args).catch((e): { result: Record<string, unknown>; panel?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui juntar as demandas." } }));
      if (out.panel) emit({ t: "painel", p: out.panel });
      return out.result;
    }

    case "verificar_whatsapp_demandas": {
      emit({ t: "acao", a: { tipo: "navegar", para: "/reunioes?aba=demandas&verificar=1" } });
      return { ok: true, acao: "lendo o WhatsApp na tela de demandas", dica: "Diga: estou lendo o WhatsApp; marque o que for demanda e toque em Organizar nas demandas." };
    }

    case "cadastros": {
      const { runRegistryTool } = await import("./registry-tool");
      const out = await runRegistryTool(args).catch((e): { result: Record<string, unknown> } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer nisso." } }));
      return out.result;
    }

    case "lista": {
      const { runListTool } = await import("./lists");
      const out = await runListTool(args).catch((e): { result: Record<string, unknown>; panel?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer na lista." } }));
      if (out.panel) emit({ t: "painel", p: out.panel });
      return out.result;
    }

    case "roteiro": {
      const { runScriptTool } = await import("./scripts");
      const out = await runScriptTool(args).catch((e): { result: Record<string, unknown>; panel?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer no roteiro." } }));
      if (out.panel) emit({ t: "painel", p: out.panel });
      return out.result;
    }

    case "pedir_melhoria": {
      if (String(args["acao"] ?? "pedir") === "listar") {
        const { listImprovements, STATUS_LABEL } = await import("../data/improvements");
        const rows = await listImprovements(12);
        emit({ t: "painel", p: { titulo: "Pedidos para o Claude", secoes: [{ titulo: "Pedidos", itens: rows.length ? rows.map((r) => ({ rotulo: r.title, detalhe: `${STATUS_LABEL[r.status]}${r.claude_note ? ` · ${r.claude_note}` : ""}`, feita: r.status === "feito" })) : [{ rotulo: "Nenhum pedido ainda." }] }] } });
        return { ok: true, pedidos: rows.map((r) => ({ titulo: r.title, andamento: STATUS_LABEL[r.status], nota: r.claude_note || undefined })) };
      }
      const titulo = String(args["titulo"] ?? "").trim(), pedido = String(args["pedido"] ?? "").trim(), detalhes = String(args["detalhes"] ?? "").trim(), area = String(args["area"] ?? "").trim();
      if (!titulo) return { ok: false, erro: "Faltou o título do pedido." };
      emit({ t: "painel", p: { titulo: "Confirmar pedido para o Claude", secoes: [], confirmar: { titulo, pedido: pedido || titulo, detalhes: detalhes || pedido || titulo, area } } });
      return { ok: true, aguardando_confirmacao: true, instrucao: "Diga em uma ou duas frases que no momento você não consegue fazer isso, que montou o pedido para o Claude e que ela precisa conferir e confirmar na tela. NÃO diga que já está sendo feito nem que foi enviado: só é enviado depois do clique dela, e o Claude implementa em seguida." };
    }

    case "buscar_no_orion": {
      const { loadCorpus } = await import("../orion.functions");
      const q = String(args["pergunta"] ?? "");
      const { docs, kws } = rank(await loadCorpus(), q, ctx.today, 8);
      if (!docs.length) return { ok: true, encontrados: 0, dica: "Diga que não encontrou nada sobre isso." };
      return { ok: true, encontrados: docs.length, trechos: docs.map((d) => ({ id: d.id, tipo: d.kind, data: d.date, onde: d.where, titulo: d.title, texto: snippet(d.text, kws, 360), arquivos: d.files?.map((f) => f.name) })) };
    }

    case "consultar_registros": {
      const assunto = String(args["assunto"] ?? "tudo"), sit = String(args["situacao"] ?? "todas");
      const per = args["de"] || args["ate"]
        ? { from: String(args["de"] ?? "0000-01-01"), to: String(args["ate"] ?? args["de"] ?? "9999-12-31"), label: `${args["de"] ?? ""} a ${args["ate"] ?? ""}` }
        : periodOf(String(args["periodo"] ?? ""), ctx.today);
      const inP = (d?: string | null) => !per || (!!d && d >= per.from && d <= per.to);
      const dayBR = (ts?: string | null) => (ts ? new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : undefined);
      const f = normalize(String(args["texto"] ?? ""));
      const match = (...parts: (string | null | undefined)[]) => !f || normalize(parts.filter(Boolean).join(" ")).includes(f);
      const br = (iso?: string) => (iso ? iso.split("-").reverse().join("/") : "");
      const out: Record<string, unknown> = { periodo: per ? per.label : "todo o histórico" };
      const secoes: Panel["secoes"] = [];

      if (assunto === "tudo" || assunto === "demandas") {
        const [dem, projs] = await Promise.all([
          supabase.from("project_demands").select("code, title, status, priority, dossier_name, project_id, created_at, updated_at").order("updated_at", { ascending: false }).limit(1000),
          supabase.from("projects").select("id, name"),
        ]);
        const pn = new Map((must(projs) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
        const all = must(dem) as { code: string; title: string; status: string; priority: string; dossier_name: string | null; project_id: string; created_at: string; updated_at: string }[];
        const pick = (r: (typeof all)[number]) => {
          const ok = sit === "concluidas" ? r.status === "done" && inP(dayBR(r.updated_at))
            : sit === "criadas" ? inP(dayBR(r.created_at))
            : sit === "abertas" ? r.status !== "done" && (!per || inP(dayBR(r.created_at)) || inP(dayBR(r.updated_at)))
            : inP(dayBR(r.created_at)) || inP(dayBR(r.updated_at));
          return ok && match(r.title, r.code, r.dossier_name, pn.get(r.project_id));
        };
        const hit = all.filter(pick);
        const ST: Record<string, string> = { todo: "a fazer", doing: "em andamento", done: "concluída" };
        out["demandas"] = { total: hit.length, concluidas: hit.filter((r) => r.status === "done").length, em_andamento: hit.filter((r) => r.status === "doing").length, a_fazer: hit.filter((r) => r.status === "todo").length,
          itens: hit.slice(0, 25).map((r) => ({ codigo: r.code, titulo: r.title, projeto: pn.get(r.project_id), polo: r.dossier_name ?? undefined, situacao: ST[r.status], criada_em: dayBR(r.created_at), atualizada_em: dayBR(r.updated_at) })) };
        if (hit.length) secoes.push({ titulo: `Demandas (${hit.length})`, itens: hit.slice(0, 25).map((r) => ({ rotulo: `${r.code} ${r.title}`, detalhe: [ST[r.status], br(dayBR(r.status === "done" ? r.updated_at : r.created_at)), r.dossier_name].filter(Boolean).join(" · "), feita: r.status === "done", link: `/demandas?projeto=${encodeURIComponent(r.project_id)}` })) });
      }

      if (assunto === "tudo" || assunto === "tarefas") {
        const tk = must(await supabase.from("tasks").select("title, due_date, due_time, done, done_at, kind, created_at").order("created_at", { ascending: false }).limit(1500)) as { title: string; due_date: string | null; due_time: string | null; done: boolean; done_at: string | null; kind: string; created_at: string }[];
        const pick = (r: (typeof tk)[number]) => {
          const ok = sit === "concluidas" ? r.done && inP(dayBR(r.done_at) ?? r.due_date)
            : sit === "criadas" ? inP(dayBR(r.created_at))
            : sit === "abertas" ? !r.done && (!per || inP(r.due_date) || inP(dayBR(r.created_at)))
            : inP(dayBR(r.created_at)) || inP(r.due_date) || inP(dayBR(r.done_at));
          return ok && match(r.title);
        };
        const hit = tk.filter(pick);
        const K = (k: string) => (k === "evento" ? "compromisso" : k === "lembrete" ? "lembrete" : "tarefa");
        out["tarefas"] = { total: hit.length, concluidas: hit.filter((r) => r.done).length, pendentes: hit.filter((r) => !r.done).length,
          itens: hit.slice(0, 30).map((r) => ({ titulo: r.title, tipo: K(r.kind), feita: r.done, para: r.due_date ?? undefined, concluida_em: dayBR(r.done_at), criada_em: dayBR(r.created_at) })) };
        if (hit.length) secoes.push({ titulo: `Tarefas, compromissos e lembretes (${hit.length})`, itens: hit.slice(0, 30).map((r) => ({ rotulo: r.title, detalhe: [K(r.kind), r.done ? "feita" : "pendente", br(r.due_date ?? undefined), hhmm(r.due_time)].filter(Boolean).join(" · "), feita: r.done, link: r.kind === "evento" ? "/calendario" : "/tarefas" })) });
      }

      if (assunto === "tudo" || assunto === "anotacoes") {
        const en = must(await supabase.from("brain_entries").select("title, text, entry_date, source").order("entry_date", { ascending: false }).limit(800)) as { title: string | null; text: string; entry_date: string; source: string }[];
        const hit = en.filter((r) => inP(r.entry_date) && match(r.title, r.text));
        out["anotacoes_no_orion"] = { total: hit.length, itens: hit.slice(0, 20).map((r) => ({ data: r.entry_date, titulo: r.title || undefined, texto: r.text.replace(/\s+/g, " ").slice(0, 220), origem: r.source === "documentacao" ? "documentação" : "anotação" })) };
        if (hit.length) secoes.push({ titulo: `Anotações no Orion (${hit.length})`, itens: hit.slice(0, 20).map((r) => ({ rotulo: (r.title || r.text).replace(/\s+/g, " ").slice(0, 120), detalhe: br(r.entry_date), link: "/cerebro" })) });
      }

      emit({ t: "painel", p: { titulo: per ? `Registros · ${per.label}` : "Registros", secoes: secoes.length ? secoes : [{ titulo: "Resultado", itens: [{ rotulo: "Nada encontrado nesse período." }] }] } });
      return { ok: true, ...out, dica: "Responda com as contagens e os destaques; se houver muitos, cite os principais. Cheque o campo 'periodo'." };
    }

    case "lembrar": {
      const kind = MEMORY_KINDS.includes(String(args["tipo"]) as MemoryKind) ? (String(args["tipo"]) as MemoryKind) : "aprendizado";
      const r = await addMemory(String(args["texto"] ?? ""), kind, "conversa");
      return r.ok ? { ok: true, guardado: true } : { ok: true, guardado: false, motivo: r.motivo === "ja_sei" ? "Já sabia disso." : r.motivo === "indisponivel" ? "A memória ainda não está ativada." : "Não guardei." };
    }

    case "esquecer": {
      const n = await forgetMemories(String(args["sobre"] ?? ""));
      return n ? { ok: true, apagados: n } : { ok: false, erro: "Não encontrei nada na memória sobre isso." };
    }

    case "ajustar_perfil": {
      const st = await loadBriefingState();
      if (!st.available) return { ok: false, erro: "O briefing ainda não está ativado." };
      const cur = st.briefing ?? { call_name: "", tone: "", greeting: "esperar" as const, greeting_note: "", work: "", biggest_demand: "", routine: "", goals: "", preferences: "", completed_at: null };
      const g = String(args["saudacao"] ?? "");
      const next = { ...cur,
        ...(args["nome"] ? { call_name: String(args["nome"]) } : {}), ...(args["jeito"] ? { tone: String(args["jeito"]) } : {}),
        ...(["esperar", "saudacao", "saudacao_hoje", "saudacao_pergunta"].includes(g) ? { greeting: g as typeof cur.greeting } : {}) };
      await saveBriefing(next, false);
      cacheByOwner.delete(ownerId());
      return { ok: true };
    }

    case "documentar": {
      const texto = String(args["texto"] ?? "").trim().slice(0, 20000);
      if (!texto) return { ok: false, erro: "Sem texto para guardar." };
      if (/\b(senha|password|token|api[ _-]?key)\b\s*[:=]/i.test(texto)) return { ok: false, erro: "Parece haver uma senha ou chave no texto. Senhas não são guardadas no Orion: diga sem a senha." };
      const names = (must(await supabase.from("dossiers").select("name")) as { name: string }[]).map((x) => x.name);
      const date = resolveDay(args["data"], ctx.today);
      const extra = Array.isArray(args["dossies"]) ? (args["dossies"] as unknown[]).map((x) => String(x).trim()).filter(Boolean) : [];
      let projectId: string | null = null;
      if (String(args["projeto"] ?? "").trim()) { try { projectId = (await resolveProject(String(args["projeto"]))).id; } catch { /* sem projeto */ } }
      const titulo = String(args["titulo"] ?? "").trim().slice(0, 80);
      must(await supabase.from("brain_entries").insert({ user_id: ownerId(), ...(titulo ? { title: titulo } : {}), text: texto, entry_date: date, project_id: projectId, dossier_names: [...new Set([...mentionedDossiers(texto, names), ...extra])] }).select("id"));
      emit({ t: "painel", p: { titulo: "Documentado no Orion", secoes: [{ titulo: date.split("-").reverse().join("/"), itens: [{ rotulo: titulo || texto.slice(0, 160), link: "/cerebro" }] }] } });
      return { ok: true, acao: "documentado", titulo: titulo || undefined };
    }

    case "documentacao": {
      const { runDocumentationTool } = await import("./documentation-tool");
      const out = await runDocumentationTool(args).catch((e): { result: Record<string, unknown>; navegar?: undefined } => ({ result: { ok: false, erro: e instanceof Error ? e.message : "Não consegui mexer na Documentação." } }));
      if (out.navegar && out.result["ok"] === true && args["acao"] !== "ler") emit({ t: "acao", a: { tipo: "navegar", para: out.navegar } });
      return out.result;
    }

    case "ler_documento": {
      const { loadCorpus } = await import("../orion.functions");
      const id = String(args["id"] ?? "");
      const d = (await loadCorpus()).find((x) => x.id === id);
      if (!d) return { ok: false, erro: "Não achei esse item. Use o id exato de buscar_no_orion." };
      return { ok: true, tipo: d.kind, titulo: d.title, data: d.date, onde: d.where, texto: d.text.slice(0, 9000), arquivos: d.files?.map((f) => f.name) };
    }
  }
  return { ok: false, erro: `Ferramenta desconhecida: ${name}` };
}

/* ───────────── conversa ───────────── */
const CHAT_MODE = `MODO CONVERSA ESCRITA: ela está digitando na tela (texto, imagens, arquivos) e LÊ a resposta; não está ouvindo. Aqui vale responder de forma completa e organizada (listas curtas, passos), sem a regra de frases curtas faladas. Se ela mandar imagem, PDF ou arquivo, analise o conteúdo de verdade e responda sobre ele. Se o pedido for algo que nenhuma ferramenta sua faz (ex.: um print de um erro, uma tela para mudar, uma função nova), use pedir_melhoria: o Claude NÃO vê a imagem, então descreva no pedido, com detalhes, o que aparece nela (tela, textos, valores, o que está errado ou o que ela quer) e o que precisa mudar.`;

export type AgentOpts = { modo?: "voz" | "chat"; anexos?: Anexo[]; /** última rodada: responde com o que já tem, sem chamar mais ferramentas */ finalizar?: boolean };
export async function runAgent(history: Turn[], emit: Emit, resume?: Resume, opts: AgentOpts = {}): Promise<void> {
  if (!process.env["OPENAI_API_KEY"]) { emit({ t: "erro", m: "A conversa por voz precisa da OPENAI_API_KEY no servidor." }); return; }
  const model = process.env["OPENAI_VOICE_MODEL"]?.trim() || process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
  const c = await voiceContext();
  const st = await loadBriefingState().catch(() => ({ available: false, briefing: null, memories: [] }));
  const starting = history.at(-1)?.role === "user" && history.at(-1)?.content === GREET_MARK;
  const directive = starting ? greetingDirective(st.briefing) : "";
  if (starting && !directive) { emit({ t: "fim" }); return; } // quer esperar: não fala nada
  const known = briefingPrompt(st.briefing, st.memories);
  const chat = opts.modo === "chat", anexos = opts.anexos ?? [];
  const messages: Record<string, unknown>[] = resume ? [...resume.estado, ...resume.resultados.map((r) => ({ role: "tool", tool_call_id: r.id, content: r.content.slice(0, 12000) }))] : [
    { role: "system", content: `${PERSONA(st.briefing?.call_name || c.name)}${known ? `\n\n${known}` : ""}${directive ? `\n\nAGORA: ${directive}` : ""}${chat ? `\n\n${CHAT_MODE}` : ""}\n\n${contextText(c.ctx)}` },
    ...history.slice(-12).map((m, i, arr) => ({ role: m.role, content: m.content === GREET_MARK ? "(a conversa por voz acabou de começar)" : i === arr.length - 1 && m.role === "user" && chat && anexos.length ? buildUserContent(m.content.slice(0, 6000), anexos) : m.content.slice(0, chat ? 6000 : 2000) })),
  ];
  const lastUser = history.at(-1);
  const quick = !resume && !chat && !starting && !anexos.length && lastUser?.role === "user" && isSmallTalk(lastUser.content, [st.briefing?.call_name, c.name]);
  if (quick) {
    // papo rápido: resposta direta, sem ferramentas nem raciocínio, para ser imediata
    const fast: Record<string, unknown>[] = [
      { role: "system", content: `Você é o Orion, o assistente pessoal${(st.briefing?.call_name || c.name) ? ` de ${st.briefing?.call_name || c.name}` : ""}, por voz. Responda a conversa em UMA frase curta, natural e calorosa, em português do Brasil, como numa conversa de verdade (se perguntarem como você está, diga como está e devolva a pergunta). Não use o nome dela. Nunca diga que vai verificar, buscar ou olhar nada. Sem listas, emojis ou markdown.` },
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content === GREET_MARK ? "(a conversa por voz acabou de começar)" : m.content })),
    ];
    try {
      await streamChat({ model, messages: fast, max_completion_tokens: 120, reasoning_effort: "none" }, (d) => emit({ t: "texto", d }));
      emit({ t: "fim" }); return;
    } catch (e) { console.error("[voz rápida]", e); /* se falhar, segue o fluxo normal abaixo */ }
  }
  try {
    let spoke = false; // já falou algo neste pedido? (aí não repete o aviso de "estou verificando")
    for (let round = 0; round < 5; round++) {
      // última rodada (ou pedido de encerrar): sem ferramentas, só responde com o que já tem — nunca fica mudo
      const noTools = opts.finalizar === true || round === 4;
      if (noTools) messages.push({ role: "system", content: "Responda AGORA, em uma ou duas frases, com o que já descobriu. Se algo não deu certo (por exemplo a ponte do WhatsApp não respondeu), diga em poucas palavras o que faltou e que ela pode pedir de novo. Não use mais ferramentas." });
      const { text, calls } = await streamChat({ model, messages, ...(noTools ? {} : { tools: TOOLS, tool_choice: "auto" }), max_completion_tokens: chat ? 2000 : 700, reasoning_effort: "low" }, (d) => { if (d.trim()) spoke = true; emit({ t: "texto", d }); });
      if (!calls.length) break;
      let said = text;
      if (!spoke) {
        // vai executar sem ter dito nada: avisa na hora, para não ficar em silêncio enquanto trabalha
        const f = fillerFor(calls.map((k) => k.name), calls.map((k) => k.id).join(""));
        if (f) { spoke = true; said = `${f} `; emit({ t: "texto", d: said }); }
      }
      messages.push({ role: "assistant", content: said || null, tool_calls: calls.map((k) => ({ id: k.id, type: "function", function: { name: k.name, arguments: k.args || "{}" } })) });
      for (const k of calls) { const st = TOOL_STATUS[k.name]; if (st) { emit({ t: "status", m: st }); break; } }
      const deferred: { id: string; nome: string; args: Record<string, unknown> }[] = [];
      for (const k of calls) {
        let out: unknown;
        try {
          if (WA_TOOLS.has(k.name)) {
            // Tenta a ponte deste servidor (app local); se ela não está aqui (site publicado), o navegador executa e continua.
            const { bridge } = await import("../whatsapp/bridge");
            const r = await runWhatsAppTool(k.name, parseArgs(k.args), async (path, method) => { const b = await bridge(path, method ?? "GET"); return b.ok ? { ok: true, data: b.data } : { ok: false, erro: b.erro, offline: !!b.offline }; }, c.ctx.today);
            if (r.offline) { deferred.push({ id: k.id, nome: k.name, args: parseArgs(k.args) }); continue; }
            if (r.panel) emit({ t: "painel", p: r.panel });
            out = r.result;
          } else out = await runTool(k.name, parseArgs(k.args), emit, c.ctx);
        } catch (e) { out = { ok: false, erro: e instanceof Error ? e.message : "erro" }; }
        messages.push({ role: "tool", tool_call_id: k.id, content: JSON.stringify(out).slice(0, 6000) });
      }
      if (deferred.length) { emit({ t: "ferramenta", estado: stripBinary(messages), chamadas: deferred }); return; }
    }
    emit({ t: "fim" });
  } catch (e) {
    if (e instanceof OpenAIError) { console.error("[voz] OpenAI", e.status, e.code, e.message); emit({ t: "erro", m: explain(e, model) }); }
    else { console.error("[voz]", e); emit({ t: "erro", m: "Tive um problema para responder agora. Pode repetir?" }); }
  }
}
