/** Financeiro → Acerto de contas: compras no cartão de um e do outro, quanto cada um deve e o pix final, com extrato para enviar. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, Camera, Check, ClipboardCopy, FileText, Handshake, Home, Image as ImageIcon, Loader2, Pencil, Plus, Printer, Receipt, Trash2, Wallet } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { readFiles, type LocalFile } from "@/components/inbox/files";
import { readStatement, type StatementLine } from "@/lib/finance/statement.functions";
import { balance, brl, fromCents, parseBills, parseMoney, split, statementText, type Payer, type SettleItem } from "@/lib/finance/settle";
import { download, printStatement, statementPng } from "@/lib/finance/settle-export";
import { useSettleActions, useSettlementItems, useSettlements, type ItemDraft, type Settlement } from "@/lib/finance/settle-data";
import { Empty, Field, Head, Modal, MoneyInput, Panel, Pill, Segmented, TextInput, btn } from "./ui";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameLine = (a: { date: string | null; description: string; amount: number }, b: { date: string | null; description: string; amount: number }) => a.amount === b.amount && norm(a.description) === norm(b.description) && (a.date ?? "") === (b.date ?? "");

/* ───────────── tela principal ───────────── */
export function SettleView() {
  const list = useSettlements(), acts = useSettleActions(), { account } = useAuth(), qc = useQueryClient();
  // o Orion mexeu no acerto (por conversa ou voz): recarrega a tela
  useEffect(() => { const h = () => { void qc.invalidateQueries({ queryKey: ["settlements"] }); void qc.invalidateQueries({ queryKey: ["settlement-items"] }); }; window.addEventListener("orion:financeiro-atualizado", h); return () => window.removeEventListener("orion:financeiro-atualizado", h); }, [qc]);
  const me = account?.name?.trim() || "Eu";
  const [selId, setSelId] = useState<string | null>(null), [newName, setNewName] = useState(""), [adding, setAdding] = useState(false);
  const [reader, setReader] = useState(false), [bills, setBills] = useState(false), [editor, setEditor] = useState<{ item: SettleItem | null; kind: SettleItem["kind"] } | null>(null);
  const settlements = list.data ?? [];
  const sel: Settlement | undefined = settlements.find((s) => s.id === selId) ?? settlements.find((s) => !s.closed) ?? settlements[0];
  const items = useSettlementItems(sel?.id ?? null).data ?? [];
  const bal = useMemo(() => balance(items), [items]);
  const text = sel ? statementText({ me, person: sel.person, items, generatedOn: todayIso() }) : "";

  const create = async () => {
    const name = newName.trim(); if (!name) return;
    try { const s = await acts.create.mutateAsync(name); setSelId(s.id); setNewName(""); setAdding(false); } catch (e) { toast.error(`Não consegui criar o acerto: ${(e as Error).message}`); }
  };
  const saveDrafts = async (drafts: ItemDraft[]) => {
    if (!sel || !drafts.length) return;
    try { await acts.addItems.mutateAsync({ settlementId: sel.id, drafts, start: items.length }); toast.success(`${drafts.length} lançamento${drafts.length === 1 ? "" : "s"} adicionado${drafts.length === 1 ? "" : "s"}.`); } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast.success("Extrato copiado. Cole no WhatsApp."); } catch { toast.error("Não consegui copiar. Use a imagem ou o PDF."); } };
  const png = async () => { try { download(await statementPng(text), `acerto-${sel?.person ?? "contas"}.png`); } catch (e) { toast.error((e as Error).message); } };

  return (
    <div className="space-y-5" data-testid="acerto">
      <Panel glow="var(--emerald)">
        <Head icon={Handshake} title="Acerto de contas" sub="Compras no seu cartão e no dele(a): o app soma, subtrai e diz quem faz o pix."
          right={<button className={btn.primary} onClick={() => setAdding(true)} data-testid="acerto-novo"><Plus size={15} /> Novo acerto</button>} />
        {adding && <div className="mb-4 flex flex-wrap items-end gap-2">
          <Field label="Com quem?" className="min-w-52 flex-1"><TextInput autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void create(); }} placeholder="Nome da pessoa" data-testid="acerto-nome" maxLength={80} /></Field>
          <button className={btn.primary} onClick={() => void create()} disabled={!newName.trim()} data-testid="acerto-criar">Criar</button>
          <button className={btn.ghost} onClick={() => { setAdding(false); setNewName(""); }}>Cancelar</button>
        </div>}
        {list.isError && <p className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="acerto-erro">Não consegui abrir os acertos agora ({(list.error as Error).message}).</p>}
        {settlements.length > 0 ? <div className="flex flex-wrap gap-2" role="tablist" aria-label="Acertos">
          {settlements.map((s) => <button key={s.id} role="tab" aria-selected={s.id === sel?.id} onClick={() => setSelId(s.id)} data-testid={`acerto-aba-${s.person}`}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${s.id === sel?.id ? "border-emerald/60 bg-emerald/10 text-emerald" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{s.person}{s.closed && <span className="ml-1.5 text-[0.65rem] opacity-70">quitado</span>}</button>)}
        </div> : !list.isError && !adding && <Empty icon={Handshake} title="Nenhum acerto ainda" hint="Crie um acerto com a pessoa com quem você divide compras no cartão. Depois é só enviar a foto do extrato." action={<button className={btn.primary} onClick={() => setAdding(true)}><Plus size={15} /> Criar o primeiro</button>} />}
      </Panel>

      {sel && <>
        <Panel glow={bal.direction === "eu_pago" ? "var(--violet)" : "var(--emerald)"} data-testid="acerto-saldo">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Conta final com {sel.person}</p>
              <p className="mt-1 font-display text-3xl font-semibold" data-testid="acerto-final">
                {bal.direction === "quite" ? "Ninguém deve nada" : bal.direction === "outro_paga" ? <>{sel.person} paga <span className="text-emerald">{brl(bal.amount)}</span> a você</> : <>Você paga <span className="text-violet">{brl(bal.amount)}</span> a {sel.person}</>}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">{sel.person} deve (compras no seu cartão)</span><b className="text-right tabular-nums text-emerald">+ {brl(fromCents(bal.owedToMe))}</b>
              <span className="text-muted-foreground">Você deve (compras no cartão dele/dela)</span><b className="text-right tabular-nums text-violet">− {brl(fromCents(bal.owedByMe))}</b>
              {(bal.paidByMe > 0 || bal.paidByOther > 0) && <><span className="text-muted-foreground">Pix que você já fez</span><b className="text-right tabular-nums">+ {brl(fromCents(bal.paidByMe))}</b><span className="text-muted-foreground">Pix que {sel.person} já fez</span><b className="text-right tabular-nums">− {brl(fromCents(bal.paidByOther))}</b></>}
            </div>
          </div>
          <DefaultSplit person={sel.person} value={sel.defaultShare} onChange={(v) => acts.patch.mutate({ id: sel.id, defaultShare: v }, { onError: (e) => toast.error(`Não consegui salvar: ${e.message}`) })} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btn.primary} onClick={() => setReader(true)} data-testid="acerto-ler"><Camera size={15} /> Ler extrato (foto, PDF ou texto)</button>
            <button className={btn.ghost} onClick={() => setBills(true)} data-testid="acerto-contas"><Home size={15} /> Contas da casa</button>
            <button className={btn.ghost} onClick={() => setEditor({ item: null, kind: "compra" })} data-testid="acerto-compra"><Receipt size={15} /> Lançar compra</button>
            <button className={btn.ghost} onClick={() => setEditor({ item: null, kind: "pagamento" })} data-testid="acerto-pix"><Wallet size={15} /> Registrar pix</button>
          </div>
        </Panel>

        <Panel>
          <Head icon={ArrowRightLeft} title="Lançamentos" sub={`${items.length} item${items.length === 1 ? "" : "s"}`} />
          {items.length === 0 ? <Empty icon={Receipt} title="Sem lançamentos" hint="Envie a foto do extrato do seu cartão (e depois a do cartão dela) ou lance à mão." /> : (
            <ul className="divide-y divide-white/5" data-testid="acerto-itens">
              {items.map((it) => <ItemRow key={it.id} it={it} person={sel.person} onEdit={() => setEditor({ item: it, kind: it.kind })}
                onDelete={() => { if (window.confirm(`Excluir "${it.description || "lançamento"}"?`)) acts.removeItem.mutate({ settlementId: sel.id, id: it.id }, { onError: (e) => toast.error(`Não consegui excluir: ${e.message}`) }); }} />)}
            </ul>
          )}
        </Panel>

        <Panel glow="var(--cyan)">
          <Head icon={FileText} title="Extrato para enviar" sub="Com tudo que foi somado e subtraído e o valor final." />
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-relaxed text-muted-foreground" data-testid="acerto-texto">{text.replace(/\*/g, "")}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btn.primary} onClick={() => void copy()} data-testid="acerto-copiar"><ClipboardCopy size={15} /> Copiar para WhatsApp</button>
            <button className={btn.ghost} onClick={() => void png()} data-testid="acerto-png"><ImageIcon size={15} /> Baixar imagem</button>
            <button className={btn.ghost} onClick={() => printStatement(`Acerto de contas — ${me} e ${sel.person}`, text)} data-testid="acerto-pdf"><Printer size={15} /> PDF / imprimir</button>
            <span className="grow" />
            <button className={btn.ghost} onClick={() => acts.patch.mutate({ id: sel.id, closed: !sel.closed })}><Check size={15} /> {sel.closed ? "Reabrir" : "Marcar como quitado"}</button>
            <button className={btn.danger} onClick={() => { if (window.confirm(`Excluir o acerto com ${sel.person} e todos os lançamentos? Não dá para desfazer.`)) acts.remove.mutate(sel.id, { onSuccess: () => setSelId(null) }); }}><Trash2 size={15} /> Excluir acerto</button>
          </div>
        </Panel>
      </>}

      {sel && reader && <StatementReader person={sel.person} existing={items} onClose={() => setReader(false)} onSave={(d) => { void saveDrafts(d); setReader(false); }} />}
      {sel && bills && <BillsModal person={sel.person} defaultShare={sel.defaultShare} onClose={() => setBills(false)} onSave={(d) => { void saveDrafts(d); setBills(false); }} />}
      {sel && editor && <ItemEditor person={sel.person} defaultShare={sel.defaultShare} initial={editor.item} kind={editor.kind} onClose={() => setEditor(null)}
        onSave={(d) => { if (editor.item) acts.updateItem.mutate({ settlementId: sel.id, id: editor.item.id, draft: d }, { onError: (e) => toast.error(`Não consegui salvar: ${e.message}`) }); else void saveDrafts([d]); setEditor(null); }} />}
    </div>
  );
}

