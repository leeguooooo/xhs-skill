---
name: xhs-cli
description: xhs-* 技能依赖的本地 CLI（二维码解码 + cookies 工具；适配 ClawHub install 用户）
metadata: {"openclaw":{"emoji":"🧰","stage":"setup"}}
---

如果你的用户主要通过 `clawhub install` 使用 `xhs-*`，那么需要安装本技能来提供本地 CLI（二维码解码、cookies 归一化等）。因为 ClawHub 上的其他 `xhs-*` 技能默认只包含 `SKILL.md`，不包含仓库根目录的 `bin/` `src/`。

## 安装

```bash
clawhub install xhs-cli
cd skills/xhs-cli
npm i
```

可选：把 `xhs-skill` 命令链接到全局（不做也能用，直接 `node ...` 即可）

```bash
cd skills/xhs-cli
npm link
```

## 命令（直接 node 运行）

二维码截图解码（PNG）：

```bash
node ./skills/xhs-cli/bin/xhs-skill.mjs qr show --in ./data/xhs_login_qr.png
```

cookies 归一化与校验：

```bash
node ./skills/xhs-cli/bin/xhs-skill.mjs cookies normalize --in ./data/raw_cookies.json --out ./data/xhs_cookies.json
node ./skills/xhs-cli/bin/xhs-skill.mjs cookies status --in ./data/xhs_cookies.json
```

生成 `Cookie:` header：

```bash
node ./skills/xhs-cli/bin/xhs-skill.mjs cookies to-header --in ./data/xhs_cookies.json
```

## 约定

- 所有敏感数据（cookies、导出文件、截图）都放在 `data/`，不要粘贴到聊天里，也不要提交到 git。
- `qr show` 仅支持 PNG；二维码解码失败通常是截图不是二维码视图或尺寸太小。
