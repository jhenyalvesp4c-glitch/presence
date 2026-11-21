/** Exemplos para ver como fica o resultado sem gastar IA (dados inventados). */
import type { Analysis, Mode } from "./meetings";

const iso = (add: number) => { const d = new Date(); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function demoAnalysis(mode: Mode): Analysis {
  if (mode === "grupo") return {
    titulo: "Resumo dos grupos — hoje", participantes: ["Carla (Polo Norte)", "Rafael (Polo Sul)", "Marina", "Diego"],
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
    titulo: "Alinhamento do disparo de novembro (P4C)", participantes: ["Ana", "Bia", "Carlos", "Jheny"],
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