function ItemRow({ it, person, onEdit, onDelete }: { it: SettleItem; person: string; onEdit: () => void; onDelete: () => void }) {
  const s = split(it);
  const who = it.kind === "pagamento" ? (it.payer === "eu" ? `Pix seu → ${person}` : `Pix de ${person} → você`) : it.payer === "eu" ? `No seu cartão · ${person} deve ${brl(fromCents(s.other))}${it.otherShare < 100 ? ` (${it.otherShare}%)` : ""}` : `No cartão de ${person} · você deve ${brl(fromCents(s.mine))}${it.otherShare > 0 ? ` (${100 - it.otherShare}%)` : ""}`;
  return (
    <li className="flex items-center gap-3 py-2.5" data-testid="acerto-item">
      <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{dm(it.date)}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm">{it.description || (it.kind === "pagamento" ? "Pix" : "Compra")}{it.installment && <span className="ml-1.5 text-xs text-muted-foreground">({it.installment})</span>}{it.linked && <span className="ml-1.5 rounded-full border border-emerald/40 px-1.5 py-0.5 text-[0.62rem] text-emerald" title="Vem de uma compra dividida no financeiro. Para mudar, edite a compra.">da compra</span>}</p><p className="truncate text-xs text-muted-foreground">{who}</p></div>
      <b className="tabular-nums text-sm">{brl(it.amount)}</b>
      {!it.linked && <button className={btn.icon} onClick={onEdit} aria-label="Editar"><Pencil size={14} /></button>}
      {!it.linked && <button className={btn.icon} onClick={onDelete} aria-label="Excluir"><Trash2 size={14} /></button>}
    </li>
  );
}

