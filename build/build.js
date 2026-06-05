import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readExif } from './lib/exif.js';
import { assemble } from './lib/manifest.js';
import { makeTiers } from './lib/encode.js';
import { makeVideo } from './lib/video.js';
import { renderAlbum, renderIndex } from './lib/render.js';

const site = JSON.parse(fs.readFileSync('config/site.json', 'utf8'));
const DIST = 'dist';
const expand = p => p.replace(/^~/, os.homedir());
const LIMIT = process.env.GP_LIMIT ? Number(process.env.GP_LIMIT) : Infinity;
const SKIP_ENCODE = process.env.GP_SKIP_ENCODE === '1'; // reuse existing tiers; just re-read EXIF + re-render
const RENDER_ONLY = process.env.GP_RENDER_ONLY === '1'; // reuse existing tiers + manifest; only re-copy assets + re-render HTML

const bonusTiersExist = (slug, id) => ['thumb', 'view', 'full']
  .every(t => fs.existsSync(path.join(DIST, 'img', slug, `${id}.${t}.avif`)));

async function buildBonus(slug, album) {
  const bonusDir = path.join(expand(album.source), 'bonus');
  const configVideos = (album.bonus && album.bonus.videos) || [];
  if (!fs.existsSync(bonusDir)) return { photos: [], videos: configVideos };
  const entries = fs.readdirSync(bonusDir);
  const photoFiles = entries.filter(f => /\.(jpe?g)$/i.test(f)).sort();
  const videoFiles = entries.filter(f => /\.(mov|mp4|m4v)$/i.test(f)).sort();
  const metas = [];
  for (const f of photoFiles) {
    const meta = await readExif(path.join(bonusDir, f));
    if (!meta.datetime) console.warn(`  ⚠ bonus ${meta.id} has no DateTimeOriginal`);
    if (!bonusTiersExist(slug, meta.id)) // skip re-encode on fast re-renders
      await makeTiers(path.join(bonusDir, f), { album: slug, id: meta.id, outDir: path.join(DIST, 'img') });
    metas.push(meta);
  }
  const videos = [];
  for (const f of videoFiles) {
    const id = f.replace(/\.[^.]+$/, '');
    const v = await makeVideo(path.join(bonusDir, f), { album: slug, id, distDir: DIST });
    v.original = `${site.originalsBaseUrl}/${f}`; // pristine .MOV staged on the Release for download
    videos.push(v);
  }
  console.log(`  bonus: ${metas.length} photos, ${videos.length} videos`);
  const photos = metas.length ? assemble(album, metas, site.originalsBaseUrl).photos : [];
  return { photos, videos: [...videos, ...configVideos] };
}

async function buildAlbum(slug) {
  const album = JSON.parse(fs.readFileSync(`albums/${slug}/album.json`, 'utf8'));
  if (RENDER_ONLY) {
    const saved = JSON.parse(fs.readFileSync(`albums/${slug}/manifest.json`, 'utf8'));
    const manifest = assemble(album, saved.photos, site.originalsBaseUrl); // re-apply album.json (phases/favorites) from saved EXIF — no re-encode
    manifest.bonus = await buildBonus(slug, album);
    fs.writeFileSync(`albums/${slug}/manifest.json`, JSON.stringify(manifest, null, 2));
    console.log(`[${slug}] render-only re-assemble (${manifest.count} photos)`);
    fs.mkdirSync(path.join(DIST, slug), { recursive: true });
    fs.writeFileSync(path.join(DIST, slug, 'index.html'), renderAlbum({ album, manifest, site }));
    return { ...album, count: manifest.count, cover: manifest.photos.find(p => p.favorite)?.tiers.thumb || manifest.photos[0].tiers.thumb };
  }
  const srcDir = expand(album.source);
  let files = fs.readdirSync(srcDir).filter(f => /\.(jpe?g)$/i.test(f)).sort();
  if (LIMIT < files.length) {            // even-spanning subset for smoke builds
    const step = files.length / LIMIT;
    files = Array.from({ length: LIMIT }, (_, i) => files[Math.floor(i * step)]);
  }
  console.log(`[${slug}] ${files.length} photos`);
  const photos = [];
  let i = 0;
  for (const f of files) {
    const src = path.join(srcDir, f);
    const meta = await readExif(src);
    if (!meta.datetime) console.warn(`  ⚠ ${meta.id} has no DateTimeOriginal — will sort/group incorrectly`);
    if (!SKIP_ENCODE) await makeTiers(src, { album: slug, id: meta.id, outDir: path.join(DIST, 'img') });
    photos.push(meta);
    if (++i % 25 === 0) console.log(`  …${i}/${files.length}`);
  }
  const manifest = assemble(album, photos, site.originalsBaseUrl);
  manifest.bonus = await buildBonus(slug, album);
  fs.writeFileSync(`albums/${slug}/manifest.json`, JSON.stringify(manifest, null, 2));
  fs.mkdirSync(path.join(DIST, slug), { recursive: true });
  fs.writeFileSync(path.join(DIST, slug, 'index.html'), renderAlbum({ album, manifest, site }));
  return { ...album, count: manifest.count,
           cover: manifest.photos.find(p => p.favorite)?.tiers.thumb || manifest.photos[0].tiers.thumb };
}

async function main() {
  if (!SKIP_ENCODE && !RENDER_ONLY) fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.rmSync(path.join(DIST, 'assets'), { recursive: true, force: true });
  fs.cpSync('site/assets', path.join(DIST, 'assets'), { recursive: true });
  fs.cpSync('site/static', DIST, { recursive: true }); // favicons + webmanifest at the site root
  fs.writeFileSync(path.join(DIST, 'CNAME'), 'gus.photos\n');
  const slugs = fs.readdirSync('albums').filter(s => fs.existsSync(`albums/${s}/album.json`));
  const albums = [];
  for (const s of slugs) albums.push(await buildAlbum(s));
  fs.writeFileSync(path.join(DIST, 'index.html'), renderIndex({ albums, site }));
  console.log('build complete →', DIST);
}
main().catch(e => { console.error(e); process.exit(1); });
