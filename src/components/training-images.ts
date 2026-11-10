import imgEtiquetasLead from "@/assets/treino-etiquetas-lead.jpg";
import imgEtiquetasFiltro from "@/assets/treino-etiquetas-filtro.jpg";
import type { Visual } from "@/lib/training-library";

/** Imagens de apoio que vêm com o app, pela chave guardada em `Visual.img`. */
const IMAGES: Record<string, string> = { "etiquetas-lead": imgEtiquetasLead, "etiquetas-filtro": imgEtiquetasFiltro };

export const visualSrc = (v: Visual) => IMAGES[v.img] ?? "";
