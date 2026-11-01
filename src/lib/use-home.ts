import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase, type AssistantMessage, type Demand } from "./supabase";
import { askAssistant } from "./assistant.functions";

/** Dados e ações da página principal: perfil, conversa com a assistente e demandas. */
export function useHome(session: Session | null | undefined) {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id;

  const refreshPending = useCallback(async () => {
    const { count } = await supabase
      .from("demands")
      .select("id", { count: "exact", head: true })
      .neq("status", "concluida");
    setPendingCount(count ?? 0);
  }, []);

  useEffect(() => {
    if (!userId || !session) return;
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
        supabase
          .from("assistant_messages")
          .select("id, role, content, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;
      if (!profile) await supabase.from("profiles").upsert({ id: userId });
      setDisplayName(profile?.display_name ?? session.user.email?.split("@")[0] ?? null);
      setMessages(((msgs ?? []) as AssistantMessage[]).reverse());
      await refreshPending();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, session, refreshPending]);

  const ask = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || !session) return;
      setError(null);
      setThinking(true);
      const temp: AssistantMessage = { id: `tmp-${Date.now()}`, role: "user", content: message, created_at: new Date().toISOString() };
      setMessages((m) => [...m, temp]);
      try {
        const res = await askAssistant({ data: { accessToken: session.access_token, message } });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMessages((m) => [
          ...m,
          { id: `tmp-a-${Date.now()}`, role: "assistant", content: res.reply, created_at: new Date().toISOString() },
        ]);
        if (res.demandsCreated.length) await refreshPending();
      } catch {
        setError("Não consegui falar com a assistente. Verifique sua conexão.");
      } finally {
        setThinking(false);
      }
    },
    [session, refreshPending],
  );

  const registerDemand = useCallback(
    async (title: string, source: Demand["source"]) => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("demands")
        .insert({ user_id: userId, title: title.trim().slice(0, 300), source })
        .select("id, title, description, source, status, created_at")
        .single();
      if (error) {
        setError(`Não consegui registrar a demanda: ${error.message}`);
        return null;
      }
      await refreshPending();
      return data as Demand;
    },
    [userId, refreshPending],
  );

  const clearConversation = useCallback(async () => {
    if (!userId) return;
    await supabase.from("assistant_messages").delete().eq("user_id", userId);
    setMessages([]);
  }, [userId]);

  return { displayName, messages, pendingCount, thinking, error, setError, ask, registerDemand, clearConversation };
}
