/** A ficha "Recomposição corporal — 12 semanas" como foi montada com a pessoa: exercícios, progressão dupla, fases, aquecimento, cardio e metas. */
import { cleanProgram, type Program } from "./program";

const ex = (nome: string, grupo: string, series: number, repsMin: number, repsMax: number, descansoS: number, equip: string, instrucoes: string, extra: Record<string, unknown> = {}) =>
  ({ nome, grupo, tipo: "forca", series, repsMin, repsMax, descansoS, equip, instrucoes, rir: "3–4", incrementoKg: equip === "halter" ? 1 : equip === "polia" ? 1 : 2.5, ...extra });
const timed = (nome: string, grupo: string, series: number, prescricao: string, descansoS: number, instrucoes = "") => ({ nome, grupo, tipo: "tempo", series, prescricao, descansoS, equip: "corpo", instrucoes });
const cardio = (nome: string, prescricao: string) => ({ nome, grupo: "Condicionamento", tipo: "cardio", series: 1, prescricao, descansoS: 0, equip: "maquina" });

export const RECOMP_12 = (): Program => cleanProgram({
  nome: "Recomposição corporal — 12 semanas",
  objetivos: ["Recuperar e desenvolver glúteos.", "Aumentar massa muscular nas coxas.", "Fortalecer posteriores e quadríceps.", "Reduzir gradualmente gordura abdominal, dos flancos e das costas.", "Melhorar condicionamento e força geral."],
  semanas: 12,
  perfil: { pesoKg: 71.5, alturaM: 1.7, frequencia: "5 dias", duracao: "60–75 min" },
  estrategia: "Não são cinco dias de musculação pesada: quem está retomando e cansa rápido precisa de estímulos bem distribuídos. Dois dias principais de pernas e um terceiro estímulo complementar de glúteos, sem sobrecarregar a recuperação.",
  dias: [
    { dia: 1, titulo: "Inferiores A", foco: "Glúteos e posteriores", tipo: "forca", aquecimento: ["5 minutos de bicicleta ou esteira leve.", "10 agachamentos sem peso, se confortáveis.", "Uma ou duas séries leves de preparação do primeiro exercício."], cardio: "5 min de aquecimento",
      meta: "Desenvolver a cadeia posterior e melhorar a capacidade de extensão do quadril, com foco nos glúteos.",
      exercicios: [
        ex("Leg press sentado", "Quadríceps e glúteos", 3, 10, 12, 120, "maquina", "Pés aproximadamente na largura dos ombros. Desça até onde consiga sem arredondar a lombar e empurre sem travar os joelhos.", { cargaInicial: null }),
        ex("Stiff com halteres", "Posteriores e glúteos", 2, 10, 12, 120, "halter", "Joelhos levemente flexionados, leve o quadril para trás e desça os halteres próximos às pernas. Não force a amplitude."),
        ex("Flexora", "Posteriores", 2, 12, 15, 90, "maquina", "Faça a flexão dos joelhos sem tirar o quadril do apoio."),
        ex("Coice de glúteo na polia", "Glúteos", 2, 12, 15, 75, "polia", "Mantenha o tronco estável e movimente a perna sem arquear a lombar.", { repsNota: "por perna" }),
        ex("Abdutora", "Glúteos", 2, 15, 20, 60, "maquina", "Abra as pernas controladamente, sem usar impulso."),
      ] },
    { dia: 2, titulo: "Superiores A", foco: "Costas, peito e braços", tipo: "forca", aquecimento: ["5 minutos de bicicleta ou esteira.", "Movimentos leves de ombros.", "Uma série de preparação na primeira máquina."], cardio: "10–15 min leves, opcional",
      nota: "Se a estação não tiver puxada alta ou remada adequada, ajustamos os exercícios às polias disponíveis.", meta: "Fortalecer costas e postura.",
      exercicios: [
        ex("Puxada alta na polia", "Costas", 2, 10, 12, 90, "polia", "Leve a barra em direção à parte superior do peito, sem puxar atrás da nuca."),
        ex("Remada baixa na polia", "Costas", 2, 10, 12, 90, "polia", "Leve os cotovelos para trás sem jogar o tronco."),
        ex("Peck deck", "Peito", 2, 12, 15, 75, "maquina", "Mantenha os ombros estáveis e evite alongar excessivamente."),
        ex("Elevação lateral com halteres", "Ombros", 2, 12, 15, 60, "halter", "Use halteres leves, sem balançar o corpo."),
        ex("Tríceps na corda", "Tríceps", 2, 12, 15, 60, "polia", "Mantenha os cotovelos próximos ao tronco."),
        ex("Rosca bíceps com halteres", "Bíceps", 2, 12, 15, 60, "halter", "Evite movimentar os ombros para conseguir levantar o peso."),
      ] },
    { dia: 3, titulo: "Cardio + abdômen", foco: "Condicionamento", tipo: "cardio", aquecimento: [], cardio: "20–30 min moderados",
      nota: "Cardio em intensidade moderada: dá para conversar, mas percebe que está se exercitando. Se estiver cansada, faça só 15 minutos de cardio leve e os abdominais com boa técnica. Não precisa completar um tempo fixo a qualquer custo.", meta: "Condicionamento e core.",
      exercicios: [cardio("Esteira", "15–20 min"), timed("Dead bug", "Abdômen", 2, "2 × 10 por lado", 45), timed("Prancha", "Abdômen", 2, "2 × 15–25 s", 45), ex("Crunch abdominal", "Abdômen", 2, 12, 12, 45, "corpo", "", { rir: "", progressao: "nenhuma" }), cardio("Esteira ou bicicleta", "5–10 min leves")] },
    { dia: 4, titulo: "Inferiores B", foco: "Quadríceps e glúteos", tipo: "forca", aquecimento: ["5 minutos de bicicleta ou esteira leve.", "10 agachamentos sem peso, se confortáveis.", "Uma ou duas séries leves de preparação do primeiro exercício."], cardio: "5 min de aquecimento",
      nota: "A elevação pélvica é importante para desenvolver a extensão do quadril. Não precisa usar carga alta inicialmente.", meta: "Quadríceps e glúteos.",
      exercicios: [
        ex("Leg press sentado", "Quadríceps e glúteos", 3, 10, 12, 120, "maquina", "Use uma amplitude confortável, mantendo os pés firmes."),
        ex("Extensora", "Quadríceps", 2, 12, 15, 90, "maquina", "Estenda os joelhos controladamente e não dê trancos."),
        ex("Agachamento goblet", "Quadríceps e glúteos", 2, 10, 12, 90, "halter", "Segure um halter junto ao peito e agache mantendo o tronco estável."),
        ex("Adutora", "Adutores", 2, 12, 15, 60, "maquina", "Controle o fechamento das pernas."),
        ex("Elevação pélvica com halter", "Glúteos", 2, 12, 15, 90, "halter", "Apoie a parte superior das costas no banco, mantenha os pés firmes e eleve o quadril contraindo os glúteos."),
      ] },
    { dia: 5, titulo: "Superiores B + glúteos", foco: "Fortalecimento geral e glúteos", tipo: "forca", aquecimento: ["5 minutos de bicicleta ou esteira.", "Movimentos leves de ombros.", "Uma série de preparação na primeira máquina."], cardio: "10–15 min leves, opcional",
      nota: "Se a polia não permitir abdução com boa estabilidade, substituímos por abdutora. Esse terceiro estímulo de glúteos é propositalmente leve: não é outro treino pesado de pernas.", meta: "Corpo todo e glúteos.",
      exercicios: [
        ex("Coice de glúteo na polia", "Glúteos", 2, 12, 15, 60, "polia", "Tronco estável, sem arquear a lombar.", { repsNota: "por perna" }),
        ex("Abdução de quadril na polia", "Glúteos", 2, 12, 15, 60, "polia", "Só se a polia permitir boa estabilidade; senão, abdutora.", { repsNota: "por perna" }),
        ex("Supino com halteres no banco", "Peito", 2, 10, 12, 90, "halter", ""),
        ex("Remada na polia", "Costas", 2, 12, 12, 90, "polia", ""),
        ex("Face pull na polia", "Ombros e postura", 2, 12, 15, 60, "polia", ""),
        timed("Prancha lateral", "Abdômen", 2, "2 × 15–20 s por lado", 45),
      ] },
    { dia: 6, titulo: "Descanso ou caminhada", foco: "Recuperação", tipo: "descanso", aquecimento: [], cardio: "", nota: "", meta: "Recuperação.", exercicios: [] },
    { dia: 0, titulo: "Descanso", foco: "Recuperação", tipo: "descanso", aquecimento: [], cardio: "", nota: "", meta: "Recuperação.", exercicios: [] },
  ],
  fases: [
    [1, "Aprender", "Encontrar cargas e ajustar máquinas"], [2, "Adaptar", "Repetir cargas e melhorar execução"], [3, "Evoluir", "Tentar aumentar repetições"], [4, "Consolidar", "Aumentar carga somente quando cumprir os critérios"],
    [5, "Progredir", "Continuar sobrecarga gradual"], [6, "Progredir", "Melhorar desempenho"], [7, "Consolidar", "Avaliar recuperação e fadiga"], [8, "Reavaliar", "Comparar cargas e medidas"],
    [9, "Desenvolver", "Retomar progressão conforme avaliação"], [10, "Evoluir", "Melhorar repetições e cargas"], [11, "Consolidar", "Buscar execução consistente"], [12, "Avaliar", "Comparar resultados e planejar novo ciclo"],
  ].map(([semana, objetivo, orientacao]) => ({ semana, objetivo, orientacao })),
  regras: [
    { situacao: "Não consegue atingir o mínimo de repetições", acao: "Reduzir a carga" }, { situacao: "Consegue o mínimo com esforço moderado", acao: "Manter" },
    { situacao: "Consegue aumentar repetições com boa técnica", acao: "Manter e progredir repetições" }, { situacao: "Atinge o máximo em todas as séries com 2 repetições de reserva", acao: "Aumentar carga" },
    { situacao: "Perde a postura ou utiliza impulso", acao: "Reduzir a carga" }, { situacao: "Sente dor articular", acao: "Interromper e avaliar" },
  ],
  incrementos: ["Máquinas de pernas: menor incremento disponível, preferencialmente 2,5–5 kg.", "Halteres: normalmente 1–2 kg por halter, quando disponíveis.", "Polias: menor incremento possível.", "Se o próximo peso for muito alto, não precisa aumentar: continue na carga anterior até estar preparada."],
  rirEscala: [{ rir: 4, significado: "Conseguiria fazer mais 4 repetições" }, { rir: 3, significado: "Conseguiria fazer mais 3" }, { rir: 2, significado: "Conseguiria fazer mais 2" }, { rir: 1, significado: "Conseguiria fazer mais 1" }, { rir: 0, significado: "Não conseguiria fazer outra repetição correta" }],
  rirNota: "Nas primeiras semanas, principalmente RIR 3–4. Depois, se estiver adaptada, RIR 2–3 na maioria dos exercícios. Não é preciso chegar à falha muscular. Não acrescentar séries automaticamente a cada semana: o volume inicial já é suficiente.",
  cargaInicial: ["Informado: leg press sentado 60–70 kg e extensora 30–40 kg — não assumir como cargas atuais, porque ficou um tempo sem treinar regularmente.", "Na primeira semana, avaliação prática: comece com uma carga leve, faça 10 repetições controladas, descanse, aumente um pouco se estiver muito fácil.", "Repita até achar um peso com o qual consiga executar a faixa prescrita mantendo 3–4 repetições em reserva. Não faça vários testes até a exaustão.", "Registre o peso que funcionou como referência inicial."],
  acompanhamento: ["Executa o treino.", "Registra cargas e repetições.", "Envia os resultados.", "O desempenho e a recuperação são analisados.", "As cargas, repetições e volume são ajustados.", "A cada duas semanas, analisam-se as medidas.", "A cada quatro semanas, comparam-se as fotos.", "Na semana 12, avaliação completa."],
  medidas: ["Peso", "Peito", "Braço direito e esquerdo", "Cintura", "Abdômen", "Quadril/glúteos", "Coxa direita e esquerda", "Panturrilhas"],
  metas: ["Conseguir executar todos os exercícios com técnica correta", "Estabelecer cargas iniciais confiáveis", "Evoluir repetições e cargas nos principais exercícios", "Melhorar a resistência física", "Desenvolver força de glúteos e pernas", "Melhorar a consistência dos treinos", "Registrar todas as avaliações corporais"].map((texto) => ({ texto, feita: false })),
  orientacoes: ["Nas primeiras duas semanas, usar o volume prescrito com cargas conservadoras. Se houver dor muscular excessiva ou recuperação ruim, reduzir séries.", "Se houver fraqueza e uso de Mounjaro, não insistir em musculação intensa em jejum. Conversar com o médico e o nutricionista sobre a ingestão alimentar e a hidratação ao redor dos treinos.", "Se não conseguir completar 90 minutos, não tem problema: a musculação é prioridade, não é preciso preencher o tempo com cardio."],
  observacoes: ["Cardio: não fazer cardio excessivo enquanto recupera massa muscular. O objetivo é melhorar o condicionamento, não compensar comida nem acelerar a perda de peso a qualquer custo. Se estiver cansada, reduzir o cardio; se sentir fraqueza, tontura ou mal-estar, interromper o treino.", "Medidas a cada duas semanas e fotos de frente, lado e costas a cada quatro semanas, sempre em condições semelhantes. Uma medida isolada não é ganho nem perda de músculo: analisar tendências, medidas, fotos e desempenho em conjunto.", "A dieta será construída depois de consolidar o treinamento, com atenção à preservação muscular e à tolerância alimentar durante o uso do Mounjaro.", "Confirmar visualmente o peck deck, os acessórios das polias e o modelo do leg press. Se algum exercício não puder ser executado no aparelho real, fazer a substituição."],
})!;
