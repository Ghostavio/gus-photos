import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readExif } from './exif.js';

test('readExif extracts the fields we display, from a real original', async () => {
  const p = await readExif('build/fixtures/IMG_2223.JPG');
  assert.equal(p.id, 'IMG_2223');
  assert.equal(p.model, 'iPad Pro');
  assert.equal(p.fnumber, '2.2');
  assert.equal(p.exposure, '1/17');
  assert.equal(p.iso, '250');
  assert.equal(p.focal35, '29 mm');
  assert.equal(p.profile, 'Display P3');
  assert.equal(p.datetime, '2019:05:31 21:08:28');
  assert.equal(p.hasProfile, true);
  assert.ok(p.width === 3024 || p.width === 4032);
});
