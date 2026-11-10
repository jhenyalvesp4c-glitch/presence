/**
 * Roteiros e exemplos de treinamento de um projeto (Documentação → Treinamentos): um documento por
 * projeto na tabela training_library. Na primeira abertura de cada projeto:
 *  - se já havia roteiros na tabela antiga (training_scripts), eles são convertidos e levados para cá;
 *  - senão, entra o conteúdo de exemplo.
 */
import { normalizeLibrary, seedLibrary, type Library, type Script } from "../training-library";
import { must, supabase } from "./db";

/** Imagens guardadas antes pela chave curta (`lead`, `filtro`) passam a usar a chave nova (`img`). */
const LEGACY_IMG: Record<string, string> = { lead: "etiquetas-lead", filtro: "etiquetas-filtro" };

export function scriptFromLegacy(raw: unknown): Script {
  const s = raw as Script & { lastClass?: string };
  const { lastClass: _drop, ...rest } = s;
  return {
    ...rest,
    blocks: (Array.isArray(s.blocks) ? s.blocks : []).map((b) => ({
      ...b,
      visuals: b.visuals?.map((v) => {
        const old = v as unknown as { key?: string; img?: string };
        const { key: _k, src: _s, ...others } = v as unknown as Record<string, unknown>;
        return { ...others, img: old.img || LEGACY_IMG[old.key ?? ""] || "" } as unknown as NonNullable<typeof b.visuals>[number];
      }),
    })),
  };
}

export async function loadLibrary(projectId: string): Promise<Library> {
  const rows = must(await supabase.from("training_library").select("scripts, examples").eq("project_id", projectId).limit(1)) as { scripts: unknown; examples: unknown }[];
  if (rows[0]) return normalizeLibrary(rows[0]);

  const legacy = must(await supabase.from("training_scripts").select("data, position").eq("project_id", projectId).order("position")) as { data: unknown }[];
  const lib = legacy.length ? normalizeLibrary({ scripts: legacy.map((r) => scriptFromLegacy(r.data)), examples: seedLibrary().examples }) : seedLibrary();
  // Só grava se o projeto já existe no banco (a página de Demandas cria o projeto antes).
  const proj = must(await supabase.from("projects").select("id").eq("id", projectId).limit(1)) as { id: string }[];
  if (proj[0]) must(await supabase.from("training_library").upsert({ project_id: projectId, scripts: lib.scripts, examples: lib.examples }, { onConflict: "project_id" }).select("project_id"));
  return lib;
}

export async function saveLibrary(projectId: string, _prev: Library, next: Library) {
  must(await supabase.from("training_library")
    .upsert({ project_id: projectId, scripts: next.scripts, examples: next.examples, updated_at: new Date().toISOString() }, { onConflict: "project_id" })
    .select("project_id"));
}
