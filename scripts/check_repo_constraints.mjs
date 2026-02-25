#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

function gitLsFiles() {
  return new Promise((resolve, reject) => {
    const p = spawn('git', ['ls-files'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => {
      out += String(d);
    });
    p.stderr.on('data', (d) => {
      err += String(d);
    });
    p.on('close', (code) => {
      if (code === 0) {
        const files = out
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean);
        resolve(files);
        return;
      }
      reject(new Error(err || `git ls-files failed with code ${code}`));
    });
  });
}

const bannedPathPatterns = [
  {
    pattern: /(^|\/)skills\/xhs-skill\/scripts\/publish[_-].*\.m?js$/i,
    reason: 'In-repo publish orchestration scripts are forbidden.',
  },
  {
    pattern: /(^|\/)skills\/xhs-skill\/scripts\/.*from_payload.*\.m?js$/i,
    reason: 'In-repo payload-to-publish orchestration scripts are forbidden.',
  },
];

const codeExtRe = /\.(mjs|cjs|js|ts|mts|cts|jsx|tsx)$/i;
const childProcessRe = /\b(spawn|spawnSync|execFile|execFileSync|exec|execSync)\b/;
const browserBinRe = /agent-browser-stealth/;

async function main() {
  const files = await gitLsFiles();
  const violations = [];
  const existingFiles = [];

  for (const file of files) {
    const abs = path.join(ROOT, file);
    try {
      await access(abs);
      existingFiles.push(file);
    } catch {
      // Deleted or unavailable file in working tree; skip.
    }
  }

  for (const file of existingFiles) {
    for (const rule of bannedPathPatterns) {
      if (rule.pattern.test(file)) {
        violations.push({
          file,
          reason: rule.reason,
        });
      }
    }
  }

  for (const file of existingFiles) {
    if (!codeExtRe.test(file)) continue;
    if (file === 'scripts/check_repo_constraints.mjs') continue;

    const abs = path.join(ROOT, file);
    const text = await readFile(abs, 'utf8');

    // Guardrail: code-level orchestration of agent-browser-stealth is forbidden in this repo.
    if (childProcessRe.test(text) && browserBinRe.test(text)) {
      violations.push({
        file,
        reason: 'Code-level browser orchestration detected. Delegate browser actions to agent-browser-stealth skill workflow, not local scripts.',
      });
    }
  }

  if (violations.length > 0) {
    console.error('Repository constraint check failed:');
    for (const v of violations) {
      console.error(`- ${v.file}: ${v.reason}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Repository constraints check passed.');
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exitCode = 1;
});
