export type Color = "cyan" | "violet" | "emerald" | "amber" | "rose";
export type Priority = "alta" | "media" | "baixa";
export type Kind = "tarefa" | "compromisso" | "habito" | "treino" | "autocuidado" | "financeiro" | "pausa" | "extra";

export type Category = { id: string; slug: string; name: string; icon: string; color: Color; position: number };

export type Task = {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  priority: Priority;
  due_date: string | null; // yyyy-MM-dd
  due_time: string | null; // HH:mm:ss
  done: boolean;
  done_at: string | null;
  position: number;
  created_at: string;
  // Campos usados pelos compromissos do calendário (tarefas da categoria "Compromissos").
  end_time?: string | null;
  place?: string | null;
  color?: string | null;
  project_id?: string | null;
  dossier_id?: string | null;
  // Vínculos criados pelo MCP (demanda, outro registro) e tipo (tarefa ou lembrete).
  demand_code?: string | null;
  related_task_id?: string | null;
  kind?: "tarefa" | "lembrete";
};

export type RoutineItem = {
  id: string; time: string; title: string; description: string; tag: string; color: Color; icon: string; kind: Kind; position: number;
};

export type ScheduleItem = RoutineItem & { plan_date: string; done: boolean; task_id: string | null };

export type DayPlan = {
  id: string; plan_date: string; disposicao: "alta" | "normal" | "baixa"; tempo: "completo" | "manha" | "tarde" | "pouco";
  prioridade: string; pausas: boolean; categories: string[]; focus_areas: string[]; started_at: string | null;
};

export type DayPriority = { id: string; plan_date: string; title: string; done: boolean; starred: boolean; position: number };

export type Workout = { id: string; name: string; duration_min: number; muscles: string[]; position: number };
export type Exercise = {
  id: string; workout_id: string; position: number; name: string; muscle: string; sets_reps: string; rest_seconds: number; instructions: string | null;
};
export type SplitDay = { id: string; weekday: number; title: string; workout_id: string | null };
export type WorkoutSession = {
  id: string; workout_id: string | null; workout_name: string; session_date: string; started_at: string;
  finished_at: string | null; duration_min: number | null; kcal: number | null;
};
export type ExerciseLog = { id: string; session_id: string; exercise_id: string | null; exercise_name: string; done: boolean; load_kg: number | null };

export type Habit = { id: string; name: string; icon: string; color: Color; position: number; active: boolean };
export type HabitCompletion = { id: string; habit_id: string; completed_on: string };

export type DemandRow = {
  id: string; title: string; description: string | null; source: "voz" | "texto" | "assistente";
  status: "nova" | "em_andamento" | "concluida"; priority: Priority; created_at: string;
};
