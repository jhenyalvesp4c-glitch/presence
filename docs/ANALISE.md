# Saúde → Análise

- Tela: `src/components/health-analysis/` (`AnalysisPage`, `charts`). Cálculos puros em `src/lib/health-analysis.ts` (testados em `src/test/health-analysis.test.ts`).
- Dados: `body_measurements` (peso, altura, medidas, fotos), ficha de treino e dieta. Nada da análise é gravado pronto: tudo é calculado ao abrir.
- Gordura: se a medição tem `values.gordura_pct` (informada pela pessoa), vale ela; senão é estimativa RFM (altura ÷ cintura). Massa magra = peso − gordura.
- Conta (`profiles`): `analysis_sex`, `analysis_period`, `analysis_hidden`, `goal_weight_kg`, `goal_waist_cm` (hook `useAnalysisPrefs`).
- Voz: ferramenta `analise_corporal` (`src/lib/voice/analysis-tool.ts`): resumo, meta, gordura.
- Indicadores: IMC (faixas da OMS), cintura ÷ altura (ideal < 0,50), cintura ÷ quadril (risco acima de 0,85 mulheres / 0,90 homens), gordura (faixa aproximada por sexo). A pontuação é a média simples das notas dos indicadores: é um guia, não um diagnóstico.
