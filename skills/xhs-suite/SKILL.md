---
name: xhs-suite
description: 小红书技能套件入口与安装导航（建议先安装这个，再按需安装其它 xhs-*）
metadata: {"openclaw":{"emoji":"🧭"}}
---

如果你的用户习惯用 `clawhub install`，推荐把本技能作为唯一入口。它的作用是告诉用户接下来该装哪些 `xhs-*`，以及每个技能分别解决什么问题。

## 快速开始（推荐安装路径）

0. 安装本地 CLI（二维码解码 + cookies 工具，登录/发布/导出会用到）

```bash
clawhub install xhs-cli
cd skills/xhs-cli
npm i
```

1. 安装登录主流程（大多数人只需要这一个）

```bash
clawhub install xhs-login-qr
```

2. 可选：cookies 工具（调试/转换/校验）

```bash
clawhub install xhs-cookie-utils
```

3. 可选：发布笔记（图文/视频）

```bash
clawhub install xhs-publish-note
```

4. 可选：导出创作者中心数据（CSV/XLSX 或截图留存）

```bash
clawhub install xhs-export-creator-data
```

## 技能说明（如何选）

- `xhs-login-qr`
  - 扫码登录 `https://creator.xiaohongshu.com/login`
  - 由 `agent-browser` 截图二维码和导出 cookies，本地 CLI 负责二维码解码与 cookies 归一化落盘
- `xhs-login-cookies`
  - 你已经能导出 cookies（不需要二维码步骤）时用这个
- `xhs-cookie-utils`
  - cookies 归一化、查看 cookies 概况、生成 `Cookie:` header
- `xhs-publish-note`
  - 发布图文/视频笔记（浏览器交互委托 `agent-browser`；本技能只提供流程与校验点）
- `xhs-export-creator-data`
  - 创作者中心数据导出（优先导出 CSV/XLSX，否则截图）

## 关键词（便于在 ClawHub 搜索）

小红书、创作者中心、creator.xiaohongshu.com、扫码登录、二维码、QR、cookies、Cookie header、发布笔记、数据导出、agent-browser、OpenClaw、AgentSkills。
