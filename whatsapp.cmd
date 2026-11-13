@echo off
rem Liga a ponte do WhatsApp (somente leitura). Deixe esta janela aberta enquanto usar o WhatsApp no Presence.
cd /d "%~dp0whatsapp-bridge"
call npm install --no-audit --no-fund
node src/index.ts
pause
