import fs from 'node:fs';
import path from 'node:path';

const T = (name) => fs.readFileSync(path.join('site/templates', name), 'utf8');
const fill = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in map ? map[k] : ''));

export function renderAlbum({ album, manifest, site }) {
  const body = fill(T('album.html'), {
    kicker: album.kicker,
    titleEn: album.title.en, titlePt: album.title.pt,
    introEn: album.intro.en, introPt: album.intro.pt,
    count: String(manifest.count), firstDate: manifest.firstDate,
    lastDate: manifest.lastDate, lastDay: String(manifest.lastDay),
  });
  return fill(T('base.html'), {
    title: album.title.en, path: `/${album.slug}/`, body,
    site: JSON.stringify(site), manifest: JSON.stringify(manifest),
  });
}

export function renderIndex({ albums, site }) {
  const cards = albums.map(a => `<a class="album-card" href="/${a.slug}/">
    <img src="${a.cover}" alt=""><div class="ac-body"><h3>${a.title.en}</h3><p>${a.count} photos</p></div></a>`).join('');
  return fill(T('index.html'), { cards, site: JSON.stringify(site) });
}
