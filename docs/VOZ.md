# Assistente de voz (estilo Jarvis)

Toque na esfera da tela inicial (ou no botão de microfone no canto inferior esquerdo das outras telas) e converse. Ela ouve, pensa, **fala com a voz do ElevenLabs** e volta a ouvir sozinha. Toque de novo enquanto ela fala para interromper; o botão ▢ encerra; dizer "tchau" também.

## O que ela faz
| Pedido | O que acontece |
|---|---|
| "Abre demandas / saúde / tarefas / calendário…" | Abre a página (e continua a conversa nela). Também "abre as demandas do projeto X". |
| "Cria uma demanda / tarefa / compromisso / lembrete…" | Cria de verdade (mesma validação da Central de entrada: projeto, polo, categoria, duplicidade) e confirma falando. |
| "O que eu tenho hoje / amanhã?" | Resume em 2–3 frases e abre um painel com agenda, atrasadas e demandas em andamento. |
| "Marca a tarefa X como feita" | Conclui a tarefa. |
| "O que aconteceu com o disparo de Maceió?" | Pesquisa no Orion (segundo cérebro) e responde. |
| "Documenta que o disparo deu erro de pagamento" | Guarda no Orion com a data. |

Cada conversa também fica salva em `assistant_messages` (o Orion encontra depois).

## Como funciona (rapidez)
- Voz → texto: reconhecimento de fala do navegador (Chrome/Edge/Safari). Sem suporte, aparece uma caixa para digitar e a resposta continua falada.
- `/api/voz`: Chat Completions em **streaming** com ferramentas (`src/lib/voice/agent.ts`). Cada frase pronta vai para `/api/tts` na hora (a próxima já é gerada enquanto a anterior toca).
- `/api/tts`: ElevenLabs (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`; modelo `eleven_flash_v2_5`, troque com `ELEVENLABS_MODEL`). Sem a chave, usa a voz do próprio navegador.
- IA: `OPENAI_API_KEY`; modelo `OPENAI_VOICE_MODEL` (ou `OPENAI_MODEL`).
- Proteções: só mesma origem + limite por IP (o app não tem login).
