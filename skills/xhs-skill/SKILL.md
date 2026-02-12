---
name: xhs-skill
description: 小红书（创作者中心）登录拿 cookies、发布笔记、导出数据的单一入口技能（浏览器交互委托 agent-browser）
metadata: {"openclaw":{"emoji":"📌","stage":"workflow"}}
---

本技能是 `xhs-*` 的合并版，目标是让用户只需要 `clawhub install xhs-skill` 一次即可开始使用。

约束：

- 所有浏览器交互（打开页面/点击/输入/上传/截图/登录/导出）全部委托 `agent-browser`。
- 所有敏感数据（cookies、导出文件、截图）只落地在本机 `data/` 目录，不要粘贴到聊天里。

执行硬约束（稳定性）：

- 同一 `agent-browser` session 禁止并发操作（串行执行），否则容易触发 `os error 35` 假失败。
- `snapshot` 的 ref 会漂移：关键动作前后必须重抓 `snapshot -i`，并用 `placeholder/role/text` 做二次定位兜底。
- 扫码不等于登录成功；必须做后验校验（见下方 A 节“登录成功判定”）。

## 安装

```bash
clawhub install xhs-skill
cd skills/xhs-skill
npm i
```

说明：`npm i` 仅用于本技能自带的本地 CLI（二维码解码、cookies 工具）。如果你不需要解码二维码/转换 cookies，也可以只用 `agent-browser` 完成扫码与导出。

## 目录约定（本机）

建议在你运行命令的工作目录下准备：

- `data/xhs_login_qr.png`：登录页二维码截图（PNG）
- `data/raw_cookies.json`：导出的原始 cookies（JSON）
- `data/xhs_cookies.json`：归一化后的 cookies（JSON）
- `data/exports/<YYYY-MM-DD>/`：导出数据（CSV/XLSX/截图）
- `data/assets/<YYYY-MM-DD>/`：发布笔记用的图标/配图素材与来源记录

```bash
mkdir -p data
```

## A. 登录（扫码）并保存 cookies

目标：登录小红书创作者中心并导出 cookies，避免频繁重复登录。

1. 用 `agent-browser` 打开登录页：

- `https://creator.xiaohongshu.com/login`
- 若默认展示「手机号/验证码登录」，点击「扫码」切换到二维码视图

2. 让 `agent-browser` 截图保存二维码（PNG）到 `data/xhs_login_qr.png`

3. （可选）用本地 CLI 解码二维码文本并打印 ASCII 二维码：

```bash
node ./bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

OpenClaw 回传规范（强制）：

- 禁止只回传文件路径（例如仅说 `data/xhs_login_qr.png`）。
- 必须先执行 `node ./bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png`，然后把输出的二维码文本 + ASCII 二维码直接发给用户。
- 若会话支持图片渲染，再附上二维码截图绝对路径（或图片附件）作为补充。
- 发完二维码后必须暂停，等待用户确认“已扫码”再继续 cookies 导出。

推荐回传模板：

```text
请用小红书 App 扫这个二维码登录。
二维码文本: <qr_text>
<ASCII QR>
```

4. 用小红书 App 扫码完成登录后，导出 cookies 到 `data/raw_cookies.json`（不走 DevTools）：

```bash
agent-browser cookies --json > ./data/raw_cookies.json
```

5. 归一化 cookies 并保存到 `data/xhs_cookies.json`：

```bash
node ./bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

5.1 推荐用脚本做后验校验（可执行门禁）：

```bash
# 例：先让 agent-browser 记录当前 URL 与后台探测后的 URL
CURRENT_URL="$(agent-browser get url)"
agent-browser open https://creator.xiaohongshu.com/creator/home
PROBE_FINAL_URL="$(agent-browser get url)"

node ./scripts/verify_login.mjs \
  --cookies ./data/xhs_cookies.json \
  --current-url "$CURRENT_URL" \
  --probe-final-url "$PROBE_FINAL_URL" \
  --json
```

登录成功判定（强制）：

- 必须同时满足以下 3 条才可回报“登录完成”：
- 当前 URL 已离开 `/login`
- 可访问创作者后台页面，且不会 401/回跳登录
- cookies 中存在 `web_session`
- 任一条件不满足，必须回报“登录失败/未完成”，并重试登录流程；禁止误报成功。

登录结果输出契约（JSON）：

```json
{
  "task": "xhs_login",
  "ok": true,
  "checks": {
    "left_login": true,
    "backend_not_rejected": true,
    "has_web_session": true
  },
  "artifacts": {
    "qr_png": "data/xhs_login_qr.png",
    "raw_cookies": "data/raw_cookies.json",
    "normalized_cookies": "data/xhs_cookies.json"
  }
}
```

失败时 `ok=false`，并给出失败项（例如缺 `web_session`），禁止输出“已完成”。

6. （可选）生成 `Cookie:` header：

```bash
node ./bin/xhs-skill.mjs cookies to-header --in ./data/xhs_cookies.json
```

失败回退：

