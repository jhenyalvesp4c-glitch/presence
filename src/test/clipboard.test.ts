import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/clipboard";

describe("copyText", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it("usa a API moderna quando funciona", async () => {
    const w = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: w }, configurable: true });
    expect(await copyText("oi")).toBe(true);
    expect(w).toHaveBeenCalledWith("oi");
  });
  it("cai para o método antigo quando a API é bloqueada", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("bloqueado")) }, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    expect(await copyText("oi")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });
});
