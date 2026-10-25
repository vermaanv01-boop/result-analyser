param(
  [int]$DebounceSeconds = 10
)
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script = Join-Path $PSScriptRoot "watcher.ps1"
Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-File", "`"$script`"", "-RepoPath", "`"$repoRoot`"", "-DebounceSeconds", $DebounceSeconds -WindowStyle Normal
Write-Host "Watcher started in new window"
