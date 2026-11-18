-- Saúde → Análise: a fórmula de gordura estimada depende de feminino/masculino. Antes ficava só no navegador; agora na conta.
alter table presence_app.profiles add column if not exists analysis_sex text check (analysis_sex in ('feminino','masculino'));
