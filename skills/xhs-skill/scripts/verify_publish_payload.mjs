#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { getImageSize } from '../lib/image.mjs';

function usage() {
  return `verify_publish_payload

Usage:
  node ./scripts/verify_publish_payload.mjs --in <payloadJsonPath> [--mode hot] [--json]
  node ./scripts/verify_publish_payload.mjs --in <payloadJsonPath> [--tag-registry ./data/tag_registry.json]

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

const AI_TEMPLATE_PHRASES = [
  '总的来说',
  '综上所述',
  '不难看出',
  '值得注意的是',
  '随着人工智能的发展',
  '随着ai的发展',
  '未来可期',
  '首先',
  '其次',
  '最后',
];

const TAG_PLACEHOLDER_PATTERNS = [
  /^#?(标签|话题|测试|示例|模板)$/i,
  /^#?(test|tag|demo|sample|xxx)$/i,
];

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

function hasLiteralBackslashN(body) {
  const s = String(body || '');
  return s.includes('\\n');
}

function hasSlashNToken(body) {
  const s = String(body || '');
  return /(^|\s)\/n(\s|$)/.test(s);
}

function containsLinkLike(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/https?:\/\//i.test(s)) return true;
  if (/www\./i.test(s)) return true;
  // very rough domain detection; intentionally strict to avoid accidental bans
  if (/\b[a-z0-9-]+\.(com|cn|net|org|io|me|co|app|dev)\b/i.test(s)) return true;
  return false;
}

function normalizeTag(tag) {
  const v = str(tag);
  if (!v) return '';
  return v.startsWith('#') ? v : `#${v}`;
}

