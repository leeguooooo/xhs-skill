# Skills Guidelines

## SKILL.md frontmatter 约束

- 必填：`name`、`description`
- `metadata`：必须是单行 JSON
- 不要写多行 YAML 数组/对象（部分 OpenClaw 解析器只支持 single-line frontmatter keys）

## 浏览器操作约定

- 所有浏览器交互：调用/委托 `agent-browser-stealth` skill
- 本仓库的技能只负责：页面目标、元素识别策略、失败回退、人工确认点
- 禁止在仓库内实现发布编排脚本（打开/填写/点击发布等动作必须由 `agent-browser-stealth` 执行）
- 发布前必须人工确认“真实话题”已在平台内选择，禁止把 `#标签` 直接拼进正文冒充话题

## 内容与标签门禁

- 不追求“绝对不可 AI 识别”，追求“降低 AI 识别风险”
- 正文必须包含个人视角 + 具体事实信号（数字/日期/来源）
- 来源证据必须可追溯：`source.evidence_snippet` + `source.key_facts`
- 标签与 `post.real_topics` 必须来自 `data/tag_registry.json`（建议每日更新，含 source 元信息），禁止占位标签和自造标签

## 本地工具约定（Node.js）

- 所有本地脚本尽量走 `xhs-skill` CLI（`bin/xhs-skill.mjs`）
- Cookies 统一落地：`data/xhs_cookies.json`
- 二维码截图：`data/xhs_login_qr.png`

## 安全

- 不要在技能里引导执行不透明命令
- 不要把 token/cookie 直接粘贴到对话里；落地到 `data/` 并在 .gitignore 中忽略
