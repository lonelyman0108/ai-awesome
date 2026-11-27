# ai-awesome

自用 AI CLI 辅助脚本与配置集合。

## Status Line (`scripts/statusline.js`)

跨平台（Windows / macOS / Linux）两行终端状态栏脚本，同时兼容 **Claude Code** 与 **Antigravity CLI (`agy`)**：

- **第 1 行**：模型与推理强度（effort）、模式/沙箱、Agent、Vim 模式、目录与 Git 状态（分支/超前落后/变更计数）、PR 状态、会话行数与耗时、费用、Prompt Cache 命中率、运行中子代理/后台任务/Artifact 计数
- **第 2 行**：Context 上下文进度条、限额 / Quota 进度条与重置倒计时

依赖：Node.js 18+（使用内置 `fetch`）。

---

### Claude Code 配置

在 `~/.claude/settings.json` 中加入 `statusLine`（每 10 分钟自动从 GitHub 拉取更新并缓存至系统临时目录）：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node -e \"const u='https://raw.githubusercontent.com/lonelyman0108/ai-awesome/main/scripts/statusline.js',fs=require('fs'),f=require('os').tmpdir()+'/cc-statusline.js',go=()=>fs.existsSync(f)&&require(f);let a=1/0;try{a=Date.now()-fs.statSync(f).mtimeMs}catch{}a<6e5?go():fetch(u,{signal:AbortSignal.timeout(3000)}).then(r=>r.ok&&r.text()).then(t=>t&&fs.writeFileSync(f,t)).catch(()=>{try{fs.utimesSync(f,new Date,new Date)}catch{}}).finally(go)\"",
    "padding": 0
  }
}
```

---

### Antigravity CLI (`agy`) 配置

在 `~/.gemini/antigravity-cli/settings.json` 中加入 `statusLine`（同样零本地文件，每 10 分钟自动拉取更新）。

**macOS / Linux**（与 Claude Code 完全一致）：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node -e \"const u='https://raw.githubusercontent.com/lonelyman0108/ai-awesome/main/scripts/statusline.js',fs=require('fs'),f=require('os').tmpdir()+'/cc-statusline.js',go=()=>fs.existsSync(f)&&require(f);let a=1/0;try{a=Date.now()-fs.statSync(f).mtimeMs}catch{}a<6e5?go():fetch(u,{signal:AbortSignal.timeout(3000)}).then(r=>r.ok&&r.text()).then(t=>t&&fs.writeFileSync(f,t)).catch(()=>{try{fs.utimesSync(f,new Date,new Date)}catch{}}).finally(go)\"",
    "padding": 0
  }
}
```

**Windows**（无双引号、无空格、无 `cmd` 元字符，绕过 Windows 版 `agy` 的 `cmd /c` 引号转义问题）：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node -e u='https://raw.githubusercontent.com/lonelyman0108/ai-awesome/main/scripts/statusline.js';fs=require('fs');f=require('os').tmpdir()+'/cc-statusline.js';go=function(){if(fs.existsSync(f))require(f)};a=1/0;try{a=Date.now()-fs.statSync(f).mtimeMs}catch(e){}Math.floor(Math.max(0,a)/6e5)?fetch(u,{signal:AbortSignal.timeout(3000)}).then(function(r){if(r.ok)return(r.text())}).then(function(t){if(t)fs.writeFileSync(f,t)}).catch(function(){try{n=Date.now()/1e3;fs.utimesSync(f,n,n)}catch(e){}}).finally(go):go()",
    "padding": 0
  }
}
```
