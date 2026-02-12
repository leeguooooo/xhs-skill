# xhs-skill

面向「小红书创作者中心」的 Skill-first 工作流仓库：沉淀可复用的 OpenClaw/AgentSkills 技能（`skills/*/SKILL.md`），并提供一组本地 Node.js CLI 小工具（二维码 QR 解码、cookies 归一化与校验）。浏览器交互（打开页面、点击、输入、上传、截图、登录、导出 cookies）统一委托 `agent-browser`。

关键词（便于 SEO 与 AI 搜索）：小红书、创作者中心、creator.xiaohongshu.com、扫码登录、二维码、QR code、cookies 导出、cookies 归一化、Cookie header、OpenClaw、AgentSkills、agent-browser、Node.js CLI、工作流、技能包。

当前推荐版本：`xhs-skill@1.0.2`

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

如果你通过 OpenClaw 使用技能（推荐）：

```bash
# 注意：OpenClaw 通常从 ~/.codex/skills 加载技能，不是 ~/clawd/skills
npx -y clawhub@latest --workdir ~/.codex --dir skills install xhs-skill --force --version 1.0.2
cd ~/.codex/skills/xhs-skill
npm i
```

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
node ./skills/xhs-skill/bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

5. 用小红书 App 扫码完成登录后，导出 cookies

- 让 `agent-browser` 导出 cookies 到：`data/raw_cookies.json`
- 支持两种输入：`[...]`（数组）或 `{ "cookies": [...] }`

6. 归一化 cookies 并写入最终文件

```bash
node ./skills/xhs-skill/bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./skills/xhs-skill/bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

7. 推荐执行登录后验校验脚本（门禁）

```bash
CURRENT_URL="$(agent-browser get url)"
agent-browser open https://creator.xiaohongshu.com/creator/home
PROBE_FINAL_URL="$(agent-browser get url)"

node ./skills/xhs-skill/scripts/verify_login.mjs \
  --cookies ./data/xhs_cookies.json \
  --current-url "$CURRENT_URL" \
  --probe-final-url "$PROBE_FINAL_URL" \
  --json
```

## CLI 命令一览（Node.js 本地工具）

> 推荐运行（也方便 ClawHub install 用户统一路径）：`node ./skills/xhs-skill/bin/xhs-skill.mjs ...`
>
> 备注：仓库根目录也保留了同名入口 `node ./bin/xhs-skill.mjs ...`（仅对 clone 仓库用户有意义）。

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
- OpenClaw 只返回了二维码文件路径，没有把二维码发出来
  - 这不算完成登录引导。需要执行 `node ./skills/xhs-skill/bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png`
  - 把命令输出中的 `qr_text` 与 ASCII 二维码直接回传给用户（可选再附图片）
- cookies 解析失败（`Unsupported cookies JSON` / `No cookies parsed`）
  - 先确认导出文件内容是 JSON
  - 优先导出“cookies 数组”；如果工具导出的是对象，请确保结构里有 `cookies` 字段

## OpenClaw/WhatsApp 关键约束（强烈建议）

- 扫码不等于登录成功，必须做后验校验。
- 登录成功标准必须同时满足：
  - 已离开 `/login`
  - 能访问后台页且不 401/不回跳登录
  - cookies 中包含 `web_session`
- 同一 `agent-browser` session 禁止并发操作，避免 `os error 35` 假失败。
- 关键动作前后都要重抓 `snapshot -i`，并用 `placeholder/role/text` 二次定位，避免 ref 漂移。
- WhatsApp 通道通常不能直接发送本地图片路径；二维码必须回传 `qr_text + ASCII`，不要只发 `data/*.png`。

## 结果契约（建议统一）

- 登录结果建议用 JSON 回传：`ok` + 三项校验（`left_login` / `backend_not_rejected` / `has_web_session`）+ 产物路径
- 发布结果建议用 JSON 回传：`ok` + `result_url` + 失败时 `error_message/error_screenshot`
- 禁止“口头成功”但缺少结构化结果

## 发布笔记注意点（高频坑）

- 标题长度：必须 `<= 20` 字，超限先裁剪或改写。
- 正文输入：编辑器通常是 `ProseMirror`，不要按普通 `input/textarea` 处理。
- 发布前：必须设置人工确认点，用户确认预览后再点“发布/提交”。

## Skills 列表（OpenClaw/AgentSkills）

- `skills/xhs-skill/SKILL.md`
  - 单一入口技能（登录拿 cookies、发布笔记、导出数据；浏览器交互委托 agent-browser；附带本地 CLI）

## 目录结构

- `skills/`: 技能目录，每个技能一个子目录，必须包含 `SKILL.md`
- `bin/`、`src/`: Node.js CLI 与本地工具库
- `data/`: cookies、二维码截图、导出结果等本地数据（默认 gitignored；保留 `.gitkeep`）
- `docs/`: 规范与设计说明
- `test/`: Node.js 单元测试（`node --test`）

## 发布到 ClawHub（上传技能，便于检索与安装）

> 注意：ClawHub 上的技能是公开可见的。上传前请确认 `skills/` 下不包含任何 cookies、token、账号信息或私密业务数据。

1. 安装 ClawHub CLI

```bash
npm i -g clawhub
# 或
pnpm add -g clawhub
```

2. 登录

```bash
clawhub login
```

3. 批量同步本仓库所有技能（推荐）

```bash
cd /Users/leo/github.com/xhs-skill

# 先跑一次 dry-run 看将要发布/更新哪些（不依赖 git push，读取的是你本地文件）
clawhub sync --dry-run

# 再执行实际发布（通常会交互确认）
clawhub sync

# 确认无误后可用全自动模式
clawhub sync --all
```

4. 更新发布（带版本 bump 与 changelog，适合 CI 或批量更新）

```bash
cd /Users/leo/github.com/xhs-skill
clawhub sync --all --bump patch --changelog "更新登录扫码流程与 cookies 工具"
```

推荐发布顺序（便于追溯）：

1. `git commit`（先把要发布的变更落到提交）
2. `clawhub sync --dry-run` 确认发布列表
3. `clawhub sync --all --bump patch --changelog "..."` 发布到 ClawHub
4. `git push`（把同一份变更推到 GitHub）

## License

MIT，见 `LICENSE`。
