# xhs-skill

面向「小红书创作者中心」的 Skill-first 工作流仓库：沉淀可复用的 OpenClaw/AgentSkills 技能（`skills/*/SKILL.md`），并提供一组本地 Node.js CLI 小工具（二维码 QR 解码、cookies 归一化与校验）。浏览器交互（打开页面、点击、输入、上传、截图、登录、导出 cookies）统一委托 `agent-browser`。

关键词（便于 SEO 与 AI 搜索）：小红书、创作者中心、creator.xiaohongshu.com、扫码登录、二维码、QR code、cookies 导出、cookies 归一化、Cookie header、OpenClaw、AgentSkills、agent-browser、Node.js CLI、工作流、技能包。

## 你能用它做什么

- 扫码登录小红书创作者中心（`https://creator.xiaohongshu.com/login`），把二维码截图转成可复制的文本并在终端打印 ASCII 二维码
- 从浏览器导出的 cookies JSON（多种导出格式）归一化为统一结构，落地到 `data/xhs_cookies.json`
- 快速查看 cookies 概况（域名、是否 session、最早/最晚过期时间）
- 将 cookies 生成 `Cookie:` header（便于本地调试或临时请求验证）

## 不做什么（项目边界）

- 不实现复杂浏览器自动化：不引入 Playwright/Selenium/Puppeteer，不写脆弱 DOM selector
- 不做登录绕过或黑盒脚本：所有网页点击/输入/截图/导出 cookies 交给 `agent-browser`
- 不在仓库里保存任何 cookies/token：所有敏感数据只写入 `data/`，并由 `.gitignore` 忽略

## 快速开始（扫码登录 + 保存 cookies）

前置要求：

- Node.js >= 18
- 已安装依赖：`npm i`

1. 安装依赖

```bash
cd /Users/leo/github.com/xhs-skill
npm i
```

2. 用 `agent-browser` 打开登录页，并切到「扫码登录」

- 登录页：`https://creator.xiaohongshu.com/login`
- 页面如果默认是「手机号/验证码登录」，需要点击一次「扫码」切换到二维码视图

3. 截图保存二维码（PNG）

- 让 `agent-browser` 截图保存到：`data/xhs_login_qr.png`（必须是 PNG）

4. 用 CLI 解码二维码（输出二维码内容 + ASCII 二维码）

```bash
node ./bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

5. 用小红书 App 扫码完成登录后，导出 cookies

- 让 `agent-browser` 导出 cookies 到：`data/raw_cookies.json`
- 支持两种输入：`[...]`（数组）或 `{ "cookies": [...] }`

6. 归一化 cookies 并写入最终文件

```bash
node ./bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

## CLI 命令一览（Node.js 本地工具）

> 仓库内直接运行：`node ./bin/xhs-skill.mjs ...`

- `xhs-skill qr show --in <pngPath>`
  - 从 PNG 截图解码二维码文本
  - 默认同时打印 ASCII 二维码（便于在终端直接扫码）
- `xhs-skill qr show-text --text <string>`
  - 将一段二维码文本渲染成 ASCII 二维码（不解码图片）
- `xhs-skill cookies normalize --in <jsonPath> --out <outPath>`
  - 归一化 cookies 导出格式，并写入统一格式（`cookie_list_v1`）
- `xhs-skill cookies status --in <cookiesJsonPath>`
  - 输出 cookies 概况（数量、域名、session/persistent、过期时间范围）
- `xhs-skill cookies to-header --in <cookiesJsonPath>`
  - 生成 `Cookie:` header 字符串（用于调试）

## cookies 文件格式（`data/xhs_cookies.json`）

`cookies normalize` 输出格式为：

- `format`: 固定 `cookie_list_v1`
- `generated_at`: ISO 时间戳
- `cookies[]`: 归一化 cookie 列表（`name/value/domain/path/httpOnly/secure/sameSite/expires`）

## 常见问题（Troubleshooting）

- 二维码解码失败（`No QR code detected in PNG`）
  - 原因 1：截图不是二维码视图（仍在手机号登录页），先点「扫码」再截图
  - 原因 2：截图尺寸过小或模糊，让 `agent-browser` 放大二维码区域再截图
  - 原因 3：图片不是 PNG，当前解码仅支持 PNG
- cookies 解析失败（`Unsupported cookies JSON` / `No cookies parsed`）
  - 先确认导出文件内容是 JSON
  - 优先导出“cookies 数组”；如果工具导出的是对象，请确保结构里有 `cookies` 字段

## Skills 列表（OpenClaw/AgentSkills）

- `skills/xhs-login-qr/SKILL.md`
  - 获取登录二维码截图（由 `agent-browser` 完成）+ 本地 CLI 解码 + 登录后导出并归一化 cookies
- `skills/xhs-login-cookies/SKILL.md`
  - 已有 cookies 导出时，直接归一化并保存
- `skills/xhs-cookie-utils/SKILL.md`
  - cookies 归一化、概况查看、生成 `Cookie:` header
- `skills/xhs-publish-note/SKILL.md`
  - 发布图文/视频笔记（浏览器交互委托 `agent-browser`；本仓库只提供流程与校验点）
- `skills/xhs-export-creator-data/SKILL.md`
  - 从创作者中心导出数据（优先导出 CSV/XLSX，或截图留存），产物落地 `data/exports/<YYYY-MM-DD>/`

## 目录结构

- `skills/`: 技能目录，每个技能一个子目录，必须包含 `SKILL.md`
- `bin/`、`src/`: Node.js CLI 与本地工具库
- `data/`: cookies、二维码截图、导出结果等本地数据（默认 gitignored；保留 `.gitkeep`）
- `docs/`: 规范与设计说明
- `test/`: Node.js 单元测试（`node --test`）

## License

MIT，见 `LICENSE`。
