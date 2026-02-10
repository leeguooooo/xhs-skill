---
name: xhs-cookie-utils
description: cookies 转换与校验（本地 CLI；不做浏览器自动化）
metadata: {"openclaw":{"emoji":"🧰"}}
---

能力：

- cookies JSON 导出格式归一化（支持数组或 `{cookies:[...]}`）
- cookies JSON -> `Cookie:` header 字符串（用于部分 HTTP 调试场景）

命令（Node.js）：

- 归一化并写入：

```bash
cd {repoRoot}
node ./bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
```

- 查看 cookies 概况：

```bash
cd {repoRoot}
node ./bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

- 输出 `Cookie:` header：

```bash
cd {repoRoot}
node ./bin/xhs-skill.mjs cookies to-header --in ./data/xhs_cookies.json
```

注意：

- 不要把 cookies 粘贴到公共渠道；尽量只写入 `data/`（已在 `.gitignore` 里忽略）。
