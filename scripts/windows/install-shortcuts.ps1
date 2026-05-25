param(
  [string]$ProjectRoot = "",
  [string]$Distro = ""
)

$ErrorActionPreference = "Stop"

function Convert-ToWslPath {
  param([string]$Path)

  $normalized = $Path.TrimEnd("\")

  if ($normalized -match "^\\\\wsl(?:\.localhost|\$)\\([^\\]+)\\(.+)$") {
    $script:ResolvedDistro = $matches[1]
    return "/" + ($matches[2] -replace "\\", "/")
  }

  $converted = & wsl.exe wslpath -a "$normalized" 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($converted)) {
    throw "Failed to resolve WSL project path from: $Path"
  }

  return $converted.Trim()
}

function Escape-SingleQuotedPowerShellString {
  param([string]$Value)
  return $Value.Replace("'", "''")
}

function Write-Launcher {
  param(
    [string]$Path,
    [string]$WslProjectRoot,
    [string]$Mode
  )

  $escapedRoot = Escape-SingleQuotedPowerShellString $WslProjectRoot

  if ($Mode -eq "start") {
    $body = @"
`$ErrorActionPreference = "Continue"
`$projectRoot = '$escapedRoot'

Write-Host "Starting Work Archive through WSL..."
& wsl.exe --cd "`$projectRoot" -- bash -lc "WORK_ARCHIVE_SKIP_OPEN=1 scripts/dev/start-dev.sh compose"
`$devExit = `$LASTEXITCODE
if (`$devExit -ne 0) {
  Write-Host ""
  Write-Host "Work Archive failed to start. Exit code: `$devExit"
  exit `$devExit
}

Write-Host ""
Write-Host "Checking Windows localhost access..."
& curl.exe -fsS --max-time 5 -o NUL "http://localhost:8080"
`$webExit = `$LASTEXITCODE
& curl.exe -fsS --max-time 5 -o NUL "http://localhost:3000/health"
`$apiExit = `$LASTEXITCODE

if (`$webExit -eq 0 -and `$apiExit -eq 0) {
  Start-Process "http://localhost:8080"
  Write-Host "Work Archive is running."
  Write-Host "Web: http://localhost:8080"
  Write-Host "API: http://localhost:3000/health"
  return
}

Write-Host "Work Archive started in WSL, but Windows cannot reach one or more localhost ports."
Write-Host "Checked endpoints:"
Write-Host "  http://localhost:8080 result=`$webExit"
Write-Host "  http://localhost:3000/health result=`$apiExit"
Write-Host ""
Write-Host "Services may still be running. Use Stop Work Archive to stop them."
exit 1
"@
  } else {
    $body = @"
`$ErrorActionPreference = "Continue"
`$projectRoot = '$escapedRoot'

Write-Host "Stopping Work Archive through WSL..."
& wsl.exe --cd "`$projectRoot" -- bash -lc "scripts/dev/stop-dev.sh"
`$devExit = `$LASTEXITCODE
if (`$devExit -ne 0) {
  Write-Host ""
  Write-Host "Work Archive stop failed. Exit code: `$devExit"
  exit `$devExit
}

Write-Host "Work Archive stopped."
"@
  }

  Set-Content -LiteralPath $Path -Value $body -Encoding UTF8
}

function New-Shortcut {
  param(
    [string]$ShortcutPath,
    [string]$LauncherPath
  )

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -NoExit -File `"$LauncherPath`""
  $shortcut.WorkingDirectory = Split-Path -Parent $LauncherPath
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,167"
  $shortcut.Save()
}

where.exe wsl.exe *> $null
if ($LASTEXITCODE -ne 0) {
  throw "wsl.exe was not found. Install WSL first."
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$script:ResolvedDistro = $Distro
$wslProjectRoot = Convert-ToWslPath $ProjectRoot

$launcherDir = Join-Path $env:LOCALAPPDATA "WorkArchive"
New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null

$startLauncher = Join-Path $launcherDir "Start Work Archive.ps1"
$stopLauncher = Join-Path $launcherDir "Stop Work Archive.ps1"

Write-Launcher -Path $startLauncher -WslProjectRoot $wslProjectRoot -Mode "start"
Write-Launcher -Path $stopLauncher -WslProjectRoot $wslProjectRoot -Mode "stop"

$desktop = [Environment]::GetFolderPath("Desktop")
New-Shortcut -ShortcutPath (Join-Path $desktop "Start Work Archive.lnk") -LauncherPath $startLauncher
New-Shortcut -ShortcutPath (Join-Path $desktop "Stop Work Archive.lnk") -LauncherPath $stopLauncher

Write-Host "Installed Work Archive shortcuts."
Write-Host "WSL project: $wslProjectRoot"
Write-Host "Launchers: $launcherDir"
Write-Host "Desktop:"
Write-Host "  Start Work Archive.lnk"
Write-Host "  Stop Work Archive.lnk"
