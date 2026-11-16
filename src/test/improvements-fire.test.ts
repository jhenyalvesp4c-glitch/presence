import { describe, expect, it } from "vitest";
import { isFireUrl } from "@/lib/improvements.functions";

describe("acionar a rotina do Claude", () => {
  it("só aceita o endereço oficial da API de rotinas", () => {
    expect(isFireUrl("https://api.anthropic.com/v1/claude_code/routines/trig_01ABCDEFGH/fire")).toBe(true);
    for (const u of ["http://api.anthropic.com/v1/claude_code/routines/trig_01/fire", "https://evil.example.com/v1/claude_code/routines/trig_01/fire", "https://api.anthropic.com/v1/claude_code/routines/trig_01/fire/../x", "https://api.anthropic.com.evil.com/v1/claude_code/routines/trig_01/fire", ""]) expect(isFireUrl(u), u).toBe(false);
  });
});
