import imgEtiquetasLead from "@/assets/treino-etiquetas-lead.jpg";
import imgEtiquetasFiltro from "@/assets/treino-etiquetas-filtro.jpg";
import { signedUrlsFor } from "@/lib/data/brain";
import type { Visual } from "@/lib/training-library";

/** Imagens de apoio que vêm com o app, pela chave guardada em `Visual.img`. */
const IMAGES: Record<string, string> = { "etiquetas-lead": imgEtiquetasLead, "etiquetas-filtro": imgEtiquetasFiltro };

/** Imagens enviadas pela usuária ficam no Storage (`storage:<caminho>`); o endereço temporário é guardado aqui. */
const BUCKET = "presence-app-brain-files";
const SIGNED = new Map<string, string>();
const STORAGE = "storage:";

export const visualSrc = (v: Visual) => (v.img.startsWith(STORAGE) ? (SIGNED.get(v.img.slice(STORAGE.length)) ?? "") : (IMAGES[v.img] ?? ""));

/** Busca (e guarda) os endereços das imagens enviadas. Devolve true se algo novo foi carregado (para redesenhar a tela). */
export async function primeVisuals(visuals: Visual[]): Promise<boolean> {
  const paths = [...new Set(visuals.filter((v) => v.img.startsWith(STORAGE)).map((v) => v.img.slice(STORAGE.length)))].filter((p) => !SIGNED.has(p));
  if (!paths.length) return false;
  const urls = await signedUrlsFor(paths.map((path) => ({ bucket: BUCKET, path })));
  let any = false;
  for (const p of paths) { const u = urls[`${BUCKET}/${p}`]; if (u) { SIGNED.set(p, u.view); any = true; } }
  return any;
}
