---
name: xhs-login-cookies
description: 登录并保存小红书 cookies 到 data/xhs_cookies.json（浏览器操作委托 agent-browser；本仓库只做存储与格式归一化）
metadata: {"openclaw":{"emoji":"🍪","stage":"login"}}
---

推荐直接使用 `/xhs-login-qr`（包含二维码获取与 CLI 展示）。

相关技能（安装导航）：

```bash
clawhub install xhs-suite
```

如果你已经能导出 cookies JSON：

1. 让 `agent-browser` 导出 cookies 到 `data/raw_cookies.json`：

```bash
agent-browser cookies --json > {repoRoot}/data/raw_cookies.json
```

2. 在本地归一化并写入 `data/xhs_cookies.json`：

```bash
cd {repoRoot}
node ./bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```
