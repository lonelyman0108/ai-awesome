#!/usr/bin/env node
// Claude Code & Antigravity CLI status line (2 lines), cross-platform (Windows / macOS / Linux)
// 1: model effort | mode/sandbox | agent | vim | dir | git | PR | session lines & time | cost | cache | tasks
// 2: context bar | rate-limit / quota bars (CC 5h/7d/per-model, AGY quota buckets)
// Per-model limits for CC come from the OAuth usage API, refreshed in a detached background process.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const USAGE_CACHE = path.join(os.tmpdir(), 'cc-statusline-usage.json');
const BG_LOCK = path.join(os.tmpdir(), 'cc-statusline-bg.lock');
const USAGE_TTL = 120 * 1000;
const SCRIPT = __filename;

function readToken() {
  try {
    const f = path.join(os.homedir(), '.claude', '.credentials.json');
    const t = JSON.parse(fs.readFileSync(f, 'utf8')).claudeAiOauth?.accessToken;
    if (t) return t;
  } catch {}
  if (process.platform === 'darwin') {
    try {
      const out = execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
        { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
      return JSON.parse(out.trim()).claudeAiOauth?.accessToken;
    } catch {}
  }
  return null;
}

async function refreshUsage() {
  try {
    const token = readToken();
    if (!token) return;
    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;
    const body = await res.text();
    JSON.parse(body);
    fs.writeFileSync(USAGE_CACHE, body);
  } catch {}
}

function ageMs(f) {
  try { return Date.now() - fs.statSync(f).mtimeMs; } catch { return Infinity; }
}

// refresh the usage cache in a detached process when stale
function kickUsageRefresh() {
  if (ageMs(USAGE_CACHE) <= USAGE_TTL) return;
  if (ageMs(BG_LOCK) > 60 * 1000) { try { fs.unlinkSync(BG_LOCK); } catch {} }
  try {
    fs.writeFileSync(BG_LOCK, '', { flag: 'wx' });
    spawn(process.execPath, [SCRIPT, '--refresh'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch {}
}

function loadUsage() {
  try { return JSON.parse(fs.readFileSync(USAGE_CACHE, 'utf8')); } catch { return null; }
}

// ---------- formatting ----------
const E = '\x1b[';
const C = (code, text) => `${E}${code}m${text}${E}0m`;
const SEP = ` ${C(90, '|')} `;
const levelColor = p => (p >= 80 ? 31 : p >= 50 ? 33 : 32);

// background-colored spaces: always width 1, unlike block glyphs in CJK locales
function bar(pct, width = 10) {
  const p = Math.max(0, Math.min(100, Number(pct)));
  const n = Math.round((p / 100) * width);
  const col = levelColor(p);
  return `${E}${col + 10}m${' '.repeat(n)}${E}100m${' '.repeat(width - n)}${E}0m ` + C(col, `${Math.round(p)}%`);
}

function tok(n) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

function dur(sec) {
  sec = Math.floor(sec);
  if (sec >= 86400) return `${Math.floor(sec / 86400)}d${Math.floor((sec % 86400) / 3600)}h`;
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 60)}m`;
}

function gitInfo(dir) {
  let out;
  try {
    out = execFileSync('git', ['-C', dir, '--no-optional-locks', 'status', '--porcelain=v2', '--branch'],
      { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  } catch { return null; }
  let branch = '', ahead = 0, behind = 0, staged = 0, modified = 0, untracked = 0, conflict = 0, m;
  for (const line of out.split('\n')) {
    if ((m = line.match(/^# branch\.head (.+)$/))) branch = m[1];
    else if ((m = line.match(/^# branch\.ab \+(\d+) -(\d+)/))) { ahead = +m[1]; behind = +m[2]; }
    else if ((m = line.match(/^[12] (.)(.)/))) { if (m[1] !== '.') staged++; if (m[2] !== '.') modified++; }
    else if (line.startsWith('u ')) conflict++;
    else if (line.startsWith('? ')) untracked++;
  }
  if (branch === '(detached)') branch = 'detached';
  let g = C(32, branch);
  if (ahead) g += C(32, ` ^${ahead}`);
  if (behind) g += C(31, ` v${behind}`);
  const chg = [];
  if (staged) chg.push(C(32, `+${staged}`));
  if (modified) chg.push(C(33, `~${modified}`));
  if (untracked) chg.push(C(90, `?${untracked}`));
  if (conflict) chg.push(C(31, `!${conflict}`));
  if (chg.length) g += ' ' + chg.join(' ');
  return g;
}

function render(d) {
  const now = Date.now() / 1000;
  const l1 = [], l2 = [];

  // model
  let model = (d.model?.display_name || '').replace(/ \(.*context\)/, '');
  if (/\[1m\]/.test(d.model?.id || '')) model += ' 1M';
  const tags = [];
  const effort = d.effort?.level || d.model?.effort;
  if (effort && !model.toLowerCase().endsWith(`(${String(effort).toLowerCase()})`)) tags.push(effort);
  if (d.fast_mode) tags.push('fast');
  if (model) l1.push(C('1;35', model) + (tags.length ? ' ' + C(35, `(${tags.join(',')})`) : ''));
  if (d.cycle_mode) {
    const modeCol = { auto: 31, plan: 33, 'accept-edits': 36 }[d.cycle_mode] || 33;
    l1.push(C(modeCol, d.cycle_mode));
  }
  if (d.sandbox?.enabled) l1.push(C(32, 'sandbox'));
  if (d.agent?.name) l1.push(C(34, `@${d.agent.name}`));
  if (d.vim?.mode) l1.push(C('1;33', d.vim.mode));

  // dir + git
  const dir = d.workspace?.current_dir || d.cwd;
  if (dir) {
    l1.push(C(36, path.basename(dir)));
    let g = gitInfo(dir);
    if (g) {
      if (d.worktree?.name) g += C(90, ` wt:${d.worktree.name}`);
      l1.push(g);
    }
  }

  // PR
  if (d.pr?.number) {
    const st = d.pr.review_state;
    const col = { approved: 32, changes_requested: 31, draft: 90 }[st] || 33;
    l1.push(C(col, `PR #${d.pr.number}` + (st ? ` ${st.replace(/_/g, ' ')}` : '')));
  }

  // session lines & time
  const c = d.cost || {};
  const s = [];
  if (c.total_lines_added || c.total_lines_removed) {
    s.push(C(32, `+${c.total_lines_added || 0}`) + ' ' + C(31, `-${c.total_lines_removed || 0}`));
  }
  if (c.total_duration_ms) {
    let t = `time ${dur(c.total_duration_ms / 1000)}`;
    if (c.total_api_duration_ms) t += ` (api ${dur(c.total_api_duration_ms / 1000)})`;
    s.push(C(90, t));
  }
  if (s.length) l1.push(s.join(' '));
  const costUsd = c.total_cost_usd ?? c.total_usd;
  if (costUsd != null) l1.push(C(33, `${c.estimated ? '~' : ''}$${Number(costUsd).toFixed(2)}`));

  // prompt cache
  const pc = d.prompt_cache;
  if (pc && pc.hit_ratio != null && pc.requests) {
    const h = Math.round(pc.hit_ratio * 100);
    let txt = C(37, 'cache ') + C(h >= 80 ? 32 : h >= 50 ? 33 : 31, `${h}%`);
    if (pc.expires_at) {
      const left = pc.expires_at - now;
      txt += C(90, left > 0 ? ` ${dur(left)}` : ' cold');
    }
    l1.push(txt);
  }

  // active subagents / background tasks / artifacts (AGY)
  const act = [];
  const runningSubs = Array.isArray(d.subagents) ? d.subagents.filter(x => x?.status === 'running').length : 0;
  if (runningSubs) act.push(C(34, `sub:${runningSubs}`));
  if (d.task_count) act.push(C(33, `bg:${d.task_count}`));
  if (d.artifact_count) act.push(C(90, `art:${d.artifact_count}`));
  if (act.length) l1.push(act.join(' '));

  // context
  const cw = d.context_window;
  if (cw && cw.used_percentage != null) {
    const u = cw.current_usage;
    const used = u ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) : 0;
    let txt = C(37, 'ctx ') + bar(cw.used_percentage);
    if (used && cw.context_window_size) txt += C(90, ` ${tok(used)}/${tok(cw.context_window_size)}`);
    l2.push(txt);
  }

  // rate limits (CC) & quota buckets (AGY)
  // CC: stdin gives 5h / 7d; usage API adds scoped ones (Fable etc.).
  // Only on a subscription (stdin has rate_limits), so third-party providers don't show stale data.
  const limits = [];
  const labels = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' };
  if (d.rate_limits) {
    for (const [k, v] of Object.entries(d.rate_limits)) {
      if (v?.used_percentage == null) continue;
      limits.push({ name: labels[k] || k.replace(/_/g, ' '), pct: v.used_percentage, reset: v.resets_at || 0 });
    }
    const usage = loadUsage();
    for (const l of usage?.limits || []) {
      if (l.percent == null || l.kind === 'session' || l.kind === 'weekly_all') continue;
      const scope = [l.scope?.model?.display_name, l.scope?.surface].filter(Boolean).join(' ');
      let name = scope || l.kind.replace(/_/g, ' ');
      if (l.group === 'weekly') name = `7d ${name}`;
      limits.push({ name, pct: l.percent, reset: l.resets_at ? Date.parse(l.resets_at) / 1000 : 0 });
    }
  }
  if (d.quota && typeof d.quota === 'object') {
    for (const [k, v] of Object.entries(d.quota)) {
      if (!v || v.disabled) continue;
      const name = k.replace(/[_-]+/g, ' ');
      const reset = v.reset_in_seconds > 0
        ? now + v.reset_in_seconds
        : (v.reset_time ? Date.parse(v.reset_time) / 1000 : 0);
      if (v.remaining_fraction != null) {
        limits.push({ name, pct: (1 - Number(v.remaining_fraction)) * 100, reset });
      } else if (v.remaining_amount != null) {
        limits.push({ name, amount: v.remaining_amount, reset });
      }
    }
  }
  for (const l of limits) {
    let txt = C(37, `${l.name} `) + (l.pct != null ? bar(l.pct) : C(36, String(l.amount)));
    const left = l.reset - now;
    if (l.reset && left > 0) txt += C(90, ` (${dur(left)})`);
    l2.push(txt);
  }

  const out = [l1.join(SEP)];
  if (l2.length) out.push(l2.join(SEP));
  process.stdout.write(out.join('\n'));
}

if (process.argv.includes('--refresh')) {
  refreshUsage().finally(() => { try { fs.unlinkSync(BG_LOCK); } catch {} });
} else {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', ch => (raw += ch));
  process.stdin.on('end', () => {
    let d = {};
    try { d = JSON.parse(raw); } catch {}
    try { render(d); } catch { process.stdout.write(d.model?.display_name || ''); }
    if (d.rate_limits) kickUsageRefresh();
  });
}
