/** Ficha pronta: plano alimentar de recomposição corporal (proposta inicial educativa; validar com nutricionista e médico). */
import type { DietPlan } from "./diet-plan";

const it = (alimento: string, qtd: string, g?: number, protG?: number) => ({ alimento, qtd, g: g ?? null, protG: protG ?? null });
const par = (alimento: string, porcao: string) => ({ alimento, porcao });

export function DIET_RECOMP(): DietPlan {
  return {
    nome: "Recomposição corporal — plano alimentar inicial",
    objetivo: "Perder gordura preservando e ganhando massa magra, com treino 5×/semana e Mounjaro sob acompanhamento médico.",
    perfil: { idade: 28, sexo: "Feminino", pesoKg: 71.5, alturaM: 1.7, imc: 24.7, treino: "5×/semana, à noite", duracaoTreino: "60–90 min", medicacao: "Mounjaro 2,5 mg semanal (acompanhamento médico)", preferencia: "2 ou 3 refeições por dia", horarios: "1ª refeição 12h30 · última ~19h30", hidratacao: "menos de 1 L/dia" },
    metas: { kcal: null, p: null, c: null, f: null },
    atencao: "Esta é uma proposta inicial educativa. Antes de seguir, valide com seu nutricionista e com o médico que acompanha o uso do Mounjaro.",
    estrategia: ["Proteína em todas as refeições", "Prato simples e repetível", "Treino bem alimentado (carboidrato em volta do treino)", "Hidratação subindo aos poucos", "Cuidar do intestino", "Sem contar calorias: foco em constância", "Comparar as opções 2 × 3 refeições pelo que você sente"],
    proteina: { min: 115, max: 130, nota: "Meta diária de proteína (≈1,6–1,8 g/kg). Prefira distribuir entre as refeições." },
    tmb: 1477, semMeta: "Sem meta calórica rígida por enquanto: a TMB estimada é ~1.477 kcal, e o apetite com Mounjaro varia — o que manda é proteína, constância e como você se sente.",
    opcoes: [
      { id: "A", nome: "Opção A — 2 refeições", tag: "Almoço + jantar pós-treino", recomendada: false, resumo: "Refeições maiores: almoço 12h30 e jantar depois do treino.", refeicoes: [
        { id: "a-almoco", nome: "Almoço", hora: "12h30", objetivo: "Refeição principal do dia, com proteína e carboidrato.", orientacoes: [], itens: [it("Frango", "180 g", 180, 56), it("Arroz", "180 g", 180, 4.5), it("Feijão", "120 g", 120, 6.5), it("Salada", "100–150 g", 125), it("Azeite", "5 g", 5), it("Mamão", "150 g", 150)] },
        { id: "a-jantar", nome: "Jantar pós-treino", hora: "após o treino", objetivo: "Recuperar o treino: proteína + carboidrato.", orientacoes: ["Se faltar proteína no dia, complete com whey."], itens: [it("Carne moída magra", "180 g", 180, 47), it("Batata", "300 g", 300, 6), it("Salada com cenoura", "100–150 g", 125), it("Azeite", "5 g", 5), it("Morangos", "100 g", 100)] },
      ] },
      { id: "B", nome: "Opção B — 3 refeições", tag: "Recomendada para experimentar", recomendada: true, resumo: "Porções menores e um lanche proteico no meio da tarde, para o estômago não pesar.", refeicoes: [
        { id: "b-almoco", nome: "Almoço", hora: "12h30", objetivo: "Base proteica com carboidrato moderado.", orientacoes: [], itens: [it("Frango", "130 g", 130, 40), it("Arroz", "120 g", 120, 3), it("Feijão", "80 g", 80, 4.4), it("Salada", "100 g", 100), it("Azeite", "5 g", 5), it("Mamão", "100 g", 100)] },
        { id: "b-lanche", nome: "Lanche proteico", hora: "16h30", objetivo: "Garantir proteína e energia antes do treino.", orientacoes: ["Whey com água.", "Fruta: banana pequena ou 150 g de morangos."], itens: [it("Whey", "1 dose (24–25 g de proteína)", undefined, 24.5), it("Banana pequena ou morangos", "1 un. ou 150 g")] },
        { id: "b-jantar", nome: "Jantar", hora: "após o treino", objetivo: "Fechar a proteína do dia e recuperar.", orientacoes: [], itens: [it("Carne moída magra ou frango", "150 g", 150, 39), it("Batata", "180 g", 180, 3.6), it("Salada", "100 g", 100), it("Azeite", "5 g", 5), it("Fruta pequena", "1 un.")] },
      ] },
    ],
    trocasProteina: [par("Frango", "troca por carne moída magra, bife ou peixe"), par("Carne moída magra", "troca por frango ou peixe"), par("Ovos", "2 ovos ≈ 1 porção de proteína")], trocasProteinaNota: "Mantenha a porção; varie a fonte.",
    trocasCarbo: [par("Arroz", "batata, batata-doce ou mandioca"), par("Batata (jantar)", "arroz ou batata-doce")], trocasCarboNota: "Troque por equivalente, não some os dois.",
    frutas: ["Mamão", "Banana", "Morango", "Goiaba", "Laranja", "Mexerica", "Maçã", "Kiwi"], frutasNota: "Frutas aceitas; varie conforme a estação.",
    whey: { dose: "1 dose ≈ 24–25 g de proteína, com água", notas: ["Use como complemento quando faltar proteína no dia.", "Com intolerância à lactose, prefira whey isolado ou bebida sem lactose."] },
    treinoNota: ["Treino à noite: almoço e lanche bem feitos sustentam o desempenho.", "Depois do treino, jantar com proteína e carboidrato.", "Se sentir o estômago pesado no treino, teste a Opção B."],
    hidratacao: { atualMl: 1000, orientacoes: ["Aumentar aos poucos, sem meta rígida.", "Água ao longo do dia, não só nas refeições."], estrategia: ["Garrafa sempre à vista", "Um copo ao acordar", "Um copo a cada refeição", "Lembrete a cada 2 h"], aviso: "Aumente gradualmente: forçar de uma vez pode causar desconforto." },
    intestino: { texto: "O Mounjaro pode desacelerar o intestino. Observe a frequência e a consistência.", estrategias: ["Hidratação em alta aos poucos", "Salada e frutas todo dia", "Feijão e aveia, se toleradas", "Caminhar após as refeições"], aviso: "Se passar de 4 dias sem evacuar, avise o médico. Não use laxantes nem fibras por conta própria." },
    aceitos: ["Frango", "Carne moída", "Arroz", "Feijão", "Batata", "Alface", "Tomate", "Pepino", "Cenoura", "Mamão", "Banana", "Morango"],
    rejeitados: ["Chuchu", "Abobrinha", "Beterraba", "Abóbora", "Brócolis", "Quiabo", "Vagem"], preferenciasNota: "Os rejeitados ficam fora do plano.",
    comparar: { registrar: ["Estômago cheio", "Facilidade de cumprir", "Proteína suficiente", "Energia", "Desempenho no treino", "Desconforto digestivo"], nota: "Teste cada opção por 1–2 semanas e compare pelo que você registrar." },
    semanal: ["Peso", "Cintura", "Abdômen", "Quadril", "Evacuação", "Água", "Energia", "Desempenho nos treinos", "Dificuldade do plano", "Efeitos digestivos e saciedade"],
    revisar: ["Peso estável ou subindo por 3 semanas", "Fraqueza, tontura ou queda forte no treino", "Intestino travado por 4 dias ou mais", "Fome ou saciedade fora do controle"],
    seguranca: ["Acompanhamento médico do Mounjaro continua obrigatório.", "Em caso de enjoo forte, vômitos ou dor abdominal, procure o médico.", "Este plano não substitui nutricionista."],
    objetivoFinal: "Reduzir gordura, ganhar força e massa magra, com um plano que você consiga sustentar.",
    grupos: [
      { id: "1", nome: "Energéticos", referencia: "≈ 100–120 kcal", nota: "", destaque: "", itens: [par("Arroz", "4 col. sopa"), par("Arroz integral", "4 col. sopa"), par("Batata cozida", "2 un. pequenas"), par("Batata-doce", "1 un. pequena"), par("Purê", "3 col. sopa"), par("Mandioca", "1 pedaço pequeno"), par("Milho", "5 col. sopa"), par("Macarrão", "3 col. sopa"), par("Polenta", "4 col. sopa")] },
      { id: "2", nome: "Extras açucarados", referencia: "≈ 20 kcal (1 col. chá)", nota: "", destaque: "", itens: [par("Açúcar branco", "1 col. chá"), par("Açúcar mascavo", "1 col. chá"), par("Mel", "1 col. chá"), par("Açúcar cristal", "1 col. chá")] },
      { id: "3", nome: "Gorduras", referencia: "≈ 40 kcal", nota: "", destaque: "", itens: [par("Azeite", "1 col. sobremesa"), par("Manteiga", "1 col. chá"), par("Margarina light", "2 col. chá"), par("Requeijão", "1 col. sobremesa"), par("Requeijão light", "1 col. sopa"), par("Maionese", "1 col. sopa")] },
      { id: "4", nome: "Reguladores", referencia: "livres", nota: "Priorize: alface, pepino, tomate, cenoura crua ralada, repolho roxo/branco, cebola roxa.", destaque: "", itens: [par("Alface", "à vontade"), par("Pepino", "à vontade"), par("Tomate", "à vontade"), par("Cenoura crua ralada", "à vontade"), par("Repolho", "à vontade"), par("Cebola roxa", "à vontade")] },
      { id: "5", nome: "Frutas", referencia: "≈ 60 kcal", nota: "", destaque: "", itens: [par("Banana", "1 média"), par("Abacaxi", "1 fatia grossa"), par("Mamão papaia", "½"), par("Mamão formosa", "1 fatia grande"), par("Manga", "½ pequena"), par("Melão", "2 fatias"), par("Mexerica", "1"), par("Morango", "15"), par("Goiaba", "1"), par("Kiwi", "1 grande"), par("Laranja", "1 grande"), par("Uva", "10"), par("Maçã", "1 pequena")] },
      { id: "6", nome: "Sucos e bebidas", referencia: "200 ml", nota: "Sucos e chás sem açúcar. Água de coco conta como porção.", destaque: "", itens: [par("Suco sem açúcar", "200 ml"), par("Chá sem açúcar", "200 ml"), par("Água de coco", "200 ml (contabilizar)")] },
      { id: "7", nome: "Leites e derivados", referencia: "≈ 70 kcal", nota: "Priorize iogurte natural e cottage. Whey fica fora deste grupo.", destaque: "", itens: [par("Leite desnatado / sem lactose", "200 ml"), par("Iogurte light", "1 un."), par("Iogurte desnatado", "200 ml"), par("Cottage", "4 col. sopa"), par("Cream cheese light", "1½ col."), par("Ricota", "1 fatia média"), par("Queijo branco", "1 fatia grossa")] },
      { id: "8", nome: "Sobremesas", referencia: "≈ 120 kcal", nota: "", destaque: "", itens: [par("Arroz-doce", "3 col. sopa"), par("Brigadeiro", "3 un."), par("Canjica", "3 col. sopa"), par("Goiabada", "1 fatia fina"), par("Picolé", "1"), par("Doce de leite", "3 cubos"), par("Pudim", "1 fatia pequena"), par("Cocada", "1 pequena")] },
      { id: "9", nome: "Construtores", referencia: "≈ 150 kcal", nota: "As porções são equivalência calórica, não de proteína.", destaque: "", itens: [par("Filé de frango", "1½"), par("Sobrecoxa", "1"), par("Bife", "1 pequeno"), par("Carne moída", "4 col. sopa"), par("Carne assada", "1 fatia pequena"), par("Carne cozida", "1 fatia"), par("Peixe", "1 filé grande"), par("Lombo", "1 fatia pequena"), par("Ovo", "2"), par("Atum light", "1 lata"), par("Hambúrguer de peru/frango", "1")] },
      { id: "10", nome: "Grãos", referencia: "≈ 70 kcal", nota: "", destaque: "", itens: [par("Feijão", "4 col. sopa"), par("Lentilha", "3 col. sopa"), par("Grão-de-bico", "2 col. sopa"), par("Ervilha fresca", "3 col. sopa"), par("Ervilha torta", "10 un."), par("Soja cozida", "2½ col. sopa"), par("Proteína texturizada", "1½ xícara")] },
      { id: "11", nome: "Sopas", referencia: "≈ 150 kcal", nota: "", destaque: "", itens: [par("Feijão com macarrão", "2 conchas"), par("Creme de ervilha", "1½ concha"), par("Creme de legumes (carne/macarrão/arroz)", "2 conchas"), par("Creme de queijo", "1½ concha")] },
    ],
    trocas: [
      { se: "Arroz", escolha: "batata, batata-doce ou mandioca" }, { se: "Frango", escolha: "carne moída, bife, peixe ou lombo" }, { se: "Feijão", escolha: "lentilha ou grão-de-bico" },
      { se: "Mamão", escolha: "banana, goiaba, laranja ou mexerica" }, { se: "Salada de alface", escolha: "repolho, pepino, tomate ou cenoura" }, { se: "Whey com água", escolha: "whey com bebida sem lactose" }, { se: "Batata no jantar", escolha: "arroz ou batata-doce" },
    ], trocasNota: "Troque 1 por 1, sem somar.",
    versaoPratica: [
      { refeicao: "Almoço", principal: "Frango + arroz + feijão", alternativas: "Carne moída ou bife + batata + feijão" },
      { refeicao: "Lanche", principal: "Whey + banana", alternativas: "Whey + morango, ou iogurte com whey" },
      { refeicao: "Jantar", principal: "Carne moída + batata", alternativas: "Frango + arroz, ou peixe + batata-doce" },
    ],
  };
}
