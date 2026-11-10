import { describe, expect, it, vi } from "vitest";
import { backdropProps } from "@/lib/backdrop";

const bg = {} as EventTarget, inner = {} as EventTarget;
const down = (p: ReturnType<typeof backdropProps>, target: EventTarget) => p.onPointerDown({ target } as never);
const click = (p: ReturnType<typeof backdropProps>, target: EventTarget) => p.onClick({ target, currentTarget: bg } as never);

describe("fechar a janela pelo fundo", () => {
  it("fecha quando o clique começa e termina no fundo", () => {
    const close = vi.fn(); const p = backdropProps(close);
    down(p, bg); click(p, bg);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("não fecha se o clique começou dentro da janela (arrastar para fora)", () => {
    const close = vi.fn(); const p = backdropProps(close);
    down(p, inner); click(p, bg);
    expect(close).not.toHaveBeenCalled();
  });
  it("não fecha se o clique foi dentro da janela", () => {
    const close = vi.fn(); const p = backdropProps(close);
    down(p, inner); click(p, inner);
    expect(close).not.toHaveBeenCalled();
  });
});
