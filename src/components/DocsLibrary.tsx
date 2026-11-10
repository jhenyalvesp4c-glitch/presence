import { useMemo, useState, type CSSProperties } from "react";
import { backdropProps } from "@/lib/backdrop";
import {
  BookOpen, Check, ChevronDown, ChevronRight, ClipboardList, Copy, Download, Eye, EyeOff, FileText, FileVideo, Folder,
  FolderOpen, FolderPlus, GraduationCap, KeyRound, LayoutGrid, Lightbulb, List, MoreHorizontal, Plus, Search, Send,
  Sparkles, Star, Trash2, User, X, LayoutTemplate, Files, Paperclip, ArrowRight,
} from "lucide-react";
import { TrainingScripts } from "@/components/TrainingScripts";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;

type Doc = {
  id: string; title: string; desc: string; kind: string; color: string; updated: string; fav?: boolean;
  rules?: string[]; steps?: string[]; files?: { name: string; size: string; type: "video" | "pdf" }[];
  login?: { user: string; pass: string; owner: string };
};
type FolderT = { id: string; name: string; icon: typeof Folder; color: string; docs: Doc[]; subs?: FolderT[] | undefined };

const mk = (id: string, title: string, desc: string, kind: string, color: string, extra: Partial<Doc> = {}): Doc => ({ id, title, desc, kind, color, updated: "30/10", ...extra });
const login = (polo: string, user: string, owner: string): Doc =>
  mk(`l-${polo}`, polo, `Acesso do polo ${polo} ao CRM e plataforma de disparo.`, "Login", "amber", { login: { user, pass: `P4c@${polo.slice(0, 3).toLowerCase()}2026`, owner } });

const seedFolders: FolderT[] = [
  { id: "tut", name: "Tutoriais e Processos", icon: BookOpen, color: "cyan", docs: [
    mk("d1", "Disparo em massa", "Como funciona o arquivamento e desarquivamento dos leads.", "Tutorial", "violet", {
      fav: true,
      rules: ["Template com botões: arquivar o disparo. Quando o lead responder, desarquivar o contato.", "Template sem botões: os leads permanecem arquivados e podem ficar esquecidos."],
      steps: ["Acesse o módulo de Disparo em Massa.", "Escolha o template (verifique se possui botões).", "Realize o disparo e arquive conforme a regra do template.", "Monitore as respostas e desarquive os leads que responderem."],
      files: [{ name: "Tutorial_disparo.mp4", size: "12,4 MB", type: "video" }, { name: "Boas_praticas_disparo.pdf", size: "1,8 MB", type: "pdf" }],
    }),
    mk("d2", "Templates de mensagem", "Modelos aprovados, variações e boas práticas.", "Guia", "cyan", { steps: ["Abra a biblioteca de templates.", "Escolha o modelo aprovado.", "Personalize as variáveis do polo."] }),
    mk("d3", "Fluxos de atendimento", "Fluxos utilizados por polo e atualizações.", "Processo", "emerald", { steps: ["Receba o lead.", "Qualifique em até 5 minutos.", "Encaminhe para o consultor do polo."] }),
    mk("d4", "Boas práticas no CRM", "Padronização, organização e rotinas recomendadas.", "Manual", "amber", { rules: ["Nunca deixe lead sem etiqueta.", "Atualize o funil diariamente."] }),
    mk("d5", "Criação de usuários", "Passo a passo para criar, editar e gerenciar usuários.", "Tutorial", "violet"),
    mk("d6", "Configurações do sistema", "Ajustes importantes, permissões e integrações.", "Guia", "cyan"),
  ] },
  { id: "log", name: "Logins dos Dossiês", icon: KeyRound, color: "amber", docs: [
    login("Barra da Tijuca", "fernando@p4c.com", "Fernando"), login("Maceió", "laura@p4c.com", "Laura"),
    login("Niterói", "niteroi@p4c.com", "Equipe Niterói"), login("BH Centro", "bhcentro@p4c.com", "Marcos"),
    login("Santos", "santos@p4c.com", "Juliana"), login("Fortaleza", "fortaleza@p4c.com", "Rafael"),
  ] },
  { id: "reg", name: "Registros e Execuções", icon: ClipboardList, color: "emerald", docs: [
    mk("r1", "Disparo Black Friday · 28/10", "Executado em 14 polos, 3.240 leads alcançados.", "Registro", "emerald", { steps: ["Disparo iniciado às 09:00.", "Arquivamento aplicado.", "Relatório enviado à coordenação."] }),
    mk("r2", "Migração de etiquetas · 15/10", "Padronização das etiquetas em todos os polos.", "Registro", "emerald"),
  ], subs: [
    { id: "reg-out", name: "Outubro 2026", icon: Folder, color: "emerald", docs: [mk("r3", "Reunião de alinhamento", "Ata e decisões da reunião mensal.", "Ata", "cyan")] },
  ] },
  { id: "tpl", name: "Templates", icon: LayoutTemplate, color: "violet", docs: [
    mk("t1", "Boas-vindas ao aluno", "Mensagem inicial com botões de interesse.", "Template", "violet"),
    mk("t2", "Reengajamento 7 dias", "Lead sem resposta após uma semana.", "Template", "violet"),
  ] },
  { id: "tre", name: "Materiais de Treinamento", icon: GraduationCap, color: "pink", docs: [
    mk("m1", "Onboarding de consultores", "Trilha completa de 5 módulos em vídeo.", "Curso", "pink", { files: [{ name: "Modulo_1.mp4", size: "84 MB", type: "video" }] }),
  ] },
  { id: "ger", name: "Documentos Gerais", icon: Files, color: "cyan", docs: [
    mk("g1", "Contrato padrão de polos", "Versão vigente do contrato de parceria.", "Documento", "cyan", { files: [{ name: "Contrato_2026.pdf", size: "640 KB", type: "pdf" }] }),
  ] },
];

