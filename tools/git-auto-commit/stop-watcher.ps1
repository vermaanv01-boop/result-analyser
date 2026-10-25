Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object {
  $_.MainWindowTitle -like "*watcher*" -or $_.CommandLine -like "*git-auto-commit*watcher*"
} | ForEach-Object {
  try { Stop-Process $_.Id -Force; Write-Host "Stopped watcher process $($_.Id)" } catch { }
}
Write-Host "Done"
