/** Roteiro de implantação: fases e passos para colocar o sistema do cliente no ar, do zero. Regras puras (sem rede). */
export type SetupStatus = "todo" | "doing" | "done" | "blocked" | "na";
export type SetupStepDef = { key: string; title: string; hint: string };
export type SetupPhaseDef = { id: string; name: string; tone: "cyan" | "violet" | "emerald" | "amber" | "pink"; goal: string; steps: SetupStepDef[] };
export type SetupStep = SetupStepDef & { id: string; phase: string; phaseIndex: number; position: number; status: SetupStatus; note: string; doneAt: string | null };

const st = (key: string, title: string, hint: string): SetupStepDef => ({ key, title, hint });

/** Modelo padrão. Os passos são do processo de implantação em si; confira os nomes das telas no sistema do cliente. */
export const SETUP_TEMPLATE: SetupPhaseDef[] = [
  { id: "base", name: "Base e acessos", tone: "cyan", goal: "Ter tudo o que é preciso para começar sem travar.", steps: [
    st("contrato", "Contrato assinado e cobrança combinada", "Confirme assinatura, valor, vencimento e quem recebe a cobrança. Guarde o contrato na pasta do cliente."),
    st("dados", "Dados da empresa e responsáveis", "Razão social, CNPJ, endereço, responsável técnico e quem decide. Preencha a ficha do cliente."),
    st("acesso-admin", "Acesso de administrador ao sistema", "Peça o convite ou crie o usuário admin. Nunca anote senhas no Orion: use seu gerenciador de senhas."),
    st("kickoff", "Reunião de kickoff realizada", "Alinhe escopo, prazos e quem acompanha cada etapa. Registre a ata na pasta do cliente."),
  ] },
  { id: "empresa", name: "Estrutura da empresa", tone: "violet", goal: "Deixar a empresa e a equipe cadastradas do jeito certo.", steps: [
    st("empresa", "Cadastrar empresa, unidades e setores", "Crie as unidades e os setores (ex.: comercial, suporte, financeiro) que vão atender."),
    st("usuarios", "Criar usuários da equipe e perfis de permissão", "Um usuário por pessoa. Dê só o acesso necessário a cada perfil (menor privilégio)."),
    st("assinatura", "Configurar a assinatura do usuário", "Defina como cada atendente se identifica nas mensagens (nome e setor). Teste com uma mensagem real."),
    st("identidade", "Logo, nome de exibição e foto do perfil", "Padronize o nome que o cliente final vê. Foto e descrição do perfil comercial, se o canal permitir."),
  ] },
  { id: "horario", name: "Horário de funcionamento", tone: "amber", goal: "O sistema sabe quando atende e o que dizer quando não atende.", steps: [
    st("expediente", "Definir horário por dia da semana", "Preencha cada dia, incluindo intervalo de almoço e fins de semana. Confirme o fuso horário."),
    st("feriados", "Cadastrar feriados e dias sem atendimento", "Inclua feriados nacionais, locais e recessos. Combine quem revisa a lista todo fim de ano."),
    st("fora-expediente", "Mensagem de fora do expediente", "Diga quando voltam a atender e ofereça um caminho (formulário, e-mail ou urgência). Teste fora do horário."),
  ] },
  { id: "fluxo", name: "Fluxo de atendimento", tone: "emerald", goal: "Cada conversa chega à pessoa certa, no tempo certo.", steps: [
    st("desenho", "Desenhar o fluxo no papel (triagem → setor → atendente)", "Rascunhe o caminho da conversa e valide com o cliente antes de configurar. Evite menus longos."),
    st("filas", "Criar filas ou departamentos e regras de distribuição", "Defina quem recebe o quê (rodízio, por carga ou por especialidade) e o que acontece sem ninguém online."),
    st("boas-vindas", "Mensagem de boas-vindas e menu de opções", "Texto curto, identifica a empresa e oferece poucas opções claras. Teste cada opção."),
    st("transferencia", "Regras de transferência entre setores", "Quando e como passar a conversa, sem o cliente repetir tudo. Registre o motivo da transferência."),
    st("encerramento", "Encerramento e pesquisa de satisfação", "Mensagem final, motivo de encerramento obrigatório e pesquisa curta, se o cliente quiser."),
    st("sla", "Tempos esperados (SLA) e alertas", "Combine tempo da primeira resposta e de resolução. Configure alertas para conversas paradas."),
  ] },
  { id: "kanban", name: "Kanban e funil", tone: "pink", goal: "Enxergar cada oportunidade ou atendimento andando por etapas.", steps: [
    st("quadro", "Criar o quadro Kanban", "Um quadro por processo (ex.: vendas, suporte). Dê um nome que o time reconheça."),
    st("colunas", "Definir as colunas (etapas) do funil", "Etapas curtas e na ordem real do trabalho. Defina o que significa entrar e sair de cada uma."),
    st("campos", "Campos, etiquetas e responsáveis dos cartões", "Só os campos que serão usados. Padronize etiquetas e quem é o dono de cada cartão."),
    st("automacoes", "Automações de movimentação", "Regras como mover o cartão quando o cliente responde ou quando o prazo vence. Teste com um cartão de exemplo."),
  ] },
  { id: "canais", name: "Canais e integrações", tone: "cyan", goal: "Conversas entrando e saindo pelos canais certos.", steps: [
    st("whatsapp", "Conectar o número de WhatsApp", "Confirme quem é o dono do número e do portfólio. Siga o fluxo oficial de onboarding."),
    st("templates", "Criar e aprovar templates de mensagem", "Categorias certas (marketing, utilidade, autenticação) e opt-in documentado. Aprovação pode levar tempo."),
    st("respostas", "Respostas rápidas e mensagens padrão", "Cadastre as mais usadas e combine quem mantém a lista atualizada."),
    st("integracoes", "Integrações (CRM, e-mail, webhooks)", "Mapeie o caminho de ida e de volta e valide com um teste. Não exponha tokens em prints ou chamados."),
  ] },
  { id: "golive", name: "Testes e go-live", tone: "violet", goal: "Entrar no ar com segurança e equipe treinada.", steps: [
    st("teste", "Teste ponta a ponta com a equipe", "Simule uma conversa completa: entrada, triagem, transferência, kanban e encerramento. Anote o que falhou."),
    st("treinamento", "Treinar a equipe", "Mostre o dia a dia (atender, transferir, usar o kanban). Deixe um material de consulta na pasta do cliente."),
    st("checklist-golive", "Checklist final de go-live", "Horários, assinaturas, filas, templates e integrações conferidos. Combine o dia e o plano B."),
    st("acompanhamento", "Acompanhar a primeira semana", "Revise conversas e métricas em 24 h e em 7 dias, ajuste o fluxo e feche o onboarding."),
  ] },
];