const allDocs = (fs: FolderT[]): (Doc & { folder: string })[] =>
  fs.flatMap((f) => [...f.docs.map((d) => ({ ...d, folder: f.name })), ...allDocs(f.subs ?? []).map((d) => d)]);
const countDocs = (f: FolderT): number => f.docs.length + (f.subs ?? []).reduce((a, s) => a + countDocs(s), 0);
const findFolder = (fs: FolderT[], id: string): FolderT | undefined => {
  for (const f of fs) { if (f.id === id) return f; const s = findFolder(f.subs ?? [], id); if (s) return s; }
  return undefined;
};
const mapFolders = (fs: FolderT[], id: string, fn: (f: FolderT) => FolderT): FolderT[] =>
  fs.map((f) => (f.id === id ? fn(f) : { ...f, subs: f.subs && mapFolders(f.subs, id, fn) }));

export function DocsLibrary({ projectId }: { projectId: string }) {
  const [section, setSection] = useState<"lib" | "tre">("lib");
  return (
    <div className="space-y-4">
      <div className="glass inline-flex rounded-2xl p-1 animate-rise">
        {([["lib", "Biblioteca", BookOpen, "cyan"], ["tre", "Treinamentos", GraduationCap, "pink"]] as const).map(([k, l, I, c]) => (
          <button key={k} onClick={() => setSection(k)} style={tint(c)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${section === k ? "bg-[color-mix(in_oklab,var(--glow)_15%,transparent)] text-[var(--glow)] shadow-[0_0_20px_-8px_var(--glow)]" : "text-muted-foreground hover:text-foreground"}`}>
            <I size={15} /> {l}
          </button>
        ))}
      </div>
      {section === "lib" ? <Library /> : <TrainingScripts projectId={projectId} />}
    </div>
  );
}

function Library() {
  const [folders, setFolders] = useState(seedFolders);
  const [open, setOpen] = useState<Record<string, boolean>>({ tut: true, log: true });
  const [cur, setCur] = useState("tut");
  const [selId, setSelId] = useState("d1");
  const [grid, setGrid] = useState(true);
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState("");
  const [orion, setOrion] = useState<{ q: string; phase: "think" | "done" } | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [trash, setTrash] = useState<Doc[]>([]);

  const docs = useMemo(() => allDocs(folders), [folders]);
  const folder = findFolder(folders, cur) ?? folders[0]!;
  const sel = docs.find((d) => d.id === selId);
  const shown = (q ? docs.filter((d) => (d.title + d.desc + d.kind + d.folder).toLowerCase().includes(q.toLowerCase())) : folder.docs);

  const toggleFav = (id: string) => setFolders((fs) => {
    const walk = (l: FolderT[]): FolderT[] => l.map((f) => ({ ...f, docs: f.docs.map((d) => (d.id === id ? { ...d, fav: !d.fav } : d)), subs: f.subs && walk(f.subs) }));
    return walk(fs);
  });
  const addDoc = () => {
    const id = `n${Date.now()}`;
    setFolders((fs) => mapFolders(fs, cur, (f) => ({ ...f, docs: [mk(id, "Novo documento", "Clique para descrever este documento.", "Rascunho", "cyan", { updated: "agora" }), ...f.docs] })));
    setSelId(id); setQ("");
  };
  const delDoc = (id: string) => {
    const d = docs.find((x) => x.id === id); if (d) setTrash((t) => [d, ...t]);
    const walk = (l: FolderT[]): FolderT[] => l.map((f) => ({ ...f, docs: f.docs.filter((x) => x.id !== id), subs: f.subs && walk(f.subs) }));
    setFolders(walk);
  };
  const createFolder = () => {
    if (!newFolder?.trim()) return setNewFolder(null);
    const id = `f${Date.now()}`;
    setFolders((fs) => [...fs, { id, name: newFolder.trim(), icon: Folder, color: "cyan", docs: [] }]);
    setCur(id); setNewFolder(null);
  };
  const runOrion = (text: string) => {
    if (!text.trim()) return;
    setOrion({ q: text, phase: "think" }); setAsk("");
    setTimeout(() => setOrion((o) => (o ? { ...o, phase: "done" } : o)), 1600);
  };
  const orionHits = orion ? docs.filter((d) => orion.q.toLowerCase().split(/\s+/).some((w) => w.length > 3 && (d.title + d.desc).toLowerCase().includes(w))).slice(0, 3) : [];
  const hits = orionHits.length ? orionHits : docs.slice(0, 2);

  return (
    <div className="space-y-4">
      {/* Orion */}
      <div className="relative animate-rise">
        <form onSubmit={(e) => { e.preventDefault(); runOrion(ask); }}
          className="group relative flex items-center gap-3 rounded-2xl border border-violet/40 bg-[linear-gradient(100deg,color-mix(in_oklab,var(--violet)_14%,transparent),color-mix(in_oklab,var(--cyan)_8%,transparent))] p-2 pl-4 shadow-[0_0_40px_-14px_var(--violet)] backdrop-blur-xl transition focus-within:shadow-[0_0_50px_-8px_var(--violet)]">
          <span className="relative grid h-9 w-9 place-items-center">
            <span className="absolute inset-0 rounded-full bg-violet/30 blur-md animate-pulse-ring" />
            <Sparkles size={20} className="relative text-cyan" />
          </span>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Pergunte ao Orion… ex: como desarquivar leads após o disparo?" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <span className="mono-caps hidden !text-[0.55rem] sm:inline">Busca em {docs.length} documentos</span>
          <button className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground transition hover:scale-105" aria-label="Perguntar"><Send size={15} /></button>
        </form>
        <div className="mt-2 flex flex-wrap gap-2">
          {["Senha do polo Maceió", "Regras do disparo em massa", "Último registro de execução"].map((s) => (
            <button key={s} onClick={() => runOrion(s)} className="tag transition hover:shadow-[0_0_14px_-4px_var(--glow)]" style={tint("violet")}>{s}</button>
          ))}
        </div>
        {orion && (
          <div className="glass relative mt-3 overflow-hidden rounded-2xl border-violet/30 p-4 animate-rise">
            <div className="pointer-events-none absolute inset-0 scanline" style={tint("violet")} />
            <div className="flex items-start gap-3">
              <span className="icon-tile h-9 w-9 shrink-0 !rounded-full" style={tint("violet")}><Sparkles size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="mono-caps">Orion · "{orion.q}"</p>
                {orion.phase === "think" ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse-ring" style={{ animationDelay: `${i * 0.2}s` }} />)}
                    Vasculhando tutoriais, logins e históricos…
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-relaxed">Encontrei <span className="text-cyan">{hits.length} fontes</span> relacionadas. O ponto principal: {hits[0]?.rules?.[0] ?? hits[0]?.desc}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hits.map((h) => (
                        <button key={h.id} onClick={() => setSelId(h.id)} className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition hover:shadow-[0_0_18px_-6px_var(--cyan)]">
                          <FileText size={12} className="text-cyan" /> {h.title} <span className="text-muted-foreground">· {h.folder}</span> <ArrowRight size={11} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setOrion(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_380px]">
        {/* árvore */}
        <aside className="glass flex flex-col rounded-3xl p-4 animate-rise">
          <div className="flex items-start gap-3">
            <span className="icon-tile h-11 w-11 shrink-0 !rounded-2xl shadow-[0_0_24px_-6px_var(--glow)]" style={tint("violet")}><FileText size={20} /></span>
            <div>
              <h2 className="font-display text-lg font-semibold">Documentação</h2>
              <p className="text-[0.7rem] leading-snug text-muted-foreground">Organize tutoriais, logins, processos e registros do projeto.</p>
            </div>
          </div>
          {newFolder === null ? (
            <button onClick={() => setNewFolder("")} className="mt-4 flex items-center justify-center gap-2 rounded-full border border-cyan/60 py-2.5 text-sm text-cyan shadow-[0_0_24px_-10px_var(--cyan)] transition hover:bg-cyan/10 hover:shadow-[0_0_30px_-6px_var(--cyan)]">
              <Plus size={15} /> Nova pasta
            </button>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); createFolder(); }} className="mt-4 flex items-center gap-2 rounded-full border border-cyan/60 px-3 py-1.5">
              <FolderPlus size={14} className="text-cyan" />
              <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onBlur={createFolder} placeholder="Nome da pasta" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </form>
          )}
          <nav className="mt-4 space-y-1">
            {folders.map((f) => <TreeNode key={f.id} f={f} depth={0} open={open} setOpen={setOpen} cur={cur} selId={selId} onFolder={(id) => { setCur(id); setQ(""); }} onDoc={setSelId} />)}
          </nav>
          <button onClick={() => trash.length && alert(`${trash.length} item(ns) na lixeira`)} className="mt-auto flex items-center gap-2 border-t border-border px-2 pt-4 text-sm text-muted-foreground transition hover:text-foreground">
            <Trash2 size={15} /> Lixeira {trash.length > 0 && <span className="tag" style={tint("pink")}>{trash.length}</span>}
          </button>
        </aside>

        {/* centro */}
        <section className="space-y-4">
          <div className="glass rounded-3xl p-4 animate-rise" style={{ animationDelay: ".05s" }}>
            <p className="mono-caps flex items-center gap-2"><Folder size={11} /> Documentação <ChevronRight size={10} /> <span className="text-foreground">{q ? "Resultados" : folder.name}</span></p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="icon-tile h-12 w-12 !rounded-2xl" style={tint(folder.color)}><FolderOpen size={22} /></span>
              <div className="mr-auto">
                <h3 className="font-display text-xl font-semibold">{q ? `Busca: "${q}"` : folder.name}</h3>
                <p className="text-xs text-muted-foreground">{shown.length} documentos</p>
              </div>
              <label className="glass flex items-center gap-2 rounded-xl px-3 py-2">
                <Search size={13} className="text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documentos…" className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
                {q && <button onClick={() => setQ("")}><X size={11} /></button>}
              </label>
              <div className="glass flex rounded-xl p-1">
                {([[true, LayoutGrid], [false, List]] as const).map(([g, I]) => (
                  <button key={String(g)} onClick={() => setGrid(g)} className={`rounded-lg p-1.5 transition ${grid === g ? "bg-cyan/15 text-cyan" : "text-muted-foreground"}`}><I size={14} /></button>
                ))}
              </div>
              <button onClick={addDoc} className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:scale-105"><Plus size={13} /> Documento</button>
            </div>

            <div className={`mt-4 grid gap-3 ${grid ? "sm:grid-cols-2" : ""}`}>
              {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground sm:col-span-2">Pasta vazia. Crie o primeiro documento ✦</p>}
              {shown.map((d, i) => {
                const on = d.id === selId;
                return (
                  <button key={d.id} onClick={() => setSelId(d.id)} style={{ ...tint(d.color), animationDelay: `${i * 0.05}s` }}
                    className={`accent-card group flex items-start gap-3 !rounded-2xl p-4 text-left animate-rise ${on ? "!border-[color-mix(in_oklab,var(--cyan)_70%,transparent)] shadow-[0_0_40px_-10px_var(--cyan)]" : ""}`}>
                    <span className="icon-tile h-11 w-11 shrink-0 transition group-hover:scale-110 group-hover:rotate-3">{d.login ? <KeyRound size={18} /> : <FileText size={18} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{d.title}</span>
                      <span className={`mt-1 block text-[0.72rem] leading-snug text-muted-foreground ${grid ? "line-clamp-2" : "truncate"}`}>{d.desc}</span>
                      <span className="tag mt-2 inline-block">{d.kind}</span>
                    </span>
                    <span role="button" onClick={(e) => { e.stopPropagation(); toggleFav(d.id); }} className="transition hover:scale-125">
                      <Star size={15} className={d.fav ? "fill-amber text-amber drop-shadow-[0_0_6px_var(--amber)]" : "text-muted-foreground"} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logins */}
          <div className="glass rounded-3xl p-4 animate-rise" style={{ animationDelay: ".1s" }}>
            <div className="flex items-center gap-3">
              <span className="icon-tile h-11 w-11 !rounded-2xl" style={tint("violet")}><KeyRound size={19} /></span>
              <div className="mr-auto">
                <h3 className="font-display text-lg font-semibold">Logins dos Dossiês</h3>
                <p className="text-[0.7rem] text-muted-foreground">Acesso de usuários por dossiê · {findFolder(folders, "log")?.docs.length ?? 0} itens</p>
              </div>
              <button onClick={() => { setCur("log"); setOpen((o) => ({ ...o, log: true })); }} className="glass flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition hover:text-cyan">Ver tudo <ArrowRight size={12} /></button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(findFolder(folders, "log")?.docs ?? []).slice(0, 3).map((d, i) => <LoginCard key={d.id} d={d} color={["amber", "emerald", "violet"][i]!} onOpen={() => setSelId(d.id)} />)}
            </div>
          </div>
        </section>

        {/* detalhes */}
        <DocDetail key={sel?.id} {...(sel ? { d: sel } : {})} onFav={() => { if (sel) toggleFav(sel.id); }} onDelete={() => { if (sel) delDoc(sel.id); }} />
      </div>
    </div>
  );
}

function TreeNode({ f, depth, open, setOpen, cur, selId, onFolder, onDoc }: {
  f: FolderT; depth: number; open: Record<string, boolean>; setOpen: (fn: (o: Record<string, boolean>) => Record<string, boolean>) => void;
  cur: string; selId: string; onFolder: (id: string) => void; onDoc: (id: string) => void;
}) {
  const isOpen = !!open[f.id];
  const on = cur === f.id;
  return (
    <div style={tint(f.color)}>
      <button onClick={() => { setOpen((o) => ({ ...o, [f.id]: !o[f.id] })); onFolder(f.id); }}
        className={`group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-secondary/60 ${on ? "text-foreground" : "text-foreground/85"}`} style={{ paddingLeft: 8 + depth * 14 }}>
        <ChevronDown size={13} className={`shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? "" : "-rotate-90"}`} />
        {isOpen ? <FolderOpen size={16} className="shrink-0 text-amber" /> : <Folder size={16} className="shrink-0 text-amber" />}
        <span className="min-w-0 flex-1 truncate">{f.name}</span>
        <span className={`rounded-full border border-border px-2 text-[0.6rem] tabular-nums ${on ? "border-[var(--glow)] text-[var(--glow)]" : "text-muted-foreground"}`}>{countDocs(f)}</span>
      </button>
      <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="ml-5 border-l border-border/80 pl-2">
            {f.subs?.map((s) => <TreeNode key={s.id} f={s} depth={depth + 1} open={open} setOpen={setOpen} cur={cur} selId={selId} onFolder={onFolder} onDoc={onDoc} />)}
            {f.docs.map((d) => (
              <button key={d.id} onClick={() => onDoc(d.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8rem] transition ${selId === d.id ? "border border-cyan/50 bg-cyan/10 text-foreground shadow-[0_0_18px_-8px_var(--cyan)]" : "text-muted-foreground hover:translate-x-0.5 hover:text-foreground"}`}>
                {d.login ? <KeyRound size={12} /> : <FileText size={12} />} <span className="truncate">{d.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginCard({ d, color, onOpen }: { d: Doc; color: string; onOpen: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v).catch(() => {}); setCopied(k); setTimeout(() => setCopied(null), 1200); };
  if (!d.login) return null;
  return (
    <div className="accent-card group !rounded-2xl p-3" style={tint(color)}>
      <button onClick={onOpen} className="flex w-full items-center gap-2 text-left">
        <span className="icon-tile h-9 w-9 !rounded-full transition group-hover:shadow-[0_0_18px_-4px_var(--glow)]"><User size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{d.title}</span>
          <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground"><User size={9} /> {d.login.owner}</span>
        </span>
        <MoreHorizontal size={14} className="text-muted-foreground" />
      </button>
      <Cred label="Usuário" value={d.login.user} onCopy={() => copy("u", d.login!.user)} copied={copied === "u"} />
      <Cred label="Senha" value={show ? d.login.pass : "••••••••••"} onCopy={() => copy("p", d.login!.pass)} copied={copied === "p"}
        extra={<button onClick={() => setShow((s) => !s)} className="text-muted-foreground hover:text-[var(--glow)]">{show ? <EyeOff size={12} /> : <Eye size={12} />}</button>} />
    </div>
  );
}

function Cred({ label, value, onCopy, copied, extra }: { label: string; value: string; onCopy: () => void; copied: boolean; extra?: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-secondary/50 px-2 py-1.5 text-[0.68rem]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="min-w-0 flex-1 truncate font-mono">{value}</span>
      {extra}
      <button onClick={onCopy} className="text-muted-foreground hover:text-[var(--glow)]">{copied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}</button>
    </div>
  );
}

function DocDetail({ d, onFav, onDelete }: { d?: Doc & { folder: string }; onFav: () => void; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [done, setDone] = useState<number[]>([]);
  if (!d) return <aside className="glass grid place-items-center rounded-3xl p-8 text-sm text-muted-foreground">Selecione um documento</aside>;
  return (
    <aside className="glass relative overflow-hidden rounded-3xl p-5 animate-rise xl:sticky xl:top-4 xl:self-start" style={{ animationDelay: ".15s" }}>
      <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-violet/20 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl shadow-[0_0_24px_-6px_var(--glow)]" style={tint(d.color)}>{d.login ? <KeyRound size={20} /> : <FileText size={20} />}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold">{d.title}</h3>
          <p className="text-xs text-muted-foreground">{d.kind} · Atualizado em {d.updated}</p>
        </div>
        <button onClick={onFav}><Star size={17} className={d.fav ? "fill-amber text-amber" : "text-muted-foreground"} /></button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="text-muted-foreground hover:text-foreground"><MoreHorizontal size={17} /></button>
          {menu && (
            <div className="glass absolute right-0 top-7 z-10 w-36 rounded-xl p-1 text-xs animate-rise">
              <button onClick={() => { onDelete(); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-destructive hover:bg-secondary"><Trash2 size={12} /> Mover p/ lixeira</button>
            </div>
          )}
        </div>
      </div>

      <DocArt d={d} />

      <h4 className="mt-4 font-semibold">Descrição</h4>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.desc}</p>

      {d.login && (
        <div className="mt-4 space-y-1">
          <LoginCard d={d} color="amber" onOpen={() => {}} />
        </div>
      )}

      {d.rules && (
        <div className="mt-4 rounded-2xl border border-cyan/50 bg-cyan/5 p-4 shadow-[0_0_30px_-12px_var(--cyan)]">
          <p className="flex items-center gap-2 font-semibold"><Lightbulb size={16} className="text-cyan" /> Regras importantes</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.8rem] leading-snug text-foreground/85">{d.rules.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      {d.steps && (
        <>
          <h4 className="mt-4 font-semibold">Passo a passo</h4>
          <ol className="mt-2 space-y-2">
            {d.steps.map((s, i) => {
              const ok = done.includes(i);
              return (
                <li key={s}>
                  <button onClick={() => setDone((x) => (ok ? x.filter((y) => y !== i) : [...x, i]))} className="flex w-full items-center gap-3 text-left text-[0.8rem]">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[0.65rem] transition ${ok ? "border-emerald bg-emerald/20 text-emerald" : "border-cyan/60 text-cyan"}`}>{ok ? <Check size={11} /> : i + 1}</span>
                    <span className={ok ? "text-muted-foreground line-through" : ""}>{s}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {d.files && (
        <div className="mt-4 rounded-2xl border border-border p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><Paperclip size={13} /> Anexos ({d.files.length})</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {d.files.map((f) => (
              <button key={f.name} onClick={() => setPreview(f.name)} className="glass group flex items-center gap-2 rounded-xl p-2 text-left transition hover:shadow-[0_0_20px_-8px_var(--glow)]" style={tint(f.type === "pdf" ? "pink" : "cyan")}>
                <span className="icon-tile h-8 w-8 shrink-0">{f.type === "pdf" ? <FileText size={14} /> : <FileVideo size={14} />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[0.7rem]">{f.name}</span><span className="text-[0.6rem] text-muted-foreground">{f.size}</span></span>
                <Download size={13} className="text-muted-foreground group-hover:text-[var(--glow)]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-6 backdrop-blur-md" {...backdropProps(() => setPreview(null))}>
          <div className="glass w-full max-w-lg rounded-3xl p-5 animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="font-semibold">{preview}</p><button onClick={() => setPreview(null)}><X size={16} /></button></div>
            <div className="relative mt-4 grid aspect-video place-items-center overflow-hidden rounded-2xl border border-border bg-secondary/40 scanline" style={tint("cyan")}>
              {preview.endsWith(".pdf") ? (
                <div className="w-2/3 space-y-2">{[90, 70, 85, 60, 75].map((w, i) => <div key={i} className="h-2 rounded bg-muted-foreground/30" style={{ width: `${w}%` }} />)}</div>
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full border border-cyan/60 text-cyan shadow-[0_0_30px_-6px_var(--cyan)]">▶</span>
              )}
            </div>
            <p className="mono-caps mt-3 text-center">Pré-visualização demonstrativa</p>
          </div>
        </div>
      )}
    </aside>
  );
}

function DocArt({ d }: { d: Doc }) {
  return (
    <div className="relative mt-4 h-36 overflow-hidden rounded-2xl border border-violet/30 bg-[radial-gradient(80%_80%_at_20%_30%,color-mix(in_oklab,var(--violet)_35%,transparent),transparent),radial-gradient(60%_80%_at_90%_60%,color-mix(in_oklab,var(--cyan)_25%,transparent),transparent)]">
      <svg viewBox="0 0 320 140" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="dg" x1="0" x2="1"><stop offset="0" stopColor="var(--cyan)" /><stop offset="1" stopColor="var(--violet)" /></linearGradient>
          <filter id="dglow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[...Array(8)].map((_, i) => <line key={i} x1={i * 45} y1="140" x2={i * 45 + 60} y2="0" stroke="var(--violet)" strokeOpacity=".12" />)}
        {d.login ? (
          <g filter="url(#dglow)" className="animate-float" style={{ transformOrigin: "160px 70px" }}>
            <rect x="120" y="55" width="80" height="60" rx="10" fill="none" stroke="url(#dg)" strokeWidth="3" />
            <path d="M138 55 v-14 a22 22 0 0 1 44 0 v14" fill="none" stroke="url(#dg)" strokeWidth="3" />
            <circle cx="160" cy="82" r="7" fill="var(--cyan)" /><rect x="157" y="86" width="6" height="14" fill="var(--cyan)" />
          </g>
        ) : (
          <>
            <g filter="url(#dglow)" className="animate-float">
              <path d="M40 80 L130 35 L100 115 L85 88 Z" fill="none" stroke="url(#dg)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M85 88 L130 35" stroke="url(#dg)" strokeWidth="2" />
            </g>
            <g transform="translate(180 30) skewY(-6)">
              <rect width="110" height="80" rx="10" fill="oklch(0.2 0.04 262 / .8)" stroke="var(--cyan)" strokeOpacity=".4" />
              {[0, 1, 2].map((i) => (
                <g key={i} transform={`translate(12 ${16 + i * 22})`}>
                  <circle r="6" cx="6" cy="0" fill="var(--emerald)" opacity=".85" />
                  <rect x="18" y="-3" width={60 - i * 10} height="6" rx="3" fill="var(--muted-foreground)" opacity=".5" />
                </g>
              ))}
            </g>
          </>
        )}
        {[...Array(10)].map((_, i) => <circle key={i} cx={(i * 37) % 320} cy={(i * 53) % 140} r="1.2" fill="var(--cyan)" className="animate-pulse-ring" style={{ animationDelay: `${i * 0.3}s` }} />)}
      </svg>
    </div>
  );
}
