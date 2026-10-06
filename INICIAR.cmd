@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instala Node.js 22 o superior y vuelve a abrir esta ventana.
 pause
 exit /b 1
)
if not exist .env.local copy .env.example .env.local >nul
if not exist node_modules\next\dist\bin\next (
 call npm ci
 if errorlevel 1 exit /b 1
)
echo Usuario: http://localhost:3000  Administrador: http://localhost:3000/admin
call npm run dev
pause
