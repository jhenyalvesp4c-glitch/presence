import { describe, expect, it } from "vitest";
import {
  appointmentRow, appointmentsOn, calendarItems, compromissoScheduleRow, compromissosForDay, monthGrid, showInTodayTasks,
} from "@/lib/appointments";
import type { Task } from "@/lib/types";

const COMP = "cat-comp";
const task = (p: Partial<Task>): Task => ({
  id: "t1", title: "Tarefa", description: null, category_id: null, priority: "media", due_date: null, due_time: null,
  done: false, done_at: null, position: 0, created_at: "2026-11-01T10:00:00Z", ...p,
});

describe("calendário ligado às tarefas", () => {
  it("compromisso marcado vira tarefa da categoria Compromissos, com ou sem dossiê", () => {
    const geral = appointmentRow({ title: "  Reunião  ", date: "2026-11-10", time: "14:00", end: "15:00", color: "cyan", dossierId: "" }, COMP, "p4c");
    expect(geral).toMatchObject({ title: "Reunião", category_id: COMP, due_date: "2026-11-10", due_time: "14:00", end_time: "15:00", dossier_id: null, project_id: "p4c" });
    expect(appointmentRow({ title: "Visita", date: "2026-11-10", color: "cyan", dossierId: "d14" }, COMP, "p4c").dossier_id).toBe("d14");
  });

  it("sem horário de início é dia todo e o fim é ignorado", () => {
    expect(appointmentRow({ title: "Feriado", date: "2026-11-15", end: "18:00", color: "pink" }, COMP, "p4c")).toMatchObject({ due_time: null, end_time: null });
  });

  it("o calendário mostra compromissos e também as outras tarefas que têm data", () => {
    const items = calendarItems([
      task({ id: "a", title: "Reunião", category_id: COMP, due_date: "2026-11-10", due_time: "14:00:00" }),
      task({ id: "b", title: "Pagar conta", category_id: "fin", due_date: "2026-11-10" }),
      task({ id: "c", title: "Sem data" }),
    ], COMP);
    expect(items.map((i) => [i.id, i.kind])).toEqual([["a", "compromisso"], ["b", "tarefa"]]);
    expect(items[0]!.time).toBe("14:00");
  });

  it("os compromissos do dia com horário entram na agenda do Organize/Planeje meu dia", () => {
    const tasks = [
      task({ id: "a", title: "Reunião", category_id: COMP, due_date: "2026-11-10", due_time: "14:00:00", place: "Sala 2" }),
      task({ id: "b", title: "Outro dia", category_id: COMP, due_date: "2026-11-11", due_time: "09:00:00" }),
      task({ id: "c", title: "Já feito", category_id: COMP, due_date: "2026-11-10", due_time: "10:00:00", done: true }),
      task({ id: "d", title: "Tarefa comum", category_id: "trab", due_date: "2026-11-10", due_time: "11:00:00" }),
    ];
    const agenda = compromissosForDay(tasks, COMP, "2026-11-10");
    expect(agenda.map((a) => a.title)).toEqual(["Reunião"]);
    expect(agenda[0]).toMatchObject({ time: "14:00", kind: "compromisso", description: "Sala 2" });
  });

  it("compromisso com horário vira linha da agenda do dia; dia todo não", () => {
    expect(compromissoScheduleRow({ title: "Reunião", date: "2026-11-10", time: "14:00", color: "pink" }, "t1")).toMatchObject({ plan_date: "2026-11-10", kind: "compromisso", color: "rose", task_id: "t1" });
    expect(compromissoScheduleRow({ title: "Feriado", date: "2026-11-10", color: "cyan" }, "t1")).toBeNull();
  });

  it("compromisso de outro dia não fica acumulando em Minhas tarefas de hoje", () => {
    const today = "2026-11-10";
    expect(showInTodayTasks(task({ category_id: COMP, due_date: "2026-11-05" }), COMP, today)).toBe(false);
    expect(showInTodayTasks(task({ category_id: COMP, due_date: today }), COMP, today)).toBe(true);
    expect(showInTodayTasks(task({ category_id: "trab", due_date: "2026-11-05" }), COMP, today)).toBe(true);
  });

  it("lista o dia com os de dia todo primeiro e depois por horário", () => {
    const list = [
      { title: "Tarde", date: "2026-11-10", time: "15:00" },
      { title: "Manhã", date: "2026-11-10", time: "09:00" },
      { title: "Dia todo", date: "2026-11-10" },
      { title: "Outro dia", date: "2026-11-11" },
    ];
    expect(appointmentsOn(list, "2026-11-10").map((a) => a.title)).toEqual(["Dia todo", "Manhã", "Tarde"]);
  });

  it("a grade do mês tem 6 semanas e começa no domingo", () => {
    const g = monthGrid(2026, 10);
    expect(g).toHaveLength(42);
    expect(g[0]!.getDay()).toBe(0);
  });
});
