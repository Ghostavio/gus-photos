import { order, localDate, dayNumber, assignPhase } from './order.js';
import { tierPath, fullUrl } from './paths.js';

export function assemble(album, photos, releaseBase) {
  const ordered = order(photos);
  const phases = album.phases || [];
  // Days are anchored on the album's grow start (earliest phase `from`),
  // not the first photo in the batch, so day numbers stay stable across subsets.
  const firstDate = phases.length
    ? phases.reduce((min, p) => (p.from < min ? p.from : min), phases[0].from)
    : localDate(ordered[0].datetime);
  const lastDate = localDate(ordered[ordered.length - 1].datetime);
  const favs = new Set(album.favorites || []);
  const out = ordered.map(p => ({
    ...p,
    day: dayNumber(p.datetime, firstDate),
    phase: assignPhase(p.datetime, phases)?.label || null,
    favorite: favs.has(p.id),
    tiers: {
      thumb: tierPath(album.slug, p.id, 'thumb'),
      view: tierPath(album.slug, p.id, 'view'),
      full: fullUrl(releaseBase, p.id),
    },
  }));
  return { slug: album.slug, firstDate, lastDate, count: out.length,
           lastDay: out[out.length - 1].day, photos: out };
}
