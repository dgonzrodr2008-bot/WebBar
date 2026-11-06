@echo off
title Restaurante Tarca Luis - Servidor Web
cd /d "%~dp0"

echo =========================================================
echo   Iniciando Restaurante Tarca Luis (La Palma, Canarias)
echo =========================================================
echo Directorio: %CD%
echo.

REM 1. Probar ruta directa de agy-node en AppData
if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
  echo Utilizando motor Antigravity Node...
  call "%APPDATA%\Antigravity\bin\agy-node.cmd" server.js
  goto end
)

REM 2. Probar agy-node en el PATH
where agy-node >nul 2>nul
if %errorlevel% equ 0 (
  echo Utilizando agy-node...
  agy-node server.js
  goto end
)

REM 3. Probar node estándar
where node >nul 2>nul
if %errorlevel% equ 0 (
  echo Utilizando Node.js del sistema...
  node server.js
  goto end
)

echo [ERROR] No se ha encontrado el entorno Node.js.
echo Por favor ejecuta el comando dentro del directorio del proyecto:
echo   cd "%~dp0"
echo   agy-node server.js
echo.
pause

:end
