/** Exemplos para ver como fica o resultado sem gastar IA (dados inventados). */
import type { Analysis, MeetingKind, Mode } from "./meetings";

const NONE = { tipo: "reuniao" as MeetingKind, fatos: [], secoes: [], expectativas: [], lembrar: [], perguntas: [] };

const iso = (add: number) => { const d = new Date(); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Exemplos de entrevista e treinamento: mostram os fatos exatos e as seções que cada tipo traz. */
export function demoByKind(kind: MeetingKind): Analysis {
  if (kind === "entrevista") return {
    ...NONE, grupos: [], tipo: "entrevista", titulo: "Entrevista — Alvorada Marketing (Analista de Operações)", participantes: ["Patrícia (RH)", "Marcos (gestor)", "Você"],
    resumo: "Entrevista para analista de operações na Alvorada Marketing, uma agência de 40 pessoas focada em comunicação para saúde. Patrícia explicou o processo e o regime de trabalho; Marcos, que seria o gestor direto, detalhou o dia a dia: cuidar da fila de demandas dos clientes, montar relatórios semanais e treinar a equipe nova nas ferramentas. A proposta falada foi de R$ 4.500 de salário, com benefícios e bônus trimestral por meta. Ficou combinado que você envia o portfólio até quinta e que o retorno do RH vem em até 7 dias úteis. Há duas dúvidas sobre o bônus que ninguém respondeu com clareza.",
    topicos: [{ assunto: "Rotina da vaga", pontos: ["Cuidar da fila de demandas dos clientes", "Relatório semanal toda sexta", "Treinar a equipe nova nas ferramentas"] }, { assunto: "Cultura", pontos: ["Reunião de alinhamento toda segunda às 9h", "Feedback mensal individual"] }],
    decisoes: [], pendencias: ["Como é calculada a meta do bônus trimestral?", "O vale-refeição é pago nos meses de férias?"], proxima: { data: iso(9), hora: "14:00", assunto: "Segunda etapa com a diretoria" },
    fatos: [
      { rotulo: "Salário", valor: "R$ 4.500 por mês", confirmar: false }, { rotulo: "Vale-refeição", valor: "R$ 38 por dia útil", confirmar: false }, { rotulo: "Plano de saúde", valor: "Pago pela empresa, titular; dependentes com 50% de desconto", confirmar: false },
      { rotulo: "Bônus", valor: "Trimestral, por meta — valor não informado (disse \"até 1 salário\"; confirmar)", confirmar: true }, { rotulo: "Regime", valor: "Híbrido: 3 dias no escritório (terça a quinta)", confirmar: false },
      { rotulo: "Horário", valor: "9h às 18h", confirmar: false }, { rotulo: "Gestor direto", valor: "Marcos Lima", confirmar: false }, { rotulo: "Prazo do retorno", valor: "Até 7 dias úteis", confirmar: false },
    ],
    secoes: [
      { titulo: "A empresa", itens: ["Agência com 40 pessoas, foco em comunicação para saúde", "Valores citados: transparência e autonomia"] },
      { titulo: "A vaga", itens: ["Analista de Operações, reporta ao Marcos", "Híbrido, 3 dias presenciais", "Ferramentas: Trello, Slack e CRM próprio"] },
      { titulo: "Remuneração e benefícios", itens: ["Salário R$ 4.500", "VR R$ 38 por dia útil", "Plano de saúde pago pela empresa", "Bônus trimestral por meta"] },
      { titulo: "O que você vai fazer", itens: ["Administrar a fila de demandas dos clientes", "Montar relatório semanal (sexta)", "Treinar a equipe nova"] },
      { titulo: "Processo seletivo", itens: ["Esta foi a 1ª etapa", "2ª etapa com a diretoria", "Retorno do RH em até 7 dias úteis"] },
    ],
    expectativas: ["Organização e proatividade com os prazos dos clientes", "Entregar o relatório semanal toda sexta", "Conseguir treinar pessoas nas ferramentas"],
    lembrar: ["Enviar o portfólio até quinta", "Perguntar como funciona a meta do bônus na próxima etapa"], perguntas: ["Como é calculada a meta do bônus trimestral?", "O vale-refeição é pago nos meses de férias?"],
    acoes: [{ quem: "Você", oQue: "Enviar o portfólio para a Patrícia", prazo: iso(3), prioridade: "alta", tipo: "tarefa", contexto: "Patrícia: me manda o portfólio até quinta", minha: true }],
  };
  if (kind === "treinamento") return {
    ...NONE, grupos: [], tipo: "treinamento", titulo: "Treinamento — Polo Santos (disparo em massa)", participantes: ["Carla (Polo Santos)", "Rafael", "Jheny"],
    resumo: "Treinamento do Polo Santos sobre disparo em massa na API oficial. Passamos pela criação do template, importação da planilha, segmentação e criação do fluxo de disparo. Carla teve dificuldade com as variáveis do template e com o formato da planilha. Ficou combinado que você envia o passo a passo em vídeo e a planilha modelo até sexta, e que o Polo Santos faz o primeiro disparo de teste na segunda, com acompanhamento.",
    topicos: [{ assunto: "Passo a passo do disparo", pontos: ["Criar o template e aguardar a aprovação da Meta", "Importar a planilha com nome e telefone", "Criar a segmentação", "Criar o fluxo e agendar o disparo"] }],
    decisoes: ["O primeiro disparo será um teste com 50 contatos"], pendencias: ["Quanto tempo a Meta leva para aprovar o template?"], proxima: { data: iso(5), hora: "10:00", assunto: "Acompanhar o primeiro disparo de teste" },
    fatos: [{ rotulo: "Contatos do teste", valor: "50 contatos", confirmar: false }, { rotulo: "Entrega do material", valor: "Até sexta", confirmar: false }, { rotulo: "Primeiro disparo", valor: "Segunda às 10h", confirmar: false }],
    secoes: [
      { titulo: "Conteúdo passado", itens: ["1. Criar o template com as variáveis entre chaves", "2. Importar a planilha (colunas nome e telefone)", "3. Segmentar por polo", "4. Criar o fluxo e agendar"] },
      { titulo: "Materiais e acessos prometidos", itens: ["Você envia o passo a passo em vídeo — até sexta", "Você envia a planilha modelo — até sexta"] },
      { titulo: "Combinados", itens: ["Teste com 50 contatos antes do disparo grande", "Acompanhamento ao vivo no primeiro disparo"] },
      { titulo: "Dificuldades e dúvidas", itens: ["Carla travou nas variáveis do template", "Formato do telefone na planilha (com DDD, sem espaço)"] },
    ],
    expectativas: [], lembrar: ["Enviar vídeo e planilha modelo até sexta", "Marcar o acompanhamento de segunda às 10h"], perguntas: ["Quanto tempo a Meta leva para aprovar o template?"],
    acoes: [
      { quem: "Jheny", oQue: "Enviar o passo a passo em vídeo para o Polo Santos", prazo: iso(4), prioridade: "alta", tipo: "demanda", contexto: "Eu mando o vídeo até sexta", minha: true },
      { quem: "Jheny", oQue: "Enviar a planilha modelo para o Polo Santos", prazo: iso(4), prioridade: "alta", tipo: "demanda", contexto: "", minha: true },
      { quem: "Carla", oQue: "Fazer o primeiro disparo de teste com 50 contatos", prazo: iso(5), prioridade: "media", tipo: "demanda", contexto: "", minha: false },
    ],
  };
  return demoAnalysis("reuniao");
}

export function demoAnalysis(mode: Mode): Analysis {
  if (mode === "grupo") return {
    ...NONE, titulo: "Resumo dos grupos — hoje", participantes: ["Carla (Polo Norte)", "Rafael (Polo Sul)", "Marina", "Diego"],
    resumo: "Dois grupos movimentados: o Polo Norte pediu ajuda com o QR Code que caiu e o Polo Sul questionou o valor do disparo. Há três pedidos que viram demanda e um aviso de manutenção para amanhã.",
    topicos: [], decisoes: ["Disparo do Polo Sul fica para quinta, depois da aprovação do template", "Manutenção do CRM amanhã às 22h, sem disparos nesse horário"],
    grupos: [
      { nome: "Polo Norte — Operação", resumo: "O QR Code de conexão caiu duas vezes de manhã e a equipe ficou sem enviar. Carla pediu para reconectar e conferir se o número foi limitado. Depois das 11h voltou a funcionar.", destaques: ["QR Code caiu 2× (manhã)", "Possível limite no número — precisa conferir", "Voltou a enviar às 11h"], pedidos: ["Carla pediu a Jheny reconectar o número do Polo Norte", "Carla pediu um relatório de entrega da semana"] },
      { nome: "Polo Sul — Campanhas", resumo: "Rafael questionou o valor do disparo de novembro e pediu uma proposta com 3 opções de volume. Marina avisou que o template ainda aguarda aprovação.", destaques: ["Valor do disparo em discussão", "Template aguardando aprovação da Meta"], pedidos: ["Rafael pediu proposta com 3 opções de volume", "Marina vai cobrar a aprovação do template"] },
    ],
    acoes: [
      { quem: "Jheny", oQue: "Reconectar o número do Polo Norte e verificar se há limite no WhatsApp", prazo: iso(0), prioridade: "alta", tipo: "demanda", contexto: "Carla: o QR caiu de novo, podem reconectar?", minha: true },
      { quem: "Jheny", oQue: "Montar relatório de entrega da semana do Polo Norte", prazo: iso(2), prioridade: "media", tipo: "demanda", contexto: "Carla: preciso do relatório de entrega", minha: true },
      { quem: "Jheny", oQue: "Enviar proposta com 3 opções de volume para o Polo Sul", prazo: iso(3), prioridade: "alta", tipo: "demanda", contexto: "Rafael: manda 3 opções de volume", minha: true },
      { quem: "Marina", oQue: "Cobrar a aprovação do template do Polo Sul", prazo: iso(1), prioridade: "media", tipo: "lembrete", contexto: "", minha: false },
      { quem: "Diego", oQue: "Avisar os polos sobre a manutenção do CRM amanhã às 22h", prazo: iso(0), prioridade: "baixa", tipo: "tarefa", contexto: "", minha: false },
    ],
    pendencias: ["O número do Polo Norte foi limitado? Ninguém confirmou.", "Qual o volume que o Polo Sul quer disparar?"], proxima: null,
  };
  return {
    ...NONE, titulo: "Alinhamento do disparo de novembro (P4C)", participantes: ["Ana", "Bia", "Carlos", "Jheny"],
    resumo: "Alinhamos o disparo em massa de novembro e a migração para a API oficial do WhatsApp. O template foi aprovado pela Meta e o volume previsto é de 5 mil contatos. O custo da API oficial ainda não está definido e ficou como pendência. Ana segue com o template, Bia com o retorno do cliente e Jheny levanta os custos.",
    topicos: [
      { assunto: "Disparo em massa de novembro", pontos: ["Template aprovado pela Meta", "Volume previsto: 5 mil contatos", "Janela de envio: terça de manhã"] },
      { assunto: "Migração para a API oficial", pontos: ["Custo por conversa ainda não levantado", "Prazo desejado: antes do fim do mês", "Risco de bloqueio no número atual"] },
      { assunto: "Treinamento da equipe", pontos: ["Carlos monta o roteiro de atendimento", "Turma nova começa na semana que vem"] },
    ],
    decisoes: ["Usar a API oficial do WhatsApp daqui para frente", "Disparar na terça-feira de manhã", "Não enviar para contatos sem opt-in"],
    acoes: [
      { quem: "Jheny", oQue: "Levantar o custo da API oficial e comparar com o número atual", prazo: iso(3), prioridade: "alta", tipo: "demanda", contexto: "Jheny: eu levanto os custos até quinta", minha: true },
      { quem: "Jheny", oQue: "Conferir quais contatos têm opt-in antes do disparo", prazo: iso(2), prioridade: "alta", tipo: "demanda", contexto: "", minha: true },
      { quem: "Ana", oQue: "Enviar o template final para publicação", prazo: iso(1), prioridade: "alta", tipo: "demanda", contexto: "Ana: o template sai amanhã", minha: false },
      { quem: "Bia", oQue: "Cobrar o retorno do cliente sobre o orçamento", prazo: iso(4), prioridade: "media", tipo: "lembrete", contexto: "", minha: false },
      { quem: "Carlos", oQue: "Montar o roteiro de atendimento da turma nova", prazo: iso(6), prioridade: "media", tipo: "demanda", contexto: "", minha: false },
      { quem: "Carlos", oQue: "Reservar a sala para o treinamento", prazo: iso(5), prioridade: "baixa", tipo: "tarefa", contexto: "", minha: false },
    ],
    pendencias: ["Quem paga o custo da API oficial: a P4C ou o cliente?", "O número atual pode continuar em paralelo durante a migração?"],
    proxima: { data: iso(7), hora: "10:00", assunto: "Retorno do orçamento e aprovação da migração" }, grupos: [],
  };
}
