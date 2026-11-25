import { describe, expect, it } from "vitest";
import { dueReminders, spokenReminder } from "../lib/reminders";

const now = new Date("2026-11-13T10:30:00");
const r = (id: string, date: string, time: string | null, done = false) => ({ id, title: `L${id}`, due_date: date, due_time: time, done });

describe("lembretes na hora", () => {
  it("avisa os que já chegaram e ignora os futuros, sem hora ou feitos", () => {
    const d = dueReminders([r("1", "2026-11-13", "10:00:00"), r("2", "2026-11-13", "11:00:00"), r("3", "2026-11-13", null), r("4", "2026-11-13", "09:00:00", true)], now, {}, {});
    expect(d.map((x) => x.id)).toEqual(["1"]);
  });
  it("não repete o já avisado, mas avisa de novo se o horário mudou", () => {
    const seen = { "1": "2026-11-13 10:00" };
    expect(dueReminders([r("1", "2026-11-13", "10:00:00")], now, seen, {})).toEqual([]);
    expect(dueReminders([r("1", "2026-11-13", "10:15:00")], now, seen, []as never)).toHaveLength(1);
  });
  it("respeita o adiamento e volta depois dele", () => {
    const snoozed = { "1": now.getTime() + 600_000 };
    expect(dueReminders([r("1", "2026-11-13", "10:00:00")], now, { "1": "2026-11-13 10:00" }, snoozed)).toEqual([]);
    expect(dueReminders([r("1", "2026-11-13", "10:00:00")], new Date(now.getTime() + 700_000), { "1": "2026-11-13 10:00" }, snoozed)).toHaveLength(1);
  });
  it("ignora lembretes muito antigos", () => {
    expect(dueReminders([r("1", "2026-11-12", "08:00:00")], now, {}, {})).toEqual([]);
  });
  it("frase falada", () => {
    expect(spokenReminder([])).toBe("");
    const two = dueReminders([r("1", "2026-11-13", "10:00:00"), r("2", "2026-11-13", "10:10:00")], now, {}, {});
    expect(spokenReminder(two.slice(0, 1))).toBe("Lembrete: L1.");
    expect(spokenReminder(two)).toBe("Você tem 2 lembretes: L1 e L2.");
  });
});

import { beforeWords, dueBefore } from "../lib/reminders";

describe("lembrar antes", () => {
  const row = (rb: number[] | null, date = "2026-11-13", time = "11:00:00") => ({ id: "t1", title: "Treinamento Pituba", due_date: date, due_time: time, done: false, remind_before: rb });
  it("avisa quando chega a hora menos a antecedência, e só uma vez", () => {
    const at1030 = new Date("2026-11-13T10:30:00");
    expect(dueBefore([row([30])], new Date("2026-11-13T10:29:00"), {}, {}).due).toEqual([]);
    const r = dueBefore([row([30])], at1030, {}, {});
    expect(r.due).toHaveLength(1);
    expect(r.due[0]).toMatchObject({ id: "t1", before: 30 });
    expect(dueBefore([row([30])], at1030, { "t1~30": "2026-11-13 11:00" }, {}).due).toEqual([]);
  });
  it("2 dias antes dispara dois dias antes; com vários, vale o mais próximo da hora", () => {
    expect(dueBefore([row([2880])], new Date("2026-11-11T11:00:00"), {}, {}).due[0]?.before).toBe(2880);
    const both = dueBefore([row([60, 1440])], new Date("2026-11-13T10:10:00"), {}, {});
    expect(both.due).toHaveLength(1);
    expect(both.due[0]?.before).toBe(60);
    expect(both.keys.sort()).toEqual(["t1~1440", "t1~60"]);
  });
  it("não avisa depois da hora, de tarefa feita ou sem antecedência; muda o horário e avisa de novo", () => {
    expect(dueBefore([row([30])], new Date("2026-11-13T11:05:00"), {}, {}).due).toEqual([]);
    expect(dueBefore([{ ...row([30]), done: true }], new Date("2026-11-13T10:40:00"), {}, {}).due).toEqual([]);
    expect(dueBefore([row(null)], new Date("2026-11-13T10:40:00"), {}, {}).due).toEqual([]);
    expect(dueBefore([row([30], "2026-11-13", "12:00:00")], new Date("2026-11-13T11:40:00"), { "t1~30": "2026-11-13 11:00" }, {}).due).toHaveLength(1);
  });
  it("adiar volta a avisar depois do prazo e a fala cita a antecedência", () => {
    const now = new Date("2026-11-13T10:40:00");
    expect(dueBefore([row([30])], now, { "t1~30": "2026-11-13 11:00" }, { "t1~30": now.getTime() + 600_000 }).due).toEqual([]);
    const d = dueBefore([row([30])], new Date(now.getTime() + 700_000), { "t1~30": "2026-11-13 11:00" }, { "t1~30": now.getTime() + 600_000 });
    expect(d.due).toHaveLength(1);
    expect(spokenReminder(d.due)).toBe("Daqui a 30 minutos: Treinamento Pituba.");
    expect([beforeWords(60), beforeWords(2880), beforeWords(10080), beforeWords(15)]).toEqual(["1 hora", "2 dias", "1 semana", "15 minutos"]);
  });
});