/* ───────────── lançar à mão / editar ───────────── */
function ItemEditor({ person, defaultShare, initial, kind, onSave, onClose }: { person: string; defaultShare: number | null; initial: SettleItem | null; kind: SettleItem["kind"]; onSave: (d: ItemDraft) => void; onClose: () => void }) {
  const [payer, setPayer] = useState<Payer>(initial?.payer ?? "eu");
  const [desc, setDesc] = useState(initial?.description ?? ""), [amount, setAmount] = useState<number | undefined>(initial?.amount), [date, setDate] = useState(initial?.date ?? todayIso());
  // compra nova: começa pela divisão padrão do acerto (se houver); compra existente: como foi lançada
  const start = initial ? initial.otherShare : defaultShare;
  const [who, setWho] = useState<"tudo" | "metade" | "pct">(() => (start === null ? "tudo" : start === 50 ? "metade" : start === 100 || start === 0 ? "tudo" : "pct"));
  const [pct, setPct] = useState(start !== null && ![0, 50, 100].includes(start) ? start : 30), [inst, setInst] = useState(initial?.installment ?? "");
  const pix = kind === "pagamento";
  // para quem é a compra: "tudo" = a parte inteira do OUTRO lado do cartão (se paguei eu, é dela; se ela pagou, é minha)
  const otherShare = pix ? 100 : who === "metade" ? 50 : who === "pct" ? Math.min(100, Math.max(0, pct)) : payer === "eu" ? 100 : 0;
  const ok = !!amount && amount > 0;
  const parts = amount && !pix ? split({ amount, otherShare }) : null;
  return (
    <Modal open onClose={onClose} title={initial ? "Editar lançamento" : pix ? "Registrar pix" : "Lançar compra"} width="max-w-lg"
      footer={<><button className={btn.ghost} onClick={onClose}>Cancelar</button><button className={btn.primary} disabled={!ok} data-testid="acerto-salvar-item" onClick={() => amount && onSave({ kind, date: date || null, description: desc, amount, payer, otherShare, installment: inst })}>Salvar</button></>}>
      <div className="space-y-4">
        <Field label={pix ? "Quem fez o pix?" : "Em qual cartão foi?"} group>
          <Segmented value={payer} onChange={setPayer} options={[{ value: "eu", label: pix ? "Eu" : "No meu cartão" }, { value: "outro", label: pix ? person : `No cartão de ${person}` }]} />
        </Field>
        {!pix && <Field label={payer === "eu" ? `De quem é a compra?` : "De quem é a compra?"} group>
          <Segmented value={who} onChange={setWho} options={[{ value: "tudo", label: payer === "eu" ? `Toda de ${person}` : "Toda minha" }, { value: "metade", label: "Dividida 50/50" }, { value: "pct", label: "Outra divisão" }]} />
          {who === "pct" && <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">{person} fica com <input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-20 rounded-xl border border-white/10 bg-black/25 px-2 py-1 text-right text-foreground" /> %</label>}
        </Field>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor"><MoneyInput value={amount} onChange={setAmount} data-testid="acerto-valor" /></Field>
          <Field label="Data"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label={pix ? "Observação (opcional)" : "Descrição"}><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={pix ? "Ex.: pix de quitação" : "Ex.: Mercado, farmácia…"} maxLength={200} data-testid="acerto-desc" /></Field>
        {parts && <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" data-testid="acerto-divisor">Parte de {person}: <b className="text-emerald">{brl(fromCents(parts.other))}</b> · Sua parte: <b>{brl(fromCents(parts.mine))}</b> <span className="text-xs text-muted-foreground">({otherShare}% / {100 - otherShare}%)</span></p>}
        {!pix && <Field label="Parcela (opcional)"><TextInput value={inst} onChange={(e) => setInst(e.target.value)} placeholder="Ex.: 2/5" maxLength={20} /></Field>}
      </div>
    </Modal>
  );
}

/** Quanto das contas da casa fica com cada um (usado como ponto de partida ao lançar). */
function DefaultSplit({ person, value, onChange }: { person: string; value: number | null; onChange: (v: number | null) => void }) {
  const [txt, setTxt] = useState(value === null ? "" : String(value));
  const commit = () => { const n = txt.trim() === "" ? null : Math.min(100, Math.max(0, Math.round(Number(txt)))); if (n !== null && !Number.isFinite(n)) return; if (n !== value) onChange(n); };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="acerto-padrao">
      <span>Divisão padrão das contas da casa:</span>
      <span>{person} fica com</span>
      <input aria-label="Porcentagem padrão da outra pessoa" inputMode="numeric" value={txt} onChange={(e) => setTxt(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} placeholder="50" className="w-14 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-right text-foreground" />
      <span>% e você com {txt === "" ? "…" : 100 - Math.min(100, Number(txt))}%</span>
      {[50, 60, 70].map((n) => <button key={n} type="button" className="rounded-full border border-white/10 px-2 py-0.5 hover:text-foreground" onClick={() => { setTxt(String(n)); onChange(n); }}>{n}/{100 - n}</button>)}
    </div>
  );
}

/** Contas da casa: cola as contas CHEIAS (uma por linha) e o app divide cada uma. */
function BillsModal({ person, defaultShare, onSave, onClose }: { person: string; defaultShare: number | null; onSave: (d: ItemDraft[]) => void; onClose: () => void }) {
  const [text, setText] = useState(""), [payer, setPayer] = useState<Payer>("outro"), [share, setShare] = useState(defaultShare ?? 50), [date, setDate] = useState(todayIso());
  const rows = useMemo(() => parseBills(text), [text]);
  const parts = rows.map((r) => split({ amount: r.amount, otherShare: share }));
  const sumOther = parts.reduce((n, p) => n + p.other, 0), sumMine = parts.reduce((n, p) => n + p.mine, 0), total = rows.reduce((n, r) => n + Math.round(r.amount * 100), 0);
  // quem pagou a conta cheia: se foi o outro, eu devo a minha parte; se fui eu, a outra pessoa deve a dela
  return (
    <Modal open onClose={onClose} title="Contas da casa" subtitle="Cole as contas cheias; o app divide cada uma" width="max-w-2xl"
      footer={<><button className={btn.ghost} onClick={onClose}>Cancelar</button><button className={btn.primary} disabled={!rows.length} data-testid="acerto-contas-salvar"
        onClick={() => onSave(rows.map((r) => ({ kind: "compra" as const, date: date || null, description: r.description, amount: r.amount, payer, otherShare: share, installment: "" })))}>Lançar {rows.length} conta{rows.length === 1 ? "" : "s"}</button></>}>
      <div className="space-y-4">
        <Field label="Quem pagou as contas cheias?" group><Segmented value={payer} onChange={setPayer} options={[{ value: "outro", label: `${person} pagou` }, { value: "eu", label: "Eu paguei" }]} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Divisão: ${person} fica com`} hint={`Você fica com ${100 - share}%.`}>
            <div className="flex items-center gap-2"><input type="number" min={0} max={100} value={share} onChange={(e) => setShare(Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))))} className="w-24 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-right text-sm" data-testid="acerto-contas-pct" /><span className="text-sm text-muted-foreground">%</span>
              {[50, 60, 70].map((n) => <button key={n} type="button" className="rounded-full border border-white/10 px-2.5 py-1 text-xs hover:text-foreground" onClick={() => setShare(n)}>{n}/{100 - n}</button>)}</div>
          </Field>
          <Field label="Data"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Contas (uma por linha, com o valor cheio)" hint="Ex.: Luz 312,40 · Internet 120 · Condomínio 1.200,00">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={"Luz 312,40\nInternet 120,00\nCondomínio 1.200,00"} data-testid="acerto-contas-texto" className="w-full rounded-2xl border border-white/10 bg-black/25 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-cyan/55" />
        </Field>
        {rows.length > 0 && <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm" data-testid="acerto-contas-previa">
          <ul className="divide-y divide-white/5">{rows.map((r, i) => <li key={i} className="flex items-center gap-3 py-1.5"><span className="min-w-0 flex-1 truncate">{r.description}</span><span className="tabular-nums text-muted-foreground">{brl(r.amount)}</span><span className="w-28 text-right text-xs tabular-nums text-emerald">{person}: {brl(fromCents(parts[i]!.other))}</span><span className="w-24 text-right text-xs tabular-nums">você: {brl(fromCents(parts[i]!.mine))}</span></li>)}</ul>
          <p className="mt-2 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-2 font-medium"><span>Total {brl(fromCents(total))}</span><span className="text-emerald">{person}: {brl(fromCents(sumOther))}</span><span>Você: {brl(fromCents(sumMine))}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{payer === "outro" ? `Como ${person} pagou, você deve a ele(a) ${brl(fromCents(sumMine))}.` : `Como você pagou, ${person} deve a você ${brl(fromCents(sumOther))}.`}</p>
        </div>}
      </div>
    </Modal>
  );
}

/* ───────────── ler extrato (foto, PDF ou texto) ───────────── */
type Line = StatementLine & { id: number; choice: "nao" | "outro" | "dividir"; dup: boolean; valorEdit: number };

function StatementReader({ person, existing, onSave, onClose }: { person: string; existing: SettleItem[]; onSave: (d: ItemDraft[]) => void; onClose: () => void }) {
  const [owner, setOwner] = useState<Payer>("eu"), [instr, setInstr] = useState(""), [texto, setTexto] = useState(""), [share, setShare] = useState(50);
  const [files, setFiles] = useState<LocalFile[]>([]), [busy, setBusy] = useState(false), [note, setNote] = useState(""), [lines, setLines] = useState<Line[] | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const addFiles = async (l: FileList | null) => {
    if (!l?.length) return;
    const r = await readFiles([...l], files);
    if (r.added.length) setFiles((f) => [...f, ...r.added]);
    if (r.rejected.length) setNote(r.rejected.join(" · "));
  };
  const read = async () => {
    setBusy(true); setNote("");
    try {
      const r = await readStatement({ data: { files: files.map(({ name, mime, size, data }) => ({ name, mime, size, data })), texto, instrucao: instr, hoje: todayIso() } });
      if (!r.ok) { setNote(r.error); return; }
      if (!r.linhas.length) { setNote("Não achei compras nesse extrato. Tente uma foto mais nítida ou cole o texto."); return; }
      setNote(r.nota);
      setLines(r.linhas.map((l, i) => {
        const dup = existing.some((e) => e.kind === "compra" && e.payer === owner && sameLine({ date: e.date, description: e.description, amount: e.amount }, { date: l.data || null, description: l.descricao, amount: l.valor }));
        const choice: Line["choice"] = dup ? "nao" : l.parteDaOutra === null ? "nao" : l.parteDaOutra === 0 ? "nao" : l.parteDaOutra === 50 ? "dividir" : "outro";
        return { ...l, id: i, choice, dup, valorEdit: l.valor };
      }));
    } catch (e) { setNote(e instanceof Error ? e.message : "Não consegui ler o extrato."); } finally { setBusy(false); }
  };
  const set = (id: number, patch: Partial<Line>) => setLines((ls) => ls && ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const all = (choice: Line["choice"]) => setLines((ls) => ls && ls.map((l) => (l.dup ? l : { ...l, choice })));
  const drafts: ItemDraft[] = (lines ?? []).filter((l) => l.choice !== "nao" && l.valorEdit > 0).map((l) => ({
    kind: "compra", date: l.data || null, description: l.descricao, amount: l.valorEdit, payer: owner, installment: l.parcela,
    // "do outro lado": no meu cartão é da outra pessoa (100%); no cartão dela é minha (0%); dividido usa a % da outra pessoa
    otherShare: l.choice === "dividir" ? share : owner === "eu" ? 100 : 0,
  }));
  const impact = drafts.reduce((n, d) => n + (d.payer === "eu" ? split(d).other : -split(d).mine), 0);
  const choices: { v: Line["choice"]; t: string }[] = [{ v: "nao", t: "Não entra" }, { v: "outro", t: owner === "eu" ? `É de ${person}` : "É minha" }, { v: "dividir", t: `Dividir (${person} ${share}%)` }];

  return (
    <Modal open onClose={onClose} title="Ler extrato" subtitle="Foto, PDF ou texto do extrato/fatura do cartão" width="max-w-3xl"
      footer={lines ? <><button className={btn.ghost} onClick={() => setLines(null)}>Voltar</button><button className={btn.primary} disabled={!drafts.length} onClick={() => onSave(drafts)} data-testid="acerto-lancar">Lançar {drafts.length} compra{drafts.length === 1 ? "" : "s"}</button></>
        : <><button className={btn.ghost} onClick={onClose}>Cancelar</button><button className={btn.primary} disabled={busy || (!files.length && !texto.trim())} onClick={() => void read()} data-testid="acerto-ler-ia">{busy ? <><Loader2 size={15} className="animate-spin" /> Lendo…</> : "Ler extrato"}</button></>}>
      {!lines ? <div className="space-y-4">
        <Field label="De quem é o cartão deste extrato?" group><Segmented value={owner} onChange={setOwner} options={[{ value: "eu", label: "Do meu cartão" }, { value: "outro", label: `Do cartão de ${person}` }]} /></Field>
        <Field label="Foto, print ou PDF">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn.ghost} onClick={() => pick.current?.click()} data-testid="acerto-arquivo"><Camera size={15} /> Escolher foto ou arquivo</button>
            <input ref={pick} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            {files.map((f) => <Pill key={f.name + f.size}>{f.name}</Pill>)}
          </div>
        </Field>
        <Field label="Ou cole o texto do extrato"><textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Cole aqui as linhas do extrato (data, estabelecimento, valor)…" className="w-full rounded-2xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm outline-none focus:border-cyan/55" /></Field>
        <Field label={`O que é ${owner === "eu" ? `de ${person}` : "meu"}? (opcional)`} hint="Se você já sabe, escreva e eu marco sozinho. Você confere antes de lançar.">
          <textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={2} placeholder={owner === "eu" ? `Ex.: o Mercado Livre e a farmácia são de ${person}; o jantar foi dividido ao meio` : "Ex.: a Amazon e o posto foram para mim"} className="w-full rounded-2xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm outline-none focus:border-cyan/55" />
        </Field>
        <p className="text-[0.7rem] text-muted-foreground">A foto vai para a IA ler as compras. Só as linhas que você marcar entram no acerto; o resto do extrato é ignorado.</p>
      </div> : <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{lines.length} compra{lines.length === 1 ? "" : "s"} lida{lines.length === 1 ? "" : "s"} · marque de quem é cada uma:</span>
          <button className={btn.ghost} onClick={() => all("outro")}>Tudo {owner === "eu" ? `de ${person}` : "meu"}</button><button className={btn.ghost} onClick={() => all("nao")}>Nada entra</button>
          <label className="ml-auto flex items-center gap-1.5 text-muted-foreground">Dividir: {person} fica com <input type="number" min={0} max={100} value={share} onChange={(e) => setShare(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="w-14 rounded-lg border border-white/10 bg-black/25 px-1.5 py-0.5 text-right text-foreground" />%</label>
        </div>
        {note && <p className="text-[0.7rem] text-amber">{note}</p>}
        <ul className="divide-y divide-white/5" data-testid="acerto-linhas">
          {lines.map((l) => <li key={l.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 ${l.choice === "nao" ? "opacity-60" : ""}`}>
            <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{dm(l.data || null)}</span>
            <span className="min-w-0 flex-1 basis-40 truncate text-sm">{l.descricao}{l.parcela && <span className="ml-1 text-xs text-muted-foreground">({l.parcela})</span>}{l.dup && <span className="ml-1.5 rounded bg-amber/15 px-1 text-[0.6rem] text-amber">já lançada</span>}</span>
            <input aria-label={`Valor de ${l.descricao}`} inputMode="decimal" defaultValue={String(l.valor).replace(".", ",")} onBlur={(e) => { const n = parseMoney(e.target.value); if (n !== null) set(l.id, { valorEdit: n }); }} className="w-24 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-right text-sm tabular-nums" />
            <div role="radiogroup" className="flex gap-1">{choices.map((c) => <button key={c.v} type="button" role="radio" aria-checked={l.choice === c.v} onClick={() => set(l.id, { choice: c.v })}
              className={`rounded-lg px-2 py-1 text-[0.7rem] transition ${l.choice === c.v ? (c.v === "nao" ? "bg-white/10 text-foreground" : "bg-emerald/15 text-emerald") : "text-muted-foreground hover:text-foreground"}`}>{c.t}</button>)}</div>
          </li>)}
        </ul>
        <p className="text-sm" data-testid="acerto-impacto">Isto muda o saldo em <b className={impact >= 0 ? "text-emerald" : "text-violet"}>{impact >= 0 ? "+" : "−"} {brl(Math.abs(impact) / 100)}</b> ({impact >= 0 ? `${person} deve mais a você` : `você deve mais a ${person}`}).</p>
      </div>}
    </Modal>
  );
}
