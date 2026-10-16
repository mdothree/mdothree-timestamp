// js/auth-ui.js and js/pro-api.js are shared MDOThree files: byte-identical on all 10 surfaces.
// Canonical copy + the same pinned hashes: mdothree/mdo3d shared/mdothree/ (SHARED_HASHES.json, tests/).
// Changing either file means copying it to every surface and updating these hashes in the same change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PINNED = {
  'auth-ui.js': 'e286a9af518964bd8e1a8aaaa419e8c46c43b3c4c0d44177537e1231a6f62a66',
  'pro-api.js': '3d71c6ed0f074763cadf9394717d305bfbaabdeb260dfc16c32b81d46e58c4d4',
};
const js = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js');

for (const [file, hash] of Object.entries(PINNED)) {
  test(`public/js/${file} is the shared MDOThree copy`, () => {
    assert.equal(createHash('sha256').update(readFileSync(path.join(js, file))).digest('hex'), hash);
  });
}
