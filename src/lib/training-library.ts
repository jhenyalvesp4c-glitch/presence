/**
 * Roteiros de treinamento e banco de exemplos (Documentação → Treinamentos).
 * Tudo é editável e fica salvo como um documento só por dono (tabela training_library).
 */

export type Pin = { x: number; y: number; label: string; text: string };
/** `img` é a chave de uma imagem do app (ver training-images.ts). */
export type Visual = { img: string; title: string; caption: string; pins: Pin[] };
export type Example = { id: string; title: string; situation: string; text: string; cat: string; color: string; visual?: Visual | undefined };
export type Faq = { q: string; a: string };
export type Scenario = { situation: string; before: string; after: string; beforeLabel?: string | undefined; afterLabel?: string | undefined };
export type Block = {
  id: string; title: string; minutes: number; show: string[]; examples: string[]; tip?: string | undefined; faq?: Faq[] | undefined;
  visuals?: Visual[] | undefined; why?: string[] | undefined; scenario?: Scenario | undefined;
  /** Texto para falar na aula ou no vídeo (só o apresentador vê, nas notas). */
  say?: string | undefined;
};
export type Script = { id: string; title: string; audience: string; goal: string; color: string; blocks: Block[]; folder?: string | undefined };
export type Library = { scripts: Script[]; examples: Example[]; folders?: string[] | undefined };

export const COLORS = ["cyan", "violet", "pink", "emerald", "amber"] as const;

// Conteúdo inicial (exemplo). Na primeira edição, tudo passa a ser salvo no banco.
const visualTagsLead: Visual = {
  img: "etiquetas-lead", title: "Onde colocar", caption: "Tela do lead aberta: conversa à esquerda, dados e etiquetas à direita.",
  pins: [
    { x: 16, y: 30, label: "Leia a conversa", text: "A Ana disse que quer saber de Enfermagem. É isso que vira etiqueta." },
    { x: 71, y: 43, label: "Etiquetas do lead", text: "Ficam no painel \"Dados do lead\". Sempre visíveis para qualquer consultor que abrir o contato." },
    { x: 71, y: 55, label: "Adicionar etiqueta", text: "Clique em \"+ Adicionar etiqueta\" e escolha da lista. O × na etiqueta remove." },
    { x: 91, y: 63, label: "Lista padrão do polo", text: "Use sempre as etiquetas da lista; não invente nomes novos, senão o filtro não encontra." },
  ],
};
const visualTagsFiltro: Visual = {
  img: "etiquetas-filtro", title: "Pra que serve", caption: "Lista de leads filtrada pela etiqueta \"Aguardando valores\".",
  pins: [
    { x: 14, y: 18, label: "Filtro por etiqueta", text: "Em Leads, escolha \"Todas as etiquetas\" → \"Aguardando valores\". Um clique." },
    { x: 39, y: 18, label: "Quantos são", text: "Na hora você sabe: 12 pessoas esperando valores. Sem contar na mão." },
    { x: 57.5, y: 29, label: "Etiquetas na lista", text: "Dá para ver curso e situação de cada um sem abrir a conversa." },
    { x: 81, y: 5, label: "Ação em grupo", text: "Com o filtro aplicado, envie os valores para todos de uma vez." },
  ],
};

const seedExamples: Example[] = [
  { id: "e1", title: "Etiqueta bem aplicada", cat: "Etiquetas", color: "amber",
    situation: "Lead pediu informações sobre o curso de Enfermagem, mas ainda não falou de valores.",
    text: "Etiquetas: [Enfermagem] [Interesse] [Aguardando valores]. Assim qualquer consultor que abrir o contato entende em 2 segundos onde ele está.",
    visual: visualTagsLead },
  { id: "e2", title: "Mover no funil", cat: "Funil", color: "cyan",
    situation: "Lead enviou documentos para matrícula.",
    text: "Arraste o card de \"Negociação\" para \"Documentação\" e registre uma nota: \"RG e comprovante recebidos em 10/11, falta histórico escolar\"." },
  { id: "e3", title: "Primeira resposta", cat: "Atendimento", color: "emerald",
    situation: "Lead novo chegou pelo anúncio do Instagram às 21h.",
    text: "\"Oi, Ana! Aqui é a Laura do polo Maceió 😊 Vi que você se interessou pelo curso de Administração. Posso te mandar as opções de turma?\"" },
  { id: "e4", title: "Template com botões", cat: "Disparo", color: "violet",
    situation: "Disparo de reengajamento para quem não respondeu há 7 dias.",
    text: "Use o template \"Reengajamento 7 dias\" (com botões Sim / Mais tarde). Após o envio, arquive todos; quem clicar em um botão volta automaticamente." },
  { id: "e5", title: "Nota de atendimento", cat: "Atendimento", color: "emerald",
    situation: "Ligação com o lead que tem dúvida sobre bolsa.",
    text: "Nota: \"Ligação 10/11 14h · quer bolsa de 50% · trabalha de manhã, prefere turma noturna · retornar sexta com simulação\"." },
  { id: "e6", title: "Lead sem resposta", cat: "Funil", color: "cyan",
    situation: "Lead está há 3 dias em \"Contato feito\" sem responder.",
    text: "Crie uma tarefa de retorno para amanhã, aplique a etiqueta [Sem resposta] e, depois de 7 dias, inclua no disparo de reengajamento." },
  { id: "e7", title: "Criar usuário", cat: "Configurações", color: "pink",
    situation: "Novo consultor entrou no polo Santos.",
    text: "Configurações → Usuários → Novo. Perfil \"Consultor\", equipe \"Santos\", e marque só as caixas de entrada do polo dele." },
];

