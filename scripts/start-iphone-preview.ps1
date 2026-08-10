[CmdletBinding()]
param(
  [int]$Port = 8000,
  [string]$Bind = "0.0.0.0"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SiteRoot = Join-Path $RepoRoot "prototype"
$IndexPath = Join-Path $SiteRoot "index.html"

if (-not (Test-Path -LiteralPath $IndexPath)) {
  throw "prototype/index.html was not found. Run this script from the repository checkout."
}

$PythonCommand = Get-Command python -ErrorAction SilentlyContinue
$UsePyLauncher = $false
if (-not $PythonCommand) {
  $PythonCommand = Get-Command py -ErrorAction SilentlyContinue
  $UsePyLauncher = $true
}
if (-not $PythonCommand) {
  throw "Python was not found. Install Python or run another static server from the prototype folder."
}

function Get-LanAddresses {
  $addresses = @()
  try {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
      } |
      Select-Object -ExpandProperty IPAddress
  } catch {
    $raw = ipconfig | Out-String
    $addresses = [regex]::Matches($raw, "IPv4[^\r\n:]*:\s*([0-9]+(?:\.[0-9]+){3})") |
      ForEach-Object { $_.Groups[1].Value } |
      Where-Object { $_ -notlike "127.*" -and $_ -notlike "169.254.*" }
  }

  $addresses | Sort-Object -Unique
}

$args = @()
if ($UsePyLauncher) {
  $args += "-3"
}
$args += @("-m", "http.server", $Port.ToString(), "--bind", $Bind)

$lanAddresses = Get-LanAddresses

Write-Host ""
Write-Host "Serving 大将戦 prototype from:"
Write-Host "  $SiteRoot"
Write-Host ""
Write-Host "Desktop:"
Write-Host "  http://localhost:$Port/"
if ($lanAddresses.Count -gt 0) {
  Write-Host ""
  Write-Host "iPhone Safari, same Wi-Fi:"
  foreach ($address in $lanAddresses) {
    Write-Host "  http://$address`:$Port/"
  }
} else {
  Write-Host ""
  Write-Host "LAN IP was not detected. Run ipconfig and open http://<IPv4 Address>:$Port/ on iPhone."
}
Write-Host ""
Write-Host "Keep this window open while testing. Press Ctrl+C to stop."
Write-Host "If Windows Firewall asks, allow Private networks."
Write-Host ""

Push-Location -LiteralPath $SiteRoot
try {
  & $PythonCommand.Source @args
} finally {
  Pop-Location
}