function uniqueList(items) {
  const out = [];
  const seen = new Set();
  for (const it of items) {
    const v = str(it);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function parseDateSafe(iso) {
  const s = str(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysSince(isoDate) {
  const d = parseDateSafe(isoDate);
  if (!d) return null;
  const now = new Date();
  const nowAtDay = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`);
  const diff = nowAtDay.getTime() - d.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

async function loadTagRegistry(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    const tagsRaw = Array.isArray(data)
      ? data
      : Array.isArray(data?.tags)
        ? data.tags
        : [];
    const normalized = uniqueList(tagsRaw.map(normalizeTag).filter(Boolean));
    return {
      exists: true,
      path: filePath,
      updated_at: str(data?.updated_at) || null,
      tags: normalized,
    };
  } catch {
    return {
      exists: false,
      path: filePath,
      updated_at: null,
      tags: [],
    };
  }
}

function hasAiTemplateStyle(body) {
  const s = String(body || '').toLowerCase();
  return AI_TEMPLATE_PHRASES.filter((p) => s.includes(p.toLowerCase()));
}

function hasPersonalVoice(body) {
  return /(我|我们|我觉得|我观察|我测了|我试了|我踩坑|我自己|这周我)/.test(String(body || ''));
}

function hasConcreteSignals({ body, sourceName, sourceDate }) {
  const s = String(body || '');
  const digitCount = (s.match(/\d/g) || []).length;
  const hasDateLike = /\d{4}[年\-/.]\d{1,2}[月\-/.]\d{1,2}日?/.test(s) || /\d{1,2}月\d{1,2}日/.test(s);
  const hasAmountLike = /\d+\s*(亿|万|%|美元|人民币|条|家|款|次)/.test(s);
  const hasSourceMention = !!sourceName && s.includes(sourceName);
  const hasWeekMention = /(这周|本周|今天|昨日|刚刚)/.test(s) || (!!sourceDate && s.includes(sourceDate));
  return {
    ok: digitCount >= 2 || hasDateLike || hasAmountLike || hasSourceMention || hasWeekMention,
    value: {
      digit_count: digitCount,
      has_date_like: hasDateLike,
      has_amount_like: hasAmountLike,
      has_source_mention: hasSourceMention,
      has_week_mention: hasWeekMention,
    },
  };
}

function hasPlaceholderTag(tags) {
  const hit = [];
  for (const t of tags) {
    const x = str(t);
    if (!x) continue;
    if (TAG_PLACEHOLDER_PATTERNS.some((re) => re.test(x))) hit.push(x);
  }
  return hit;
}

function isImagePath(p) {
  const s = String(p || '').toLowerCase();
  return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg');
}

async function checkMediaDims(media) {
  const images = media.filter(isImagePath);
  const results = [];
  for (const p of images) {
    try {
      const { width, height, format } = await getImageSize(p);
      const ratio = width / height;
      results.push({ path: p, ok: true, width, height, ratio, format });
    } catch (e) {
      results.push({ path: p, ok: false, error: e?.message || String(e) });
    }
  }

  // Strict-ish: expect portrait 3:4 assets for XHS cards (prefer 1242x1660).
  const ratioTarget = 3 / 4;
  const ratioTol = 0.02;
  const bad = results.filter((r) => r.ok && Math.abs(r.ratio - ratioTarget) > ratioTol);
  const parseFailed = results.filter((r) => !r.ok);

  const hasAny = images.length > 0;
  const ok = !hasAny || (bad.length === 0 && parseFailed.length === 0);

  const perfect = results.filter((r) => r.ok && r.width === 1242 && r.height === 1660);
  return {
    ok,
    value: {
      checked_images: images.length,
      passed: results.filter((r) => r.ok).length,
      parse_failed: parseFailed.length,
      ratio_bad: bad.length,
      perfect_1242x1660: perfect.length,
      details: results.slice(0, 12), // keep output bounded
    },
  };
}

async function buildChecks(payload, mode, { tagRegistry, allowUnverifiedTags }) {
  const topic = str(payload?.topic);
  const sourceName = str(payload?.source?.name);
  const sourceUrl = str(payload?.source?.url);
  const sourceDate = str(payload?.source?.date);

  const title = str(payload?.post?.title);
  const body = str(payload?.post?.body);
  const tagsRaw = pickArray(payload?.post?.tags).map((x) => normalizeTag(x)).filter(Boolean);
  const tags = tagsRaw.filter((x) => x.startsWith('#'));
  const media = pickArray(payload?.post?.media).map((x) => str(x)).filter(Boolean);

  const titleLen = [...title].length;
  const bodyLen = [...body].length;
  const screenshotOnly = media.length > 0 && media.every((x) => isScreenshotLike(x));
  const hotMode = mode === 'hot';
  const hasBackslashN = hasLiteralBackslashN(body);
  const hasSlashN = hasSlashNToken(body);
  const mediaDims = await checkMediaDims(media);
  const linkInTitle = containsLinkLike(title);
  const linkInBody = containsLinkLike(body);
  const linkInTags = tagsRaw.some((t) => containsLinkLike(t));
  const linkInMediaPath = media.some((p) => containsLinkLike(p) || String(p).includes('://'));
  const duplicateTagCount = tagsRaw.length - uniqueList(tagsRaw).length;
  const placeholderTags = hasPlaceholderTag(tagsRaw);
  const aiTemplateHits = hasAiTemplateStyle(body);
  const personalVoice = hasPersonalVoice(body);
  const concreteSignals = hasConcreteSignals({ body, sourceName, sourceDate });
  const registryTagSet = new Set((tagRegistry?.tags || []).map((x) => str(x).toLowerCase()));
  const unverifiedTags = tags.filter((t) => !registryTagSet.has(str(t).toLowerCase()));
  const registryAgeDays = daysSince(tagRegistry?.updated_at);
  const registryFresh = registryAgeDays !== null && registryAgeDays >= 0 && registryAgeDays <= 7;

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
    body_newline_normalized: {
      // Allow literal "\\n" in payload (we can normalize before writing), but forbid "/n" token.
      ok: !hasSlashN,
      value: {
        has_literal_backslash_n: hasBackslashN,
        has_slash_n_token: hasSlashN,
      },
    },
    tags_ok: {
      ok: tags.length >= 3 && tags.length <= 8 && duplicateTagCount === 0,
      value: { count: tags.length, duplicate_count: duplicateTagCount, tags },
    },
    tags_not_placeholder: {
      ok: placeholderTags.length === 0,
      value: {
        hit: placeholderTags,
      },
    },
    tags_from_registry: {
      ok: allowUnverifiedTags || (tagRegistry.exists && registryFresh && unverifiedTags.length === 0),
      value: {
        allow_unverified_tags: allowUnverifiedTags,
        registry_exists: !!tagRegistry.exists,
        registry_path: tagRegistry.path,
        registry_updated_at: tagRegistry.updated_at,
        registry_age_days: registryAgeDays,
        registry_fresh_within_days_7: registryFresh,
        registry_tag_count: tagRegistry.tags.length,
        unverified_tags: unverifiedTags,
      },
    },
    no_links_in_content: {
      ok: !(linkInTitle || linkInBody || linkInTags),
      value: {
        title: linkInTitle,
        body: linkInBody,
        tags: linkInTags,
      },
    },
    no_links_in_media_path: {
      ok: !linkInMediaPath,
      value: linkInMediaPath ? media : null,
    },
    media_ok: {
      ok: media.length >= 1 && !screenshotOnly,
      value: { count: media.length, screenshot_only: screenshotOnly, media },
    },
    media_dim_ok: mediaDims,
    anti_ai_personal_voice: {
      ok: personalVoice,
      value: { has_personal_voice: personalVoice },
    },
    anti_ai_concrete_signals: concreteSignals,
    anti_ai_template_phrase: {
      ok: aiTemplateHits.length === 0,
      value: {
        hit: aiTemplateHits,
      },
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
      'tag-registry': { type: 'string', default: './data/tag_registry.json' },
      'allow-unverified-tags': { type: 'boolean', default: false },
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
  const tagRegistryPath = str(values['tag-registry']) || './data/tag_registry.json';
  const tagRegistry = await loadTagRegistry(tagRegistryPath);
  const allowUnverifiedTags = !!values['allow-unverified-tags'];
  const checks = await buildChecks(payload, mode, { tagRegistry, allowUnverifiedTags });

  const missing = Object.entries(checks)
    .filter(([, item]) => !item.ok)
    .map(([key]) => key);

  const result = {
    task: 'xhs_publish_payload_validate',
    ok: missing.length === 0,
    mode,
    policy: {
      tag_registry_path: tagRegistry.path,
      allow_unverified_tags: allowUnverifiedTags,
      anti_ai_style_required: true,
    },
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
