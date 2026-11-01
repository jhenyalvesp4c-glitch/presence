import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="glass max-w-md rounded-3xl p-10 text-center animate-rise">
        <p className="mono-caps mb-3">Em breve</p>
        <h1 className="font-serif text-4xl"><span className="text-gradient">{title}</span></h1>
        <p className="mt-4 text-muted-foreground">{text}</p>
        <Link to="/assistente" className="glass mt-8 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm">
          <ArrowLeft size={16} /> Voltar ao assistente
        </Link>
      </div>
    </div>
  );
}
