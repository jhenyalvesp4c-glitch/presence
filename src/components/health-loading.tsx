import { Loader2 } from "lucide-react";

/** Tela de espera da área de Saúde (enquanto as fichas carregam do banco). */
export function HealthLoading() {
  return (
    <div className="health-area grid min-h-screen place-items-center bg-background text-foreground" role="status" aria-label="Carregando">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
