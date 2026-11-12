import { Fragment, type ReactNode } from "react";

/** Texto da IA em formato simples (negrito, itálico, listas, [1] de fonte) → elementos React. Sem HTML cru. */
const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[\d+\](?:\s*\[\d+\])*)/g;

function inline(text: string, onCite?: (n: number) => void, keyBase = ""): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyBase}${i}`;
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={key} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (/^\*.+\*$/.test(part)) return <em key={key} className="text-foreground/90">{part.slice(1, -1)}</em>;
    if (/^`.+`$/.test(part)) return <code key={key} className="rounded bg-secondary/70 px-1 font-mono text-[0.85em] text-cyan">{part.slice(1, -1)}</code>;
    if (/^\[\d+\]/.test(part)) {
      return (
        <Fragment key={key}>
          {[...part.matchAll(/\[(\d+)\]/g)].map((m, j) => {
            const n = Number(m[1]);
            return (
              <button key={j} type="button" onClick={() => onCite?.(n)} aria-label={`Ver fonte ${n}`} data-testid="citacao"
                className="mx-0.5 inline-grid h-[1.35em] min-w-[1.35em] -translate-y-[0.1em] place-items-center rounded-md border border-violet/50 bg-violet/15 px-1 align-baseline font-mono text-[0.68em] font-semibold text-violet transition hover:-translate-y-[0.25em] hover:border-cyan hover:bg-cyan/15 hover:text-cyan hover:shadow-[0_0_12px_-2px_var(--cyan)]">{n}</button>
            );
          })}
        </Fragment>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

type Block = { t: "p"; lines: string[] } | { t: "ul"; items: string[] } | { t: "ol"; items: string[] } | { t: "h"; text: string };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const last = out[out.length - 1];
    if (!line.trim()) { out.push({ t: "p", lines: [] }); continue; }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/), ol = line.match(/^\s*\d+[.)]\s+(.*)$/), h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) out.push({ t: "h", text: h[1]! });
    else if (ul) { if (last?.t === "ul") last.items.push(ul[1]!); else out.push({ t: "ul", items: [ul[1]!] }); }
    else if (ol) { if (last?.t === "ol") last.items.push(ol[1]!); else out.push({ t: "ol", items: [ol[1]!] }); }
    else if (last?.t === "p" && last.lines.length) last.lines.push(line.trim());
    else out.push({ t: "p", lines: [line.trim()] });
  }
  return out.filter((b) => b.t !== "p" || b.lines.length);
}

export function Rich({ text, onCite, className = "" }: { text: string; onCite?: (n: number) => void; className?: string }) {
  return (
    <div className={`space-y-3 text-[0.86rem] leading-relaxed text-foreground/90 ${className}`}>
      {blocks(text).map((b, i) => {
        if (b.t === "h") return <h4 key={i} className="mono-caps !text-[0.65rem] text-cyan">{inline(b.text, onCite, `h${i}`)}</h4>;
        if (b.t === "p") return <p key={i}>{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, onCite, `p${i}-${j}-`)}</Fragment>)}</p>;
        const Tag = b.t === "ul" ? "ul" : "ol";
        return (
          <Tag key={i} className="space-y-1.5">
            {b.items.map((it, j) => (
              <li key={j} className="relative rounded-xl border border-border/60 bg-secondary/20 py-1.5 pl-9 pr-3 transition hover:border-violet/40 hover:bg-secondary/40">
                <span className="absolute left-2.5 top-1.5 grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-cyan/30 to-violet/30 font-mono text-[0.6rem] text-foreground">{b.t === "ol" ? j + 1 : "▸"}</span>
                {inline(it, onCite, `l${i}-${j}-`)}
              </li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
