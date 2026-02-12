#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';

import { normalizeCookiesPayload } from '../lib/cookies.mjs';

function usage() {
  return `verify_login

Usage:
  node ./scripts/verify_login.mjs --cookies <cookiesJsonPath> --current-url <url> --probe-final-url <url> [--probe-status <code>] [--json]

Checks (all required):
  1) left /login
  2) backend probe does not end at /login and status != 401 (if provided)
  3) cookies contain web_session
`;
}

function normUrl(v) {
  if (!v) return '';
  return String(v).trim();
}

function isLoginUrl(url) {
  const s = normUrl(url).toLowerCase();
  if (!s) return true;
  return s.includes('/login');
}

function hasWebSessionCookie(cookies) {
  for (const c of cookies) {
    if (!c || typeof c !== 'object') continue;
    if (String(c.name || '').trim() === 'web_session' && String(c.value || '').trim()) {
      return true;
    }
  }
  return false;
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      cookies: { type: 'string' },
      'current-url': { type: 'string' },
      'probe-final-url': { type: 'string' },
      'probe-status': { type: 'string' },
      json: { type: 'boolean', default: true },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  if (!values.cookies) {
    throw new Error('Missing --cookies <cookiesJsonPath>');
  }

  const raw = await readFile(values.cookies, 'utf8');
  const parsed = JSON.parse(raw);
  const normalized = normalizeCookiesPayload(parsed);

  const currentUrl = normUrl(values['current-url']);
  const probeFinalUrl = normUrl(values['probe-final-url']);
  const probeStatusRaw = values['probe-status'];
  const probeStatus = probeStatusRaw ? Number(probeStatusRaw) : null;

  const checks = {
    left_login: {
      ok: !!currentUrl && !isLoginUrl(currentUrl),
      value: currentUrl || null,
    },
    backend_not_rejected: {
      ok:
        !!probeFinalUrl &&
        !isLoginUrl(probeFinalUrl) &&
        (probeStatus === null || probeStatus !== 401),
      value: {
        probe_final_url: probeFinalUrl || null,
        probe_status: Number.isFinite(probeStatus) ? probeStatus : null,
      },
    },
    has_web_session: {
      ok: hasWebSessionCookie(normalized.cookies),
      value: null,
    },
  };

  const missing = Object.entries(checks)
    .filter(([, v]) => !v.ok)
    .map(([k]) => k);

  const result = {
    ok: missing.length === 0,
    checks,
    cookie_count: normalized.cookies.length,
    missing,
  };

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`ok: ${result.ok}`);
    console.log(`missing: ${result.missing.join(', ') || '(none)'}`);
  }

  if (!result.ok) {
    process.exitCode = 2;
  }
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e?.message || String(e));
  process.exitCode = 1;
});

