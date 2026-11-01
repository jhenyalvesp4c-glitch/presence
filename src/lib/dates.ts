import { format } from "date-fns";

/** Datas do app são sempre locais (yyyy-MM-dd), nunca UTC. */
export const isoDate = (d: Date) => format(d, "yyyy-MM-dd");
export const fromIsoDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
export const todayIso = () => isoDate(new Date());
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
};
export const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
