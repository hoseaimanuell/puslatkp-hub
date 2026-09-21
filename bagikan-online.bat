@echo off
REM ==========================================================================
REM  Membagikan web ini lewat internet SEMENTARA (untuk uji/demo).
REM  - Komputer ini harus tetap menyala selama web dipakai.
REM  - Untuk mematikan: tutup jendela "TUNNEL", "FE", dan "BE".
REM  - Port 3100/4100 dipakai agar tidak bentrok dengan npm run dev (3000/4000).
REM  - Password akun = password di database. GANTI password bawaan sebelum dibagikan.
REM ==========================================================================
setlocal
cd /d "%~dp0"
set PORT_FE=3100
set PORT_BE=4100

if not exist "be.env" ( echo be.env belum ada. Salin be.env.example lalu isi dulu. & pause & exit /b 1 )

echo [1/4] Build frontend (sekitar 1 menit)...
set NEXT_PUBLIC_API_URL=/api
set NEXT_DIST_DIR=.next-online
set API_PROXY=http://127.0.0.1:%PORT_BE%
pushd fe
call npm run build || ( echo Build gagal. & popd & pause & exit /b 1 )
popd

echo [2/4] Menyalakan backend di port %PORT_BE%...
start "BE" cmd /k "cd /d %~dp0be && set PORT=%PORT_BE%&& node src/server.js"

echo [3/4] Menyalakan frontend di port %PORT_FE%...
start "FE" cmd /k "cd /d %~dp0fe && npx next start -p %PORT_FE%"
timeout /t 8 >nul

echo [4/4] Membuka alamat online. Cari baris berisi https://... di jendela TUNNEL, itu alamat yang dibagikan.
where cloudflared >nul 2>nul
if %errorlevel%==0 (
  start "TUNNEL" cmd /k "cloudflared tunnel --url http://localhost:%PORT_FE%"
) else (
  REM Tanpa unduhan: memakai SSH bawaan Windows ke localhost.run (gratis, tanpa akun)
  start "TUNNEL" cmd /k "ssh -o StrictHostKeyChecking=accept-new -R 80:localhost:%PORT_FE% nokey@localhost.run"
)
echo.
echo Selesai. Web lokal: http://localhost:%PORT_FE%
echo Untuk mematikan, tutup jendela TUNNEL, FE, dan BE.
endlocal
