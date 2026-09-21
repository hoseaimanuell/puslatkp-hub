# PUSLATKP Management Hub — peluncur development (Windows / Laragon)
# Menjalankan servis be (Express :4000) dan fe (Next.js :3000) di dua jendela terpisah.
# Prasyarat: MySQL Laragon aktif, database Puslatkp1a sudah diimpor, be/.env sudah diisi.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    $lar = Get-ChildItem 'C:\laragon\bin\nodejs' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $lar) { Write-Host '[ERROR] Node.js tidak ditemukan.' -ForegroundColor Red; exit 1 }
    $env:PATH = "$($lar.FullName);$env:PATH"
    Write-Host "[INFO] Memakai Node.js Laragon: $($lar.Name)" -ForegroundColor Green
}

if (-not (Test-Path "$root\be\.env")) {
    Write-Host '[ERROR] be\.env belum ada. Salin be\.env.example -> be\.env dan isi JWT_SECRET.' -ForegroundColor Red
    exit 1
}

foreach ($svc in 'be', 'fe') {
    if (-not (Test-Path "$root\$svc\node_modules")) {
        Write-Host "[INFO] npm install di $svc ..." -ForegroundColor Yellow
        Push-Location "$root\$svc"; & cmd.exe /c 'npm.cmd install'; Pop-Location
    }
}

Write-Host '[INFO] Menjalankan be di http://localhost:4000 dan fe di http://localhost:3000' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$env:PATH='$env:PATH'; Set-Location '$root\be'; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$env:PATH='$env:PATH'; Set-Location '$root\fe'; npm run dev"
Start-Sleep -Seconds 6
Start-Process 'http://localhost:3000'
