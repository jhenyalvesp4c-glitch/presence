# Presence

Assistente pessoal para rotina, saúde, foco e finanças.

Stack: [TanStack Start](https://tanstack.com/start) (React 19 + SSR), Vite, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query e Nitro para o build de servidor.

## Desenvolvimento

Requisitos: [Bun](https://bun.sh) (ou Node.js 22+ com npm).

```sh
bun install
bun run dev        # http://localhost:8080
```

## Scripts

| Comando           | O que faz                                        |
| ----------------- | ------------------------------------------------ |
| `bun run dev`     | Servidor de desenvolvimento com HMR              |
| `bun run build`   | Build de produção em `.output/`                  |
| `bun run preview` | Pré-visualiza o build de produção                |
| `bun run test`    | Testes (Vitest)                                  |
| `bun run lint`    | ESLint + Prettier                                |
| `bun run format`  | Formata o código com Prettier                    |

## Deploy

O build usa o Nitro. Por padrão gera um servidor Node:

```sh
bun run build
node .output/server/index.mjs   # porta 3000 (PORT para alterar)
```

Para outras plataformas, defina o preset do Nitro, por exemplo `NITRO_PRESET=vercel bun run build`
(também `netlify`, `cloudflare-module`, etc.). A Vercel detecta o preset automaticamente.

## Estrutura

- `src/routes/` — rotas baseadas em arquivos (TanStack Router); `routeTree.gen.ts` é gerado automaticamente.
- `src/components/` — componentes da aplicação; `src/components/ui/` são os componentes shadcn/ui.
- `src/lib/` — utilitários, dados de planejamento e tratamento de erros de SSR.
- `src/styles.css` — tokens de tema e classes visuais compartilhadas.
