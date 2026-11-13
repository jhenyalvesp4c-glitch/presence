@echo off
rem Atualiza o app local com a versao mais recente e inicia. Basta dar dois cliques.
cd /d "%~dp0"
git remote get-url presence >nul 2>&1 || git remote add presence https://github.com/jhenyalvesp4c-glitch/presence.git
echo Baixando a versao mais recente...
git fetch presence claude/busy-planck-p1i0im || goto erro
git checkout -B claude/busy-planck-p1i0im FETCH_HEAD || goto erro
echo Conferindo dependencias...
call npm install --no-audit --no-fund || goto erro
echo Iniciando o app em http://localhost:8080 ...
start "" http://localhost:8080
call npm run dev
goto fim
:erro
echo.
echo Algo deu errado. Copie a mensagem acima e envie para a Claude.
pause
:fim
