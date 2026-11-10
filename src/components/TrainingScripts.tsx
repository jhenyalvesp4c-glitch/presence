import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { toast } from "sonner";
import { useCategories, useToggleTask } from "@/lib/data/tasks";
import { useDeleteTraining, useSaveTraining, useTrainings } from "@/lib/data/trainings";
import { sortTrainings, trainingStatus, type Training, type TrainingDraft } from "@/lib/trainings";
import { todayIso } from "@/lib/dates";
import { loadTrainingScripts, saveTrainingScripts } from "@/lib/data/training-scripts";
import { useDbState } from "@/lib/data/use-db-state";
import imgEtiquetasLead from "@/assets/treino-etiquetas-lead.jpg";
import imgEtiquetasFiltro from "@/assets/treino-etiquetas-filtro.jpg";
import {
  ArrowRight, CalendarDays, Check, ChevronDown, Clock, Copy, GraduationCap, Lightbulb, MessageCircleQuestion,
  Play, Plus, RotateCcw, Search, Sparkles, Square, Target, Users, X, ImageIcon, Maximize2, MapPin, Pencil, Trash2, CalendarPlus, ThumbsUp, ArrowDown, CheckCircle2,
} from "lucide-react";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;

type Pin = { x: number; y: number; label: string; text: string };
type Visual = { src: string; key?: string | undefined; title: string; caption: string; pins: Pin[] };
type Example = { id: string; title: string; situation: string; text: string; cat: string; color: string; visual?: Visual };
type Block = {
  id: string; title: string; minutes: number; show: string[]; examples: string[]; tip?: string; faq?: { q: string; a: string }[];
  visuals?: Visual[]; why?: string[]; scenario?: { situation: string; before: string; after: string };
};
type Script = { id: string; title: string; audience: string; goal: string; color: string; lastClass: string; blocks: Block[] };

// Dados de demonstração (apenas visual, nada é salvo)
const visualTagsLead: Visual = {
  src: imgEtiquetasLead, key: "lead", title: "Onde colocar", caption: "Tela do lead aberta: conversa à esquerda, dados e etiquetas à direita.",
  pins: [
    { x: 16, y: 30, label: "Leia a conversa", text: "A Ana disse que quer saber de Enfermagem. É isso que vira etiqueta." },
    { x: 71, y: 43, label: "Etiquetas do lead", text: "Ficam no painel \"Dados do lead\". Sempre visíveis para qualquer consultor que abrir o contato." },
    { x: 71, y: 55, label: "Adicionar etiqueta", text: "Clique em \"+ Adicionar etiqueta\" e escolha da lista. O × na etiqueta remove." },
    { x: 91, y: 63, label: "Lista padrão do polo", text: "Use sempre as etiquetas da lista; não invente nomes novos, senão o filtro não encontra." },
  ],
};
const visualTagsFiltro: Visual = {
  src: imgEtiquetasFiltro, key: "filtro", title: "Pra que serve", caption: "Lista de leads filtrada pela etiqueta \"Aguardando valores\".",
  pins: [
    { x: 14, y: 18, label: "Filtro por etiqueta", text: "Em Leads, escolha \"Todas as etiquetas\" → \"Aguardando valores\". Um clique." },
    { x: 39, y: 18, label: "Quantos são", text: "Na hora você sabe: 12 pessoas esperando valores. Sem contar na mão." },
    { x: 57.5, y: 29, label: "Etiquetas na lista", text: "Dá para ver curso e situação de cada um sem abrir a conversa." },
    { x: 81, y: 5, label: "Ação em grupo", text: "Com o filtro aplicado, envie os valores para todos de uma vez." },
  ],
};

const seedExamples: Example[] = [
  { id: "e1", title: "Etiqueta bem aplicada", cat: "Etiquetas", color: "amber",
    situation: "Lead pediu informações sobre o curso de Enfermagem, mas ainda não falou de valores.",
    text: "Etiquetas: [Enfermagem] [Interesse] [Aguardando valores]. Assim qualquer consultor que abrir o contato entende em 2 segundos onde ele está.",
    visual: visualTagsLead },
  { id: "e2", title: "Mover no funil", cat: "Funil", color: "cyan",
    situation: "Lead enviou documentos para matrícula.",
    text: "Arraste o card de \"Negociação\" para \"Documentação\" e registre uma nota: \"RG e comprovante recebidos em 10/11, falta histórico escolar\"." },
  { id: "e3", title: "Primeira resposta", cat: "Atendimento", color: "emerald",
    situation: "Lead novo chegou pelo anúncio do Instagram às 21h.",
    text: "\"Oi, Ana! Aqui é a Laura do polo Maceió 😊 Vi que você se interessou pelo curso de Administração. Posso te mandar as opções de turma?\"" },
  { id: "e4", title: "Template com botões", cat: "Disparo", color: "violet",
    situation: "Disparo de reengajamento para quem não respondeu há 7 dias.",
    text: "Use o template \"Reengajamento 7 dias\" (com botões Sim / Mais tarde). Após o envio, arquive todos; quem clicar em um botão volta automaticamente." },
  { id: "e5", title: "Nota de atendimento", cat: "Atendimento", color: "emerald",
    situation: "Ligação com o lead que tem dúvida sobre bolsa.",
    text: "Nota: \"Ligação 10/11 14h · quer bolsa de 50% · trabalha de manhã, prefere turma noturna · retornar sexta com simulação\"." },
  { id: "e6", title: "Lead sem resposta", cat: "Funil", color: "cyan",
    situation: "Lead está há 3 dias em \"Contato feito\" sem responder.",
    text: "Crie uma tarefa de retorno para amanhã, aplique a etiqueta [Sem resposta] e, depois de 7 dias, inclua no disparo de reengajamento." },
  { id: "e7", title: "Criar usuário", cat: "Configurações", color: "pink",
    situation: "Novo consultor entrou no polo Santos.",
    text: "Configurações → Usuários → Novo. Perfil \"Consultor\", equipe \"Santos\", e marque só as caixas de entrada do polo dele." },
];

