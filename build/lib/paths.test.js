import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierPath, fullUrl } from './paths.js';

test('tierPath builds album-scoped tier paths', () => {
  assert.equal(tierPath('acervo-01', 'IMG_2223', 'thumb'), '/img/acervo-01/IMG_2223.thumb.avif');
  assert.equal(tierPath('acervo-01', 'IMG_2223', 'view'),  '/img/acervo-01/IMG_2223.view.avif');
});

test('fullUrl points at the Release', () => {
  assert.equal(
    fullUrl('https://github.com/Ghostavio/gus-photos/releases/download/acervo-01', 'IMG_2223'),
    'https://github.com/Ghostavio/gus-photos/releases/download/acervo-01/IMG_2223.full.avif'
  );
});
