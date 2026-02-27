# xhs-skill（小红书创作者中心工作流技能）

一句话：用 `agent-browser-stealth` 负责浏览器操作；用本仓库的 Node.js 小工具负责二维码解码、cookies 归一化、以及“发布前门禁校验 + 内容审核”。目标是更省事，但不允许“偷懒式发帖”（只截图就发布）。

关键词（SEO / AI 搜索）：小红书、小红书创作者中心、creator.xiaohongshu.com、扫码登录、二维码、QR、cookies 导出、cookies 归一化、发布笔记、热点发布、OpenClaw、AgentSkills、agent-browser-stealth、ClawHub、XHS、Redbook、Xiaohongshu。

## 项目边界（先说清楚）

- 不引入 Playwright/Selenium/Puppeteer，不写脆弱 DOM selector。
- 打开/点击/输入/上传/截图/导出 cookies 全部委托 `agent-browser-stealth`（本仓库只提供流程与本地校验工具）。
- 仓库内不维护“发布编排脚本”；发布动作只允许通过 `agent-browser-stealth` 执行。
- 禁止使用 `agent-browser`（旧通道已禁用，统一走 `agent-browser-stealth`）。
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

1. `agent-browser-stealth` 打开登录页并切到扫码：`https://creator.xiaohongshu.com/login`
2. `agent-browser-stealth` 截图保存二维码到 `data/xhs_login_qr.png`（必须 PNG）
3. 输出二维码文本 + ASCII（二选一通道不支持发图时，这是强制要求）：

```bash
node ./skills/xhs-skill/bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

4. 扫码后导出 cookies 并归一化：

```bash
agent-browser-stealth cookies --json > ./data/raw_cookies.json
node ./skills/xhs-skill/bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
```

5. 登录后验校验（3 条都过才允许回报“登录完成”）：

```bash
CURRENT_URL="$(agent-browser-stealth get url)"
agent-browser-stealth open https://creator.xiaohongshu.com/creator/home
PROBE_FINAL_URL="$(agent-browser-stealth get url)"

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
  --policy ./skills/xhs-skill/config/verify_publish_policy.json \
  --tag-registry ./data/tag_registry.json \
  --min-registry-tags 12 \
  --require-source-evidence on \
  --strict-anti-ai on \
  --mode hot \
  --json
```

3. 内容审核门禁（分层规则 + AI；不通过禁止发布）：

```bash
node ./skills/xhs-skill/scripts/review_publish_payload.mjs \
  --in ./data/publish_payload.json \
  --policy ./skills/xhs-skill/config/review_policy.json \
  --taxonomy ./skills/xhs-skill/config/review_taxonomy.json \
  --ai-provider auto \
  --require-ai off \
  --mode hot \
  --json
```

4. 仅当校验和审核都返回 `ok=true` 才允许让 `agent-browser-stealth` 进入发布页，填写并点击“发布/提交”。
   校验阈值和词表可在 `skills/xhs-skill/config/verify_publish_policy.json` 调整；审核策略在 `skills/xhs-skill/config/review_policy.json`，分层风险路径在 `skills/xhs-skill/config/review_taxonomy.json`。

5. 浏览器发布动作只通过 `agent-browser-stealth` 执行（本仓库不提供发布脚本）：
- 同一 session 串行执行：打开发布页 -> 上传素材 -> 填写标题/正文/标签。
- 发布前人工确认：在小红书发布页手动选择至少 3 个真实话题，再人工确认最终预览。
- 发布后闭环校验：回到内容管理页确认标题/缩略图变化，必要时重开编辑页读回检查。

## 防封要点（必须执行）

- 节奏：动作之间随机停顿，输入优先 `type --delay`，避免瞬时 `fill`。
- 指纹：固定 `--profile` 并使用 `--headed`，不要每次像新设备。
- 频率：新号更保守；默认建议 `24h <= 3`，两次发布间隔至少 `30` 分钟。
- 行为：先正常浏览再发布，避免“打开页面立即提交”。
- 网络：优先家庭宽带/手机热点，避免机房 IP、频繁切换代理。
- 恢复：被限流后停止自动化，先手动养号 `3~7` 天。

## 反 AI 识别与真实标签门禁（强制）

- 不承诺“100% 不被识别为 AI”，目标是显著降低风险。
- 文案必须通过 `anti_ai` 门禁：需要个人视角、具体事实信号（数字/日期/来源提及），并规避模板腔。
- 发布前必须通过 `review_publish_payload` 审核门禁（`decision=pass`）；默认是规则 + AI 分层审核，输出 `risk_path`、标准化证据和 `review_queue` 信息。
- 文案来源必须可追溯：`source.evidence_snippet` + `source.key_facts` 必填。
- 禁止自动把 `#标签` 直接拼进正文冒充话题。
- 标签和 `post.real_topics` 都必须来自真实话题池 `data/tag_registry.json`（建议每日更新），禁止自造标签。
- 发布前必须在小红书发布页手动选择至少 3 个真实话题，再由 `agent-browser-stealth` 执行最终点击发布。