const seedScripts: Script[] = [
  { id: "s1", title: "Primeiros passos no CRM", audience: "Consultores novos", color: "cyan", lastClass: "05/11",
    goal: "Ao final, o consultor consegue atender um lead do início ao fim sem ajuda.",
    blocks: [
      { id: "b1", title: "Boas-vindas e visão geral", minutes: 10,
        show: ["Tela inicial e menu lateral", "Caixa de entrada do polo", "Onde ficam as notificações"], examples: [],
        tip: "Pergunte quem já usou outro CRM; ajuda a calibrar o ritmo." },
      { id: "b2", title: "Atendendo o primeiro lead", minutes: 20,
        show: ["Abrir uma conversa nova", "Responder em até 5 minutos", "Registrar nota de atendimento", "Ver o histórico do contato"], examples: ["e3", "e5"],
        faq: [{ q: "E se o lead chegar fora do horário?", a: "Responda no primeiro horário do dia seguinte e marque a etiqueta [Fora do horário]." }] },
      { id: "b3", title: "Etiquetas nos leads", minutes: 15,
        show: ["Onde ficam as etiquetas no lead", "Adicionar e remover uma etiqueta", "Filtrar a lista por etiqueta", "Fazer uma ação em grupo a partir do filtro"],
        examples: ["e1", "e6"],
        visuals: [visualTagsLead, visualTagsFiltro],
        why: [
          "Qualquer consultor entende o lead em 2 segundos, sem reler a conversa inteira.",
          "Você acha todo mundo que está na mesma situação com um clique (ex.: 12 leads aguardando valores).",
          "Dá para agir em grupo: mandar valores, reengajar ou passar para outro consultor de uma vez.",
          "Os relatórios mostram onde os leads travam — por curso, interesse ou motivo.",
        ],
        scenario: {
          situation: "Segunda de manhã, a coordenadora pergunta: \"Quantos leads de Enfermagem estão esperando valores?\"",
          before: "Abrir conversa por conversa e contar na mão. Meia hora, e ainda escapa alguém.",
          after: "Filtrar [Enfermagem] + [Aguardando valores], ver os 12 leads e mandar os valores para todos de uma vez.",
        },
        tip: "Mostre a imagem 1 enquanto explica onde clicar, e a imagem 2 quando perguntarem \"mas pra quê?\".",
        faq: [
          { q: "Por que não escrever isso numa nota?", a: "A nota explica o detalhe de um lead; a etiqueta serve para achar e agrupar vários. Use os dois." },
          { q: "Quantas etiquetas devo colocar?", a: "De 2 a 4: curso, momento e algo especial (bolsa, fora do horário). Mais que isso vira bagunça." },
        ] },
      { id: "b3f", title: "Funil e retorno", minutes: 10,
        show: ["Mover o card no funil", "Criar tarefa de retorno"], examples: ["e2", "e6"],
        tip: "Faça eles aplicarem as etiquetas e moverem um lead de teste antes de seguir." },
      { id: "b4", title: "Prática guiada", minutes: 15,
        show: ["Cada um atende um lead de teste", "Revisar juntos as notas", "Tirar dúvidas finais"], examples: [] },
    ] },
  { id: "s2", title: "Disparo em massa", audience: "Coordenadores de polo", color: "violet", lastClass: "28/10",
    goal: "Fazer um disparo correto e não deixar nenhum lead esquecido no arquivo.",
    blocks: [
      { id: "b5", title: "Escolha do template", minutes: 10, show: ["Biblioteca de templates", "Diferença entre com e sem botões"], examples: ["e4"] },
      { id: "b6", title: "Executar o disparo", minutes: 15, show: ["Selecionar a lista", "Agendar horário", "Arquivar após o envio"], examples: ["e4"],
        tip: "Mostre o erro comum: disparo sem botões e leads esquecidos no arquivo." },
      { id: "b7", title: "Acompanhar respostas", minutes: 10, show: ["Desarquivar quem respondeu", "Relatório do disparo"], examples: ["e6"] },
    ] },
  { id: "s3", title: "Administração do polo", audience: "Gestores", color: "pink", lastClass: "—",
    goal: "Gestor consegue criar usuários e acompanhar a equipe sozinho.",
    blocks: [
      { id: "b8", title: "Usuários e permissões", minutes: 15, show: ["Criar usuário", "Definir perfil e equipe", "Desativar acesso"], examples: ["e7"] },
      { id: "b9", title: "Relatórios da equipe", minutes: 15, show: ["Tempo de resposta", "Leads por consultor", "Exportar relatório"], examples: [] },
    ] },
];