const seedScripts: Script[] = [
  { id: "s1", title: "Primeiros passos no CRM", audience: "Consultores novos", color: "cyan",
    goal: "Ao final, o consultor consegue atender um lead do início ao fim sem ajuda.",
    blocks: [
      { id: "b1", title: "Boas-vindas e visão geral", minutes: 10,
        show: ["Tela inicial e menu lateral", "Caixa de entrada do polo", "Onde ficam as notificações"], examples: [],
        tip: "Pergunte quem já usou outro CRM; ajuda a calibrar o ritmo." },
      { id: "b2", title: "Atendendo o primeiro lead", minutes: 20,
        show: ["Abrir uma conversa nova", "Responder em até 5 minutos", "Registrar nota de atendimento", "Ver o histórico do contato"], examples: ["e3", "e5"],
        faq: [{ q: "E se o lead chegar fora do horário?", a: "Responda no primeiro horário do dia seguinte e marque a etiqueta [Fora do horário]." }] },
      { id: "b3", title: "Etiquetas nos leads", minutes: 15,
        show: ["Onde ficam as etiquetas no lead", "Adicionar e remover uma etiqueta", "Filtrar a lista por etiqueta", "Fazer uma ação em grupo a partir do filtro"],
        examples: ["e1", "e6"],
        visuals: [visualTagsLead, visualTagsFiltro],
        why: [
          "Qualquer consultor entende o lead em 2 segundos, sem reler a conversa inteira.",
          "Você acha todo mundo que está na mesma situação com um clique (ex.: 12 leads aguardando valores).",
          "Dá para agir em grupo: mandar valores, reengajar ou passar para outro consultor de uma vez.",
          "Os relatórios mostram onde os leads travam — por curso, interesse ou motivo.",
        ],
        scenario: {
          situation: "Segunda de manhã, a coordenadora pergunta: \"Quantos leads de Enfermagem estão esperando valores?\"",
          before: "Abrir conversa por conversa e contar na mão. Meia hora, e ainda escapa alguém.",
          after: "Filtrar [Enfermagem] + [Aguardando valores], ver os 12 leads e mandar os valores para todos de uma vez.",
          beforeLabel: "Sem etiquetas", afterLabel: "Com etiquetas",
        },
        tip: "Mostre a imagem 1 enquanto explica onde clicar, e a imagem 2 quando perguntarem \"mas pra quê?\".",
        faq: [
          { q: "Por que não escrever isso numa nota?", a: "A nota explica o detalhe de um lead; a etiqueta serve para achar e agrupar vários. Use os dois." },
          { q: "Quantas etiquetas devo colocar?", a: "De 2 a 4: curso, momento e algo especial (bolsa, fora do horário). Mais que isso vira bagunça." },
        ] },
      { id: "b3f", title: "Funil e retorno", minutes: 10,
        show: ["Mover o card no funil", "Criar tarefa de retorno"], examples: ["e2", "e6"],
        tip: "Faça eles aplicarem as etiquetas e moverem um lead de teste antes de seguir." },
      { id: "b4", title: "Prática guiada", minutes: 15,
        show: ["Cada um atende um lead de teste", "Revisar juntos as notas", "Tirar dúvidas finais"], examples: [] },
    ] },
  { id: "s2", title: "Disparo em massa", audience: "Coordenadores de polo", color: "violet",
    goal: "Fazer um disparo correto e não deixar nenhum lead esquecido no arquivo.",
    blocks: [
      { id: "b5", title: "Escolha do template", minutes: 10, show: ["Biblioteca de templates", "Diferença entre com e sem botões"], examples: ["e4"] },
      { id: "b6", title: "Executar o disparo", minutes: 15, show: ["Selecionar a lista", "Agendar horário", "Arquivar após o envio"], examples: ["e4"],
        tip: "Mostre o erro comum: disparo sem botões e leads esquecidos no arquivo." },
      { id: "b7", title: "Acompanhar respostas", minutes: 10, show: ["Desarquivar quem respondeu", "Relatório do disparo"], examples: ["e6"] },
    ] },
  { id: "s3", title: "Administração do polo", audience: "Gestores", color: "pink",
    goal: "Gestor consegue criar usuários e acompanhar a equipe sozinho.",
    blocks: [
      { id: "b8", title: "Usuários e permissões", minutes: 15, show: ["Criar usuário", "Definir perfil e equipe", "Desativar acesso"], examples: ["e7"] },
      { id: "b9", title: "Relatórios da equipe", minutes: 15, show: ["Tempo de resposta", "Leads por consultor", "Exportar relatório"], examples: [] },
    ] },
];

