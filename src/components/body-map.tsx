// Mapa muscular: silhueta feminina (frente e costas) com o grupo selecionado em destaque.

import corpoFrenteAsset from "@/assets/corpo-frente.jpg";
import corpoCostasFAsset from "@/assets/corpo-costas-f.jpg";
import corpoFrenteMAsset from "@/assets/corpo-frente-m.jpg";
import corpoCostasMAsset from "@/assets/corpo-costas-m.jpg";

const corpoFrente = corpoFrenteAsset;
const corpoCostasF = corpoCostasFAsset;
const corpoFrenteM = corpoFrenteMAsset;
const corpoCostasM = corpoCostasMAsset;

export type Sexo = "feminino" | "masculino";

export type GrupoMuscular =
  | "Peito" | "Costas" | "Pernas" | "Glúteos" | "Ombros"
  | "Bíceps" | "Tríceps" | "Abdômen" | "Cardio";

// Contorno da metade direita do corpo (do topo da cabeça até o centro), espelhado depois.
const PONTOS: [number, number][] = [
  [100, 10], [112, 13], [118, 24], [118, 36], [114, 46], [106, 52], // cabeça
  [104, 58], [106, 64], [114, 67],                                  // pescoço
  [128, 70], [142, 75], [148, 83],                                  // ombro
  [151, 92], [150, 104],                                            // deltoide
  [147, 130], [143, 160], [140, 190],                               // braço
  [138, 212], [136, 228], [133, 240],                               // antebraço
  [130, 248], [126, 250], [125, 244],                               // mão
  [127, 232], [129, 214], [130, 196],                               // antebraço interno
  [131, 176], [131, 156], [128, 138],                               // braço interno
  [125, 126], [121, 122],                                           // axila
  [124, 140], [126, 160], [124, 176],                               // lateral do tronco
  [121, 186], [119, 192],                                           // cintura
  [124, 204], [131, 214], [135, 226],                               // quadril
  [136, 240], [133, 256],                                           // coxa
  [128, 282], [122, 308], [118, 332],                               // coxa → joelho
  [115, 352], [113, 370], [113, 384],                               // panturrilha
  [114, 394], [118, 398], [112, 403], [102, 403],                   // tornozelo e pé
  [99, 396], [99, 382], [99, 366],                                  // tornozelo interno
  [98, 344], [97, 320], [96, 296],                                  // perna interna
  [96, 272], [97, 250], [100, 230],                                 // coxa interna → centro
];