export const STATUS_LABEL: Record<SetupStatus, string> = { todo: "A fazer", doing: "Fazendo", done: "Concluído", blocked: "Travado", na: "Não se aplica" };
export const isFinished = (s: SetupStatus) => s === "done" || s === "na";

export type PhaseProgress = { id: string; name: string; index: number; total: number; finished: number; pct: number; blocked: number; doing: number };
export type SetupProgress = { total: number; finished: number; pct: number; phases: PhaseProgress[]; next: SetupStep | null; blocked: SetupStep[] };

/** Progresso geral e por fase; "concluído" e "não se aplica" contam como feitos. `next` é o primeiro passo ainda aberto (fazendo, depois a fazer). */
export function progressOf(steps: SetupStep[]): SetupProgress {
  const phases = new Map<string, PhaseProgress>();
  for (const s of steps) {
    const p = phases.get(s.phase) ?? { id: s.phase, name: s.phase, index: s.phaseIndex, total: 0, finished: 0, pct: 0, blocked: 0, doing: 0 };
    p.total++; if (isFinished(s.status)) p.finished++; if (s.status === "blocked") p.blocked++; if (s.status === "doing") p.doing++;
    phases.set(s.phase, p);
  }
  const list = [...phases.values()].sort((a, b) => a.index - b.index).map((p) => ({ ...p, pct: p.total ? Math.round((p.finished / p.total) * 100) : 0 }));
  const finished = steps.filter((s) => isFinished(s.status)).length, ordered = [...steps].sort((a, b) => a.phaseIndex - b.phaseIndex || a.position - b.position);
  const open = ordered.filter((s) => !isFinished(s.status));
  return { total: steps.length, finished, pct: steps.length ? Math.round((finished / steps.length) * 100) : 0, phases: list, next: open.find((s) => s.status === "doing") ?? open.find((s) => s.status !== "blocked") ?? open[0] ?? null, blocked: ordered.filter((s) => s.status === "blocked") };
}

