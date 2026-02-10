---
name: xhs-login-qr
description: 获取小红书登录二维码（由 agent-browser 截图），在 CLI 里显示二维码并完成登录，然后导出并保存 cookies
authors: leo
metadata: {"openclaw":{"emoji":"📷","stage":"login"}}
---

目标：避免重复登录。用一次扫码登录拿到长期可复用的 cookies，并落地保存。

相关技能（安装导航）：

```bash
clawhub install xhs-suite
```

CLI 依赖（ClawHub install 用户必须先装这个）：

```bash
clawhub install xhs-cli
cd skills/xhs-cli
npm i
```

硬约束：

- 任何网页操作（打开页面/切换扫码登录/截图/复制 cookies）全部委托 `agent-browser` skill。
- 本 skill 只负责：步骤编排、文件路径约定、二维码在 CLI 输出、cookies 归一化与存储。

前置：

- 本仓库已安装依赖：`npm i`（在仓库根目录）

流程：

1. 让 `agent-browser` 打开小红书创作者中心登录页 `https://creator.xiaohongshu.com/login`。
2. 如果页面默认展示的是「手机号/验证码登录」，点击页面上的「扫码」切换到「扫码登录」，确保二维码区域可见。
3. 让 `agent-browser` 对当前页面做截图，保存到：`{repoRoot}/data/xhs_login_qr.png`（要求 PNG）。
4. 在本地终端执行（显示二维码 ASCII + 输出二维码内容字符串）：

```bash
cd {repoRoot}
node ./skills/xhs-cli/bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

5. 用户用小红书 App 扫码完成登录。
6. 登录成功后，直接用 `agent-browser` 导出 cookies 到文件（推荐，避免手工 DevTools 导出）：保存到：`{repoRoot}/data/raw_cookies.json`。

```bash
agent-browser cookies --json > {repoRoot}/data/raw_cookies.json
```

7. 归一化并保存最终 cookies：

```bash
cd {repoRoot}
node ./skills/xhs-cli/bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./skills/xhs-cli/bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

8. 可选：生成 `Cookie:` header（用于后续 HTTP 调试/接口调用场景）：

```bash
cd {repoRoot}
node ./skills/xhs-cli/bin/xhs-skill.mjs cookies to-header --in ./data/xhs_cookies.json > ./data/xhs_cookie_header.txt
```

OpenClaw 输出建议：

- 直接输出二维码 ASCII（纯文本，兼容所有 UI）。
- 同时输出二维码图片路径 `data/xhs_login_qr.png`，OpenClaw 若支持附件/图片渲染可展示；不支持时也不影响扫码（用 ASCII 扫）。

失败回退：

- 如果二维码解码失败：让 `agent-browser` 放大二维码区域后重新截图（仍保存 PNG），再重试 `xhs-skill qr show`。
- 如果 cookies 导出格式无法解析：把导出的原始内容保存到 `data/raw_cookies.json`，我再扩展 `cookies normalize` 的兼容分支。

## 可复用命令模板（更省事，尽量少判断）

说明：

- 建议使用独立 session，避免和你平时浏览器上下文串扰：`agent-browser --session xhs ...`
- 下面模板默认在仓库根目录执行（`cd {repoRoot}`）

### A. 一键拿到可解码的二维码截图

```bash
cd {repoRoot}

# 可选：先关掉旧窗口，减少状态干扰
agent-browser --session xhs close || true

# 打开登录页
agent-browser --session xhs set viewport 1440 900
agent-browser --session xhs open https://creator.xiaohongshu.com/login
agent-browser --session xhs wait --load networkidle

# 尝试切到“扫码登录”（如果本来就在扫码态，这一步通常也不会出事）
agent-browser --session xhs find text "扫码" click || true
agent-browser --session xhs wait 800

# 截图 + 立即用 CLI 验证是否能解码（解码成功才算拿到对的截图）
agent-browser --session xhs screenshot ./data/xhs_login_qr.png
node ./skills/xhs-cli/bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

### B. 登录后导出 cookies（不走 DevTools）

```bash
cd {repoRoot}

# 登录完成后直接导出 cookies（JSON）
agent-browser --session xhs cookies --json > ./data/raw_cookies.json

# 归一化并保存为统一格式
node ./skills/xhs-cli/bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./skills/xhs-cli/bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

### C. 二维码解码失败时的低成本重试

```bash
cd {repoRoot}

# 拉大视口再截一次（有时二维码区域太小/模糊会导致解码失败）
agent-browser --session xhs set viewport 1920 1080
agent-browser --session xhs reload
agent-browser --session xhs wait --load networkidle
agent-browser --session xhs find text "扫码" click || true
agent-browser --session xhs wait 800
agent-browser --session xhs screenshot --full ./data/xhs_login_qr.png

node ./skills/xhs-cli/bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```
