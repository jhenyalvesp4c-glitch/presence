/**
 * Financeiro guardado na nuvem (Supabase, tabelas `fin_*`), só para quem está logado.
 * - Lê tudo ao abrir e grava apenas o que mudou.
 * - Na primeira vez, se a nuvem está vazia e o navegador tem dados, sobe esses dados (e deixa uma cópia de segurança no navegador).
 * - Sem login ou sem rede: continua funcionando com a cópia local, e avisa no indicador.
 */
import { supabase } from "../supabase";
import { diffRows, emptyRows, fromRows, hasData, TABLES, toRows, type Row, type RowDiff, type Rows, type TableName } from "./db-map";
import { LocalFinanceRepo, type FinanceRepo } from "./repo";
import { EMPTY_STATE, type FinanceState } from "./types";

export type SyncStatus = "idle" | "saving" | "saved" | "local" | "error";
export interface ObservableRepo extends FinanceRepo { status(): SyncStatus; subscribe(fn: (s: SyncStatus) => void): () => void }

const CHUNK = 400, PAGE = 1000;
const BACKUP_KEY = "presence.financeiro.v1.migrado";

/** Grava no Supabase só o que mudou (usado pelo navegador e pela voz no servidor). */
async function writeDiff(d: RowDiff, next: Rows): Promise<void> {
  const now = new Date().toISOString();
  if (d.settings) { const { error } = await supabase.from("fin_settings").upsert({ onboarded: next.settings.onboarded, mock: next.settings.mock, updated_at: now }, { onConflict: "user_id" }); if (error) throw new Error(error.message); }
  for (const t of TABLES) {
    for (let i = 0; i < d.upserts[t].length; i += CHUNK) {
      const rows = d.upserts[t].slice(i, i + CHUNK).map((r) => ({ ...r, updated_at: now }));
      const { error } = await supabase.from(t).upsert(rows, { onConflict: "user_id,id" });
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < d.deletes[t].length; i += CHUNK) {
      const { error } = await supabase.from(t).delete().in("id", d.deletes[t].slice(i, i + CHUNK));
      if (error) throw new Error(error.message);
    }
  }
}

/** Salva uma mudança feita fora do navegador (a voz, no servidor): compara o antes e o depois e grava só a diferença. */
export async function persistChange(prev: FinanceState, next: FinanceState): Promise<void> {
  const d = diffRows(toRows(prev), toRows(next));
  if (!d.empty) await writeDiff(d, toRows(next));
}

export class CloudFinanceRepo implements ObservableRepo {
  private local = new LocalFinanceRepo();
  private last: Rows | null = null; // o que se sabe estar na nuvem
  private st: SyncStatus = "idle";
  private subs = new Set<(s: SyncStatus) => void>();
  private chain: Promise<void> = Promise.resolve();

  status() { return this.st; }
  subscribe(fn: (s: SyncStatus) => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  private set(s: SyncStatus) { if (s !== this.st) { this.st = s; this.subs.forEach((f) => f(s)); } }

  private async hasSession(): Promise<boolean> {
    try { const { data } = await supabase.auth.getSession(); return !!data.session; } catch { return false; }
  }

  private async fetchAll(t: TableName): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(t).select("*").order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  private async fetchRows(): Promise<{ rows: Rows; hasSettings: boolean }> {
    const [settings, ...lists] = await Promise.all([supabase.from("fin_settings").select("onboarded, mock").maybeSingle(), ...TABLES.map((t) => this.fetchAll(t))]);
    if (settings.error) throw new Error(settings.error.message);
    const rows = emptyRows();
    TABLES.forEach((t, i) => { rows[t] = lists[i] as Row[]; });
    if (settings.data) rows.settings = { onboarded: !!settings.data.onboarded, mock: !!settings.data.mock };
    return { rows, hasSettings: !!settings.data };
  }

  async load(): Promise<FinanceState> {
    if (!(await this.hasSession())) { this.last = null; this.set("local"); return this.local.load(); }
    try {
      const { rows, hasSettings } = await this.fetchRows();
      const cloudEmpty = !hasSettings && TABLES.every((t) => rows[t].length === 0);
      if (cloudEmpty) {
        const mine = await this.local.load();
        this.last = rows; // vazio
        if (hasData(mine)) { await this.push(mine); await this.backupLocal(); return mine; }
        this.set("saved"); return structuredClone(EMPTY_STATE);
      }
      this.last = rows; this.set("saved");
      return fromRows(rows);
    } catch {
      this.last = null; this.set("error");
      return this.local.load();
    }
  }

  /** Leitura pura da nuvem (usada pela voz no servidor): sem checar sessão do navegador, sem migrar nada. `null` = ainda não há dados. */
  async readCloud(): Promise<FinanceState | null> {
    const { rows, hasSettings } = await this.fetchRows();
    return !hasSettings && TABLES.every((t) => rows[t].length === 0) ? null : fromRows(rows);
  }

  /** Guarda a cópia do navegador num nome de reserva (não apaga, para nunca perder nada na migração). */
  private async backupLocal() {
    try { const v = localStorage.getItem("presence.financeiro.v1"); if (v) { localStorage.setItem(BACKUP_KEY, v); localStorage.removeItem("presence.financeiro.v1"); } } catch { /* sem armazenamento */ }
  }

  private async push(state: FinanceState): Promise<void> {
    const next = toRows(state), prev = this.last ?? emptyRows(), d = diffRows(prev, next);
    if (d.empty) return;
    this.set("saving");
    await writeDiff(d, next);
    this.last = next; this.set("saved");
  }

  async save(state: FinanceState): Promise<void> {
    // uma gravação por vez, na ordem; cada uma envia o que mudou desde a última que deu certo
    this.chain = this.chain.then(async () => {
      if (this.last === null) { await this.local.save(state); if (!(await this.hasSession())) { this.set("local"); return; } try { const r = await this.fetchRows(); this.last = r.rows; } catch { this.set("error"); return; } }
      try { await this.push(state); } catch { await this.local.save(state); this.set("error"); }
    });
    return this.chain;
  }

  async reset(): Promise<void> {
    await this.local.reset();
    try { localStorage.removeItem(BACKUP_KEY); } catch { /* sem armazenamento */ }
    if (!(await this.hasSession())) { this.set("local"); return; }
    this.set("saving");
    try {
      for (const t of TABLES) { const { error } = await supabase.from(t).delete().not("id", "is", null); if (error) throw new Error(error.message); }
      const { error } = await supabase.from("fin_settings").delete().not("user_id", "is", null); if (error) throw new Error(error.message);
      this.last = emptyRows(); this.set("saved");
    } catch { this.set("error"); }
  }
}

export const cloudFinanceRepo = new CloudFinanceRepo();
