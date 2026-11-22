export type Cat = { id: string; name: string; color: string; icon: string; income?: boolean; words: string[] };

/** Cores em oklch para combinar com o tema escuro do Orion. */
export const DEFAULT_CATS: Cat[] = [
  { id: "moradia", name: "Moradia", color: "oklch(0.72 0.17 290)", icon: "Home", words: ["aluguel", "condominio", "condomínio", "luz", "energia", "agua", "água", "gas", "gás", "iptu", "internet", "reforma", "móveis", "moveis", "sofá", "sofa"] },
  { id: "mercado", name: "Mercado", color: "oklch(0.8 0.16 160)", icon: "ShoppingCart", words: ["mercado", "supermercado", "feira", "padaria", "açougue", "acougue", "hortifruti", "atacadão", "atacadao"] },
  { id: "restaurantes", name: "Restaurantes", color: "oklch(0.78 0.16 55)", icon: "Utensils", words: ["restaurante", "ifood", "lanche", "pizza", "hamburguer", "hambúrguer", "almoço", "almoco", "jantar", "café", "cafe", "sorvete", "bar", "delivery", "almocei", "jantei", "lanchei", "marmita"] },
  { id: "transporte", name: "Transporte", color: "oklch(0.78 0.13 235)", icon: "Car", words: ["uber", "99", "gasolina", "combustível", "combustivel", "estacionamento", "ônibus", "onibus", "metrô", "metro", "pedágio", "pedagio", "passagem", "oficina"] },
  { id: "saude", name: "Saúde", color: "oklch(0.74 0.2 15)", icon: "HeartPulse", words: ["farmácia", "farmacia", "remédio", "remedio", "médico", "medico", "consulta", "exame", "dentista", "plano de saúde", "academia", "terapia"] },
  { id: "educacao", name: "Educação", color: "oklch(0.82 0.14 210)", icon: "GraduationCap", words: ["curso", "livro", "faculdade", "escola", "mensalidade", "inglês", "ingles", "apostila", "udemy"] },
  { id: "lazer", name: "Lazer", color: "oklch(0.76 0.19 330)", icon: "Clapperboard", words: ["cinema", "show", "ingresso", "jogo", "parque", "festa", "balada", "teatro", "passeio", "viagem", "hotel"] },
  { id: "assinaturas", name: "Assinaturas", color: "oklch(0.7 0.18 270)", icon: "Repeat", words: ["netflix", "spotify", "amazon prime", "disney", "youtube", "icloud", "assinatura", "hbo", "globoplay"] },
  { id: "compras", name: "Compras", color: "oklch(0.8 0.15 90)", icon: "ShoppingBag", words: ["roupa", "tênis", "tenis", "camisa", "sapato", "celular", "iphone", "notebook", "eletrônico", "eletronico", "presente", "shopee", "amazon", "mercado livre"] },
  { id: "outros", name: "Outros", color: "oklch(0.7 0.03 260)", icon: "CircleEllipsis", words: [] },
  { id: "salario", name: "Salário", color: "oklch(0.82 0.17 155)", icon: "Banknote", income: true, words: ["salário", "salario", "pagamento", "holerite"] },
  { id: "extra", name: "Renda extra", color: "oklch(0.8 0.15 190)", icon: "Sparkles", income: true, words: ["freela", "freelance", "venda", "bônus", "bonus", "reembolso", "rendimento", "pix recebido"] },
];

/** Ajuste feito pela pessoa: muda nome/cor/ícone/palavras de uma categoria de fábrica, esconde uma, ou cria uma nova (`custom`). */
export type CatDef = { id: string; name?: string; color?: string; icon?: string; words?: string[]; hidden?: boolean; custom?: boolean; income?: boolean };
/** Categorias que nunca somem: servem de destino para o que não se encaixa. */
export const PROTECTED_CATS = new Set(["outros", "extra"]);

/** Listas vivas: são reescritas no lugar por `applyCategories`, então quem importou continua vendo a versão atual. */
export const CATS: Cat[] = [...DEFAULT_CATS];
export const EXPENSE_CATS: Cat[] = DEFAULT_CATS.filter((c) => !c.income);
export const INCOME_CATS: Cat[] = DEFAULT_CATS.filter((c) => c.income);

/** Cria a lista final (fábrica + ajustes + novas). `hidden` ficam em CATS (para o histórico continuar legível) mas fora das listas de escolha. */
export function buildCategories(defs: CatDef[] | undefined): { all: Cat[]; visible: Cat[] } {
  const list = defs ?? [], over = new Map(list.filter((d) => !d.custom).map((d) => [d.id, d]));
  const all: Cat[] = DEFAULT_CATS.map((c) => { const o = over.get(c.id); return o ? { ...c, name: o.name?.trim() || c.name, color: o.color || c.color, icon: o.icon || c.icon, words: o.words ?? c.words } : c; });
  for (const d of list) if (d.custom && !all.some((c) => c.id === d.id)) all.push({ id: d.id, name: d.name?.trim() || "Nova categoria", color: d.color || "oklch(0.75 0.15 250)", icon: d.icon || "Tag", ...(d.income ? { income: true } : {}), words: d.words ?? [] });
  const hidden = new Set(list.filter((d) => d.hidden && !PROTECTED_CATS.has(d.id)).map((d) => d.id));
  return { all, visible: all.filter((c) => !hidden.has(c.id)) };
}
export function applyCategories(defs: CatDef[] | undefined): void {
  const { all, visible } = buildCategories(defs);
  CATS.length = 0; CATS.push(...all);
  EXPENSE_CATS.length = 0; EXPENSE_CATS.push(...visible.filter((c) => !c.income));
  INCOME_CATS.length = 0; INCOME_CATS.push(...visible.filter((c) => c.income));
}

export const catOf = (id: string): Cat => CATS.find((c) => c.id === id) ?? CATS.find((c) => c.id === "outros") ?? DEFAULT_CATS.find((c) => c.id === "outros")!;
export const hasCat = (id: string): boolean => CATS.some((c) => c.id === id);

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Sugere a categoria pela descrição ("livro" → Educação). */
export function guessCategory(desc: string, income = false): string {
  const t = strip(desc);
  const pool = income ? INCOME_CATS : EXPENSE_CATS;
  let best: { id: string; len: number } | null = null;
  for (const c of pool) for (const w of c.words) { const k = strip(w); if (k && new RegExp(`(?<![a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t) && (!best || k.length > best.len)) best = { id: c.id, len: k.length }; }
  return best?.id ?? (income ? "extra" : "outros");
}