function suavizar(pts: [number, number][]): string {
  const first = pts[0];
  if (!first) return "";
  let d = `M ${first[0]} ${first[1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    if (!p0 || !p1 || !p2 || !p3) continue;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return `${d} Z`;
}

const SILHUETA = suavizar([
  ...PONTOS,
  ...PONTOS.slice(1, -1).reverse().map(([x, y]) => [200 - x, y] as [number, number]),
]);

// Formas dos músculos (viewBox 0 0 200 420, centro em x=100).
const M = {
  peitoE: "M74 86 C80 78 92 77 97 83 C99 90 99 98 96 105 C88 111 78 109 73 100 C71 95 71 90 74 86 Z",
  peitoD: "M126 86 C120 78 108 77 103 83 C101 90 101 98 104 105 C112 111 122 109 127 100 C129 95 129 90 126 86 Z",
  ombroE: "M62 76 C54 72 47 78 46 88 C45 97 50 104 57 103 C64 102 68 94 67 86 C66 81 65 78 62 76 Z",
  ombroD: "M138 76 C146 72 153 78 154 88 C155 97 150 104 143 103 C136 102 132 94 133 86 C134 81 135 78 138 76 Z",
  bicepsE: "M62 108 C56 106 51 112 52 124 C53 138 57 148 62 147 C67 146 69 136 68 124 C67 114 66 110 62 108 Z",
  bicepsD: "M138 108 C144 106 149 112 148 124 C147 138 143 148 138 147 C133 146 131 136 132 124 C133 114 134 110 138 108 Z",
  abdomen: "M84 128 C92 124 108 124 116 128 C119 146 118 168 112 184 C104 190 96 190 88 184 C82 168 81 146 84 128 Z",
  coracao: "M100 112 C94 104 84 100 84 91 C84 85 89 82 94 84 C97 85 99 88 100 91 C101 88 103 85 106 84 C111 82 116 85 116 91 C116 100 106 104 100 112 Z",
  quadE: "M96 236 C86 232 74 234 70 244 C68 262 72 286 80 306 C88 312 96 308 98 296 C100 276 100 252 96 236 Z",
  quadD: "M104 236 C114 232 126 234 130 244 C132 262 128 286 120 306 C112 312 104 308 102 296 C100 276 100 252 104 236 Z",
  costasE: "M72 96 C66 116 68 146 80 168 C86 176 94 178 98 174 C92 150 90 122 92 100 C86 96 78 94 72 96 Z",
  costasD: "M128 96 C134 116 132 146 120 168 C114 176 106 178 102 174 C108 150 110 122 108 100 C114 96 122 94 128 96 Z",
  gluteoE: "M76 200 C86 194 96 196 98 204 C99 216 96 228 88 234 C78 236 70 228 70 216 C70 208 72 203 76 200 Z",
  gluteoD: "M124 200 C114 194 104 196 102 204 C101 216 104 228 112 234 C122 236 130 228 130 216 C130 208 128 203 124 200 Z",
  posteriorE: "M96 240 C86 236 74 238 71 248 C70 266 74 288 81 304 C89 308 96 304 97 292 C99 274 99 254 96 240 Z",
  posteriorD: "M104 240 C114 236 126 238 129 248 C130 266 126 288 119 304 C111 308 104 304 103 292 C101 274 101 254 104 240 Z",
  panturrilhaE: "M94 322 C86 318 79 322 79 334 C79 350 83 366 88 372 C94 372 97 362 97 348 C97 336 97 326 94 322 Z",
  panturrilhaD: "M106 322 C114 318 121 322 121 334 C121 350 117 366 112 372 C106 372 103 362 103 348 C103 336 103 326 106 322 Z",
} as const;

type Vista = "frente" | "costas";

const REGIOES: Record<GrupoMuscular, Partial<Record<Vista, string[]>>> = {
  "Peito": { frente: [M.peitoE, M.peitoD] },
  "Costas": { costas: [M.costasE, M.costasD] },
  "Pernas": {
    frente: [M.quadE, M.quadD],
    costas: [M.posteriorE, M.posteriorD, M.panturrilhaE, M.panturrilhaD],
  },
  "Glúteos": { costas: [M.gluteoE, M.gluteoD] },
  "Ombros": { frente: [M.ombroE, M.ombroD], costas: [M.ombroE, M.ombroD] },
  "Bíceps": { frente: [M.bicepsE, M.bicepsD] },
  "Tríceps": { costas: [M.bicepsE, M.bicepsD] },
  "Abdômen": { frente: [M.abdomen] },
  "Cardio": { frente: [M.coracao] },
};

export function FiguraSimples({ vista, grupo }: { vista: Vista; grupo: GrupoMuscular }) {
  const ativos = REGIOES[grupo][vista] ?? [];
  const filtroId = `brilho-${vista}`;
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 420" className="h-56 w-auto md:h-64" role="img" aria-label={`Corpo humano, vista de ${vista}`}>
        <defs>
          <filter id={filtroId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={SILHUETA} className="fill-muted/30 stroke-border" strokeWidth="1.5" strokeLinejoin="round" />
        {ativos.map((d) => (
          <path
            key={grupo + d}
            d={d}
            className="muscle-glow fill-primary/90"
            filter={`url(#${filtroId})`}
          />
        ))}
      </svg>
      <figcaption className="font-mono text-[10px] uppercase tracking-normal text-muted-foreground">
        {vista}
      </figcaption>
    </figure>
  );
}

const ZONAS_FRENTE: Partial<Record<GrupoMuscular, [number, number, number, number][]>> = {
  "Peito": [[272, 318, 50, 38], [368, 318, 50, 38]],
  "Ombros": [[212, 258, 34, 40], [428, 258, 34, 40]],
  "Bíceps": [[200, 355, 22, 55], [440, 355, 22, 55]],
  "Abdômen": [[320, 425, 48, 75]],
  "Pernas": [[262, 690, 50, 140], [378, 690, 50, 140], [255, 960, 28, 85], [385, 960, 28, 85]],
  "Cardio": [[298, 315, 30, 30]],
};

