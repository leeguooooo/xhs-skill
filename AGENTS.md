# Agent Instructions (xhs-skill)

## Project Intent

This repository is **skill-first**.

- Primary deliverables live in `skills/<skill>/SKILL.md`.
- We do **not** implement complex browser automation here.
- Any browser interaction (navigate/click/type/upload/screenshot/login) must be delegated to the `agent-browser-stealth` skill.

## Non-Goals

- No MCP server implementation in this repo.
- No Playwright/Selenium/Puppeteer dependencies.
- No fragile DOM selectors hard-coded in this repo.
- No in-repo publish orchestration scripts (for example `publish_from_payload`).
- Do not use `agent-browser`; use `agent-browser-stealth` only.
- Prefer Node.js for any local tooling (CLI, cookie normalization, QR decode).

## OpenClaw Compatibility

- `skills/` layout must remain compatible with OpenClaw AgentSkills loading.
- `SKILL.md` frontmatter rules:
  - `name` and `description` required
  - `metadata` must be a **single-line JSON object**
  - Avoid multiline YAML values in frontmatter

## Data / Secrets

- All cookies and exports go under `data/`.
- `data/` is gitignored (except `.gitkeep`).
- Never paste cookies/tokens directly into chat logs; write them to `data/`.

## Publish Quality Gates

- Do not claim "100% undetectable AI"; only reduce risk with stricter content checks.
- Require anti-AI style checks (personal perspective + concrete facts, avoid template phrasing).
- Require source traceability fields (`source.evidence_snippet` + `source.key_facts`).
- Require real tags and `post.real_topics` from `data/tag_registry.json`; do not fabricate tags or fake topic hashtags.
