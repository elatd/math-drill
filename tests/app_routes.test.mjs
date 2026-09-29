import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../app/', import.meta.url));
const root = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const redirect = root.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('root opens the saved language, with an explicit override and preserved URL state', () => {
  assert.ok(redirect);
  for (const [search, saved, hash, expected] of [
    ['', null, '', 'en/'],
    ['', 'ja', '', 'ja/'],
    ['?lang=en&from=home', 'ja', '#play', 'en/?from=home#play'],
    ['?lang=ja', 'en', '', 'ja/'],
  ]) {
    let destination;
    runInNewContext(redirect, {
      URLSearchParams,
      location: { search, hash, replace: (url) => { destination = url; } },
      localStorage: { getItem: () => saved },
    });
    assert.equal(destination, expected);
  }
});

test('root defaults to English when browser storage is unavailable', () => {
  let destination;
  runInNewContext(redirect, {
    URLSearchParams,
    location: { search: '', hash: '', replace: (url) => { destination = url; } },
    localStorage: { getItem: () => { throw new Error('blocked'); } },
  });
  assert.equal(destination, 'en/');
});

test('both language routes include their own game assets', () => {
  for (const lang of ['en', 'ja']) {
    const html = readFileSync(`${app}${lang}/index.html`, 'utf8');
    for (const [, asset] of html.matchAll(/(?:href|src)="(icon\.svg|style\.css|js\/main\.js)"/g)) {
      assert.ok(existsSync(`${app}${lang}/${asset}`), `${lang}/${asset}`);
    }
  }
});
