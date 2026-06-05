import fs from 'node:fs';
import path from 'node:path';

const T = (name) => fs.readFileSync(path.join('site/templates', name), 'utf8');
const fill = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in map ? map[k] : ''));
const attr = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); // HTML-attribute escape
const MO_EN_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateBi = iso => { // "2019-05-31" → bilingual: EN "May 31, 2019" / PT "31/05/2019"
  const [Y, M, D] = String(iso).split('-').map(Number);
  return `<span class="en">${MO_EN_FULL[M - 1]} ${D}, ${Y}</span><span class="pt">${String(D).padStart(2, '0')}/${String(M).padStart(2, '0')}/${Y}</span>`;
};

export function renderAlbum({ album, manifest, site }) {
  const body = fill(T('album.html'), {
    kicker: album.kicker,
    titleEn: album.title.en, titlePt: album.title.pt,
    introEn: album.intro.en, introPt: album.intro.pt,
    count: String(manifest.count),
    dateRange: dateBi(manifest.firstDate) + ' – ' + dateBi(manifest.lastDate),
    lastDay: String(manifest.lastDay),
  });
  return fill(T('base.html'), {
    title: attr(album.title.en), path: `/${album.slug}/`, body,
    ogDesc: attr(album.intro.en),
    site: JSON.stringify(site), manifest: JSON.stringify(manifest),
  });
}

export function renderIndex({ albums, site }) {
  // Single-album site for now: redirect the root to the (first) album rather than render a
  // standalone landing page. Carries share tags so the bare gus.photos domain unfurls too.
  const a = albums[0];
  const target = a ? `/${a.slug}/` : '/';
  return fill(T('index.html'), {
    target,
    ogTitle: (a && a.title) ? attr(a.title.en) : 'gus.photos',
    ogDesc: (a && a.intro) ? attr(a.intro.en) : '',
  });
}
