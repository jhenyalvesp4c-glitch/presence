# Contas (e-mail e senha)

O Presence tem login simples do Supabase Auth: **e-mail + senha**, sem Google nem serviços externos.

## Como funciona
- Tela de entrada (`src/components/auth/AuthGate.tsx`) com "Entrar" e "Criar conta". Sem login, nada do app aparece.
- **A primeira conta a entrar é a principal**: assume os dados que já existiam (o antigo "dono fixo" `00000000-0000-0000-0000-000000000001`). A segunda conta começa vazia (só com as categorias de tarefa padrão). **Máximo de 2 contas** (função `presence_app.claim_account`; para mudar o limite, altere `n >= 2` numa nova migração).
- `presence_app.account_owner` liga o usuário do Auth ao "dono" dos dados. `presence_app.owner_id()` é o dono de quem está logado (e o padrão de `user_id` em todas as tabelas).
- RLS: toda tabela com `user_id` (e os 3 buckets, pasta = dono) só deixa ler/gravar linhas do próprio dono. Conta que não passou por `claim_account` não enxerga nada.
- Arquivos: o caminho no Storage começa com o dono (`ownerId()`).

## No servidor
- Funções do servidor (`createServerFn`) recebem o token por um middleware global (`src/start.ts`); rotas `/api/voz` e `/api/tts` usam `withUser` (`src/lib/server-auth.ts`). Sem login válido → 401.
- Dentro do pedido, `supabase` (Proxy em `src/lib/supabase.ts`) e `ownerId()` usam o login de quem pediu (AsyncLocalStorage). Código novo só precisa importar `supabase` e usar `ownerId()` em vez de IDs fixos.
- **MCP (`/api/mcp`) continua sem login de usuário**: usa `MCP_TOKEN` e age como a conta principal (dono legado) pelo papel `anon`.

## Ainda pendente (endurecimento)
- As policies do papel `anon` para o dono legado continuam existindo por causa do MCP: quem tiver a chave pública do Supabase ainda consegue ler os dados da conta principal pela API REST. Para fechar, dê ao MCP um login próprio e remova as policies "sem login: …" (tabelas e Storage).
- Recuperar senha por e-mail ainda não tem tela.

## Testes locais sem login
`VITE_AUTH_DISABLED=1 bun run dev` roda tudo como a conta principal, sem a tela de entrada. **Nunca defina isso na Vercel.**
