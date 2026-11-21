@echo off
rem Desliga a ponte do WhatsApp que esta em segundo plano e tira a inicializacao automatica com o Windows.
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OrionWhatsApp.vbs" >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3939 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
echo.
echo Pronto: a ponte foi desligada e nao liga mais sozinha. Suas mensagens guardadas continuam no computador.
echo Para ligar de novo, de dois cliques em whatsapp-fundo.cmd (ou use o botao em Configuracoes - WhatsApp).
echo.
pause
