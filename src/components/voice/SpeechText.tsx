import { useEffect, useRef, type ElementType } from "react";

/** Caixa de fala de tamanho fixo: conforme o texto cresce, rola sozinha para o fim para mostrar o que está sendo dito. */
export function SpeechText({ text, className = "", as: Tag = "p", maxH = "max-h-[5.4rem]", testId = "voz-texto" }: { text: string; className?: string; as?: ElementType; maxH?: string; testId?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }, [text]);
  return (
    <Tag ref={ref} data-testid={testId}
      className={`${maxH} overflow-y-auto break-words [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,transparent,black_0.9rem)] ${className}`}>
      {text}
    </Tag>
  );
}
