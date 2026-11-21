# Cursos (`/cursos`)

Área de estudo dentro do Orion. O primeiro curso é o **Meta Academy** (ecossistema Meta, WhatsApp Business Platform, políticas, templates, qualidade e integrações).

- Catálogo de cursos (`src/lib/courses/index.ts`) e página (`src/components/courses/CoursesPage.tsx`, rota `src/routes/cursos.tsx`, item "Cursos" na barra lateral).
- Abas: Visão geral (anéis, trilhas, próximo passo, evolução), Trilhas e aulas (com busca), Simulado, Flashcards, Laboratório de casos, Glossário, Anotações, Fontes e Dados (exportar/importar backup).
- **Fontes e verificação:** cada aula tem `sources` (links oficiais) e `verified` (AAAA-MM-DD ou `null` = pendente). Última rodada: 21/11/2026. Aulas com `null` aparecem como "verificação pendente".
- **Armazenamento:** só `localStorage` (`orion.cursos.<curso>.v1`), sem banco e sem login, como no projeto original. Dados inválidos são descartados (`src/lib/courses/storage.ts`).
- Para adicionar um curso: criar o arquivo de conteúdo em `src/lib/courses/` com o mesmo formato (módulos, glossário, flashcards, quiz, casos) e incluir em `COURSES`.
