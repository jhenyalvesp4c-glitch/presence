import imgEtiquetasLead from "@/assets/treino-etiquetas-lead.jpg";
import imgEtiquetasFiltro from "@/assets/treino-etiquetas-filtro.jpg";
import { signedUrlsFor } from "@/lib/data/brain";
import type { Visual } from "@/lib/training-library";

/** Imagens de apoio que vêm com o app, pela chave guardada em `Visual.img`. */
const IMAGES: Record<string, string> = { "etiquetas-lead": imgEtiquetasLead, "etiquetas-filtro": imgEtiquetasFiltro };

/** Arquivos enviados pela usuária ficam no Storage; os endereços temporários (1 h) ficam neste cache, por caminho. */
const BUCKET = "presence-app-brain-files";
const SIGNED = new Map<string, { view: string; download: string }>();
const STORAGE = "storage:";

export const visualSrc = (v: Visual) => (v.img.startsWith(STORAGE) ? (SIGNED.get(v.img.slice(STORAGE.length))?.view ?? "") : (IMAGES[v.img] ?? ""));
export const mediaUrl = (path: string) => SIGNED.get(path);

/** Busca (e guarda) os endereços dos arquivos. Devolve true se algo novo foi carregado (para redesenhar a tela). */
export async function primePaths(all: string[]): Promise<boolean> {
  const paths = [...new Set(all)].filter((p) => p && !SIGNED.has(p));
  if (!paths.length) return false;
  const urls = await signedUrlsFor(paths.map((path) => ({ bucket: BUCKET, path })));
  let any = false;
  for (const p of paths) { const u = urls[`${BUCKET}/${p}`]; if (u) { SIGNED.set(p, u); any = true; } }
  return any;
}
export const primeVisuals = (visuals: Visual[]) => primePaths(visuals.filter((v) => v.img.startsWith(STORAGE)).map((v) => v.img.slice(STORAGE.length)));
