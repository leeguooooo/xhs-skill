# xhs-skill（小红书创作者中心工作流技能）

一句话：用 `agent-browser` 负责浏览器操作；用本仓库的 Node.js 小工具负责二维码解码、cookies 归一化、以及“发布前门禁校验”。目标是更省事，但不允许“偷懒式发帖”（只截图就发布）。

关键词（SEO / AI 搜索）：小红书、小红书创作者中心、creator.xiaohongshu.com、扫码登录、二维码、QR、cookies 导出、cookies 归一化、发布笔记、热点发布、OpenClaw、AgentSkills、agent-browser、ClawHub、XHS、Redbook、Xiaohongshu。

## 项目边界（先说清楚）

- 不引入 Playwright/Selenium/Puppeteer，不写脆弱 DOM selector。
- 打开/点击/输入/上传/截图/导出 cookies 全部委托 `agent-browser`（本仓库只提供流程与本地校验工具）。
- cookies/截图/导出文件只落地到本机 `data/`（已 gitignore）。

更多细节与可复用指令模板见：`skills/xhs-skill/SKILL.md`

## 安装（OpenClaw 推荐）

```bash
# OpenClaw 通常从 ~/.codex/skills 加载技能
npx -y clawhub@latest --workdir ~/.codex --dir skills install xhs-skill --force
cd ~/.codex/skills/xhs-skill
npm i
```

（克隆仓库开发）

```bash
npm i
```

## 最小工作流

### 1) 扫码登录并保存 cookies（带后验门禁）

1. `agent-browser` 打开登录页并切到扫码：`https://creator.xiaohongshu.com/login`
2. `agent-browser` 截图保存二维码到 `data/xhs_login_qr.png`（必须 PNG）
3. 输出二维码文本 + ASCII（二选一通道不支持发图时，这是强制要求）：

```bash
node ./skills/xhs-skill/bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

4. 扫码后导出 cookies 并归一化：

```bash
agent-browser cookies --json > ./data/raw_cookies.json
node ./skills/xhs-skill/bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
```

5. 登录后验校验（3 条都过才允许回报“登录完成”）：

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

### 2) 发“今日热点”笔记（发布前强门禁，禁止截图直发）

1. 先生成 `data/publish_payload.json`（包含标题/正文/标签/素材/热点来源）。
2. 热点门禁校验（不通过就必须补齐，禁止继续发布）：

```bash
node ./skills/xhs-skill/scripts/verify_publish_payload.mjs \
  --in ./data/publish_payload.json \
  --mode hot \
  --json
```

3. 仅当返回 `ok=true` 才允许让 `agent-browser` 进入发布页，填写并点击“发布/提交”。

## 硬门禁标准（用来挡住“低质发布”）

- 登录：离开 `/login` + 后台页不回跳/不 401 + cookies 含 `web_session`
- 发布（热点）：标题 8~20 字 + 正文 >= 80 字 + 标签 >= 3 个（且都以 `#` 开头）+ 有媒体且非“仅截图” + 来源名/URL/日期齐全（`--mode hot` 要求来源日期=当天）

## 命令速查

```bash
# 二维码：截图 -> 文本 + ASCII
node ./skills/xhs-skill/bin/xhs-skill.mjs qr show --in <png>

# cookies：导出 -> 归一化
node ./skills/xhs-skill/bin/xhs-skill.mjs cookies normalize --in <raw.json> --out <xhs.json>

# 登录门禁
node ./skills/xhs-skill/scripts/verify_login.mjs --cookies <xhs.json> --current-url <url> --probe-final-url <url> --json

# 发布门禁（热点）
node ./skills/xhs-skill/scripts/verify_publish_payload.mjs --in <payload.json> --mode hot --json
```

## 常见问题（只保留最常见）

- `No QR code detected in PNG`：没切到扫码视图或二维码太小，放大二维码区域后重截（必须 PNG）。
- WhatsApp 看不到二维码：必须回传 `qr_text + ASCII`，不要只发本地图片路径。
- `verify_login` 缺 `web_session`：扫码不等于成功，按门禁标准重试；必要时重新导出 cookies。

## 发布到 ClawHub（维护者用）

```bash
clawhub login
clawhub sync --all --bump patch --changelog "..."
```

## License

MIT，见 `LICENSE`。
