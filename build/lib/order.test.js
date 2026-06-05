import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalEpoch, order, dayNumber, assignPhase } from './order.js';

test('parseLocalEpoch parses EXIF datetime as naive local seconds', () => {
  const a = parseLocalEpoch('2019:05:31 21:08:27');
  const b = parseLocalEpoch('2019:05:31 21:08:28');
  assert.equal(b - a, 1);
});

test('order sorts by datetime then filename, places composite by its EXIF date', () => {
  const photos = [
    { id: 'IMG_2303', datetime: '2019:06:04 23:18:50' },
    { id: 'IMG_2295', datetime: '2019:06:04 01:05:59' }, // composite, renamed
    { id: 'IMG_2290', datetime: '2019:06:03 23:32:08' },
  ];
  const out = order(photos);
  assert.deepEqual(out.map(p => p.id), ['IMG_2290', 'IMG_2295', 'IMG_2303']);
});

test('dayNumber is 1-based from the first photo local date', () => {
  assert.equal(dayNumber('2019:05:31 21:08:27', '2019:05:31'), 1);
  assert.equal(dayNumber('2019:06:01 09:00:00', '2019:05:31'), 2);
  assert.equal(dayNumber('2019:10:01 23:27:36', '2019:05:31'), 124);
});

test('assignPhase maps a date into the configured phase label', () => {
  const phases = [
    { from: '2019-05-31', to: '2019-06-27', label: { en: 'Germination & Seedling', pt: 'Germinação e Muda' } },
    { from: '2019-06-28', to: '2019-08-24', label: { en: 'Vegetative', pt: 'Vegetativo' } },
  ];
  assert.equal(assignPhase('2019:07:29 09:22:01', phases).label.en, 'Vegetative');
  assert.equal(assignPhase('2019:06:01 09:00:00', phases).label.en, 'Germination & Seedling');
  assert.equal(assignPhase('2030:01:01 00:00:00', phases), null);
});