// No banco, as imagens dos roteiros ficam guardadas pela chave (o endereço do arquivo muda a cada publicação).
const VISUAL_BY_KEY: Record<string, string> = { lead: imgEtiquetasLead, filtro: imgEtiquetasFiltro };
const mapVisuals = (s: Script, f: (v: Visual) => Visual): Script => ({ ...s, blocks: s.blocks.map((b) => (b.visuals ? { ...b, visuals: b.visuals.map(f) } : b)) });
const encodeScript = (s: Script): unknown => mapVisuals(s, (v) => ({ ...v, src: "" }));
const decodeScript = (raw: unknown): Script => mapVisuals(raw as Script, (v) => ({ ...v, src: (v.key && VISUAL_BY_KEY[v.key]) || v.src }));
const EMPTY_SCRIPT: Script = { id: "", title: "", audience: "", goal: "", color: "cyan", lastClass: "—", blocks: [] };

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function TrainingScripts({ projectId }: { projectId: string }) {
  // Roteiros salvos no banco por projeto (os 3 de exemplo entram na primeira vez).
  const [scripts, setScripts, scriptsReady] = useDbState<Script[]>(
    projectId, [],
    () => loadTrainingScripts(projectId, seedScripts, encodeScript, decodeScript),
    (p, n) => saveTrainingScripts(projectId, p, n, encodeScript),
  );
  const [examples] = useState(seedExamples);
  const [selId, setSelId] = useState("s1");
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [openB, setOpenB] = useState<Record<string, boolean>>({ b3: true });
  const [lesson, setLesson] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todos");
  const [hl, setHl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ block: string; text: string } | null>(null);
  const [zoom, setZoom] = useState<Visual | null>(null);
  const [editing, setEditing] = useState<Training | "new" | null>(null);

  // Turmas: salvas de verdade, como compromissos do calendário.
  const today = todayIso();
  const trainingsQ = useTrainings();
  const catsQ = useCategories();
  const compId = (catsQ.data ?? []).find((c) => c.slug === "comp")?.id;
  const saveT = useSaveTraining(compId, projectId);
  const delT = useDeleteTraining();
  const toggleT = useToggleTask();
  const turmas = useMemo(() => sortTrainings(trainingsQ.data ?? [], today), [trainingsQ.data, today]);
  const lastClassOf = (s: Script) => {
    const past = turmas.filter((t) => t.scriptKey === s.id && t.date <= today).map((t) => t.date).sort();
    return past.length ? ddmm(past[past.length - 1]!) : s.lastClass;
  };
  const saveTraining = (draft: TrainingDraft, existing?: Training) =>
    saveT.mutate({ draft, existing }, {
      onSuccess: () => { toast.success(existing ? "Turma atualizada" : "Turma agendada · já está no Calendário"); setEditing(null); },
      onError: (e) => toast.error(`Não consegui salvar a turma: ${e.message}`),
    });
  const removeTraining = (t: Training) => {
    if (!window.confirm(`Excluir a turma "${t.group}"? Ela sai do Calendário também.`)) return;
    delT.mutate(t, { onSuccess: () => { toast.success("Turma excluída"); setEditing(null); }, onError: (e) => toast.error(`Não consegui excluir: ${e.message}`) });
  };

  const sel = scripts.find((s) => s.id === selId) ?? scripts[0] ?? EMPTY_SCRIPT;
  const items = sel.blocks.flatMap((b) => b.show.map((_, i) => `${b.id}:${i}`));
  const doneCount = items.filter((k) => shown[k]).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const totalMin = sel.blocks.reduce((a, b) => a + b.minutes, 0);
  const cats = ["Todos", ...Array.from(new Set(examples.map((e) => e.cat)))];
  const exFiltered = useMemo(() => examples.filter((e) =>
    (cat === "Todos" || e.cat === cat) && (e.title + e.situation + e.text).toLowerCase().includes(q.toLowerCase())), [examples, cat, q]);

  const toggle = (k: string) => setShown((s) => ({ ...s, [k]: !s[k] }));
  const reset = () => setShown((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !items.includes(k))));
  const copy = (e: Example) => { navigator.clipboard?.writeText(e.text).catch(() => {}); setCopied(e.id); setTimeout(() => setCopied(null), 1200); };
  const focusExample = (id: string) => {
    setHl(id); setCat("Todos"); setQ("");
    setTimeout(() => document.getElementById(`ex-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    setTimeout(() => setHl((h) => (h === id ? null : h)), 2200);
  };
  const addItem = () => {
    if (!adding?.text.trim()) return setAdding(null);
    setScripts((ss) => ss.map((s) => s.id !== sel.id ? s : { ...s, blocks: s.blocks.map((b) => b.id === adding.block ? { ...b, show: [...b.show, adding.text.trim()] } : b) }));
    setAdding(null);
  };
  const newScript = () => {
    const id = `s${Date.now()}`;
    setScripts((ss) => [...ss, { id, title: "Novo roteiro", audience: "Defina o público", color: "emerald", lastClass: "—", goal: "Descreva o que a turma deve saber fazer ao final.",
      blocks: [{ id: `b${Date.now()}`, title: "Abertura", minutes: 10, show: [], examples: [] }] }]);
    setSelId(id); setLesson(false);
  };

  const stats = [
    { l: "Roteiros", v: scripts.length, c: "cyan", I: GraduationCap },
    { l: "Exemplos", v: examples.length, c: "violet", I: Sparkles },
    { l: "Próximas turmas", v: turmas.filter((t) => trainingStatus(t, today) === "proxima").length, c: "amber", I: CalendarDays },
    { l: "Pessoas treinadas", v: turmas.filter((t) => t.done).reduce((a, t) => a + t.people, 0), c: "emerald", I: Users },
  ];

  if (!scriptsReady) return <p className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground" data-testid="carregando-roteiros">Carregando os roteiros…</p>;

  return (
    <div className="space-y-4">
      <p className="mono-caps flex items-center gap-2 !text-[0.6rem]"><Sparkles size={10} /> Roteiros e turmas ficam salvos · as frases de exemplo são de demonstração</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className="accent-card flex items-center gap-3 !rounded-2xl p-4 animate-rise" style={{ ...tint(s.c), animationDelay: `${i * 0.05}s` }}>
            <span className="icon-tile h-11 w-11 shrink-0"><s.I size={18} /></span>
            <div><p className="font-display text-2xl font-bold tabular-nums">{s.v}</p><p className="text-[0.7rem] text-muted-foreground">{s.l}</p></div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
        {/* roteiros + turmas */}
        <aside className="space-y-4">
          <div className="glass rounded-3xl p-4 animate-rise">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Roteiros</h2>
              <button onClick={newScript} className="flex items-center gap-1 rounded-full border border-cyan/60 px-3 py-1 text-xs text-cyan transition hover:bg-cyan/10"><Plus size={12} /> Novo</button>
            </div>
            <div className="mt-3 space-y-2">
              {scripts.map((s) => {
                const on = s.id === sel.id;
                const its = s.blocks.flatMap((b) => b.show.map((_, i) => `${b.id}:${i}`));
                const p = its.length ? Math.round((its.filter((k) => shown[k]).length / its.length) * 100) : 0;
                return (
                  <button key={s.id} onClick={() => { setSelId(s.id); setLesson(false); }} style={tint(s.color)}
                    className={`accent-card block w-full !rounded-2xl p-3 text-left transition ${on ? "!border-[color-mix(in_oklab,var(--glow)_70%,transparent)] shadow-[0_0_30px_-10px_var(--glow)]" : ""}`}>
                    <span className="block truncate text-sm font-semibold">{s.title}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[0.68rem] text-muted-foreground"><Users size={10} /> {s.audience}</span>
                    <span className="mt-2 flex items-center gap-2 text-[0.62rem] text-muted-foreground">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-[var(--glow)] transition-all" style={{ width: `${p}%` }} /></span>
                      {s.blocks.length} blocos
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-3xl p-4 animate-rise" style={{ animationDelay: ".05s" }}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold"><CalendarDays size={15} className="text-amber" /> Turmas</h3>
              <button onClick={() => setEditing("new")} className="flex items-center gap-1 rounded-full border border-amber/60 px-3 py-1 text-xs text-amber transition hover:bg-amber/10"><CalendarPlus size={12} /> Agendar</button>
            </div>
            <p className="mt-1 text-[0.65rem] leading-snug text-muted-foreground">Entram no Calendário e no seu dia automaticamente.</p>
            <div className="mt-3 space-y-1.5">
              {trainingsQ.isLoading && <p className="py-4 text-center text-xs text-muted-foreground">Carregando turmas…</p>}
              {!trainingsQ.isLoading && turmas.length === 0 && (
                <button onClick={() => setEditing("new")} className="w-full rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground transition hover:border-amber/60 hover:text-foreground">
                  Nenhuma turma agendada ainda.<br /><span className="text-amber">Agendar a primeira</span>
                </button>
              )}
              {turmas.map((t) => {
                const st = trainingStatus(t, today);
                return (
                  <div key={t.id} className="group flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-xs transition hover:bg-secondary/60">
                    <button onClick={() => setEditing(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Editar turma ${t.group}`}>
                      <span className={`grid h-10 w-12 shrink-0 place-items-center rounded-lg border text-center text-[0.7rem] font-semibold leading-tight tabular-nums ${st === "proxima" ? "border-amber/60 text-amber" : st === "passou" ? "border-pink/50 text-pink" : "border-border text-muted-foreground"}`}>
                        <span>{ddmm(t.date)}{t.time && <span className="block text-[0.58rem] font-normal">{t.time}</span>}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${t.done ? "text-muted-foreground" : ""}`}>{t.group}</span>
                        <span className="block truncate text-[0.65rem] text-muted-foreground">{t.scriptTitle || "Sem roteiro"} · {t.people} pessoas</span>
                        {st === "passou" && <span className="block text-[0.6rem] text-pink">Já passou · marque como feita</span>}
                      </span>
                    </button>
                    <button onClick={() => toggleT.mutate({ id: t.taskId, done: !t.done })} aria-label={t.done ? "Desmarcar turma feita" : "Marcar turma como feita"} title={t.done ? "Feita" : "Marcar como feita"}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${t.done ? "border-emerald bg-emerald/20 text-emerald" : "border-muted-foreground/40 text-transparent hover:border-emerald hover:text-emerald/60"}`}>
                      <Check size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* roteiro selecionado */}
        <section className="glass rounded-3xl p-5 animate-rise" style={{ ...tint(sel.color), animationDelay: ".05s" }}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl shadow-[0_0_24px_-6px_var(--glow)]"><GraduationCap size={22} /></span>
            <div className="mr-auto min-w-0">
              <h3 className="font-display text-xl font-semibold">{sel.title}</h3>
              <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users size={11} /> {sel.audience}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {totalMin} min</span>
                <span>Última turma: {lastClassOf(sel)}</span>
              </p>
            </div>
            <button onClick={reset} className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"><RotateCcw size={12} /> Reiniciar</button>
            <button onClick={() => { setLesson((l) => !l); if (!lesson) setOpenB(Object.fromEntries(sel.blocks.map((b) => [b.id, true]))); }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition hover:scale-105 ${lesson ? "border border-emerald/60 bg-emerald/15 text-emerald" : "bg-gradient-brand text-primary-foreground"}`}>
              {lesson ? <><Square size={12} /> Encerrar aula</> : <><Play size={12} /> Modo aula</>}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><Target size={14} className="text-[var(--glow)]" /> Objetivo</p>
            <p className="mt-1 text-[0.8rem] text-muted-foreground">{sel.goal}</p>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{lesson ? "Marque o que já mostrou para a turma" : "Itens mostrados"}</span>
              <span className="font-semibold tabular-nums">{doneCount}/{items.length} · {pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-brand transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {pct === 100 && <p className="mt-2 text-xs text-emerald">Tudo mostrado! Nada ficou de fora ✦</p>}
          </div>

          <ol className="relative mt-5 space-y-3 border-l border-border/80 pl-5">
            {sel.blocks.map((b, bi) => {
              const isOpen = !!openB[b.id];
              const bDone = b.show.filter((_, i) => shown[`${b.id}:${i}`]).length;
              const complete = b.show.length > 0 && bDone === b.show.length;
              return (
                <li key={b.id} className="relative">
                  <span className={`absolute -left-[31px] top-3 grid h-5 w-5 place-items-center rounded-full border text-[0.6rem] ${complete ? "border-emerald bg-emerald/20 text-emerald" : "border-[var(--glow)] bg-background text-[var(--glow)]"}`}>
                    {complete ? <Check size={10} /> : bi + 1}
                  </span>
                  <div className="rounded-2xl border border-border bg-card/40">
                    <button onClick={() => setOpenB((o) => ({ ...o, [b.id]: !o[b.id] }))} className="flex w-full items-center gap-3 p-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{b.title}</span>
                        <span className="text-[0.68rem] text-muted-foreground">{b.minutes} min · {bDone}/{b.show.length} mostrados{b.examples.length ? ` · ${b.examples.length} exemplo(s)` : ""}</span>
                      </span>
                      <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    </button>
                    {isOpen && (
                      <div className="space-y-3 border-t border-border px-3 pb-3 pt-2 animate-rise">
                        <div>
                          <p className="mono-caps !text-[0.58rem]">O que mostrar</p>
                          <ul className="mt-1.5 space-y-1.5">
                            {b.show.map((s, i) => {
                              const k = `${b.id}:${i}`; const ok = !!shown[k];
                              return (
                                <li key={k}>
                                  <button onClick={() => toggle(k)} className={`flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-[0.8rem] transition hover:bg-secondary/50 ${lesson ? "py-1.5 text-sm" : ""}`}>
                                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${ok ? "border-emerald bg-emerald/20 text-emerald" : "border-muted-foreground/50"}`}>{ok && <Check size={11} />}</span>
                                    <span className={ok ? "text-muted-foreground line-through" : ""}>{s}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                          {adding?.block === b.id ? (
                            <form onSubmit={(e) => { e.preventDefault(); addItem(); }} className="mt-1.5 flex items-center gap-2 rounded-lg border border-cyan/50 px-2 py-1">
                              <input autoFocus value={adding.text} onChange={(e) => setAdding({ block: b.id, text: e.target.value })} onBlur={addItem} placeholder="O que mais mostrar?" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
                            </form>
                          ) : (
                            <button onClick={() => setAdding({ block: b.id, text: "" })} className="mt-1 flex items-center gap-1 px-1.5 text-[0.7rem] text-muted-foreground hover:text-cyan"><Plus size={11} /> Adicionar item</button>
                          )}
                        </div>

                        {b.visuals?.length ? <VisualGuide visuals={b.visuals} onZoom={setZoom} /> : null}

                        {b.why && (
                          <div className="rounded-xl border border-emerald/40 bg-emerald/5 p-3">
                            <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold"><ThumbsUp size={13} className="text-emerald" /> Por que isso ajuda no dia a dia</p>
                            <ul className="mt-2 space-y-1.5">
                              {b.why.map((w) => (
                                <li key={w} className="flex gap-2 text-[0.75rem] leading-snug"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald" /> {w}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {b.scenario && (
                          <div className="rounded-xl border border-border p-3">
                            <p className="mono-caps !text-[0.58rem]">Situação para contar</p>
                            <p className="mt-1 text-[0.8rem] font-medium leading-snug">{b.scenario.situation}</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                              <div className="rounded-lg border border-pink/40 bg-pink/5 p-2 text-[0.72rem] leading-snug"><b className="text-pink">Sem etiquetas</b><br />{b.scenario.before}</div>
                              <span className="grid place-items-center text-muted-foreground"><ArrowRight size={14} className="hidden sm:block" /><ArrowDown size={14} className="sm:hidden" /></span>
                              <div className="rounded-lg border border-emerald/40 bg-emerald/5 p-2 text-[0.72rem] leading-snug"><b className="text-emerald">Com etiquetas</b><br />{b.scenario.after}</div>
                            </div>
                          </div>
                        )}

                        {b.examples.length > 0 && (
                          <div>
                            <p className="mono-caps !text-[0.58rem]">Exemplos para usar</p>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {b.examples.map((id) => {
                                const e = examples.find((x) => x.id === id); if (!e) return null;
                                return (
                                  <button key={id} onClick={() => focusExample(id)} className="tag flex items-center gap-1 transition hover:shadow-[0_0_14px_-4px_var(--glow)]" style={tint(e.color)}>
                                    <Sparkles size={10} /> {e.title} <ArrowRight size={10} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {b.tip && (
                          <p className="flex gap-2 rounded-xl border border-amber/40 bg-amber/5 p-2.5 text-[0.75rem] leading-snug">
                            <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber" /> <span><b>Dica:</b> {b.tip}</span>
                          </p>
                        )}

                        {b.faq?.map((f) => (
                          <div key={f.q} className="rounded-xl border border-border p-2.5 text-[0.75rem]">
                            <p className="flex items-center gap-1.5 font-medium"><MessageCircleQuestion size={13} className="text-cyan" /> {f.q}</p>
                            <p className="mt-1 pl-5 text-muted-foreground">{f.a}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* banco de exemplos */}
        <aside className="glass flex flex-col rounded-3xl p-4 animate-rise xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start" style={{ animationDelay: ".1s" }}>
          <div className="flex items-start gap-3">
            <span className="icon-tile h-10 w-10 shrink-0 !rounded-2xl" style={tint("violet")}><Sparkles size={18} /></span>
            <div>
              <h3 className="font-display text-lg font-semibold">Banco de exemplos</h3>
              <p className="text-[0.7rem] leading-snug text-muted-foreground">Bons exemplos prontos para quando a equipe perguntar.</p>
            </div>
          </div>
          <label className="glass mt-3 flex items-center gap-2 rounded-xl px-3 py-2">
            <Search size={13} className="text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar exemplo…" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
            {q && <button onClick={() => setQ("")}><X size={11} /></button>}
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] transition ${cat === c ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-border text-muted-foreground hover:text-foreground"}`}>{c}</button>
            ))}
          </div>
          <div className="mt-3 space-y-2.5 overflow-y-auto pr-1">
            {exFiltered.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhum exemplo encontrado.</p>}
            {exFiltered.map((e) => (
              <div key={e.id} id={`ex-${e.id}`} style={tint(e.color)}
                className={`accent-card !rounded-2xl p-3 transition ${hl === e.id ? "!border-[color-mix(in_oklab,var(--glow)_80%,transparent)] shadow-[0_0_30px_-6px_var(--glow)]" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.title}</span>
                  <span className="tag !text-[0.58rem]">{e.cat}</span>
                </div>
                <p className="mt-1.5 text-[0.7rem] text-muted-foreground"><b className="text-foreground/80">Situação:</b> {e.situation}</p>
                <div className="mt-2 rounded-lg bg-secondary/50 p-2 text-[0.72rem] leading-snug">{e.text}</div>
                {e.visual && (
                  <button onClick={() => setZoom(e.visual!)} className="group relative mt-2 block w-full overflow-hidden rounded-lg border border-border">
                    <img src={e.visual.src} alt={e.visual.caption} loading="lazy" width={1536} height={960} className="aspect-[16/7] w-full object-cover object-right transition group-hover:scale-105" />
                    <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[0.6rem] backdrop-blur"><ImageIcon size={10} /> Ver imagem</span>
                  </button>
                )}
                <button onClick={() => copy(e)} className="mt-2 flex items-center gap-1 text-[0.68rem] text-muted-foreground transition hover:text-[var(--glow)]">
                  {copied === e.id ? <><Check size={11} className="text-emerald" /> Copiado</> : <><Copy size={11} /> Copiar exemplo</>}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
      {zoom && <Lightbox visual={zoom} onClose={() => setZoom(null)} />}
      {editing && (
        <TrainingForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? undefined : editing} scripts={scripts} defaultScript={sel}
          saving={saveT.isPending || delT.isPending} onClose={() => setEditing(null)}
          onSave={(d) => saveTraining(d, editing === "new" ? undefined : editing)}
          onDelete={editing === "new" ? undefined : () => removeTraining(editing)}
          onOpenScript={(id) => { setSelId(id); setEditing(null); }} />
      )}
    </div>
  );
}

function PinDot({ n, pin, active, onHover }: { n: number; pin: Pin; active: boolean; onHover: (n: number | null) => void }) {
  return (
    <button type="button" onMouseEnter={() => onHover(n)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(n)} onBlur={() => onHover(null)}
      aria-label={`${n}. ${pin.label}`} style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
      className={`absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-brand text-[0.7rem] font-bold text-primary-foreground ring-2 ring-background transition ${active ? "scale-125 shadow-[0_0_20px_2px_var(--cyan)]" : "shadow-[0_0_12px_-2px_var(--cyan)]"}`}>
      {n}
    </button>
  );
}

function PinLegend({ pins, active, onHover, large }: { pins: Pin[]; active: number | null; onHover: (n: number | null) => void; large?: boolean }) {
  return (
    <ol className="space-y-1.5">
      {pins.map((p, i) => (
        <li key={p.label} onMouseEnter={() => onHover(i + 1)} onMouseLeave={() => onHover(null)}
          className={`flex gap-2 rounded-lg p-1.5 transition ${active === i + 1 ? "bg-cyan/10" : ""} ${large ? "text-sm" : "text-[0.75rem]"}`}>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-brand text-[0.62rem] font-bold text-primary-foreground">{i + 1}</span>
          <span className="leading-snug"><b>{p.label}.</b> <span className="text-muted-foreground">{p.text}</span></span>
        </li>
      ))}
    </ol>
  );
}

function VisualGuide({ visuals, onZoom }: { visuals: Visual[]; onZoom: (v: Visual) => void }) {
  const [idx, setIdx] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const v = visuals[idx] ?? visuals[0]!;
  return (
    <div className="rounded-xl border border-cyan/40 bg-cyan/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto flex items-center gap-1.5 text-[0.8rem] font-semibold"><ImageIcon size={13} className="text-cyan" /> Imagem de apoio</p>
        {visuals.length > 1 && visuals.map((x, i) => (
          <button key={x.title} onClick={() => { setIdx(i); setActive(null); }}
            className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] transition ${i === idx ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {i + 1}. {x.title}
          </button>
        ))}
      </div>
      <div className="relative mt-2 overflow-hidden rounded-lg border border-border">
        <img src={v.src} alt={v.caption} loading="lazy" width={1536} height={960} className="block w-full" />
        {v.pins.map((p, i) => <PinDot key={p.label} n={i + 1} pin={p} active={active === i + 1} onHover={setActive} />)}
        <button onClick={() => onZoom(v)} className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[0.65rem] backdrop-blur transition hover:text-cyan">
          <Maximize2 size={11} /> Ampliar
        </button>
      </div>
      <p className="mt-1.5 text-[0.68rem] italic text-muted-foreground">{v.caption}</p>
      <div className="mt-2"><PinLegend pins={v.pins} active={active} onHover={setActive} /></div>
    </div>
  );
}

function Lightbox({ visual, onClose }: { visual: Visual; onClose: () => void }) {
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={visual.title} onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-md animate-rise">
      <div onClick={(e) => e.stopPropagation()} className="glass grid max-h-full w-full max-w-7xl gap-4 overflow-auto rounded-3xl p-4 lg:grid-cols-[1fr_320px]">
        <div className="relative self-start overflow-hidden rounded-xl border border-border">
          <img src={visual.src} alt={visual.caption} width={1536} height={960} className="block w-full" />
          {visual.pins.map((p, i) => <PinDot key={p.label} n={i + 1} pin={p} active={active === i + 1} onHover={setActive} />)}
        </div>
        <div>
          <div className="flex items-start gap-2">
            <div className="mr-auto">
              <h3 className="font-display text-lg font-semibold">{visual.title}</h3>
              <p className="text-xs text-muted-foreground">{visual.caption}</p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="mt-3"><PinLegend pins={visual.pins} active={active} onHover={setActive} large /></div>
        </div>
      </div>
    </div>
  );
}


function TrainingForm({ initial, scripts, defaultScript, saving, onClose, onSave, onDelete, onOpenScript }: {
  initial?: Training | undefined; scripts: Script[]; defaultScript: Script; saving: boolean;
  onClose: () => void; onSave: (d: TrainingDraft) => void; onDelete?: (() => void) | undefined; onOpenScript: (id: string) => void;
}) {
  const [f, setF] = useState<TrainingDraft>(() => initial ?? {
    group: "", people: 0, scriptKey: defaultScript.id, scriptTitle: defaultScript.title, date: todayIso(), time: "", end: "", place: "", notes: "",
  });
  const set = <K extends keyof TrainingDraft>(k: K, v: TrainingDraft[K]) => setF((x) => ({ ...x, [k]: v }));
  const known = scripts.some((s) => s.id === f.scriptKey);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const field = "glass w-full rounded-xl px-3 py-2 text-sm outline-none focus:border-amber/60";
  const label = "mb-1 block text-[0.7rem] text-muted-foreground";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.group.trim()) { toast.error("Dê um nome para a turma."); return; }
    if (!f.date) { toast.error("Escolha a data."); return; }
    if (f.time && f.end && f.end <= f.time) { toast.error("O fim precisa ser depois do início."); return; }
    onSave(f);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label={initial ? "Editar turma" : "Agendar turma"} onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-md animate-rise">
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={tint("amber")} className="glass max-h-full w-full max-w-lg space-y-3 overflow-auto rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <span className="icon-tile h-10 w-10 shrink-0 !rounded-2xl"><CalendarDays size={18} /></span>
          <div className="mr-auto">
            <h3 className="font-display text-lg font-semibold">{initial ? "Editar turma" : "Agendar turma"}</h3>
            <p className="text-[0.7rem] text-muted-foreground">Vai para o Calendário e aparece quando você perguntar o que tem no dia.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={16} /></button>
        </div>

        <label className="block"><span className={label}>Turma / polo</span>
          <input autoFocus value={f.group} onChange={(e) => set("group", e.target.value)} maxLength={120} placeholder="Ex.: Turma Niterói" className={field} />
        </label>
        <label className="block"><span className={label}>Roteiro</span>
          <div className="flex gap-2">
            <select value={f.scriptKey} onChange={(e) => { const s = scripts.find((x) => x.id === e.target.value); set("scriptKey", e.target.value); set("scriptTitle", s?.title ?? ""); }} className={`${field} bg-background`}>
              {!known && <option value={f.scriptKey}>{f.scriptTitle || "Sem roteiro"}</option>}
              {scripts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            {known && <button type="button" onClick={() => onOpenScript(f.scriptKey)} className="glass shrink-0 rounded-xl px-3 text-xs text-muted-foreground hover:text-amber">Abrir</button>}
          </div>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-3 block sm:col-span-1"><span className={label}>Data</span>
            <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={field} required />
          </label>
          <label className="block"><span className={label}>Início</span>
            <input type="time" value={f.time ?? ""} onChange={(e) => set("time", e.target.value)} className={field} />
          </label>
          <label className="block"><span className={label}>Fim</span>
            <input type="time" value={f.end ?? ""} onChange={(e) => set("end", e.target.value)} disabled={!f.time} className={`${field} disabled:opacity-50`} />
          </label>
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <label className="block"><span className={label}><MapPin size={10} className="inline" /> Local</span>
            <input value={f.place ?? ""} onChange={(e) => set("place", e.target.value)} maxLength={200} placeholder="Online, Google Meet, Polo Santos…" className={field} />
          </label>
          <label className="block"><span className={label}><Users size={10} className="inline" /> Pessoas</span>
            <input type="number" min={0} max={1000} value={f.people || ""} onChange={(e) => set("people", Number(e.target.value) || 0)} placeholder="0" className={field} />
          </label>
        </div>
        <label className="block"><span className={label}>Observações</span>
          <textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} maxLength={1500} rows={3} placeholder="Ex.: levar lead de teste, pedir para todos entrarem antes com login…" className={`${field} resize-none`} />
        </label>

        <div className="flex items-center gap-2 pt-1">
          {onDelete && <button type="button" onClick={onDelete} disabled={saving} className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs text-pink transition hover:bg-pink/10"><Trash2 size={13} /> Excluir</button>}
          <button type="button" onClick={onClose} className="ml-auto rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:scale-105 disabled:opacity-60">
            {initial ? <><Pencil size={12} /> Salvar</> : <><CalendarPlus size={12} /> Agendar</>}
          </button>
        </div>
      </form>
    </div>
  );
}