export const seedLibrary = (): Library => structuredClone({ scripts: seedScripts, examples: seedExamples, folders: [] });

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Garante o formato mesmo se o que veio do banco estiver incompleto. */
export function normalizeLibrary(raw: { scripts?: unknown; examples?: unknown; folders?: unknown } | null | undefined): Library {
  return {
    folders: arr<string>(raw?.folders).filter((f) => typeof f === "string" && f.trim()),
    scripts: arr<Script>(raw?.scripts).map((s) => ({ ...s, blocks: arr<Block>(s.blocks).map((b) => ({ ...b, show: arr(b.show), examples: arr(b.examples) })) })),
    examples: arr<Example>(raw?.examples),
  };
}

export const upsertScript = (lib: Library, s: Script): Library =>
  lib.scripts.some((x) => x.id === s.id) ? { ...lib, scripts: lib.scripts.map((x) => (x.id === s.id ? s : x)) } : { ...lib, scripts: [...lib.scripts, s] };

export const removeScript = (lib: Library, id: string): Library => ({ ...lib, scripts: lib.scripts.filter((s) => s.id !== id) });

const mapScript = (lib: Library, sid: string, fn: (s: Script) => Script): Library => ({ ...lib, scripts: lib.scripts.map((s) => (s.id === sid ? fn(s) : s)) });

export const upsertBlock = (lib: Library, sid: string, b: Block): Library =>
  mapScript(lib, sid, (s) => ({ ...s, blocks: s.blocks.some((x) => x.id === b.id) ? s.blocks.map((x) => (x.id === b.id ? b : x)) : [...s.blocks, b] }));

export const removeBlock = (lib: Library, sid: string, bid: string): Library =>
  mapScript(lib, sid, (s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== bid) }));

export const moveBlock = (lib: Library, sid: string, bid: string, dir: -1 | 1): Library =>
  mapScript(lib, sid, (s) => {
    const i = s.blocks.findIndex((b) => b.id === bid), j = i + dir;
    if (i < 0 || j < 0 || j >= s.blocks.length) return s;
    const blocks = [...s.blocks];
    [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
    return { ...s, blocks };
  });

/** Troca (text) ou apaga (null) um item de "O que mostrar"; texto vazio também apaga. */
export const setShowItem = (lib: Library, sid: string, bid: string, index: number, text: string | null): Library =>
  mapScript(lib, sid, (s) => ({
    ...s,
    blocks: s.blocks.map((b) => {
      if (b.id !== bid) return b;
      const t = text?.trim();
      if (index >= b.show.length) return t ? { ...b, show: [...b.show, t] } : b;
      return { ...b, show: t ? b.show.map((x, i) => (i === index ? t : x)) : b.show.filter((_, i) => i !== index) };
    }),
  }));

export const upsertExample = (lib: Library, e: Example): Library =>
  lib.examples.some((x) => x.id === e.id) ? { ...lib, examples: lib.examples.map((x) => (x.id === e.id ? e : x)) } : { ...lib, examples: [...lib.examples, e] };

/** Apaga o exemplo e tira ele de todos os blocos que o usavam. */
export const removeExample = (lib: Library, id: string): Library => ({
  ...lib,
  examples: lib.examples.filter((e) => e.id !== id),
  scripts: lib.scripts.map((s) => ({ ...s, blocks: s.blocks.map((b) => (b.examples.includes(id) ? { ...b, examples: b.examples.filter((x) => x !== id) } : b)) })),
});

/* ───────────── Pastas de roteiros ───────────── */
/** Todas as pastas: as criadas (mesmo vazias) e as que algum roteiro usa. */
export const folderNames = (lib: Library): string[] => [...new Set([...(lib.folders ?? []), ...lib.scripts.map((s) => s.folder).filter((f): f is string => !!f)])];

export const addFolder = (lib: Library, name: string): Library => {
  const n = name.trim().slice(0, 60);
  return !n || folderNames(lib).some((f) => f.toLowerCase() === n.toLowerCase()) ? lib : { ...lib, folders: [...(lib.folders ?? []), n] };
};

export const renameFolder = (lib: Library, from: string, to: string): Library => {
  const n = to.trim().slice(0, 60);
  if (!n || n === from || folderNames(lib).some((f) => f.toLowerCase() === n.toLowerCase() && f !== from)) return lib;
  return { ...lib, folders: (lib.folders ?? []).map((f) => (f === from ? n : f)), scripts: lib.scripts.map((s) => (s.folder === from ? { ...s, folder: n } : s)) };
};

/** Apaga a pasta; os roteiros dela vão para "Sem pasta" (nada é perdido). */
export const removeFolder = (lib: Library, name: string): Library => ({
  ...lib, folders: (lib.folders ?? []).filter((f) => f !== name), scripts: lib.scripts.map((s) => (s.folder === name ? { ...s, folder: undefined } : s)),
});
