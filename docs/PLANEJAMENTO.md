# Planejamento inteligente

- `src/lib/planning/engine.ts`: motor puro (`planDay`) que monta o dia a partir de dados reais: compromissos, tarefas, hábitos, treino, refeições, financeiro, demandas e rotina.
- Fontes ligáveis em `plan_settings.sources` (todas ligadas por padrão), janela do dia e tempo de deslocamento.
- Rotina editável (`routine_items`: duração, dias da semana, ativa).
- Aprendizado: ações no plano viram `plan_events`; `learn.ts` gera `plan_suggestions` (mover horário, limite de tarefas, pico de foco). Aceitar atualiza `plan_settings.prefs`.
- Telas: `/planejamento`, `/planejamento/dia` (duração, adiar, modo foco, revisão do dia), `/planejamento/semana`.
- Voz: ferramenta `planejamento` (`src/lib/voice/planning-tool.ts`).
