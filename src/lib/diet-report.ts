/** Relatório da alimentação para o nutricionista: dias (calorias e macros, refeições, água, como foi), alimentos registrados, avaliações semanais e comparação das opções. */
import { compareOptions, customMealName, daySummary, type DayLog, type DietPlan, type DietWeekly, type Extra, type OptionStats } from "./diet-plan";

export type ReportDay = { date: string; opcao: string; kcal: number; p: number; c: number; f: number; refeicoes: string; aguaMl: number | null; fullness: number | null; difficulty: number | null; energy: number | null; training: number | null; discomfort: number | null; bowel: boolean | null; notes: string; alimentos: { refeicao: string; itens: Extra[] }[] };
export type DietReport = { titulo: string; periodo: { de: string; ate: string; emitido: string; dias: number; registrados: number }; perfil: string[]; media: { kcal: number; p: number; c: number; f: number; aguaMl: number | null; refeicoes: number } | null; dias: ReportDay[]; semanais: DietWeekly[]; opcoes: OptionStats[]; observacoes: string[]; meta: string };
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const n1 = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function buildDietReport(plan: DietPlan, from: string, to: string, today: string, logs: DayLog[], weeklies: DietWeekly[]): DietReport {
  const inRange = logs.filter((l) => l.date >= from && l.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const dias: ReportDay[] = inRange.map((l) => {
    const s = daySummary(plan, l), names = new Map(s.opt.refeicoes.map((m) => [m.id, m.nome]));
    const groups = new Map<string, Extra[]>(); for (const e of l.extras) { const k = names.get(e.meal ?? "") ?? customMealName(e.meal) ?? "Outros"; groups.set(k, [...(groups.get(k) ?? []), e]); }
    return { date: l.date, opcao: s.opt.nome, kcal: Math.round(s.macros.kcal), p: Math.round(s.macros.p), c: Math.round(s.macros.c), f: Math.round(s.macros.f), refeicoes: `${s.done}/${s.total}`, aguaMl: l.waterMl, fullness: l.fullness, difficulty: l.difficulty, energy: l.energy, training: l.training, discomfort: l.discomfort, bowel: l.bowel, notes: l.notes.trim(), alimentos: [...groups].map(([refeicao, itens]) => ({ refeicao, itens })) };
  });
  const full = dias.filter((d) => d.kcal > 0), water = dias.filter((d) => d.aguaMl !== null).map((d) => d.aguaMl!);
  const pp = plan.perfil, perfil = [pp.idade ? `${pp.idade} anos` : "", pp.sexo, pp.pesoKg ? `Peso inicial ${n1(pp.pesoKg)} kg` : "", pp.alturaM ? `Altura ${n1(pp.alturaM)} m` : "", pp.treino ? `Treino: ${pp.treino}${pp.duracaoTreino ? ` (${pp.duracaoTreino})` : ""}` : "", pp.medicacao ? `Medicação: ${pp.medicacao}` : "", pp.hidratacao ? `Hidratação inicial: ${pp.hidratacao}` : ""].filter(Boolean);
  const days = Math.max(1, Math.round((new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86_400_000) + 1);
  return {
    titulo: plan.nome, periodo: { de: from, ate: to, emitido: today, dias: days, registrados: inRange.length }, perfil,
    media: full.length ? { kcal: Math.round(avg(full.map((d) => d.kcal))), p: Math.round(avg(full.map((d) => d.p))), c: Math.round(avg(full.map((d) => d.c))), f: Math.round(avg(full.map((d) => d.f))), aguaMl: water.length ? Math.round(avg(water)) : null, refeicoes: Math.round(avg(full.map((d) => Number(d.refeicoes.split("/")[0])))) } : null,
    dias, semanais: weeklies.filter((w) => w.date >= from && w.date <= to), opcoes: compareOptions(plan, inRange),
    observacoes: [...dias.filter((d) => d.notes).map((d) => `${dm(d.date)}: ${d.notes}`), ...weeklies.filter((w) => w.notes.trim() && w.date >= from && w.date <= to).map((w) => `Semana ${w.week}: ${w.notes.trim()}`)],
    meta: plan.proteina.min ? `Meta de proteína: ${plan.proteina.min}–${plan.proteina.max ?? plan.proteina.min} g/dia. ${plan.semMeta}` : plan.semMeta,
  };
}

export function dietReportText(r: DietReport): string {
  const L: string[] = [`RELATÓRIO DE ALIMENTAÇÃO — ${r.titulo}`, `Período ${dm(r.periodo.de)} a ${dm(r.periodo.ate)} · ${r.periodo.registrados} de ${r.periodo.dias} dias registrados`, ""];
  if (r.perfil.length) L.push("PERFIL", ...r.perfil.map((x) => `- ${x}`), "");
  if (r.meta) L.push("META", r.meta, "");
  if (r.media) L.push("MÉDIA DOS DIAS REGISTRADOS", `Calorias ${r.media.kcal} kcal · Proteína ${r.media.p} g · Carboidrato ${r.media.c} g · Gordura ${r.media.f} g${r.media.aguaMl !== null ? ` · Água ${n1(r.media.aguaMl / 1000)} L` : ""}`, "");
  if (r.dias.length) {
    L.push("DIA A DIA");
    for (const d of r.dias) {
      L.push(`${dm(d.date)} · ${d.opcao} · ${d.kcal} kcal · P ${d.p} · C ${d.c} · G ${d.f} · refeições ${d.refeicoes}${d.aguaMl !== null ? ` · água ${n1(d.aguaMl / 1000)} L` : ""}${d.bowel === null ? "" : ` · evacuou: ${d.bowel ? "sim" : "não"}`}`);
      const sc = [["estômago cheio", d.fullness], ["facilidade", d.difficulty], ["energia", d.energy], ["treino", d.training], ["desconforto", d.discomfort]].filter(([, v]) => v !== null).map(([k, v]) => `${k} ${v}/5`);
      if (sc.length) L.push(`   ${sc.join(" · ")}`);
      for (const g of d.alimentos) L.push(`   ${g.refeicao}: ${g.itens.map((e) => `${e.nome}${e.qtd ? ` (${e.qtd})` : ""}`).join(", ")}`);
    }
    L.push("");
  }
  if (r.semanais.length) { L.push("AVALIAÇÕES SEMANAIS"); for (const w of r.semanais) L.push(`Semana ${w.week}: peso ${w.weight ?? "—"} kg · cintura ${w.waist ?? "—"} · abdômen ${w.abdomen ?? "—"} · quadril ${w.hip ?? "—"} · evacuações ${w.bowelCount ?? "—"}`); L.push(""); }
  const op = r.opcoes.filter((o) => o.dias > 0);
  if (op.length > 1) { L.push("COMPARAÇÃO DAS OPÇÕES"); for (const o of op) L.push(`${o.nome}: ${o.dias} dia(s) · ${o.kcal ?? "—"} kcal · proteína ${o.protein ?? "—"} g · refeições cumpridas ${o.adherence}%`); L.push(""); }
  if (r.observacoes.length) L.push("OBSERVAÇÕES", ...r.observacoes.map((o) => `- ${o}`), "");
  L.push("Gerado pelo Orion. Calorias e macros são estimativas pelas porções informadas; o plano é uma proposta inicial a validar com nutricionista e médico.");
  return L.join("\n");
}
