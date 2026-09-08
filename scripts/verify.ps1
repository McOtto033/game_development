$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required. Install Node.js 22 or newer, then run this command again.'
}

& node (Join-Path $PSScriptRoot 'verify.js')
if ($LASTEXITCODE -ne 0) {
    throw "Verification failed (exit $LASTEXITCODE)."
}

