import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DemandRow, Priority } from "../types";
import { must, supabase } from "./db";

const COLS = "id, title, description, source, status, priority, created_at";

export function useDemands() {
  return useQuery({
    queryKey: ["demands"],
    queryFn: async () => must(await supabase.from("demands").select(COLS).order("created_at", { ascending: false })) as DemandRow[],
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["demands"] });
}

export function useCreateDemand() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (d: { title: string; description?: string | null; priority?: Priority }) =>
      must(await supabase.from("demands").insert({ ...d, title: d.title.trim().slice(0, 300), source: "texto" }).select(COLS).single()) as DemandRow,
    onSuccess: invalidate,
  });
}

export function useUpdateDemand() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<DemandRow, "status" | "priority" | "title" | "description">> }) => {
      must(await supabase.from("demands").update(patch).eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}

export function useDeleteDemand() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      must(await supabase.from("demands").delete().eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}
