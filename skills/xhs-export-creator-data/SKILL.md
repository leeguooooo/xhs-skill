---
name: xhs-export-creator-data
description: 从小红书创作者中心导出数据（截图/导出 CSV/XLSX；浏览器操作委托 agent-browser）
metadata: {"openclaw":{"emoji":"📊"}}
---

目标：把创作者中心关键数据导出到 `data/exports/<YYYY-MM-DD>/`，用于后续分析。

步骤：

1. 确认已登录（必要时先 `/xhs-login-cookies`）。
2. 调用 `agent-browser` 进入创作者中心：
- 仪表盘概览
- 内容分析
- 粉丝分析
3. 对每个页面：
- 优先尝试页面自带导出（如有）到 `data/exports/<date>/`
- 没有导出时：保存关键区块截图到同目录
4. 记录：导出时间范围、口径说明、页面 URL。

产物：

- `data/exports/<YYYY-MM-DD>/...`
