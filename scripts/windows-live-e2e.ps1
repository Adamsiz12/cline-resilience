param(
    [Parameter(Mandatory=$true)]
    [string]$ClineSourceDir,
    [switch]$RunClineHostTests
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "[1/4] Verifying Cline source checkout..." -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
    node scripts/verify-cline-checkout.mjs $ClineSourceDir
    if ($LASTEXITCODE -ne 0) { throw "Cline checkout compatibility verification failed." }

    Write-Host "[2/4] Building and running Cline Resilience practical tests..." -ForegroundColor Cyan
    npm run test:practical
    if ($LASTEXITCODE -ne 0) { throw "Cline Resilience practical test failed." }
} finally {
    Pop-Location
}

if ($RunClineHostTests) {
    $bun = Get-Command bun -ErrorAction SilentlyContinue
    if (-not $bun) {
        throw "bun was not found. Install Bun or rerun without -RunClineHostTests."
    }

    $VsCodeDir = Join-Path $ClineSourceDir "apps/vscode"
    $DesktopDir = Join-Path $ClineSourceDir "apps/examples/desktop-app"

    Write-Host "[3/4] Running Cline VS Code host unit tests..." -ForegroundColor Cyan
    Push-Location $VsCodeDir
    try {
        bun run test:unit
        if ($LASTEXITCODE -ne 0) { throw "Cline VS Code unit tests failed." }
    } finally {
        Pop-Location
    }

    Write-Host "[4/4] Running Cline Desktop typecheck + chat UI tests..." -ForegroundColor Cyan
    Push-Location $DesktopDir
    try {
        bun run typecheck
        if ($LASTEXITCODE -ne 0) { throw "Cline Desktop typecheck failed." }
        bun run test:chat-ui
        if ($LASTEXITCODE -ne 0) { throw "Cline Desktop chat UI tests failed." }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[3/4] Cline host tests skipped (pass -RunClineHostTests to enable)." -ForegroundColor Yellow
    Write-Host "[4/4] Done." -ForegroundColor Green
}

Write-Host "All requested checks completed successfully." -ForegroundColor Green
