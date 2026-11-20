/** Relatório de acompanhamento (para enviar ao nutricionista): perfil, peso e medidas, avaliações semanais, aderência e progressão das cargas. */
import { MEASURE_FIELDS, adherenceByWeek, loadSeries, personalRecords, type Program, type SetLog, type Weekly } from "./program";

export type ReportMeasure = { date: string; peso: string; valores: Record<string, string> };
export type Report = {
  titulo: string; periodo: { inicio: string; hoje: string; semana: number; total: number };
  perfil: string[]; medidas: ReportMeasure[]; semanais: Weekly[];
  aderencia: { week: number; feitos: number; planejados: number }[];
  cargas: { nome: string; primeira: number; ultima: number; treinos: number; recorde: string | null }[];
  observacoes: string[];
};
const dm = (iso: string) => iso.split("-").reverse().join("/");
const n1 = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export function buildReport(p: Program, startIso: string, todayIso: string, week: number, logs: SetLog[], weeklies: Weekly[], measures: ReportMeasure[]): Report {
  const wk = Math.min(Math.max(week, 1), p.semanas), prs = new Map(personalRecords(logs).map((r) => [r.exerciseId, r]));
  const cargas = p.dias.flatMap((d) => d.exercicios.filter((e) => e.tipo === "forca")).flatMap((e) => {
    const s = loadSeries(logs, e.id);
    if (!s.length) return [];
    const r = prs.get(e.id);
    return [{ nome: e.nome, primeira: s[0]!.load, ultima: s.at(-1)!.load, treinos: s.length, recorde: r ? `${n1(r.load)} kg × ${r.reps}` : null }];
  });
  const perfil = [p.perfil.pesoKg ? `Peso inicial: ${n1(p.perfil.pesoKg)} kg` : "", p.perfil.alturaM ? `Altura: ${n1(p.perfil.alturaM)} m` : "", p.perfil.frequencia ? `Frequência: ${p.perfil.frequencia}` : "", p.perfil.duracao ? `Duração: ${p.perfil.duracao}` : "", ...p.objetivos.map((o) => `Objetivo: ${o}`)].filter(Boolean);
  const observacoes = [...weeklies.filter((w) => w.notes.trim()).map((w) => `Semana ${w.week}: ${w.notes.trim()}`), ...p.observacoes.filter((o) => /mounjaro|tontura|fraqueza|dieta|nutri/i.test(o))];
  return { titulo: p.nome, periodo: { inicio: startIso, hoje: todayIso, semana: wk, total: p.semanas }, perfil, medidas: measures.filter((m) => m.date >= startIso).sort((a, b) => a.date.localeCompare(b.date)), semanais: [...weeklies].sort((a, b) => a.week - b.week), aderencia: adherenceByWeek(p, logs, wk).map(({ week, feitos, planejados }) => ({ week, feitos, planejados })), cargas, observacoes };
}

/** Texto simples, pronto para colar no WhatsApp ou no e-mail. */
export function reportText(r: Report): string {
  const L: string[] = [`RELATÓRIO DE ACOMPANHAMENTO — ${r.titulo}`, `Semana ${r.periodo.semana} de ${r.periodo.total} (início ${dm(r.periodo.inicio)} · hoje ${dm(r.periodo.hoje)})`, ""];
  if (r.perfil.length) L.push("PERFIL", ...r.perfil.map((x) => `- ${x}`), "");
  if (r.medidas.length) {
    L.push("PESO E MEDIDAS (cm)");
    for (const m of r.medidas) L.push(`${dm(m.date)} · peso ${m.peso || "—"} kg · ${MEASURE_FIELDS.filter((f) => m.valores[f.key]).map((f) => `${f.label.toLowerCase()} ${m.valores[f.key]}`).join(" · ") || "sem medidas"}`);
    const a = r.medidas[0]!, b = r.medidas.at(-1)!;
    if (r.medidas.length > 1) { const dp = Number(b.peso.replace(",", ".")) - Number(a.peso.replace(",", ".")); if (Number.isFinite(dp) && a.peso && b.peso) L.push(`Variação do peso: ${dp > 0 ? "+" : ""}${n1(dp)} kg desde ${dm(a.date)}`); }
    L.push("");
  }
  if (r.semanais.length) { L.push("AVALIAÇÕES SEMANAIS (disposição e recuperação de 1 a 5)"); for (const w of r.semanais) L.push(`Semana ${w.week}: peso ${w.weight ?? "—"} · treinou ${w.daysTrained ?? "—"} dia(s) · disposição ${w.energy ?? "—"} · recuperação ${w.recovery ?? "—"}${w.notes ? ` · ${w.notes}` : ""}`); L.push(""); }
  if (r.aderencia.length) L.push("ADERÊNCIA (treinos feitos / planejados)", r.aderencia.map((a) => `S${a.week}: ${a.feitos}/${a.planejados}`).join(" · "), "");
  if (r.cargas.length) L.push("PROGRESSÃO DAS CARGAS", ...r.cargas.map((c) => `- ${c.nome}: ${n1(c.primeira)} → ${n1(c.ultima)} kg em ${c.treinos} treino(s)${c.recorde ? ` (melhor série: ${c.recorde})` : ""}`), "");
  if (r.observacoes.length) L.push("OBSERVAÇÕES", ...r.observacoes.map((o) => `- ${o}`), "");
  L.push("Gerado pelo Orion. Medidas isoladas não indicam ganho ou perda de músculo: a leitura é pela tendência, em conjunto com fotos e desempenho.");
  return L.join("\n");
}
