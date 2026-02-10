# Skills Guidelines

## SKILL.md frontmatter 约束

- 必填：`name`、`description`
- `metadata`：必须是单行 JSON
- 不要写多行 YAML 数组/对象（部分 OpenClaw 解析器只支持 single-line frontmatter keys）

## 浏览器操作约定

- 所有浏览器交互：调用/委托 `agent-browser` skill
- 本仓库的技能只负责：页面目标、元素识别策略、失败回退、人工确认点

## 本地工具约定（Node.js）

- 所有本地脚本尽量走 `xhs-skill` CLI（`bin/xhs-skill.mjs`）
- Cookies 统一落地：`data/xhs_cookies.json`
- 二维码截图：`data/xhs_login_qr.png`

## 安全

- 不要在技能里引导执行不透明命令
- 不要把 token/cookie 直接粘贴到对话里；落地到 `data/` 并在 .gitignore 中忽略
