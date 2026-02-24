#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BROWSER_BIN = 'agent-browser-stealth';

function usage() {
  return `publish_from_payload

Goal:
  Read data/publish_payload*.json and run a serial publish flow via agent-browser-stealth:
  warmup -> open publish -> ensure 图文 -> upload -> humanized typing -> (optional) publish -> readback checks.

Usage:
  node ./scripts/publish_from_payload.mjs --payload ./data/publish_payload.json [--mode hot] [--session xhs] [--profile ~/.xhs-profile] [--confirm] [--json]
  node ./scripts/publish_from_payload.mjs --payload ./data/publish_payload.json [--confirm] [--min-interval-minutes 30] [--max-posts-per-day 3] [--rate-log ./data/publish_rate_log.json]
  node ./scripts/publish_from_payload.mjs --payload ./data/publish_payload.json [--humanize on|off] [--headed on|off] [--allow-eval-fallback off] [--ack-real-topics]

Notes:
  - By default this script DOES NOT click "发布". Use --confirm to actually submit.
  - Anti-risk defaults are enabled: headed mode, random pauses, and pre-publish warmup browsing.
  - It never auto-appends hashtags into body; select real topics manually in XHS UI.
  - For stable fingerprints, prefer fixed --profile (especially when using --confirm).
  - It will hard-fail if title/body contain link-like text (http/www/domain).
`;
}

const browserRuntime = {
  profile: '',
  headed: true,
};

function str(v) {
  return String(v || '').trim();
}

function containsLinkLike(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/https?:\/\//i.test(s)) return true;
  if (/www\./i.test(s)) return true;
  if (/\b[a-z0-9-]+\.(com|cn|net|org|io|me|co|app|dev)\b/i.test(s)) return true;
  return false;
}

function normalizeBodyText(body) {
  // JSON payload may contain literal "\\n" (two chars). Convert to actual newlines.
  return String(body || '').replaceAll('\\n', '\n');
}