type Zonas = Partial<Record<GrupoMuscular, [number, number, number, number][]>>;

const ZONAS_FRENTE_M: Zonas = {
  "Peito": [[265, 300, 52, 36], [375, 300, 52, 36]],
  "Ombros": [[182, 258, 34, 40], [458, 258, 34, 40]],
  "Bíceps": [[165, 345, 24, 52], [475, 345, 24, 52]],
  "Abdômen": [[320, 410, 50, 85]],
  "Pernas": [[255, 690, 50, 120], [385, 690, 50, 120], [250, 940, 30, 80], [390, 940, 30, 80]],
  "Cardio": [[295, 295, 28, 28]],
};

const ZONAS_COSTAS_F: Zonas = {
  "Costas": [[272, 350, 45, 80], [368, 350, 45, 80], [320, 240, 55, 30]],
  "Ombros": [[205, 265, 30, 36], [435, 265, 30, 36]],
  "Tríceps": [[160, 360, 22, 55], [480, 360, 22, 55]],
  "Glúteos": [[265, 555, 52, 60], [375, 555, 52, 60]],
  "Pernas": [[255, 715, 40, 100], [385, 715, 40, 100], [245, 920, 30, 75], [395, 920, 30, 75]],
};

const ZONAS_COSTAS: Partial<Record<GrupoMuscular, [number, number, number, number][]>> = {
  "Costas": [[268, 330, 50, 85], [372, 330, 50, 85], [320, 215, 60, 30]],
  "Ombros": [[215, 250, 36, 40], [425, 250, 36, 40]],
  "Tríceps": [[168, 345, 24, 60], [472, 345, 24, 60]],
  "Glúteos": [[272, 530, 52, 58], [368, 530, 52, 58]],
  "Pernas": [[265, 690, 44, 105], [378, 690, 44, 105], [258, 895, 34, 75], [392, 895, 34, 75]],
};

const FIGURAS: Record<Sexo, Record<Vista, { src: string; zonas: Zonas }>> = {
  feminino: { frente: { src: corpoFrente, zonas: ZONAS_FRENTE }, costas: { src: corpoCostasF, zonas: ZONAS_COSTAS_F } },
  masculino: { frente: { src: corpoFrenteM, zonas: ZONAS_FRENTE_M }, costas: { src: corpoCostasM, zonas: ZONAS_COSTAS } },
};

function FiguraFoto({ grupo, vista, sexo }: { grupo: GrupoMuscular; vista: Vista; sexo: Sexo }) {
  const fig = FIGURAS[sexo][vista];
  const zonas = fig.zonas[grupo] ?? [];
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="relative aspect-[1/2] h-40 shrink-0 md:h-44">
        <img key={fig.src} src={fig.src} alt={`Corpo humano, vista de ${vista}`} width={640} height={1280} loading="lazy" className="animate-in fade-in duration-500 h-full w-full object-cover [mask-image:radial-gradient(ellipse_60%_55%_at_50%_50%,black_70%,transparent_100%)]" />
        <svg viewBox="0 0 640 1280" className="pointer-events-none absolute inset-0 h-full w-full mix-blend-screen" aria-hidden>
          <defs>
            <filter id={`brilho-foto-${vista}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
          </defs>
          {zonas.map(([cx, cy, rx, ry]) => (
            <g key={grupo + cx + cy} className="muscle-glow">
              <ellipse cx={cx} cy={cy} rx={rx * 1.4} ry={ry * 1.4} className="fill-primary/60" filter={`url(#brilho-foto-${vista})`} />
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} className="fill-primary/45" filter={`url(#brilho-foto-${vista})`} />
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 h-1/4 bg-gradient-to-b from-transparent via-primary/15 to-transparent motion-safe:animate-[scan_4s_ease-in-out_infinite]" />
      </div>
      <figcaption className="font-mono text-[10px] uppercase tracking-normal text-muted-foreground">{vista}</figcaption>
    </figure>
  );
}

export function BodyMap({ grupo, sexo = "feminino" }: { grupo: GrupoMuscular; sexo?: Sexo }) {
  return (
    <div className="flex items-start justify-center gap-3">
      <FiguraFoto grupo={grupo} vista="frente" sexo={sexo} />
      <FiguraFoto grupo={grupo} vista="costas" sexo={sexo} />
    </div>
  );
}
