@echo off
setlocal
chcp 65001 >nul
title Escena IA - Clasificador de escenas

set "APP_DIR=%~dp0"
set "APP_URL=http://localhost:3000"

cd /d "%APP_DIR%"

if not exist "package.json" (
  echo.
  echo ERROR: No se encontro package.json en:
  echo %APP_DIR%
  echo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Node.js no esta instalado o no esta disponible en PATH.
  echo Instala Node.js 22.13 o superior y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: npm no esta disponible en PATH.
  echo Reinstala Node.js incluyendo npm y vuelve a intentarlo.
  echo.
  pause
  exit /b 1
)

if /i "%~1"=="--check" (
  echo Lanzador verificado correctamente.
  exit /b 0
)

if not exist "node_modules\." (
  echo.
  echo Preparando la aplicacion por primera vez...
  echo Este proceso puede tardar algunos minutos.
  echo.
  call npm install
  if errorlevel 1 goto :installation_error
)

echo.
echo ================================================
echo              ESCENA IA
echo ================================================
echo.
echo Iniciando la aplicacion...
echo El navegador se abrira automaticamente.
echo.
echo Para detenerla, cierra esta ventana o pulsa Ctrl+C.
echo.

start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command ^
  "$url='%APP_URL%'; for ($i=0; $i -lt 120; $i++) { try { $response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($response.StatusCode -ge 200) { Start-Process $url; exit 0 } } catch {}; Start-Sleep -Seconds 1 }"

call npm run dev
set "SERVER_EXIT=%ERRORLEVEL%"

if not "%SERVER_EXIT%"=="0" goto :server_error

echo.
echo El servidor de Escena IA se ha detenido.
echo.
pause
exit /b 0

:installation_error
echo.
echo ERROR: No fue posible instalar las dependencias.
echo Comprueba tu conexion a Internet y vuelve a intentarlo.
echo.
pause
exit /b 1

:server_error
echo.
echo ERROR: La aplicacion termino con el codigo %SERVER_EXIT%.
echo Comprueba que el puerto 3000 no este siendo utilizado por otro programa.
echo.
pause
exit /b %SERVER_EXIT%
