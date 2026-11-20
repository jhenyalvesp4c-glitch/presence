/** Junta os dados reais para os indicadores dos botões de acesso rápido (atualiza sozinho, sem pesar: reaproveita o que as telas já carregam). */
import { useQuery } from "@tanstack/react-query";

import { cloudFinanceRepo } from "../finance/cloud-repo";
import { isoOf } from "../finance/calc";
import { financeBadge, habitBadge, ideaBadge, taskBadge, type Badges } from "../nav-badges";
import { useHabitCompletions, useHabits } from "./habits";
import { useIdeas } from "./ideas";
import { useTasks } from "./tasks";

export function useNavBadges(enabled = true): Badges {
  const tasks = useTasks(), ideas = useIdeas(), habits = useHabits(), done = useHabitCompletions();
  const fin = useQuery({ queryKey: ["fin-badge"], queryFn: () => cloudFinanceRepo.readCloud().catch(() => null), staleTime: 5 * 60_000, enabled });
  if (!enabled) return {};
  const now = new Date(), todayIso = isoOf(now), out: Badges = {};
  const t = taskBadge(tasks.data ?? [], todayIso), f = financeBadge(fin.data ?? null, now), i = ideaBadge(ideas.data ?? [], now), h = habitBadge(habits.data ?? [], done.data ?? [], todayIso);
  if (t) out["/tarefas"] = t; if (f) out["/financeiro"] = f; if (i) out["/ideias"] = i; if (h) out["/habitos"] = h;
  return out;
}
