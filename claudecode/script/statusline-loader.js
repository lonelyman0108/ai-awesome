#!/usr/bin/env node
// Lightweight loader for statusline.js (caches in os.tmpdir() for 10 minutes).
// Useful for Antigravity CLI on Windows where inline `node -e "..."` quotes get escaped by `cmd /c`.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = 'https://raw.githubusercontent.com/lonelyman0108/ai-awesome/main/claudecode/script/statusline.js';
const cache = path.join(os.tmpdir(), 'cc-statusline.js');
const go = () => fs.existsSync(cache) && require(cache);

let age = Infinity;
try { age = Date.now() - fs.statSync(cache).mtimeMs; } catch {}

if (age < 6e5) {
  go();
} else {
  fetch(url, { signal: AbortSignal.timeout(3000) })
    .then(r => r.ok && r.text())
    .then(t => t && fs.writeFileSync(cache, t))
    .catch(() => { try { fs.utimesSync(cache, new Date(), new Date()); } catch {} })
    .finally(go);
}