- 二维码解码失败：通常是没有切到扫码视图或二维码太小，让 `agent-browser` 放大后重新截图（仍为 PNG）。
- cookies 归一化失败：保留原始 `data/raw_cookies.json`，后续再扩展兼容分支。

## B. 发布笔记（图文/视频）

输入（用户提供）：

- 笔记类型：图文 或 视频
- 标题、正文、标签（必填）
- 话题（必填；做热点发布时必须是“今天热点”）
- 图片/视频路径（本机绝对路径优先）
- 图标/配图需求（可选）：关键词、风格（扁平/拟物/线性）、主色、是否透明背景
- 热点来源（必填）：来源名、来源 URL、来源日期（`YYYY-MM-DD`）

发布硬门禁（强制）：

1. 先把发布素材整理为 `data/publish_payload.json`（示例）：

```json
{
  "topic": "今日热点：xxxx",
  "source": {
    "name": "央视新闻",
    "url": "https://example.com/news",
    "date": "2026-02-12"
  },
  "post": {
    "title": "20字内标题示例",
    "body": "不少于 80 字的正文......",
    "tags": ["#热点", "#今日新闻", "#小红书运营"],
    "media": ["/abs/path/cover.png", "/abs/path/card_1.png"]
  }
}
```

2. 发布前必须执行校验脚本：

```bash
# 普通模式
node ./scripts/verify_publish_payload.mjs --in ./data/publish_payload.json --json

# 今天热点模式（强制 source.date = 今天）
node ./scripts/verify_publish_payload.mjs --in ./data/publish_payload.json --mode hot --json
```

3. 只有当校验结果 `ok=true` 才允许进入发布页点击“发布/提交”。
4. 任一校验失败必须中止流程并提示补齐，禁止“只传截图直接发”。

素材准备（可选，省去用户自己找图标/配图）：

1. 用户只给“需求描述”，例如：
- “一个红色爱心线性 icon，透明背景”
- “适合美妆笔记的浅色系贴纸风小图标”
2. 用 `agent-browser` 搜索并挑选 3-5 个候选（优先免版权/可复用来源）。
3. 用 `agent-browser` 直接截图保存到：
- `data/assets/<YYYY-MM-DD>/icons/<name>.png`
- 把来源 URL 追加到：`data/assets/<YYYY-MM-DD>/sources.txt`
4. 进入发布页后按常规上传媒体，并在点击“发布/提交”前设置人工确认点（预览无误再发）。

流程（浏览器侧全部由 `agent-browser` 完成）：

1. 确保已登录（先完成上面的 A，或已有有效登录态）。
2. 准备并校验 `data/publish_payload.json`（必须 `ok=true`）。
3. 打开发布页面（允许路径变化）。
4. 上传媒体（图文多图/视频文件与封面）。
5. 填写标题/正文/话题/标签：
- 标题必须 `8~20` 字（超过 20 字先裁剪或提示用户改短）
- 正文必须 `>= 80` 字
- 标签至少 3 个，且都以 `#` 开头
- 禁止“仅截图素材”直接发布（如只含 `screenshot/login_qr` 等截图文件）
- 正文编辑区按 `ProseMirror` 处理，不要按普通 input 假设
- 每次点击/填写前先刷新 ref，避免 ref 漂移误操作
6. 点击“发布/提交”前暂停，要求用户确认最终预览。
7. 发布后记录结果页 URL；失败时截图并记录错误文案。

发布结果输出契约（JSON）：

```json
{
  "task": "xhs_publish",
  "ok": true,
  "result_url": "https://creator.xiaohongshu.com/....",
  "content_checks": {
    "title_len": 18,
    "body_len": 136,
    "tag_count": 3,
    "topic": "今日热点：xxxx",
    "source_date": "2026-02-12"
  },
  "artifacts": {
    "payload_json": "data/publish_payload.json",
    "media_inputs": ["..."],
    "error_screenshot": null
  }
}
```

发布失败时 `ok=false`，并返回 `error_message`、`error_screenshot` 路径和未通过的 `missing_checks`。

## C. 导出创作者中心数据（CSV/XLSX 或截图）

目标：把创作者中心关键数据导出到 `data/exports/<YYYY-MM-DD>/`，用于后续分析。

1. 确认已登录。
2. 用 `agent-browser` 进入创作者中心的常用分析页（仪表盘/内容分析/粉丝分析）。
3. 每个页面：
- 优先使用页面自带导出（如有）到 `data/exports/<date>/`
- 无导出时：保存关键区块截图到同目录
4. 记录：导出时间范围、口径说明、页面 URL。

## 本地 CLI（本技能自带）

命令：

- `node ./bin/xhs-skill.mjs qr show --in <pngPath>`
- `node ./bin/xhs-skill.mjs cookies normalize --in <jsonPath> --out <outPath>`
- `node ./bin/xhs-skill.mjs cookies status --in <cookiesJsonPath>`
- `node ./bin/xhs-skill.mjs cookies to-header --in <cookiesJsonPath>`
- `node ./scripts/verify_publish_payload.mjs --in <payloadJsonPath> [--mode hot]`
