# Git Auto-Commit Watcher for Windows (PowerShell)
# Watches tracked and untracked files (excluding ignored/node_modules/dist/build/.env/secrets)
# Debounces for 10 seconds after last change, stages and commits safely

param(
  [string]$RepoPath = "$(Split-Path -Parent (Split-Path -Parent $PSScriptRoot))",
  [int]$DebounceSeconds = 10
)

$ErrorActionPreference = "Stop"

function Test-IsSensitiveFile {
  param([string]$Path)
  $name = Split-Path -Leaf $Path
  if ($name -match "^\.env(\.|$)" -and $name -ne ".env.example") { return $true }
  if ($name -match "credentials|secret" -and $name -match "\.(json|txt|key|pem|pfx|crt)$") { return $true }
  if ($name -match "\.pem$" -or $name -match "\.key$" -and $name -ne "*.example*") { return $true }
  return $false
}

function Start-Watcher {
  Write-Host "Starting Git Auto-Commit Watcher..."
  Write-Host "Repository: $RepoPath"
  Write-Host "Debounce: $DebounceSeconds seconds"
  Write-Host "Press Ctrl+C to stop"

  Set-Location $RepoPath

  $lastChange = Get-Date
  $timerActive = $false

  $watcher = New-Object System.IO.FileSystemWatcher
  $watcher.Path = $RepoPath
  $watcher.IncludeSubdirectories = $true
  $watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, CreationTime, DirectoryName'
  $watcher.EnableRaisingEvents = $true

  $action = {
    $path = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType
    $name = Split-Path -Leaf $path
    if ($name -eq "") { return }
    # Skip .git directory
    if ($path -match "\\\.git(\\|$)") { return }
    # Skip node_modules, dist, build
    if ($path -match "\\node_modules(\\|$)" -or $path -match "\\dist(\\|$)" -or $path -match "\\build(\\|$)") { return }
    if (Test-IsSensitiveFile -Path $path) { 
      Write-Host "[WARN] Sensitive file change detected: $path - will not be auto-staged"
      return
    }
    $global:lastChange = Get-Date
    $global:timerActive = $true
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Change detected: $changeType $path"
  }

  Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action | Out-Null
  Register-ObjectEvent -InputObject $watcher -EventName "Changed" -Action $action | Out-Null
  Register-ObjectEvent -InputObject $watcher -EventName "Renamed" -Action $action | Out-Null
  Register-ObjectEvent -InputObject $watcher -EventName "Deleted" -Action $action | Out-Null

  try {
    while ($true) {
      Start-Sleep -Seconds 1
      if ($timerActive) {
        $elapsed = (New-TimeSpan -Start $lastChange -End (Get-Date)).TotalSeconds
        if ($elapsed -ge $DebounceSeconds) {
          $timerActive = $false
          Commit-Changes
        }
      }
    }
  } finally {
    Unregister-Event -SourceIdentifier * -ErrorAction SilentlyContinue
    $watcher.Dispose()
  }
}

function Commit-Changes {
  Set-Location $RepoPath
  try {
    # Check for sensitive files in working tree
    $status = git status --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Git status failed" }
    if (-not $status) {
      Write-Host "[$(Get-Date -Format 'HH:mm:ss')] No changes to commit"
      return
    }
    # Scan for sensitive files
    foreach ($line in $status) {
      if ($line -match "^\s*[MADRCU?]{1,2}\s+(.+)$") {
        $file = $matches[1].Trim('"')
        if (Test-IsSensitiveFile -Path $file) {
          Write-Host "[ERROR] Sensitive file detected in changes - refusing to commit. File: $file"
          return
        }
      }
    }
    # Add all changes (respects .gitignore)
    git add -A 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "git add failed" }
    # Check if staged changes exist
    git diff --cached --quiet 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "[$(Get-Date -Format 'HH:mm:ss')] No staged changes"
      return
    }
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $msg = "Auto-commit: $timestamp"
    git commit -m $msg 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Committed successfully"
    } else {
      Write-Host "[ERROR] Commit failed"
    }
  } catch {
    Write-Host "[ERROR] $_"
  }
}

Start-Watcher
