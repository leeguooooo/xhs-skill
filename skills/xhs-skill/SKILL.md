---
name: xhs-skill
description: 小红书（创作者中心）登录拿 cookies、发布笔记、导出数据的单一入口技能（浏览器交互委托 agent-browser）
metadata: {"openclaw":{"emoji":"📌","stage":"workflow"}}
---

本技能是 `xhs-*` 的合并版，目标是让用户只需要 `clawhub install xhs-skill` 一次即可开始使用。

约束：

- 所有浏览器交互（打开页面/点击/输入/上传/截图/登录/导出）全部委托 `agent-browser`。
- 所有敏感数据（cookies、导出文件、截图）只落地在本机 `data/` 目录，不要粘贴到聊天里。

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

4. 用小红书 App 扫码完成登录后，导出 cookies 到 `data/raw_cookies.json`（不走 DevTools）：

```bash
agent-browser cookies --json > ./data/raw_cookies.json
```

5. 归一化 cookies 并保存到 `data/xhs_cookies.json`：

```bash
node ./bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

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
- 标题、正文
- 话题（可选）
- 图片/视频路径（本机绝对路径优先）
- 图标/配图需求（可选）：关键词、风格（扁平/拟物/线性）、主色、是否透明背景

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
2. 打开发布页面（允许路径变化）。
3. 上传媒体（图文多图/视频文件与封面）。
4. 填写标题/正文/话题。
5. 点击“发布/提交”前暂停，要求用户确认最终预览。
6. 发布后记录结果页 URL；失败时截图并记录错误文案。

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

