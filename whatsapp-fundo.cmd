@echo off
rem Deixa a ponte do WhatsApp (somente leitura) ligada em SEGUNDO PLANO, sem janela, e a liga sozinha sempre que o Windows iniciar. Basta dar dois cliques (uma vez).
cd /d "%~dp0whatsapp-bridge"
if not exist node_modules (
  echo Instalando as pecas da ponte. Aguarde...
  call npm install --no-audit --no-fund || goto erro
)
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
> "%STARTUP%\OrionWhatsApp.vbs" echo CreateObject("WScript.Shell").Run "wscript.exe ""%~dp0whatsapp-fundo.vbs""", 0, False
if errorlevel 1 goto erro
wscript.exe "%~dp0whatsapp-fundo.vbs"
echo.
echo Pronto! A ponte do WhatsApp esta ligando escondida e vai ligar sozinha quando o Windows iniciar.
echo Nao ha janela para deixar aberta. Abra o Orion - Configuracoes - WhatsApp para ler o QR Code.
echo Para desfazer, de dois cliques em whatsapp-parar.cmd.
echo.
pause
goto fim
:erro
echo.
echo Algo deu errado. Copie a mensagem acima e envie para a Claude.
pause
:fim
