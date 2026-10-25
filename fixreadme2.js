const fs = require('fs');
const p = 'C:/Users/Lenovo/OneDrive/Desktop/Student-ranking-system/README.md';
let s = fs.readFileSync(p, 'utf8');
const idx = s.indexOf('## Git Auto-Commit Watcher');
if (idx >= 0) {
  const rep = "## Git Auto-Commit Watcher (Windows)\r\n\r\n- **Location:** `tools/git-auto-commit/`\r\n- **Start:** `powershell -ExecutionPolicy Bypass -File .\\tools\\git-auto-commit\\start-watcher.ps1`\r\n- **Stop:** `powershell -ExecutionPolicy Bypass -File .\\tools\\git-auto-commit\\stop-watcher.ps1` or close the watcher window\r\n- **Behavior:** Watches tracked and untracked project files recursively. Debounces changes for 10 seconds after the last change. Automatically stages with `git add -A` (respects `.gitignore`). Commits with a meaningful timestamped message when staged changes exist. Never pushes automatically.\r\n- **Exclusions:** `node_modules/`, `dist/`, `build/`, `.git/`, `.env`, `.env.local`, `.env.*.local` (except `.env.example`), `*.log`, `*.pem`, `*.key`, `credentials.json`, `secrets.json`.\r\n- **Safety:** Never stages secrets or credentials; fails safely if sensitive files are detected. Skips commits when there are no changes. Prevents overlapping commits. Handles Git errors safely.\r\n\r\n";
  s = s.slice(0, idx) + rep;
  fs.writeFileSync(p, s);
  console.log('done');
} else {
  console.log('not found');
}
