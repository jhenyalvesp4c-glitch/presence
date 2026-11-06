import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Estado em memória que também vive no banco. A tela edita como se fosse um `useState`; cada mudança
 * é enviada ao banco em fila (uma de cada vez, na ordem). Se o envio falhar, avisa e recarrega do banco.
 * `ready` só fica verdadeiro depois do primeiro carregamento. `key` null = ainda não pode carregar.
 */
export function useDbState<T>(
  key: string | null, initial: T, load: () => Promise<T>, save: (prev: T, next: T) => Promise<void>,
) {
  const [state, setState] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const cur = useRef<T>(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const fns = useRef({ load, save });
  fns.current = { load, save };

  const reload = useCallback(async () => {
    const v = await fns.current.load();
    cur.current = v;
    setState(v);
  }, []);

  useEffect(() => {
    if (key === null) { setReady(false); return; }
    let alive = true;
    setReady(false);
    cur.current = initial;
    setState(initial);
    queue.current = Promise.resolve();
    fns.current.load()
      .then((v) => { if (alive) { cur.current = v; setState(v); } })
      .catch((e: Error) => toast.error(`Não consegui carregar: ${e.message}`))
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback((upd: T | ((p: T) => T)) => {
    const prev = cur.current;
    const next = typeof upd === "function" ? (upd as (p: T) => T)(prev) : upd;
    if (next === prev) return;
    cur.current = next;
    setState(next);
    queue.current = queue.current
      .then(() => fns.current.save(prev, next))
      .catch((e: Error) => {
        toast.error(`Não consegui salvar: ${e.message}`);
        return reload().catch(() => undefined);
      });
  }, [reload]);

  return [state, set, ready] as const;
}
