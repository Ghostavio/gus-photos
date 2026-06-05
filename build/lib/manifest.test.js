import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble } from './manifest.js';

const album = {
  slug: 'acervo-01',
  phases: [{ from: '2019-05-31', to: '2019-06-27', label: { en: 'Germination & Seedling', pt: 'Germinação e Muda' } }],
  favorites: ['IMG_2290'],
};
const photos = [
  { id: 'IMG_2303', datetime: '2019:06:04 23:18:50', model: 'iPad Pro', hdr: false, width: 4032, height: 3024 },
  { id: 'IMG_2290', datetime: '2019:06:03 23:32:08', model: 'iPad Pro', hdr: true, width: 4032, height: 3024 },
];

test('assemble orders, numbers days, assigns phases, marks favorites + tiers', () => {
  const m = assemble(album, photos, 'https://rel');
  assert.equal(m.photos[0].id, 'IMG_2290');
  assert.equal(m.photos[0].day, 4);
  assert.equal(m.photos[0].favorite, true);
  assert.equal(m.photos[0].phase.en, 'Germination & Seedling');
  assert.equal(m.photos[0].tiers.thumb, 'img/acervo-01/IMG_2290.thumb.avif');
  assert.equal(m.photos[0].tiers.full, 'https://rel/IMG_2290.full.avif');
  assert.equal(m.firstDate, '2019-05-31');
  assert.equal(m.lastDate, '2019-06-04');
  assert.equal(m.count, 2);
});
