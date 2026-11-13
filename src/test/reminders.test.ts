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
