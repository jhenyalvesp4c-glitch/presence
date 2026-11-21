import { createFileRoute } from "@tanstack/react-router";

import { FinBackdrop, LiveDot } from "@/components/finance/fx";
import { ConnectionMap } from "@/components/map/ConnectionMap";

export const Route = createFileRoute("/mapa")({
  head: () => ({ meta: [{ title: "Mapa de conexões · Orion" }, { name: "description", content: "O segundo cérebro como uma rede viva: projetos, dossiês, demandas, anotações, ideias, reuniões e pessoas ligados entre si." }] }),
  component: MapPage,
});

function MapPage() {
  return (
    <main className="relative mx-auto min-h-screen max-w-[1500px] px-4 pb-32 pt-6 md:py-8" data-testid="pagina-mapa"><FinBackdrop />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3" style={{ animation: "fin-rise .6s both" }}>
        <div><p className="mono-caps flex items-center gap-3">Segundo cérebro <LiveDot color="var(--cyan)" label="rede viva" /></p>
          <h1 className="mt-2 font-serif text-5xl leading-[0.95] tracking-tight md:text-6xl">Mapa de <span className="text-gradient inline-block pr-3 italic">conexões</span></h1></div>
        <p className="max-w-md text-sm text-muted-foreground">Tudo o que o Orion guarda, ligado: projetos, dossiês, demandas, notas, reuniões, ideias e pessoas. Passe o mouse para ver as ligações e clique para abrir.</p>
      </header>
      <ConnectionMap />
    </main>
  );
}
