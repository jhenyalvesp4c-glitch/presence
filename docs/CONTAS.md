# Contas, login e acesso

**Cada pessoa cria a própria conta (e-mail e senha) direto no Orion.** Ninguém precisa de conta na Vercel nem na Supabase para entrar.

## Como funciona
- Tela de entrada do Orion (`AuthGate`): "Entrar" e "Criar conta" (Supabase Auth, e-mail e senha). Ao entrar, a função `presence_app.claim_account` vincula o login a um espaço de dados próprio (`account_owner`).
- A conta principal (a primeira) usa o dono legado `00000000-0000-0000-0000-000000000001`; as demais usam o próprio id. Cada pessoa só enxerga o que é dela (RLS por `owner_id()`).
- **Limite de contas:** `presence_app.app_settings` (`max_accounts`, hoje 10). Existe para proteger o custo da IA enquanto o cadastro está aberto. Para mudar: `update presence_app.app_settings set value = 20 where key = 'max_accounts';`.

## Vercel
- A proteção "Vercel Authentication" (SSO) fica **só nas prévias** (`ssoProtection.deploymentType = "preview"`). A produção é pública, para qualquer pessoa abrir o site e criar a conta. Se ela voltar para "all", só quem tem login na Vercel entra.
- As rotas de servidor (`/api/voz`, `/api/tts`, `/api/whatsapp`, funções do servidor) exigem a sessão do Orion; o MCP exige o token. Os diagnósticos `GET /api/voz` e `GET /api/tts` também exigem login (fazem chamadas pagas).

## Banco: nada para quem não está logado
A migração `20261124000200_presence_app_close_anon_access.sql` removeu as políticas do "modo sem login" (papel `anon`) de todas as tabelas e dos buckets `presence-app-*`, e tirou os privilégios do `anon`. A chave pública do banco vai no código do site, então **ela não pode dar acesso a dados**.
- Consequência: o modo de teste local sem login (`VITE_AUTH_DISABLED=1`) e o MCP (que usava a chave pública como a conta principal) não leem mais os dados. Para ligar o MCP de novo é preciso um login de serviço no servidor (ainda não feito).

## Para conferir no painel da Supabase (Authentication)
- **URL Configuration:** "Site URL" = endereço de produção do Orion; sem isso o link do e-mail de confirmação leva para o lugar errado.
- **Providers → Email:** cadastro por e-mail ativo.
- **Leaked password protection:** ligar (impede senhas vazadas).
- E-mails de confirmação: o envio padrão da Supabase tem limite baixo por hora; para muitas contas, configurar um SMTP próprio.