function uniqHashtags(tags) {
  const out = [];
  const seen = new Set();
  for (const t of tags) {
    const v = str(t);
    if (!v) continue;
    const x = v.startsWith('#') ? v : `#${v}`;
    const k = x.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function parseFirstJsonObject(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try {
    return JSON.parse(s.slice(i, j + 1));
  } catch {
    return null;
  }
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseToggle(value, fallback = true) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return fallback;
  if (['1', 'true', 'on', 'yes', 'y'].includes(s)) return true;
  if (['0', 'false', 'off', 'no', 'n'].includes(s)) return false;
  return fallback;
}

function randInt(min, max) {
  const lo = Math.max(1, Math.floor(min));
  const hi = Math.max(lo, Math.floor(max));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function nowISO() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function isPublishSuccessUrl(url) {
  const s = str(url);
  if (!s) return false;
  return /https?:\/\/creator\.xiaohongshu\.com\/publish\/success(?:[/?#]|$)/i.test(s);
}

async function pollPublishSuccessUrl(
  session,
  {
    maxAttempts = 25,
    intervalMs = 1200,
  } = {}
) {
  const attempts = Math.max(1, toPositiveInt(maxAttempts, 25));
  const interval = Math.max(200, toPositiveInt(intervalMs, 1200));

  let lastUrl = '';
  for (let i = 1; i <= attempts; i++) {
    const r = await ab(session, ['get', 'url'], { allowFail: true });
    const currentUrl = str(r.stdout);
    if (currentUrl) lastUrl = currentUrl;
    if (r.code === 0 && isPublishSuccessUrl(currentUrl)) {
      return {
        ok: true,
        attempts_used: i,
        max_attempts: attempts,
        interval_ms: interval,
        url: currentUrl,
      };
    }
    if (i < attempts) await sleep(interval);
  }

  return {
    ok: false,
    attempts_used: attempts,
    max_attempts: attempts,
    interval_ms: interval,
    last_url: lastUrl || null,
  };
}

async function readJsonSafe(filePath, fallbackValue) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function writeJsonAtomic(filePath, value) {
  const full = path.resolve(filePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function humanPause(session, minMs, maxMs, label) {
  const ms = randInt(minMs, maxMs);
  await ab(session, ['wait', ms], { allowFail: true });
  return { label, wait_ms: ms };
}

async function runWarmupBrowsing(session) {
  const steps = [];

  const runStep = async (label, args) => {
    const r = await ab(session, args, { allowFail: true });
    steps.push({ label, ok: r.code === 0 });
    return r.code === 0;
  };

  await runStep('open_explore', ['open', 'https://www.xiaohongshu.com/explore']);
  await runStep('wait_explore_loaded', ['wait', '--load', 'domcontentloaded']);
  steps.push(await humanPause(session, 6000, 12000, 'dwell_explore_before_scroll'));
  await runStep('scroll_explore_once', ['eval', 'window.scrollTo(0, Math.max(500, Math.floor(window.innerHeight * 0.8))); "ok";']);
  steps.push(await humanPause(session, 5000, 10000, 'dwell_explore_after_scroll'));

  await runStep('open_creator_home', ['open', 'https://creator.xiaohongshu.com/creator/home']);
  await runStep('wait_creator_home_loaded', ['wait', '--load', 'networkidle']);
  steps.push(await humanPause(session, 4000, 9000, 'dwell_creator_home'));

  return steps;
}

function normalizeRateEntries(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray(raw.entries)) return raw.entries;
  return [];
}

function checkPublishRateGate(entries, { profileKey, minIntervalMinutes, maxPostsPerDay }) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const minIntervalMs = minIntervalMinutes * 60 * 1000;

  const own = entries.filter((x) => x && x.profile_key === profileKey && Number.isFinite(Number(x.ts)));
  const ownLast24h = own.filter((x) => Number(x.ts) >= dayAgo).sort((a, b) => Number(a.ts) - Number(b.ts));

  const count24h = ownLast24h.length;
  const latest = ownLast24h.length ? ownLast24h[ownLast24h.length - 1] : null;
  const sinceLastMs = latest ? Math.max(0, now - Number(latest.ts)) : null;

  if (count24h >= maxPostsPerDay) {
    return {
      ok: false,
      reason: 'too_many_posts_24h',
      count_24h: count24h,
      max_posts_per_day: maxPostsPerDay,
    };
  }

  if (sinceLastMs !== null && sinceLastMs < minIntervalMs) {
    return {
      ok: false,
      reason: 'min_interval_not_met',
      minutes_since_last: Math.floor(sinceLastMs / 60000),
      min_interval_minutes: minIntervalMinutes,
      wait_more_minutes: Math.ceil((minIntervalMs - sinceLastMs) / 60000),
    };
  }

  return {
    ok: true,
    count_24h: count24h,
    max_posts_per_day: maxPostsPerDay,
    min_interval_minutes: minIntervalMinutes,
  };
}

function run(cmd, args, { stdinText } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => {
      resolve({ code: code ?? 1, stdout: out, stderr: err });
    });
    if (stdinText) p.stdin.write(stdinText);
    p.stdin.end();
  });
}

async function ab(session, args, { allowFail = false } = {}) {
  const full = [];
  if (browserRuntime.headed) full.push('--headed');
  if (browserRuntime.profile) full.push('--profile', browserRuntime.profile);
  if (session) full.push('--session', session);
  full.push(...args);
  const r = await run(BROWSER_BIN, full);
  if (!allowFail && r.code !== 0) {
    const msg = `${BROWSER_BIN} failed: ${args.join(' ')}\n${r.stderr || r.stdout}`;
    throw new Error(msg.trim());
  }
  return r;
}

function extractRefsFromSnapshotJson(obj) {
  // agent-browser-stealth snapshot --json output formats have changed over time.
  // Newer builds may return: { success:true, data:{ refs:{ e1:{name,role}, ... }, snapshot:"... [ref=e1]" } }
  // Older builds may embed refs as "@e123" tokens inside a tree. Normalize both to "@eN".
  if (obj && typeof obj === 'object' && obj.data && typeof obj.data === 'object') {
    const refsMap = obj.data.refs;
    if (refsMap && typeof refsMap === 'object' && !Array.isArray(refsMap)) {
      const out = [];
      for (const [k, v] of Object.entries(refsMap)) {
        const key = String(k || '').trim();
        if (!/^e\d+$/i.test(key)) continue;
        out.push({
          ref: `@${key}`,
          role: typeof v?.role === 'string' ? v.role : undefined,
          name:
            typeof v?.name === 'string'
              ? v.name
              : typeof v?.text === 'string'
                ? v.text
                : typeof v?.label === 'string'
                  ? v.label
                  : undefined,
        });
      }
      if (out.length) return out;
    }
  }

  const out = [];
  const seen = new Set();
  const maxNodes = 5000;
  let visited = 0;

  const push = (ref, meta) => {
    if (!ref || typeof ref !== 'string') return;
    let r = ref.trim();
    if (/^e\d+$/i.test(r)) r = `@${r}`;
    if (!/^@e\d+$/i.test(r)) return;
    if (seen.has(r)) return;
    seen.add(r);
    out.push({ ref: r, ...meta });
  };

  const walk = (v, meta) => {
    if (visited++ > maxNodes) return;
    if (v === null || v === undefined) return;
    const t = typeof v;
    if (t === 'string') {
      // Sometimes refs appear embedded in strings; capture exact tokens only.
      if (/^(@)?e\d+$/i.test(v.trim())) push(v.trim(), meta);
      return;
    }
    if (t !== 'object') return;

    if (Array.isArray(v)) {
      for (const it of v) walk(it, meta);
      return;
    }

    const nextMeta = { ...meta };
    for (const [k, val] of Object.entries(v)) {
      if (k === 'ref' && typeof val === 'string') push(val, nextMeta);
      if (k === 'role' && typeof val === 'string') nextMeta.role = val;
      if ((k === 'name' || k === 'text' || k === 'label') && typeof val === 'string') nextMeta.name = val;
    }

    for (const val of Object.values(v)) walk(val, nextMeta);
  };

  walk(obj, {});
  return out;
}

function pickBestUploadRef(refs) {
  if (!refs.length) return null;
  const score = (r) => {
    const name = String(r.name || '');
    const role = String(r.role || '').toLowerCase();
    let s = 0;
    if (/上传|选择|添加|导入/.test(name)) s += 5;
    if (/图片|图文|封面|相册|照片/.test(name)) s += 3;
    if (/文件|file/i.test(name)) s += 2;
    if (/视频/.test(name)) s -= 6;
    if (role === 'button') s += 2;
    if (role === 'textbox') s += 1;
    return s;
  };
  let best = refs[0];
  let bestScore = score(best);
  for (const r of refs.slice(1)) {
    const sc = score(r);
    if (sc > bestScore) {
      best = r;
      bestScore = sc;
    }
  }
  return best.ref;
}

async function verifyPayload(payloadPath, mode) {
  const verifyScript = path.join(__dirname, 'verify_publish_payload.mjs');
  const r = await run(process.execPath, [
    verifyScript,
    '--in',
    payloadPath,
    ...(mode ? ['--mode', mode] : []),
    '--json',
  ]);
  const txt = (r.stdout || '').trim();
  const parsed = txt ? parseFirstJsonObject(txt) : null;
  return { code: r.code, result: parsed, raw: { stdout: r.stdout, stderr: r.stderr } };
}

function jsFillProseMirror(body) {
  // Keep it self-contained, no selectors beyond "ProseMirror + contenteditable".
  const b = JSON.stringify(String(body || ''));
  return `
(() => {
  const body = ${b};
  const root =
    document.querySelector('.ProseMirror[contenteditable="true"]') ||
    document.querySelector('[contenteditable="true"].ProseMirror') ||
    document.querySelector('.ProseMirror');
  if (!root) return JSON.stringify({ ok: false, error: 'ProseMirror not found' });
  root.focus();

  // Replace content with <p> per line. This is more stable than execCommand on ProseMirror.
  const lines = body.split('\\n');
  root.innerHTML = '';
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line.length ? line : '\\u00A0';
    root.appendChild(p);
  }

  root.dispatchEvent(new Event('input', { bubbles: true }));
  root.dispatchEvent(new Event('change', { bubbles: true }));

  const readback = (root.innerText || '').trimEnd();
  return JSON.stringify({ ok: true, len: readback.length, has_literal_backslash_n: readback.includes('\\\\n'), readback });
})()
`.trim();
}

function jsReadback() {
  return `
(() => {
  const titleEl =
    document.querySelector('input[maxlength]') ||
    document.querySelector('input[placeholder*="标题"]') ||
    document.querySelector('input[type="text"]');
  const title = titleEl ? String(titleEl.value || '') : '';

  const pm =
    document.querySelector('.ProseMirror[contenteditable="true"]') ||
    document.querySelector('[contenteditable="true"].ProseMirror') ||
    document.querySelector('.ProseMirror');
  const body = pm ? String(pm.innerText || '') : '';

  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).map((i) => ({
    accept: i.accept || '',
    multiple: !!i.multiple,
    disabled: !!i.disabled,
    visible: !!(i.offsetWidth || i.offsetHeight || i.getClientRects().length),
  }));

  return JSON.stringify({ ok: true, title, body, body_len: body.trim().length, file_inputs: fileInputs });
})()
`.trim();
}

function jsSelectBestFileInput({ expectMultiple }) {
  const m = expectMultiple ? 'true' : 'false';
  return `
(() => {
  const expectMultiple = ${m};
  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  if (!inputs.length) return JSON.stringify({ ok: false, error: 'No input[type=file] found' });

  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const norm = (s) => String(s || '').toLowerCase();

  let best = null;
  let bestScore = -1e9;
  let bestIndex = -1;

  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    if (!el) continue;
    const accept = norm(el.accept);
    const disabled = !!el.disabled;
    const multi = !!el.multiple;
    const vis = visible(el);

    let score = 0;
    if (!disabled) score += 5;
    if (accept.includes('image') || accept.includes('png') || accept.includes('jpg') || accept.includes('jpeg')) score += 4;
    if (accept.includes('video') || accept.includes('mp4') || accept.includes('mov')) score -= 8;
    if (expectMultiple && multi) score += 3;
    if (expectMultiple && !multi) score -= 2;
    if (!expectMultiple && !multi) score += 1;
    if (vis) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = el;
      bestIndex = i;
    }
  }

  if (!best) return JSON.stringify({ ok: false, error: 'No suitable file input found' });

  // Tag it so agent-browser-stealth upload can target it reliably.
  best.id = 'xhs_skill_upload_input';
  best.setAttribute('data-xhs-skill', 'upload');

  return JSON.stringify({
    ok: true,
    count: inputs.length,
    chosen: {
      index: bestIndex,
      accept: best.accept || '',
      multiple: !!best.multiple,
      disabled: !!best.disabled,
      visible: ${'!!(best.offsetWidth || best.offsetHeight || best.getClientRects().length)'}
    }
  });
})()
`.trim();
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      payload: { type: 'string' },
      mode: { type: 'string', default: 'normal' },
      session: { type: 'string' },
      profile: { type: 'string' },
      headed: { type: 'string', default: 'on' },
      humanize: { type: 'string', default: 'on' },
      'allow-eval-fallback': { type: 'string', default: 'off' },
      'min-interval-minutes': { type: 'string', default: '30' },
      'max-posts-per-day': { type: 'string', default: '3' },
      'rate-log': { type: 'string', default: './data/publish_rate_log.json' },
      'ack-real-topics': { type: 'boolean', default: false },
      confirm: { type: 'boolean', default: false },
      json: { type: 'boolean', default: true },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const payloadPath = str(values.payload) || './data/publish_payload.json';
  const mode = str(values.mode || 'normal').toLowerCase();
  const session = str(values.session);
  const profile = str(values.profile);
  const headed = parseToggle(values.headed, true);
  const humanize = parseToggle(values.humanize, true);
  const allowEvalFallback = parseToggle(values['allow-eval-fallback'], false);
  const minIntervalMinutes = toPositiveInt(values['min-interval-minutes'], 30);
  const maxPostsPerDay = toPositiveInt(values['max-posts-per-day'], 3);
  const rateLogPath = str(values['rate-log']) || './data/publish_rate_log.json';
  const ackRealTopics = !!values['ack-real-topics'];
  const publishPollAttempts = 25;
  const publishPollIntervalMs = 1200;
  const confirm = !!values.confirm;
  const warnings = [];

  browserRuntime.profile = profile;
  browserRuntime.headed = headed;

  const antiRisk = {
    headed,
    profile: profile || null,
    humanize,
    allow_eval_fallback: allowEvalFallback,
    ack_real_topics: ackRealTopics,
    min_interval_minutes: minIntervalMinutes,
    max_posts_per_day: maxPostsPerDay,
    rate_log: path.resolve(rateLogPath),
    publish_success_poll: {
      max_attempts: publishPollAttempts,
      interval_ms: publishPollIntervalMs,
    },
  };

  if (confirm && !session && !profile) {
    const out = {
      task: 'xhs_publish_auto',
      ok: false,
      stage: 'risk_gate',
      error: 'Publishing with --confirm requires --session or --profile so fingerprint/session can stay stable.',
      anti_risk: antiRisk,
    };
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
    return;
  }

  if (confirm && !profile) {
    warnings.push('No --profile provided. Prefer fixed profile to reduce new-device risk.');
  }

  // 1) Validate payload (gate)
  const verified = await verifyPayload(payloadPath, mode === 'hot' ? 'hot' : 'normal');
  if (!verified.result || verified.result.ok !== true) {
    const out = {
      task: 'xhs_publish_auto',
      ok: false,
      stage: 'payload_validate',
      payload: payloadPath,
      verify: verified.result,
    };
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
    return;
  }

  // 2) Load payload
  const raw = await readFile(payloadPath, 'utf8');
  const payload = JSON.parse(raw);
  const title = str(payload?.post?.title);
  const media = Array.isArray(payload?.post?.media) ? payload.post.media.map((x) => str(x)).filter(Boolean) : [];
  const tags = uniqHashtags(Array.isArray(payload?.post?.tags) ? payload.post.tags : []);
  let body = normalizeBodyText(payload?.post?.body || '');

  // Link ban: absolutely forbid link-like tokens in published fields.
  if (containsLinkLike(title) || containsLinkLike(body) || tags.some((t) => containsLinkLike(t))) {
    const out = {
      task: 'xhs_publish_auto',
      ok: false,
      stage: 'content_gate',
      error: 'Links are forbidden in title/body/tags (risk of ban). Remove http/www/domain-like text.',
    };
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
    return;
  }

  const humanTrace = [];
  if (humanize) {
    const warmup = await runWarmupBrowsing(session);
    humanTrace.push(...warmup);
  }

  // 3) Open publish page
  await ab(session, ['open', 'https://creator.xiaohongshu.com/creator/publish']);
  await ab(session, ['wait', '--load', 'networkidle']);

  // 4) Ensure 图文 mode (best-effort)
  const tryTab = async (name) => {
    await ab(session, ['find', 'role', 'tab', 'click', '--name', name], { allowFail: true });
    await ab(session, ['find', 'text', name, 'click'], { allowFail: true });
  };
  await tryTab('图文');
  await tryTab('图文笔记');

  // 5) Preflight: file input should accept images and allow multiple when needed
  const pre = await ab(session, ['eval', jsReadback()]);
  const preJson = parseFirstJsonObject(pre.stdout) || {};
  const inputs = Array.isArray(preJson.file_inputs) ? preJson.file_inputs : [];
  const anyVisible = inputs.find((x) => x && x.visible);
  if (media.length > 1 && anyVisible && anyVisible.multiple === false) {
    // Likely stuck in video tab. Try switching again.
    await tryTab('图文');
    await ab(session, ['wait', 600]);
  }

  // 6) Upload media
  if (media.length === 0) {
    throw new Error('No media in payload. Refuse to publish without images/videos.');
  }

  // Prefer uploading through an actual <input type="file"> (uploading to a button ref will fail).
  // We first select the best candidate input and tag it with a stable id.
  const sel = await ab(session, ['eval', jsSelectBestFileInput({ expectMultiple: media.length > 1 })], { allowFail: true });
  const selJson = parseFirstJsonObject(sel.stdout) || {};
  if (selJson.ok) {
    await ab(session, ['upload', '#xhs_skill_upload_input', ...media]);
  } else {
    // Fallback: try generic selector (agent-browser-stealth supports CSS selectors here).
    const r = await ab(session, ['upload', 'input[type=file]', ...media], { allowFail: true });
    if (r.code !== 0) {
      throw new Error(
        `Upload failed: no usable input[type=file]. selector_error=${selJson.error || 'unknown'}`
      );
    }
  }

  await ab(session, ['wait', '--load', 'networkidle']);
  await ab(session, ['wait', Math.min(15000, 1000 * Math.max(2, media.length * 2))]);
  if (humanize) humanTrace.push(await humanPause(session, 1200, 3500, 'pause_after_upload'));

  // 7) Fill title (humanized typing first, direct assignment fallback)
  const titleDelay = randInt(65, 120);
  await ab(
    session,
    [
      'eval',
      `(() => {
        const el = document.querySelector('input[placeholder*="标题"]') || document.querySelector('input[maxlength]');
        if (!el) return 'NO_TITLE_INPUT';
        el.focus();
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'OK';
      })()`,
    ],
    { allowFail: true }
  );

  let titleTyped = false;
  const titleAttempts = [
    ['find', 'role', 'textbox', 'type', '--name', '标题', title, '--delay', String(titleDelay)],
    ['find', 'label', '标题', 'type', title, '--delay', String(titleDelay)],
    ['type', 'input[placeholder*="标题"]', title, '--delay', String(titleDelay)],
  ];
  for (const cmd of titleAttempts) {
    const r = await ab(session, cmd, { allowFail: true });
    if (r.code === 0) {
      titleTyped = true;
      break;
    }
  }
  if (!titleTyped) {
    const fillAttempts = [
      ['find', 'role', 'textbox', 'fill', '--name', '标题', title],
      ['fill', 'input[placeholder*="标题"]', title],
    ];
    for (const cmd of fillAttempts) {
      const r = await ab(session, cmd, { allowFail: true });
      if (r.code === 0) {
        titleTyped = true;
        break;
      }
    }
  }
  if (!titleTyped && allowEvalFallback) {
    await ab(
      session,
      [
        'eval',
        `(() => {
          const el = document.querySelector('input[placeholder*="标题"]') || document.querySelector('input[maxlength]');
          if (!el) return 'NO_TITLE_INPUT';
          el.focus();
          el.value = ${JSON.stringify(title)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return 'OK';
        })()`,
      ],
      { allowFail: true }
    );
    titleTyped = true;
  }
  if (!titleTyped) {
    throw new Error(
      'Failed to fill title with human-like typing/fill. Re-run with --allow-eval-fallback on only if necessary.'
    );
  }

  if (humanize) humanTrace.push(await humanPause(session, 900, 2600, 'pause_after_title'));

  // 8) Fill ProseMirror body (humanized typing first) + readback
  await ab(
    session,
    [
      'eval',
      `(() => {
        const root =
          document.querySelector('.ProseMirror[contenteditable="true"]') ||
          document.querySelector('[contenteditable="true"].ProseMirror') ||
          document.querySelector('.ProseMirror');
        if (!root) return 'NO_PM';
        root.focus();
        root.innerHTML = '';
        root.dispatchEvent(new Event('input', { bubbles: true }));
        return 'OK';
      })()`,
    ],
    { allowFail: true }
  );

  const bodyDelay = randInt(55, 95);
  const bodyAttempts = [
    ['type', '.ProseMirror[contenteditable="true"]', body, '--delay', String(bodyDelay)],
    ['type', '.ProseMirror', body, '--delay', String(bodyDelay)],
  ];
  let bodyTyped = false;
  for (const cmd of bodyAttempts) {
    const r = await ab(session, cmd, { allowFail: true });
    if (r.code === 0) {
      bodyTyped = true;
      break;
    }
  }
  if (!bodyTyped && allowEvalFallback) {
    const fill = await ab(session, ['eval', jsFillProseMirror(body)]);
    const fillJson = parseFirstJsonObject(fill.stdout) || {};
    if (!fillJson.ok) {
      throw new Error(`Failed to fill ProseMirror: ${fillJson.error || 'unknown'}`);
    }
    bodyTyped = true;
  }
  if (!bodyTyped) {
    throw new Error(
      'Failed to fill body with human-like typing. Re-run with --allow-eval-fallback on only if necessary.'
    );
  }

  if (humanize) humanTrace.push(await humanPause(session, 1500, 4200, 'pause_after_body'));

  const rb = await ab(session, ['eval', jsReadback()]);
  const rbJson = parseFirstJsonObject(rb.stdout) || {};
  const rbTitle = str(rbJson.title);
  const rbBody = String(rbJson.body || '');

  const rbHasLiteralBackslashN = rbBody.includes('\\n');
  const rbHasLink = containsLinkLike(rbTitle) || containsLinkLike(rbBody) || containsLinkLike(tags.join(' '));

  const contentChecks = {
    title_len: [...rbTitle].length,
    body_len: [...rbBody.trim()].length,
    has_literal_backslash_n: rbHasLiteralBackslashN,
    has_link_like: rbHasLink,
  };

  if (contentChecks.title_len === 0 || contentChecks.body_len < 80) {
    throw new Error('Readback failed: title/body not written correctly (empty or too short). Abort before publish.');
  }
  if (contentChecks.title_len > 20) {
    throw new Error('Readback failed: title > 20 chars. Abort before publish.');
  }
  if (contentChecks.has_literal_backslash_n) {
    throw new Error('Readback failed: body still contains literal "\\\\n". Abort before publish.');
  }
  if (contentChecks.has_link_like) {
    throw new Error('Readback failed: link-like content detected. Abort before publish.');
  }

  // 9) Stop here unless explicitly confirmed
  if (!confirm) {
    const out = {
      task: 'xhs_publish_auto',
      ok: true,
      published: false,
      ready_to_publish: true,
      payload: payloadPath,
      mode,
      content_checks: contentChecks,
      anti_risk: {
        ...antiRisk,
        warnings,
        trace: humanTrace,
      },
      note: 'Select at least 3 real topics in XHS UI, then run again with --confirm --ack-real-topics.',
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (!ackRealTopics) {
    const out = {
      task: 'xhs_publish_auto',
      ok: false,
      stage: 'tag_gate',
      error: 'Real topics not acknowledged. Select at least 3 real XHS topics manually, then re-run with --confirm --ack-real-topics.',
      payload: payloadPath,
      mode,
      anti_risk: {
        ...antiRisk,
        warnings,
        trace: humanTrace,
      },
    };
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
    return;
  }

  const profileKey = profile ? `profile:${path.resolve(profile)}` : `session:${session || 'default'}`;
  const existing = await readJsonSafe(rateLogPath, { entries: [] });
  const entries = normalizeRateEntries(existing);
  const rateGate = checkPublishRateGate(entries, {
    profileKey,
    minIntervalMinutes,
    maxPostsPerDay,
  });
  if (!rateGate.ok) {
    const out = {
      task: 'xhs_publish_auto',
      ok: false,
      stage: 'risk_gate',
      error: `Risk gate blocked publish: ${rateGate.reason}`,
      payload: payloadPath,
      mode,
      anti_risk: {
        ...antiRisk,
        profile_key: profileKey,
        rate_gate: rateGate,
        warnings,
        trace: humanTrace,
      },
    };
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
    return;
  }

  if (humanize) humanTrace.push(await humanPause(session, 2500, 7000, 'pause_before_publish_click'));

  // 10) Click publish (strict button name)
  await ab(session, ['find', 'role', 'button', 'click', '--name', '发布'], { allowFail: true });
  await ab(session, ['find', 'role', 'button', 'click', '--name', '发布笔记'], { allowFail: true });
  await sleep(800);

  const publishPoll = await pollPublishSuccessUrl(session, {
    maxAttempts: publishPollAttempts,
    intervalMs: publishPollIntervalMs,
  });
  if (!publishPoll.ok) {
    const out = {
      task: 'xhs_publish_auto',
      ok: false,
      published: false,
      stage: 'publish_verify',
      error: 'Publish submitted, but success URL was not observed within bounded polling window.',
      result_url: publishPoll.last_url || null,
      payload: payloadPath,
      mode,
      content_checks: contentChecks,
      anti_risk: {
        ...antiRisk,
        profile_key: profileKey,
        rate_gate: rateGate,
        warnings,
        trace: humanTrace,
        publish_success_poll_result: publishPoll,
      },
    };
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
    return;
  }
  const resultUrl = publishPoll.url;
  const publishedAt = nowISO();
  let rateLogUpdated = false;

  try {
    const nextEntries = entries
      .filter((x) => x && Number.isFinite(Number(x.ts)))
      .filter((x) => Date.now() - Number(x.ts) <= 30 * 24 * 60 * 60 * 1000);
    nextEntries.push({
      ts: Date.now(),
      iso: publishedAt,
      profile_key: profileKey,
      mode,
      payload: path.resolve(payloadPath),
      result_url: resultUrl || null,
    });
    await writeJsonAtomic(rateLogPath, { entries: nextEntries.slice(-500) });
    rateLogUpdated = true;
  } catch (e) {
    warnings.push(`Failed to update rate log: ${e?.message || String(e)}`);
  }

  const out = {
    task: 'xhs_publish_auto',
    ok: true,
    published: true,
    verified_after_publish: false,
    result_url: resultUrl || null,
    payload: payloadPath,
    mode,
    content_checks: contentChecks,
    anti_risk: {
      ...antiRisk,
      profile_key: profileKey,
      rate_gate: rateGate,
      rate_log_updated: rateLogUpdated,
      published_at: publishedAt,
      warnings,
      trace: humanTrace,
      publish_success_poll_result: publishPoll,
    },
    warning:
      'Post-publish readback is best-effort and depends on current creator center routes. If needed, open note manager and re-open edit page to verify.',
  };
  console.log(JSON.stringify(out, null, 2));
}

main(process.argv.slice(2)).catch((e) => {
  const out = { task: 'xhs_publish_auto', ok: false, error: e?.message || String(e) };
  try {
    console.log(JSON.stringify(out, null, 2));
  } catch {
    console.log(String(out.error));
  }
  process.exitCode = 1;
});
