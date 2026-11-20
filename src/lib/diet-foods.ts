/** Alimentos para o diário: macros por 100 g (preparado) e medidas caseiras em gramas. Estimativas para acompanhar; o rótulo e o nutricionista mandam. */
import type { Macros } from "./diet-plan";

export type Food = { id: string; nome: string; per100: Macros; medidas: { nome: string; g: number }[]; /** nomes alternativos para a busca */ alias?: string };
const f = (nome: string, kcal: number, p: number, c: number, g: number, medidas: [string, number][] = [], alias = ""): Food => ({ id: nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), nome, per100: { kcal, p, c, f: g }, medidas: medidas.map(([nome, g]) => ({ nome, g })), alias });

export const FOODS: Food[] = [
  f("Frango grelhado", 165, 31, 0, 3.6, [["filé", 120], ["pedaço", 60]], "peito de frango"), f("Sobrecoxa assada", 190, 25, 0, 10, [["unidade", 100]]), f("Carne moída magra", 215, 27, 0, 11, [["col. sopa", 25], ["concha", 80]], "patinho acém"),
  f("Bife grelhado", 220, 28, 0, 11, [["unidade pequena", 100], ["fatia", 60]], "carne"), f("Lombo suíno", 200, 27, 0, 10, [["fatia", 60]]), f("Peixe grelhado", 130, 25, 0, 3, [["filé", 120]], "tilápia salmão"), f("Atum light", 110, 25, 0, 1, [["lata", 120], ["col. sopa", 20]]),
  f("Ovo cozido", 145, 12.5, 1, 10, [["unidade", 50]], "omelete"), f("Hambúrguer de peru/frango", 150, 20, 4, 6, [["unidade", 90]]),
  f("Whey protein", 400, 82, 10, 5, [["dose", 30], ["scoop", 30]], "whey"),
  f("Arroz branco", 130, 2.5, 28, 0.3, [["col. sopa", 25], ["concha", 100], ["xícara", 160]]), f("Arroz integral", 125, 2.6, 26, 1, [["col. sopa", 25], ["concha", 100]]),
  f("Feijão", 77, 5, 14, 0.5, [["col. sopa", 25], ["concha", 100]]), f("Lentilha", 115, 9, 20, 0.4, [["col. sopa", 25], ["concha", 100]]), f("Grão-de-bico", 165, 9, 27, 2.6, [["col. sopa", 20]]),
  f("Batata cozida", 87, 2, 20, 0.1, [["unidade pequena", 90], ["unidade média", 130]], "batata inglesa"), f("Batata-doce cozida", 90, 1.6, 21, 0.1, [["unidade pequena", 120], ["fatia", 40]]), f("Purê de batata", 95, 2, 15, 3, [["col. sopa", 30]]), f("Mandioca cozida", 125, 1, 30, 0.3, [["pedaço pequeno", 80]], "aipim macaxeira"),
  f("Macarrão cozido", 150, 5, 30, 1, [["col. sopa", 25], ["pegador", 110]]), f("Milho cozido", 100, 3, 21, 1, [["col. sopa", 20], ["espiga", 100]]), f("Polenta", 70, 1.5, 15, 0.5, [["col. sopa", 40]]),
  f("Pão francês", 300, 9, 58, 3, [["unidade", 50]]), f("Pão de forma", 255, 8, 49, 3, [["fatia", 25]]), f("Aveia em flocos", 390, 14, 66, 8, [["col. sopa", 15]]), f("Tapioca (goma)", 240, 0, 60, 0, [["col. sopa", 20]]),
  f("Salada de folhas", 20, 1.2, 3.5, 0.2, [["prato", 100], ["col. sopa", 15]], "alface rúcula"), f("Tomate", 18, 0.9, 3.9, 0.2, [["unidade", 100], ["fatia", 20]]), f("Pepino", 15, 0.7, 3.6, 0.1, [["col. sopa", 20]]), f("Cenoura crua ralada", 41, 0.9, 10, 0.2, [["col. sopa", 15]]), f("Repolho", 25, 1.3, 5.8, 0.1, [["col. sopa", 15]]),
  f("Azeite", 884, 0, 0, 100, [["col. chá", 4], ["col. sobremesa", 8], ["col. sopa", 12]]), f("Manteiga", 717, 0.9, 0.1, 81, [["col. chá", 5], ["col. sopa", 12]]), f("Requeijão", 250, 9, 3, 23, [["col. sobremesa", 15], ["col. sopa", 30]]), f("Maionese", 320, 1, 3, 33, [["col. sopa", 20]]), f("Pasta de amendoim", 590, 25, 20, 50, [["col. sopa", 15]]),
  f("Leite desnatado", 35, 3.4, 5, 0.1, [["copo", 200], ["xícara", 200]], "sem lactose"), f("Iogurte natural", 60, 4, 6, 2, [["pote", 170], ["copo", 200]]), f("Cottage", 100, 11, 3, 4.5, [["col. sopa", 25]]), f("Ricota", 140, 12, 3, 8, [["fatia", 40]]), f("Queijo branco", 280, 18, 3, 22, [["fatia", 30]], "minas"), f("Cream cheese light", 180, 7, 5, 15, [["col. sopa", 20]]),
  f("Banana", 90, 1, 23, 0.3, [["unidade pequena", 70], ["unidade média", 100]], "banana prata"), f("Mamão", 43, 0.5, 11, 0.1, [["fatia", 100], ["meio papaia", 150]], "papaia formosa"), f("Morango", 32, 0.7, 7.7, 0.3, [["unidade", 12], ["xícara", 150]]), f("Maçã", 52, 0.3, 14, 0.2, [["unidade pequena", 130]]),
  f("Laranja", 47, 0.9, 12, 0.1, [["unidade", 150]]), f("Mexerica", 44, 0.8, 11, 0.2, [["unidade", 100]], "tangerina"), f("Goiaba", 54, 1, 13, 0.5, [["unidade", 120]]), f("Manga", 60, 0.8, 15, 0.4, [["meia", 100]]), f("Uva", 69, 0.7, 18, 0.2, [["unidade", 6]]), f("Abacaxi", 50, 0.5, 13, 0.1, [["fatia", 75]]), f("Melão", 34, 0.8, 8, 0.2, [["fatia", 150]]), f("Kiwi", 61, 1.1, 15, 0.5, [["unidade", 80]]),
  f("Suco de laranja", 45, 0.7, 10, 0.2, [["copo", 200]]), f("Água de coco", 20, 0.2, 5, 0, [["copo", 200]]), f("Açúcar", 400, 0, 100, 0, [["col. chá", 5]]), f("Mel", 300, 0.3, 82, 0, [["col. chá", 7]]),
  f("Brigadeiro", 400, 5, 60, 16, [["unidade", 20]]), f("Pudim", 150, 4, 24, 4, [["fatia pequena", 80]]), f("Picolé de fruta", 80, 0.5, 19, 0.2, [["unidade", 60]]), f("Doce de leite", 320, 6, 56, 8, [["cubo", 20]]),
];
export const UNITS_G = { nome: "g", g: 1 };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca por nome (e apelidos); sem texto devolve os mais comuns. */
export function findFoods(q: string, limit = 8): Food[] {
  const t = norm(q.trim());
  if (t.length < 2) return [];
  const words = t.split(/\s+/);
  return FOODS.map((fd) => { const n = norm(`${fd.nome} ${fd.alias ?? ""}`); const hit = words.every((w) => n.includes(w)); return { fd, score: hit ? (norm(fd.nome).startsWith(words[0]!) ? 0 : 1) : 9 }; }).filter((x) => x.score < 9).sort((a, b) => a.score - b.score).slice(0, limit).map((x) => x.fd);
}
/** Alimento da base que corresponde a um item do plano ("Carne moída magra ou frango" → carne moída). */
export function foodForPlanItem(alimento: string): Food | null { return findFoods(alimento.split(/ ou | \(/i)[0]!, 1)[0] ?? findFoods(alimento.split(" ")[0]!, 1)[0] ?? null; }

/** Macros de `qty` de uma medida (ou gramas). */
export function foodMacros(food: Food, qty: number, unit: string): Macros {
  const m = food.medidas.find((x) => x.nome === unit), grams = qty * (m ? m.g : 1), k = grams / 100;
  return { kcal: food.per100.kcal * k, p: food.per100.p * k, c: food.per100.c * k, f: food.per100.f * k };
}
export const qtyLabel = (qty: number, unit: string) => `${String(Math.round(qty * 10) / 10).replace(".", ",")} ${unit === "g" ? "g" : unit}`;
