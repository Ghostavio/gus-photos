import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import { makeTiers } from './encode.js';
const pexec = promisify(execFile);

async function profileOf(f) {
  const { stdout } = await pexec('exiftool', ['-s3', '-ProfileDescription', f]);
  return stdout.trim();
}

test('makeTiers emits 3 AVIF tiers that all preserve Display P3', async () => {
  const out = 'build/fixtures/out';
  fs.rmSync(out, { recursive: true, force: true });
  const tiers = await makeTiers('build/fixtures/IMG_2223.JPG', { album: 'acervo-01', id: 'IMG_2223', outDir: out });
  for (const tier of ['thumb', 'view', 'full']) {
    assert.ok(fs.existsSync(tiers[tier]), `${tier} written`);
    assert.equal(await profileOf(tiers[tier]), 'Display P3', `${tier} keeps P3`);
  }
  const sz = t => fs.statSync(tiers[t]).size;
  assert.ok(sz('thumb') < sz('view') && sz('view') < sz('full'));
});
