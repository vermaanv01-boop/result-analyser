# Git Auto-Commit Watcher (Windows)

## Setup
1. Ensure Git is installed and configured in the repository.
2. Run PowerShell with appropriate execution policy if needed.

## Start the watcher
```powershell
.\tools\git-auto-commit\start-watcher.ps1
```
Or directly:
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\git-auto-commit\watcher.ps1 -RepoPath . -DebounceSeconds 10
```

## Stop the watcher
```powershell
.\tools\git-auto-commit\stop-watcher.ps1
```
Or simply close the watcher PowerShell window (Ctrl+C).

## Behavior
- Watches tracked and untracked project files recursively.
- Debounces changes for 10 seconds after the last change.
- Automatically stages changes with `git add -A` (respects `.gitignore`).
- Commits with a meaningful timestamped message when staged changes exist.
- Never pushes to GitHub.
- Skips commits when there are no changes.
- Prevents overlapping commits (single commit cycle).

## Exclusions
- `node_modules/`, `dist/`, `build/`
- `.git/` directory
- `.env`, `.env.*` (except `.env.example`), credentials, secrets, `*.pem`, `*.key`
- Files matching credential/secret patterns are never staged; watcher fails safely if detected.

## Troubleshooting
- If the watcher doesn't detect changes on some files, ensure antivirus isn't locking files.
- If commits fail due to hooks, fix issues and changes will be committed on next cycle.
- The watcher only commits; it does not push automatically.