示例：准备真实标签池

```bash
cat > ./data/tag_registry.json <<'JSON'
{
  "updated_at": "2026-02-24",
  "source": {
    "platform": "xiaohongshu",
    "method": "manual_from_publish_topic_picker",
    "url": "https://creator.xiaohongshu.com/creator/publish"
  },
  "tags": ["#AI热点", "#人工智能", "#行业观察", "#科技新闻", "#AI资讯", "#科技观察"]
}
JSON
```

## 硬门禁标准（用来挡住“低质发布”）

- 登录：离开 `/login` + 后台页不回跳/不 401 + cookies 含 `web_session`
- 发布（热点）：标题 8~20 字 + 正文 >= 80 字 + 标签 >= 3 个 + `real_topics >= 3`（两者都必须命中 `tag_registry`）+ 有媒体且非“仅截图” + 来源名/URL/日期 + `source.evidence_snippet` + `source.key_facts` 齐全（`--mode hot` 要求来源日期=当天）+ anti_ai 门禁通过
- 发布（审核）：`review_publish_payload` 返回 `ok=true` 且 `decision=pass` 才能继续发布；`review/block` 均拦截。

## 命令速查

```bash
# 二维码：截图 -> 文本 + ASCII
node ./skills/xhs-skill/bin/xhs-skill.mjs qr show --in <png>

# cookies：导出 -> 归一化
node ./skills/xhs-skill/bin/xhs-skill.mjs cookies normalize --in <raw.json> --out <xhs.json>

# 登录门禁
node ./skills/xhs-skill/scripts/verify_login.mjs --cookies <xhs.json> --current-url <url> --probe-final-url <url> --json

# 发布门禁（热点）
node ./skills/xhs-skill/scripts/verify_publish_payload.mjs --in <payload.json> --policy ./skills/xhs-skill/config/verify_publish_policy.json --tag-registry ./data/tag_registry.json --min-registry-tags 12 --require-source-evidence on --strict-anti-ai on --mode hot --json

# 内容审核门禁（分层规则 + AI）
node ./skills/xhs-skill/scripts/review_publish_payload.mjs --in <payload.json> --policy ./skills/xhs-skill/config/review_policy.json --taxonomy ./skills/xhs-skill/config/review_taxonomy.json --ai-provider auto --require-ai off --mode hot --json

# 仓库约束检查（防回退）
npm run check:constraints

# 发布动作：请按 skills/xhs-skill/SKILL.md 的 B 节流程，使用 agent-browser-stealth 执行
```

## 发版前 60 秒自检（维护者）

```bash
# 1) 基础检查
npm run check:constraints
npm test

# 2) 确认变更
git status --short

# 3) 发布到 ClawHub（patch）
clawhub sync --all --bump patch --changelog "docs: 补充发版前快速自检清单"
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
