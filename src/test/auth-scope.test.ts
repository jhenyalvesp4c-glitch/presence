import { describe, expect, it } from "vitest";
import { bearer, runWithScope } from "../lib/server-auth";
import { ownerId, setClientOwner, SINGLE_USER_ID, supabase } from "../lib/supabase";

const fakeClient = (tag: string) => ({ from: (t: string) => `${tag}:${t}` });

describe("login no servidor: cada pedido enxerga só o seu dono", () => {
  it("sem pedido, o dono é o legado; no navegador vem do login", () => {
    expect(ownerId()).toBe(SINGLE_USER_ID);
    setClientOwner("owner-x"); expect(ownerId()).toBe("owner-x"); setClientOwner(undefined);
  });
  it("dentro do pedido, ownerId e supabase usam o contexto dele, mesmo com awaits no meio", async () => {
    const seen = await Promise.all(["a", "b"].map((who) => runWithScope({ client: fakeClient(who), owner: `dono-${who}`, uid: who }, async () => {
      await new Promise((r) => setTimeout(r, who === "a" ? 15 : 1));
      return [ownerId(), (supabase as unknown as { from: (t: string) => string }).from("tasks")];
    })));
    expect(seen).toEqual([["dono-a", "a:tasks"], ["dono-b", "b:tasks"]]);
    expect(ownerId()).toBe(SINGLE_USER_ID); // fora do pedido volta ao padrão
  });
  it("lê o token do cabeçalho Authorization", () => {
    expect(bearer(new Request("http://x", { headers: { authorization: "Bearer abc.def" } }))).toBe("abc.def");
    expect(bearer(new Request("http://x"))).toBeNull();
    expect(bearer(new Request("http://x", { headers: { authorization: "Basic zzz" } }))).toBeNull();
  });
});
