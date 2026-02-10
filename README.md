# xhs-skill

以 Skill 为核心的小红书工作流仓库（Node.js）。

## 定位

- 只做「技能编排与本地小工具（CLI）」：沉淀可复用的 `skills/<name>/SKILL.md`。
- 不做复杂浏览器自动化实现：任何网页点击/输入/截图/登录/上传等操作，统一交给 `agent-browser` skill。
- 面向 OpenClaw：`skills/` + `SKILL.md` frontmatter 约束对齐 OpenClaw/AgentSkills 加载方式。

## 安装

```bash
cd /Users/leo/github.com/xhs-skill
npm i
```

## 核心流程（扫码登录 + 保存 cookies）

1. 用 `agent-browser` 打开登录页 `https://creator.xiaohongshu.com/login`，切到「扫码登录」，截图保存 `data/xhs_login_qr.png`
2. CLI 显示二维码（ASCII）并输出二维码内容：

```bash
node ./bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

3. 登录后用 `agent-browser` 导出 cookies 到 `data/raw_cookies.json`
4. 归一化并保存：

```bash
node ./bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

## CLI

- `xhs-skill qr show --in <pngPath>`: 从 PNG 截图解码二维码并在终端打印二维码
- `xhs-skill cookies normalize --in <json> --out <json>`: 归一化 cookies 导出格式
- `xhs-skill cookies status --in <cookies.json>`: 查看 cookies 概况
- `xhs-skill cookies to-header --in <cookies.json>`: 输出 `Cookie:` header 字符串

## 目录结构

- `skills/`: 每个子目录一个技能（必须包含 `SKILL.md`）
- `bin/` `src/`: Node.js CLI 与本地工具
- `data/`: cookies 等本地数据（gitignored）
- `docs/`: 设计与规范
