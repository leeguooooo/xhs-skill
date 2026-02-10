---
name: xhs-login-qr
description: 获取小红书登录二维码（由 agent-browser 截图），在 CLI 里显示二维码并完成登录，然后导出并保存 cookies
authors: leo
metadata: {"openclaw":{"emoji":"📷","stage":"login"}}
---

目标：避免重复登录。用一次扫码登录拿到长期可复用的 cookies，并落地保存。

硬约束：

- 任何网页操作（打开页面/切换扫码登录/截图/复制 cookies）全部委托 `agent-browser` skill。
- 本 skill 只负责：步骤编排、文件路径约定、二维码在 CLI 输出、cookies 归一化与存储。

前置：

- 本仓库已安装依赖：`npm i`（在仓库根目录）

流程：

1. 让 `agent-browser` 打开小红书创作者中心登录页，并切到「扫码登录」二维码可见状态。
2. 让 `agent-browser` 对当前页面做截图，保存到：`{repoRoot}/data/xhs_login_qr.png`（要求 PNG）。
3. 在本地终端执行（显示二维码 ASCII + 输出二维码内容字符串）：

```bash
cd {repoRoot}
node ./bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

4. 用户用小红书 App 扫码完成登录。
5. 登录成功后，让 `agent-browser` 导出 cookies（优先导出 JSON 数组；如果只能导出对象也可以）。保存到：`{repoRoot}/data/raw_cookies.json`。
6. 归一化并保存最终 cookies：

```bash
cd {repoRoot}
node ./bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

7. 可选：生成 `Cookie:` header（用于后续 HTTP 调试/接口调用场景）：

```bash
cd {repoRoot}
node ./bin/xhs-skill.mjs cookies to-header --in ./data/xhs_cookies.json > ./data/xhs_cookie_header.txt
```

OpenClaw 输出建议：

- 直接输出二维码 ASCII（纯文本，兼容所有 UI）。
- 同时输出二维码图片路径 `data/xhs_login_qr.png`，OpenClaw 若支持附件/图片渲染可展示；不支持时也不影响扫码（用 ASCII 扫）。

失败回退：

- 如果二维码解码失败：让 `agent-browser` 放大二维码区域后重新截图（仍保存 PNG），再重试 `xhs-skill qr show`。
- 如果 cookies 导出格式无法解析：把导出的原始内容保存到 `data/raw_cookies.json`，我再扩展 `cookies normalize` 的兼容分支。
