import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAlbum } from './render.js';

const album = { slug: 'acervo-01', kicker: 'Acervo 01 — 2019',
  title: { en: 'From seed to flower', pt: 'Da semente à flor' },
  intro: { en: 'EN intro', pt: 'PT intro' } };
const manifest = { slug: 'acervo-01', firstDate: '2019-05-31', lastDate: '2019-10-01',
  count: 2, lastDay: 124, photos: [] };
const site = { giscus: { repo: 'x/y' } };

test('renderAlbum injects album data and JSON globals', () => {
  const html = renderAlbum({ album, manifest, site });
  assert.match(html, /From seed to flower/);
  assert.match(html, /Da semente à flor/);
  assert.match(html, /Day 124/);
  assert.match(html, /window\.__MANIFEST__=\{/);
  assert.match(html, /"count":2/);
});
