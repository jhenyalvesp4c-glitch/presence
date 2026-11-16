import { describe, expect, it } from "vitest";
import { fillerFor } from "@/lib/voice/filler";

describe("aviso falado enquanto trabalha", () => {
  it("consultas dizem que estão verificando", () => {
    for (const t of ["buscar_no_orion", "consultar_registros", "resumo_do_dia", "whatsapp_mencoes"]) expect(fillerFor([t], "x"), t).toMatch(/verific|olhando/i);
  });
  it("WhatsApp diz que está abrindo", () => { expect(fillerFor(["whatsapp_ler"], "a")).toMatch(/WhatsApp/); expect(fillerFor(["whatsapp_conversas", "registrar"], "a")).toMatch(/WhatsApp/); });
  it("criar e mudar coisas diz que está fazendo", () => { for (const t of ["registrar", "atualizar_demanda", "gerenciar_tarefa", "lista", "roteiro"]) expect(fillerFor([t], "b"), t).toMatch(/fazendo|cuidando/i); });
  it("ações imediatas e pedidos de melhoria não falam nada", () => { for (const t of ["abrir_pagina", "encerrar_conversa", "ajustar_perfil", "pedir_melhoria"]) expect(fillerFor([t], "c"), t).toBe(""); expect(fillerFor([], "c")).toBe(""); });
  it("é estável para o mesmo pedido e varia entre pedidos", () => {
    expect(fillerFor(["buscar_no_orion"], "id1")).toBe(fillerFor(["buscar_no_orion"], "id1"));
    expect(new Set(["a", "bb", "ccc", "dddd", "eeeee"].map((s) => fillerFor(["buscar_no_orion"], s))).size).toBeGreaterThan(1);
  });
});