/** Linhas a inserir para o modelo (sem tocar no que já existe, que é identificado pela `key`). */
export function missingRows(template: SetupPhaseDef[], existingKeys: Iterable<string>) {
  const have = new Set(existingKeys), out: { key: string; phase: string; phase_position: number; position: number; title: string; hint: string }[] = [];
  template.forEach((ph, pi) => ph.steps.forEach((s, si) => { if (!have.has(s.key)) out.push({ key: s.key, phase: ph.name, phase_position: pi, position: si, title: s.title, hint: s.hint }); }));
  return out;
}
export const toneOfPhase = (name: string, index = 0): SetupPhaseDef["tone"] => SETUP_TEMPLATE.find((p) => p.name === name)?.tone ?? (["cyan", "violet", "emerald", "amber", "pink"] as const)[index % 5]!;
export const goalOfPhase = (name: string) => SETUP_TEMPLATE.find((p) => p.name === name)?.goal ?? "";

const TONES = ["cyan", "violet", "emerald", "amber", "pink"] as const;
const rk = () => Math.random().toString(36).slice(2, 7);
/** Valida um modelo salvo: cada fase precisa de nome e ao menos um passo com título; gera chaves únicas. `null` = inválido/vazio (usa o modelo de fábrica). */
export function sanitizeTemplate(raw: unknown): SetupPhaseDef[] | null {
  if (!Array.isArray(raw)) return null;
  type P = { id?: unknown; name?: unknown; goal?: unknown; steps?: unknown }; type S = { key?: unknown; title?: unknown; hint?: unknown };
  const out: SetupPhaseDef[] = [], keys = new Set<string>();
  for (const ph of (raw as P[]).slice(0, 30)) {
    if (!ph || typeof ph !== "object" || typeof ph.name !== "string" || !ph.name.trim() || !Array.isArray(ph.steps)) continue;
    const steps: SetupStepDef[] = [];
    for (const st of (ph.steps as S[]).slice(0, 60)) {
      if (!st || typeof st !== "object" || typeof st.title !== "string" || !st.title.trim()) continue;
      let key = typeof st.key === "string" && st.key.trim() ? st.key.trim().slice(0, 60) : `t-${rk()}`; while (keys.has(key)) key = `t-${rk()}`;
      keys.add(key); steps.push({ key, title: st.title.trim().slice(0, 200), hint: typeof st.hint === "string" ? st.hint.slice(0, 1000) : "" });
    }
    if (steps.length) out.push({ id: typeof ph.id === "string" && ph.id ? ph.id : `p-${out.length}`, name: ph.name.trim().slice(0, 80), tone: TONES[out.length % TONES.length]!, goal: typeof ph.goal === "string" ? ph.goal.slice(0, 200) : "", steps });
  }
  return out.length ? out : null;
}
/** Transforma o roteiro de um cliente em modelo (mantém fases, ordem, títulos e "como fazer"; sem status nem anotações). */
export function templateFromSteps(steps: SetupStep[]): SetupPhaseDef[] {
  const phases = new Map<string, SetupStep[]>(), order: string[] = [];
  for (const s of [...steps].sort((a, b) => a.phaseIndex - b.phaseIndex || a.position - b.position)) { if (!phases.has(s.phase)) { phases.set(s.phase, []); order.push(s.phase); } phases.get(s.phase)!.push(s); }
  return order.map((name, i) => ({ id: `p-${i}`, name, tone: TONES[i % TONES.length]!, goal: goalOfPhase(name), steps: phases.get(name)!.map((s) => ({ key: s.key.startsWith("custom-") ? `t-${rk()}` : s.key, title: s.title, hint: s.hint })) }));
}

export type SetupExisting = { id: string; key: string; status: SetupStatus; note: string };
/** Troca o roteiro antigo pelo modelo atual sem perder andamento: mantém status/anotação dos passos que continuam,
 *  cria os novos e apaga só os antigos que ninguém mexeu (a fazer, sem anotação, não criados à mão). */
export function planReplace(template: SetupPhaseDef[], existing: SetupExisting[]) {
  const byKey = new Map(existing.map((e) => [e.key, e])), keys = new Set<string>();
  const update: { id: string; phase: string; phase_position: number; position: number; title: string; hint: string }[] = [];
  const insert: { key: string; phase: string; phase_position: number; position: number; title: string; hint: string }[] = [];
  template.forEach((ph, pi) => ph.steps.forEach((s, si) => {
    keys.add(s.key);
    const row = { phase: ph.name, phase_position: pi, position: si, title: s.title, hint: s.hint }, e = byKey.get(s.key);
    if (e) update.push({ id: e.id, ...row }); else insert.push({ key: s.key, ...row });
  }));
  const remove = existing.filter((e) => !keys.has(e.key) && e.status === "todo" && !e.note.trim() && !e.key.startsWith("custom-")).map((e) => e.id);
  return { update, insert, remove };
}
