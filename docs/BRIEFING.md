# Briefing e memória da Presence

A Presence aprende com cada pessoa: como chamar, jeito de conversar, como começar a conversa, trabalho, maior demanda, rotina, objetivos e regras. Depois continua aprendendo (memória).

## Telas
- **Briefing** (`src/components/briefing/BriefingFlow.tsx`): tela cheia, conversa em passos (nome → jeito de falar → como começar a conversa → trabalho → maior demanda → rotina → objetivos → regras → resumo). Dá para responder por voz (microfone → Whisper). A aba "O que aprendi" lista a memória e deixa apagar ou ensinar algo.
- **Quando aparece**: sozinho no primeiro login de uma conta que **não é a principal** (adiável com "Fazer depois"); para a conta principal e para qualquer pessoa, pelo cartão "Personalize a Presence / Meu briefing" na tela inicial e pelo menu da conta.

## Dados (migração `20261118000100_presence_app_briefing.sql`)
- `presence_app.user_briefing` (uma linha por dono) e `presence_app.user_memories` (aprendizados). RLS por dono, como o resto.
- Sem a migração aplicada o recurso fica desligado (o app segue normal): `loadBriefingState` devolve `available: false`.

## Como a Presence usa
- `briefingPrompt` (src/lib/briefing.ts) entra no prompt da voz (`runAgent`) com tudo que ela sabe + os aprendizados.
- Começo da conversa: o cliente manda `[[inicio]]` quando a pessoa toca na esfera e escolheu cumprimentar; `greetingDirective` diz como (só cumprimentar, mostrar o dia, perguntar como ajudar, ou o que ela pediu a mais). "Esperar eu falar" não fala nada.
- Ferramentas da voz: `lembrar` (guarda aprendizado, sem duplicar), `esquecer`, `ajustar_perfil` (nome, jeito, saudação). "Como te chamar" também atualiza `profiles.display_name` (saudação da tela inicial).
