# Contas, login e acesso

**Cada pessoa cria a própria conta (usuário e senha) direto no Orion.** Sem e-mail, sem confirmação. Ninguém precisa de conta na Vercel nem na Supabase para entrar.

## Usuário e senha (sem e-mail)
- "Criar conta" chama `presence_app.create_login(usuario, senha, nome)` (migração `20261202000100_presence_app_username_login.sql`), que cria o login no Supabase Auth com o e-mail interno `<usuario>@orion.local`, **já confirmado**. Nenhum e-mail é enviado. Depois o app entra com `signInWithPassword`.
- "Entrar" aceita o usuário (vira `<usuario>@orion.local`) ou, para contas antigas, o e-mail completo.
- Não existe "esqueci a senha" (não há e-mail). A pessoa troca a senha no menu da conta ("Trocar senha"). Se alguém esquecer, quem administra redefine pelo painel da Supabase (Authentication → Users) ou por SQL.
- A mesma migração confirmou todas as contas que estavam presas esperando o e-mail.

## Como funciona
- Tela de entrada do Orion (`AuthGate`): "Entrar" e "Criar conta" (Supabase Auth por baixo). Ao entrar, a função `presence_app.claim_account` vincula o login a um espaço de dados próprio (`account_owner`).
- A conta principal (a primeira) usa o dono legado `00000000-0000-0000-0000-000000000001`; as demais usam o próprio id. Cada pessoa só enxerga o que é dela (RLS por `owner_id()`).
- **Limite de contas:** `presence_app.app_settings` (`max_accounts`, hoje 1.000.000 = sem limite na prática). Existe para proteger o custo da IA enquanto o cadastro está aberto. Para mudar: `update presence_app.app_settings set value = 20 where key = 'max_accounts';`.

## Vercel
- A proteção "Vercel Authentication" (SSO) fica **só nas prévias** (`ssoProtection.deploymentType = "preview"`). A produção é pública, para qualquer pessoa abrir o site e criar a conta. Se ela voltar para "all", só quem tem login na Vercel entra.
- As rotas de servidor (`/api/voz`, `/api/tts`, `/api/whatsapp`, funções do servidor) exigem a sessão do Orion; o MCP exige o token. Os diagnósticos `GET /api/voz` e `GET /api/tts` também exigem login (fazem chamadas pagas).

## Banco: nada para quem não está logado
A migração `20261124000200_presence_app_close_anon_access.sql` removeu as políticas do "modo sem login" (papel `anon`) de todas as tabelas e dos buckets `presence-app-*`, e tirou os privilégios do `anon`. A chave pública do banco vai no código do site, então **ela não pode dar acesso a dados**.
- Consequência: o modo de teste local sem login (`VITE_AUTH_DISABLED=1`) e o MCP (que usava a chave pública como a conta principal) não leem mais os dados. Para ligar o MCP de novo é preciso um login de serviço no servidor (ainda não feito).

## Para conferir no painel da Supabase (Authentication)
- (Só importa para contas antigas por e-mail.) **URL Configuration → Redirect URLs:** adicionar o endereço de produção do Orion (`https://spark-mind-friend-htvx.vercel.app/**`). O cadastro pede que o link do e-mail de confirmação volte para o endereço de onde a pessoa se cadastrou (`emailRedirectTo`); a Supabase só aceita se o endereço estiver nessa lista. "Site URL" é o plano B (o projeto da Supabase é compartilhado com outro app: só mude se for o Orion o principal).
- **Providers → Email:** cadastro por e-mail ativo.
- **Leaked password protection:** ligar (impede senhas vazadas).
- E-mails de confirmação: o envio padrão da Supabase tem limite baixo por hora; para muitas contas, configurar um SMTP próprio.
