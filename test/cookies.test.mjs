import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCookiesPayload, cookiesToHeaderString } from '../src/lib/cookies.mjs';

test('normalizeCookiesPayload accepts array', () => {
  const out = normalizeCookiesPayload([
    { name: 'a', value: 'b', domain: '.xiaohongshu.com', path: '/' },
    { Name: 'c', Value: 'd' },
  ]);
  assert.equal(out.format, 'cookie_list_v1');
  assert.equal(out.cookies.length, 2);
});

test('cookiesToHeaderString', () => {
  const header = cookiesToHeaderString([
    { name: 'a', value: 'b' },
    { name: 'c', value: 'd' },
  ]);
  assert.equal(header, 'a=b; c=d');
});
