# ai-awesome

自用 AI CLI 辅助脚本与配置集合。

## Status Line (`claudecode/script/statusline.js`)

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
    "command": "node -e \"const u='https://raw.githubusercontent.com/lonelyman0108/ai-awesome/main/claudecode/script/statusline.js',fs=require('fs'),f=require('os').tmpdir()+'/cc-statusline.js',go=()=>fs.existsSync(f)&&require(f);let a=1/0;try{a=Date.now()-fs.statSync(f).mtimeMs}catch{}a<6e5?go():fetch(u,{signal:AbortSignal.timeout(3000)}).then(r=>r.ok&&r.text()).then(t=>t&&fs.writeFileSync(f,t)).catch(()=>{try{fs.utimesSync(f,new Date,new Date)}catch{}}).finally(go)\"",
    "padding": 0
  }
}
```

---

### Antigravity CLI (`agy`) 配置

> Windows 上 `agy` 通过 `cmd /c` 执行命令时会对 `command` 内的双引号做参数转义，直接写内联 `node -e "..."` 会触发语法错误。推荐使用本仓库提供的无引号本地 loader（`claudecode/script/statusline-loader.js`），全平台通用且同样支持每 10 分钟自动更新主脚本。

#### 1. 下载 loader

**macOS / Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyman0108/ai-awesome/main/claudecode/script/statusline-loader.js \
  -o ~/.gemini/antigravity-cli/statusline.js
```

**Windows (PowerShell)：**

```powershell
irm https://raw.githubusercontent.com/lonelyman0108/ai-awesome/main/claudecode/script/statusline-loader.js `
  -OutFile "$env:USERPROFILE\.gemini\antigravity-cli\statusline.js"
```

#### 2. 启用配置

在 `~/.gemini/antigravity-cli/settings.json` 中添加（将 `<USER>` 替换为本机用户名，避免使用引号）：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:/Users/<USER>/.gemini/antigravity-cli/statusline.js",
    "enabled": true
  }
}
```

macOS / Linux 可直接写：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.gemini/antigravity-cli/statusline.js",
    "enabled": true
  }
}
```

也可以在 `agy` TUI 中直接运行 `/statusline node <loader路径>` 立即热生效。
