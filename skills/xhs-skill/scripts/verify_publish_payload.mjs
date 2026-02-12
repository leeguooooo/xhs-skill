#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';

function usage() {
  return `verify_publish_payload

Usage:
  node ./scripts/verify_publish_payload.mjs --in <payloadJsonPath> [--mode hot] [--json]

Payload JSON example:
{
  "topic": "今日热点：......",
  "source": {
    "name": "央视新闻",
    "url": "https://...",
    "date": "2026-02-12"
  },
  "post": {
    "title": "标题",
    "body": "正文",
    "tags": ["#热点", "#小红书"],
    "media": ["/abs/path/cover.png"]
  }
}
`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isScreenshotLike(path) {
  if (!path) return false;
  const s = String(path).toLowerCase();
  return (
    s.includes('screenshot') ||
    s.includes('screen_shot') ||
    s.includes('xhs_login') ||
    s.includes('login_qr') ||
    s.includes('after_click')
  );
}

function str(v) {
  return String(v || '').trim();
}

function isValidDateYYYYMMDD(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isHttpUrl(v) {
  return /^https?:\/\//i.test(v);
}

function pickArray(v) {
  return Array.isArray(v) ? v : [];
}

function buildChecks(payload, mode) {
  const topic = str(payload?.topic);
  const sourceName = str(payload?.source?.name);
  const sourceUrl = str(payload?.source?.url);
  const sourceDate = str(payload?.source?.date);

  const title = str(payload?.post?.title);
  const body = str(payload?.post?.body);
  const tagsRaw = pickArray(payload?.post?.tags).map((x) => str(x)).filter(Boolean);
  const tags = tagsRaw.filter((x) => x.startsWith('#'));
  const media = pickArray(payload?.post?.media).map((x) => str(x)).filter(Boolean);

  const titleLen = [...title].length;
  const bodyLen = [...body].length;
  const screenshotOnly = media.length > 0 && media.every((x) => isScreenshotLike(x));
  const hotMode = mode === 'hot';

  const checks = {
    has_topic: {
      ok: topic.length >= 4,
      value: topic || null,
    },
    has_source: {
      ok: !!sourceName && isHttpUrl(sourceUrl) && isValidDateYYYYMMDD(sourceDate),
      value: { name: sourceName || null, url: sourceUrl || null, date: sourceDate || null },
    },
    title_ok: {
      ok: titleLen >= 8 && titleLen <= 20,
      value: { title: title || null, length: titleLen },
    },
    body_ok: {
      ok: bodyLen >= 80,
      value: { length: bodyLen },
    },
    tags_ok: {
      ok: tags.length >= 3,
      value: { count: tags.length, tags },
    },
    media_ok: {
      ok: media.length >= 1 && !screenshotOnly,
      value: { count: media.length, screenshot_only: screenshotOnly, media },
    },
    hot_source_is_today: {
      ok: !hotMode || sourceDate === todayISO(),
      value: { required_date: hotMode ? todayISO() : null, source_date: sourceDate || null },
    },
  };

  return checks;
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      in: { type: 'string' },
      mode: { type: 'string', default: 'normal' },
      json: { type: 'boolean', default: true },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  if (!values.in) {
    throw new Error('Missing --in <payloadJsonPath>');
  }

  const raw = await readFile(values.in, 'utf8');
  const payload = JSON.parse(raw);
  const mode = str(values.mode || 'normal').toLowerCase();
  const checks = buildChecks(payload, mode);

  const missing = Object.entries(checks)
    .filter(([, item]) => !item.ok)
    .map(([key]) => key);

  const result = {
    task: 'xhs_publish_payload_validate',
    ok: missing.length === 0,
    mode,
    checks,
    missing,
  };

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`ok: ${result.ok}`);
    console.log(`missing: ${missing.join(', ') || '(none)'}`);
  }

  if (!result.ok) {
    process.exitCode = 2;
  }
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e?.message || String(e));
  process.exitCode = 1;
});
