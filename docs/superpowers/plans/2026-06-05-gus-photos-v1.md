# gus.photos v1 ("Acervo 01") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static, color-accurate photo-archive site at `gus.photos` on GitHub Pages, launching with one 500-photo album, designed to add more albums by dropping in originals + a config.

**Architecture:** A local **Node build** reads pristine originals → extracts EXIF (`exiftool`) → generates color-managed **AVIF** tiers (`sharp` resize + `avifenc`, Display-P3 preserved) → writes a `manifest.json` → renders static HTML from templates. Pages serves the site + small tiers (thumb/view); a GitHub **Release** holds full-res AVIFs, bit-exact JPEG originals, and videos. Comments via **giscus** (GitHub Discussions) in the lightbox.

**Tech Stack:** Node 24 (built-in `node --test`), `sharp` (libvips, ICC-aware resize), `exiftool` + `avifenc`/`avifdec` (libavif 1.4.2) CLIs, `gh` CLI, vanilla HTML/CSS/JS (no framework), GitHub Pages + Cloudflare + giscus.

**Reference design (source of truth for CSS/JS/markup):** the approved mockup `/tmp/avif-test/layout_v3_src.html` (token version) and its rendered form `.superpowers/brainstorm/33015-1780629078/content/layout-v9.html`. Spec: `docs/superpowers/specs/2026-06-05-gus-photos-design.md`.

---

## File Structure

```
gus-photos/                       (repo root, branch: main)
  package.json                    build deps + scripts
  CNAME                           "gus.photos"
  .gitignore                      ignore node_modules, dist, .superpowers, *.local
  README.md
  config/
    site.json                     site-wide: { giscus:{repo,repoId,category,categoryId}, releaseTag }
  albums/
    acervo-01/
      album.json                  album config (title, intro, phases, favorites, bonus)
      manifest.json               GENERATED — ordered photos + tiers + EXIF
  build/
    lib/
      exif.js                     readExif(file) -> photo metadata        (+ exif.test.js)
      order.js                    order(photos), dayNumber, assignPhase    (+ order.test.js)
      manifest.js                 buildManifest(...)                       (+ manifest.test.js)
      encode.js                   makeTiers(...) sharp+avifenc, P3-verify   (+ encode.test.js)
      render.js                   renderAlbum/renderIndex (templates)      (+ render.test.js)
      paths.js                    tier filenames + Release URLs            (+ paths.test.js)
    build.js                      orchestrator: albums -> dist/
    release.js                    upload full-res/originals/videos via gh
    deploy.sh                     push dist/ -> gh-pages branch
    fixtures/                     tiny sample images for tests (copied in Task 1)
  site/
    templates/
      base.html                   shell: <head>, header, lang toggle, footer
      album.html                  album page body (hero, tabs, views, lightbox)
      index.html                  albums index
    assets/
      css/site.css                extracted mockup CSS (verbatim)
      js/album.js                 hero/scrubber/lightbox/i18n/toggle/giscus
  dist/                           GENERATED build output (gitignored; deployed to gh-pages)
  docs/superpowers/...            spec + this plan
```

---

## Phase 0 — Repo restructure & scaffold

### Task 0.1: Preserve the old app on `legacy`

**Files:** none (git ops)

- [ ] **Step 1: Confirm clean tree on master**

Run: `git -C /Users/admin/webapps/gus-photos status --porcelain`
Expected: only untracked `docs/`, `v*.jpeg`, and `.superpowers/` (brainstorm artifacts). If anything else, stop and resolve.

- [ ] **Step 2: Create and push the legacy branch from current master**

```bash
cd /Users/admin/webapps/gus-photos
git branch legacy master
git push -u origin legacy
```
Expected: `legacy` branch created locally and on origin, pointing at the old Heroku/Node app commit `2081bed`.

- [ ] **Step 3: Verify legacy has the old app**

Run: `git ls-tree --name-only legacy`
Expected: `index.js`, `package.json`, `Procfile`, `app.json`, `views/`, etc.

### Task 0.2: Make `main` the default and clear out the old app

**Files:** delete old app files; add `.gitignore`

- [ ] **Step 1: Rename master to main locally**

```bash
git branch -m master main
```

- [ ] **Step 2: Remove old-app files from main (kept safe on legacy)**

```bash
git rm -r index.js package.json Procfile app.json .bowerrc .jshintrc views README.md
```
Expected: those files staged for deletion. (`.gitignore` stays.)

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
dist/
.superpowers/
*.local
.DS_Store
# brainstorm screenshots
/v*.jpeg
/.playwright-mcp/
```

- [ ] **Step 4: Commit the spec, plan, and reset**

```bash
git add .gitignore docs/superpowers
git commit -m "chore: reset main for new static site; add design spec + plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Push main and set it as the default branch on GitHub**

```bash
git push -u origin main
gh repo edit Ghostavio/gus-photos --default-branch main
```
Expected: push succeeds; default branch is now `main`.

- [ ] **Step 6: Delete the remote master**

```bash
git push origin --delete master
```
Expected: remote `master` removed; `legacy` + `main` remain.

### Task 0.3: Scaffold the project

**Files:** Create `package.json`, `config/site.json`, dir structure

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gus-photos",
  "private": true,
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "build": "node build/build.js",
    "release": "node build/release.js",
    "deploy": "bash build/deploy.sh",
    "test": "node --test build/"
  },
  "dependencies": {
    "sharp": "^0.33.5"
  }
}
```

- [ ] **Step 2: Install deps and verify CLIs**

```bash
npm install
exiftool -ver && avifenc --version | head -1 && avifdec --version | head -1 && gh --version | head -1
```
Expected: sharp installs; `exiftool` prints a version; avifenc shows `1.4.2`; `gh` present.

- [ ] **Step 3: Create directories and `config/site.json`**

```bash
mkdir -p config albums/acervo-01 build/lib build/fixtures site/templates site/assets/css site/assets/js
```

`config/site.json` (giscus IDs filled in Phase 8 — placeholders here are config, replaced before deploy):
```json
{
  "domain": "gus.photos",
  "releaseTag": "acervo-01",
  "originalsBaseUrl": "https://github.com/Ghostavio/gus-photos/releases/download/acervo-01",
  "giscus": { "repo": "Ghostavio/gus-photos", "repoId": "", "category": "Comments", "categoryId": "" }
}
```

- [ ] **Step 4: Commit scaffold**

```bash
git add package.json package-lock.json config/site.json
git commit -m "chore: scaffold static-site build project"
```

---

## Phase 1 — Pipeline: metadata & ordering

Define the photo data shape used everywhere:

```js
// A "photo" object (produced by exif.js, consumed by order.js/manifest.js/render.js):
// {
//   file: "IMG_2223.JPG",            // basename in the originals dir
//   id: "IMG_2223",                  // basename without extension
//   datetime: "2019:05:31 21:08:27", // EXIF DateTimeOriginal (local wall-clock)
//   epochLocal: 1559329707,          // datetime parsed as naive-local seconds (for sorting only)
//   width: 4032, height: 3024,       // EXIF pixel dims (pre-orientation)
//   orientation: 6,                  // EXIF Orientation (1..8)
//   model: "iPad Pro", focal: "4.2 mm", focal35: "29 mm",
//   fnumber: "2.2", exposure: "1/17", iso: "250",
//   profile: "Display P3",           // ProfileDescription or null
//   hdr: true,                       // CustomRendered === "HDR (original saved)" || Apple HDRImageType
//   hasProfile: true
// }
```

### Task 1.1: `order.js` — chronological order, day numbers, phases (TDD)

**Files:**
- Create: `build/lib/order.js`
- Test: `build/lib/order.test.js`

- [ ] **Step 1: Write failing tests**

```js
// build/lib/order.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalEpoch, order, dayNumber, assignPhase } from './order.js';

test('parseLocalEpoch parses EXIF datetime as naive local seconds', () => {
  // 2019:05:31 21:08:27 -> deterministic naive epoch (UTC interpretation, used only for relative sort)
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
  assert.equal(assignPhase('2030:01:01 00:00:00', phases), null); // out of range -> null
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test build/lib/order.test.js`
Expected: FAIL — `order.js` has no such exports.

- [ ] **Step 3: Implement `order.js`**

```js
// build/lib/order.js
// All dates are EXIF local wall-clock ("YYYY:MM:DD HH:MM:SS"). We never use UTC/mdls.

export function parseLocalEpoch(dt) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dt);
  if (!m) return NaN;
  const [, Y, Mo, D, H, Mi, S] = m.map(Number);
  return Math.floor(Date.UTC(Y, Mo - 1, D, H, Mi, S) / 1000); // UTC used only as a stable relative clock
}

export function order(photos) {
  return [...photos].sort((a, b) => {
    const d = parseLocalEpoch(a.datetime) - parseLocalEpoch(b.datetime);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

export function localDate(dt) { return dt.slice(0, 10).replace(/:/g, '-'); } // "2019:05:31 .." -> "2019-05-31"

export function dayNumber(dt, firstDate) {
  const day = Date.UTC(...localDate(dt).split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)));
  const first = Date.UTC(...firstDate.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)));
  return Math.round((day - first) / 86400000) + 1;
}

export function assignPhase(dt, phases) {
  const d = localDate(dt);
  return phases.find(p => d >= p.from && d <= p.to) || null;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test build/lib/order.test.js`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add build/lib/order.js build/lib/order.test.js
git commit -m "feat(build): chronological order, day numbers, phase assignment"
```

### Task 1.2: `exif.js` — read metadata via exiftool (integration test)

**Files:**
- Create: `build/lib/exif.js`, `build/lib/exif.test.js`
- Fixture: copy one real original into `build/fixtures/`

- [ ] **Step 1: Add a fixture image**

```bash
cp "$HOME/maconhas-originals/IMG_2223.JPG" build/fixtures/IMG_2223.JPG
```

- [ ] **Step 2: Write failing test**

```js
// build/lib/exif.test.js
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
  assert.equal(p.datetime, '2019:05:31 21:08:27');
  assert.equal(p.hasProfile, true);
  assert.ok(p.width === 3024 || p.width === 4032);
});
```

- [ ] **Step 3: Run, verify fail**

Run: `node --test build/lib/exif.test.js` → FAIL (no `readExif`).

- [ ] **Step 4: Implement `exif.js`**

```js
// build/lib/exif.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const pexec = promisify(execFile);

const TAGS = [
  '-FileName', '-DateTimeOriginal', '-ImageWidth', '-ImageHeight', '-Orientation#',
  '-Model', '-FocalLength', '-FocalLengthIn35mmFormat', '-FNumber', '-ExposureTime',
  '-ISO', '-ProfileDescription', '-CustomRendered', '-HDRImageType',
];

export async function readExif(file) {
  // -j JSON, -s short tag names, -G0 no groups
  const { stdout } = await pexec('exiftool', ['-j', '-s', ...TAGS, file], { maxBuffer: 1 << 24 });
  const t = JSON.parse(stdout)[0];
  const hdr = /HDR/i.test(t.CustomRendered || '') || /HDR/i.test(t.HDRImageType || '');
  return {
    file: t.FileName,
    id: path.parse(t.FileName).name,
    datetime: (t.DateTimeOriginal || '').trim(),
    width: Number(t.ImageWidth), height: Number(t.ImageHeight),
    orientation: Number(t.Orientation) || 1,
    model: t.Model || '', focal: t.FocalLength || '', focal35: t.FocalLengthIn35mmFormat || '',
    fnumber: t.FNumber != null ? String(t.FNumber) : '',
    exposure: t.ExposureTime || '', iso: t.ISO != null ? String(t.ISO) : '',
    profile: t.ProfileDescription || null,
    hasProfile: Boolean(t.ProfileDescription),
    hdr,
  };
}
```

- [ ] **Step 5: Run, verify pass**

Run: `node --test build/lib/exif.test.js` → PASS.

- [ ] **Step 6: Commit**

```bash
git add build/lib/exif.js build/lib/exif.test.js build/fixtures/IMG_2223.JPG
git commit -m "feat(build): exiftool metadata reader"
```

---

## Phase 2 — Pipeline: color-managed AVIF tiers

### Task 2.1: `paths.js` — tier filenames & Release URLs (TDD)

**Files:** Create `build/lib/paths.js`, `build/lib/paths.test.js`

- [ ] **Step 1: Failing test**

```js
// build/lib/paths.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierPath, fullUrl } from './paths.js';

test('tierPath builds album-scoped tier paths', () => {
  assert.equal(tierPath('acervo-01', 'IMG_2223', 'thumb'), 'img/acervo-01/IMG_2223.thumb.avif');
  assert.equal(tierPath('acervo-01', 'IMG_2223', 'view'),  'img/acervo-01/IMG_2223.view.avif');
});

test('fullUrl points at the Release', () => {
  assert.equal(
    fullUrl('https://github.com/Ghostavio/gus-photos/releases/download/acervo-01', 'IMG_2223'),
    'https://github.com/Ghostavio/gus-photos/releases/download/acervo-01/IMG_2223.full.avif'
  );
});
```

- [ ] **Step 2: Run → FAIL.**  `node --test build/lib/paths.test.js`

- [ ] **Step 3: Implement**

```js
// build/lib/paths.js
export function tierPath(album, id, tier) { return `img/${album}/${id}.${tier}.avif`; }
export function fullUrl(base, id) { return `${base}/${id}.full.avif`; }
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** `git add build/lib/paths.* && git commit -m "feat(build): tier path helpers"`

### Task 2.2: `encode.js` — sharp resize + avifenc, with a P3/orientation verification gate

**Files:** Create `build/lib/encode.js`, `build/lib/encode.test.js`

- [ ] **Step 1: Write the verification test (this is the color guarantee)**

```js
// build/lib/encode.test.js
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
  // size sanity: thumb < view < full
  const sz = t => fs.statSync(tiers[t]).size;
  assert.ok(sz('thumb') < sz('view') && sz('view') < sz('full'));
});
```

- [ ] **Step 2: Run → FAIL.** `node --test build/lib/encode.test.js`

- [ ] **Step 3: Implement `encode.js`**

```js
// build/lib/encode.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
const pexec = promisify(execFile);

const TIERS = {
  thumb: { px: 640,  q: 80 },
  view:  { px: 2048, q: 82 },
};
const FULL_Q = 80;
const SPEED = 6; // batch speed/quality tradeoff (see spec §4)

// Resize ICC-aware to a lossless PNG that keeps the embedded Display-P3 profile, applying EXIF orientation.
async function resizedPng(src, px, tmp) {
  await sharp(src)
    .rotate()                 // bake EXIF orientation
    .resize({ width: px, height: px, fit: 'inside', withoutEnlargement: true })
    .keepIccProfile()         // do NOT convert colourspace; retain P3
    .png()
    .toFile(tmp);
  return tmp;
}

async function avif(input, out, q) {
  await pexec('avifenc', ['-q', String(q), '-d', '10', '-y', '444', '-s', String(SPEED), '-j', 'all', input, out],
    { maxBuffer: 1 << 24 });
}

export async function makeTiers(src, { album, id, outDir }) {
  const dir = path.join(outDir, album);
  fs.mkdirSync(dir, { recursive: true });
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-'));
  const tiers = {};
  try {
    for (const [name, { px, q }] of Object.entries(TIERS)) {
      const png = await resizedPng(src, px, path.join(tmpRoot, `${id}.${name}.png`));
      const out = path.join(dir, `${id}.${name}.avif`);
      await avif(png, out, q);
      tiers[name] = out;
    }
    // full: avifenc straight on the original (ICC byte-identical; EXIF orientation -> AVIF irot)
    const full = path.join(dir, `${id}.full.avif`);
    await avif(src, full, FULL_Q);
    tiers.full = full;
    return tiers;
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run → PASS** (slow — full-res encode at speed 6 takes ~10–15 s).

Run: `node --test build/lib/encode.test.js`
Expected: PASS, all three tiers report `Display P3`.

- [ ] **Step 5: Verify the `full` tier displays upright (orientation carried as irot)**

Run: `avifdec --info build/fixtures/out/acervo-01/IMG_2223.full.avif 2>/dev/null | grep -i irot || echo "no irot"`
Expected: if the source had a non-1 orientation, an `irot`/`imir` transform is present. (IMG_2223 is orientation 6 → expect a transform. If absent on a rotated source, add `.rotate().png()` full path like the other tiers.)

- [ ] **Step 6: Commit**

```bash
echo "build/fixtures/out/" >> .gitignore
git add build/lib/encode.js build/lib/encode.test.js .gitignore
git commit -m "feat(build): color-managed AVIF tier encoder (P3-verified)"
```

---

## Phase 3 — Pipeline: manifest + composite handling

### Task 3.1: Rename the composite into the IMG sequence

**Files:** none (one-time data op on the originals folder)

- [ ] **Step 1: Confirm the gap is free and rename**

```bash
cd "$HOME/maconhas-originals"
ls IMG_229[1-9].* IMG_230[0-2].* 2>/dev/null || echo "gap 2291-2302 is free"
mv 2125B13E-6E3B-4481-A34F-293BD7842887.jpg IMG_2295.jpg
exiftool -s3 -DateTimeOriginal IMG_2295.jpg
```
Expected: gap free; `IMG_2295.jpg` now exists; its DateTimeOriginal is `2019:06:04 01:05:59` (sorts between 2290 and 2303). If it lacks a profile, tag it:

```bash
exiftool -overwrite_original -ProfileDescription="Display P3" IMG_2295.jpg 2>/dev/null || true
```

### Task 3.2: `manifest.js` — assemble the ordered manifest (TDD + integration)

**Files:** Create `build/lib/manifest.js`, `build/lib/manifest.test.js`; create `albums/acervo-01/album.json`

- [ ] **Step 1: Write `albums/acervo-01/album.json`**

```json
{
  "slug": "acervo-01",
  "kicker": "Acervo 01 — 2019",
  "title": { "en": "From seed to flower", "pt": "Da semente à flor" },
  "intro": {
    "en": "From May 31 to October 1, 2019, I grew three plants of my own — start to finish, seed to flower. This is the complete collection: 500 photographs documenting all five months of the grow, shot on an iPad Pro.",
    "pt": "De 31 de maio a 1º de outubro de 2019, cultivei minha própria maconha — três plantas, da semente à flor. Este é o acervo completo: 500 fotografias documentando os cinco meses de cultivo, do início ao fim, registradas num iPad Pro."
  },
  "source": "~/maconhas-originals",
  "phases": [
    { "from": "2019-05-31", "to": "2019-06-27", "label": { "en": "Germination & Seedling", "pt": "Germinação e Muda" } },
    { "from": "2019-06-28", "to": "2019-08-24", "label": { "en": "Vegetative", "pt": "Vegetativo" } },
    { "from": "2019-08-25", "to": "2019-09-30", "label": { "en": "Flowering", "pt": "Floração" } },
    { "from": "2019-10-01", "to": "2019-10-01", "label": { "en": "Harvest", "pt": "Colheita" } }
  ],
  "favorites": [],
  "bonus": { "photos": [], "videos": [] }
}
```
*(favorites / bonus / exact phase dates are user-provided later; empty is valid.)*

- [ ] **Step 2: Failing test (pure assembly from fake photos)**

```js
// build/lib/manifest.test.js
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
  assert.equal(m.photos[0].day, 4);                  // 2019-06-03 is day 4 from 2019-05-31
  assert.equal(m.photos[0].favorite, true);
  assert.equal(m.photos[0].phase.en, 'Germination & Seedling');
  assert.equal(m.photos[0].tiers.thumb, 'img/acervo-01/IMG_2290.thumb.avif');
  assert.equal(m.photos[0].tiers.full, 'https://rel/IMG_2290.full.avif');
  assert.equal(m.firstDate, '2019-05-31');
  assert.equal(m.lastDate, '2019-06-04');
  assert.equal(m.count, 2);
});
```

- [ ] **Step 3: Run → FAIL.** `node --test build/lib/manifest.test.js`

- [ ] **Step 4: Implement `manifest.js`**

```js
// build/lib/manifest.js
import { order, localDate, dayNumber, assignPhase } from './order.js';
import { tierPath, fullUrl } from './paths.js';

export function assemble(album, photos, releaseBase) {
  const ordered = order(photos);
  const firstDate = localDate(ordered[0].datetime);
  const lastDate = localDate(ordered[ordered.length - 1].datetime);
  const favs = new Set(album.favorites || []);
  const out = ordered.map(p => ({
    ...p,
    day: dayNumber(p.datetime, firstDate),
    phase: assignPhase(p.datetime, album.phases || [])?.label || null,
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
```

- [ ] **Step 5: Run → PASS.** **Step 6: Commit** `git add build/lib/manifest.* albums/acervo-01/album.json && git commit -m "feat(build): manifest assembly + acervo-01 config"`

---

## Phase 4 — Front end: extract & templatize the approved mockup

The mockup is verified; these tasks turn its self-contained HTML into templated, manifest-driven files. **Do not redesign** — port verbatim, then swap embedded data for manifest data.

### Task 4.1: Extract CSS verbatim

**Files:** Create `site/assets/css/site.css`

- [ ] **Step 1: Copy the `<style>` block from the mockup into `site/assets/css/site.css`**

Source: everything between `<style>` and `</style>` in `/tmp/avif-test/layout_v3_src.html` (the full theme: header, hero/scrubber, tabs, timeline chapters, masonry, fav-grid, figures/chips, lightbox, meta panel, fullres switch, giscus mock, language `.en/.pt` rules). Save as-is.

- [ ] **Step 2: Verify it's non-empty and references the design tokens**

Run: `grep -c -- '--accent' site/assets/css/site.css`
Expected: ≥ 1.

- [ ] **Step 3: Commit** `git add site/assets/css/site.css && git commit -m "feat(site): extract verified theme CSS"`

### Task 4.2: `render.js` — emit album markup from the manifest (TDD)

**Files:** Create `build/lib/render.js`, `build/lib/render.test.js`, `site/templates/album.html`, `site/templates/base.html`

- [ ] **Step 1: Write `site/templates/base.html`** (shell with `{{slots}}`)

```html
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}} — gus.photos</title>
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="canonical" href="https://gus.photos{{path}}">
</head><body class="lang-en">
<header>
  <a class="brand" href="/">gus<b>.</b>photos</a>
  <div class="nav">
    <a href="/"><span class="en">Albums</span><span class="pt">Acervos</span></a>
    <div class="lang"><button id="enBtn" class="on">EN</button><button id="ptBtn">PT</button></div>
  </div>
</header>
{{body}}
<footer class="wrap">gus.photos — <span class="en">a growing archive of old photosets.</span><span class="pt">um acervo crescente de fotografias antigas.</span></footer>
<script>window.__SITE__={{site}};window.__MANIFEST__={{manifest}};</script>
<script src="/assets/js/album.js"></script>
</body></html>
```

- [ ] **Step 2: Write `site/templates/album.html`**

Port the mockup's body (hero with `#layA/#layB`, `#scrub`, hero controls; `.tabs` with Timeline/Masonry/Favorites/Bonus; the four `section.view`; the lightbox `#modal` with the Details/Comments panel and `#fullresToggle`) **with the grid/figure markup removed** — those are injected by `album.js` from the manifest. Keep static chrome (hero scaffold, tabs, empty `<section class="view" id="...">` containers, the lightbox). Insert the album's `kicker`, `title`, `intro`, facts, and `Day 1 / Day {{lastDay}}` labels as template tokens.

- [ ] **Step 3: Failing test for `render.js`**

```js
// build/lib/render.test.js
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
```

- [ ] **Step 4: Run → FAIL.** `node --test build/lib/render.test.js`

- [ ] **Step 5: Implement `render.js`**

```js
// build/lib/render.js
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
```

- [ ] **Step 6: Run → PASS.** **Step 7: Commit** `git add build/lib/render.* site/templates && git commit -m "feat(site): manifest-driven album rendering"`

### Task 4.3: `album.js` — port interactions + render grids from the manifest

**Files:** Create `site/assets/js/album.js`

- [ ] **Step 1: Copy the mockup's `<script>` into `album.js`**, then make these exact substitutions:

1. Delete the hard-coded `THUMB`, `FULL`, `metaSets`, `DAYOF`, `HERO_FAVS`, `ORIG` constants and the `setFor()` helper.
2. At the top add: `const M = window.__MANIFEST__, SITE = window.__SITE__;` and build lookups from the manifest:
```js
const byId = Object.fromEntries(M.photos.map(p => [p.id, p]));
const THUMB = id => byId[id].tiers.thumb;
const VIEW  = id => byId[id].tiers.view;
const FULL  = id => byId[id].tiers.full;           // full-res (Release) — used when toggle on
const META  = id => byId[id];                       // {model,focal,...,day,phase,...}
const HERO_FAVS = M.photos.filter(p => p.favorite).map(p => p.id);
const DAYOF = Object.fromEntries(M.photos.map(p => [p.id, p.day]));
```
3. Replace `mImg.src = fullRes ? (ORIG[id]||FULL[id]) : FULL[id];` with
   `mImg.src = fullRes ? FULL(id) : VIEW(id);`  *(default = 2048px view; toggle = full-res)*.
4. Replace `fill(metaSets[setFor(id)])` with `fill(META(id))` and update `fill()` to read manifest fields (`m.model, m.focal, m.focal35, m.fnumber+'  →ƒ/'`, `m.exposure, m.iso, m.profile, m.width+' × '+m.height, m.datetime` → formatted, `'Day '+m.day+(m.phase?' · '+m.phase[lang]:'')`). Show the HDR badge only when `m.hdr`.
5. Build the grids/timeline/masonry/favorites/bonus DOM from `M.photos` on load (the function below). Lightbox `list` is built from the rendered figures, sorted by `data-day`/order as in the mockup.

```js
// renders figures into each view from the manifest
function figure(p, opts = {}) {
  const f = document.createElement('figure');
  f.dataset.id = p.id;
  if (p.favorite) f.dataset.fav = '1';
  if (opts.video) { f.className = 'vid'; f.dataset.vid = '1'; }
  const img = new Image(); img.loading = 'lazy'; img.src = THUMB(p.id); img.alt = '';
  f.append(img);
  if (!opts.video) { const c = document.createElement('div'); c.className = 'chip';
    c.innerHTML = `<b>●</b> ƒ/${p.fnumber} · ${p.exposure}s · ISO ${p.iso}`; f.append(c); }
  if (p.favorite) { const s = document.createElement('span'); s.className = 'fav-star'; s.textContent = '★'; f.append(s); }
  return f;
}
// Timeline: group by phase (chapter), then by day (day-group); see mockup markup for the wrappers.
```
*(Group photos by `phase[lang]` into chapters, then by `day` into day-groups; render Masonry as a flat column flow; Favorites = `p.favorite`; Bonus = `album.bonus` photos + video tiles. Reuse the exact class names from the CSS: `.chapter/.day-group/.day-head/.grid/.masonry/.fav-grid`.)*

6. **i18n**: keep the EN/PT toggle; persist with `localStorage('gp_lang')`; expose `lang` and re-render chips/captions on switch.
7. **giscus**: implement `loadComments(id)` (Task 5.2).

- [ ] **Step 2: Commit (wiring verified in Phase 6 against a real build)**

```bash
git add site/assets/js/album.js
git commit -m "feat(site): manifest-driven interactions (grids, lightbox, hero, i18n)"
```

---

## Phase 5 — Front end: full-res toggle + giscus (port + wire)

### Task 5.1: Confirm the full-res toggle reads the manifest tiers

**Files:** `site/assets/js/album.js`

- [ ] **Step 1:** Ensure the persisted toggle (`gp_fullres`, off by default) flips `show()` between `VIEW(id)` (default) and `FULL(id)` (Release URL), and the panel note reads `"2048px · faster"` / `"Full resolution · 4032px"` (verbatim from the mockup). The "Download original" link `href = FULL(id)`.
- [ ] **Step 2: Commit** `git commit -am "feat(site): full-res toggle wired to manifest tiers"`

### Task 5.2: Wire real giscus into the Comments pane

**Files:** `site/assets/js/album.js`

- [ ] **Step 1: Replace the mocked comments markup** in the lightbox panel's `#commentsPane` with an empty mount: `<div id="giscus-mount"></div>` (keep the `Details ⇄ Comments` segmented toggle from the mockup).

- [ ] **Step 2: Implement lazy giscus load + per-photo term + nav update**

```js
let giscusLoaded = false;
function loadComments(id) {
  const mount = document.getElementById('giscus-mount');
  const term = `${M.slug}:${id}`;
  if (!giscusLoaded) {
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true; s.crossOrigin = 'anonymous';
    Object.assign(s.dataset, {
      repo: SITE.giscus.repo, repoId: SITE.giscus.repoId,
      category: SITE.giscus.category, categoryId: SITE.giscus.categoryId,
      mapping: 'specific', term,
      strict: '1', reactionsEnabled: '1', emitMetadata: '0',
      inputPosition: 'top', theme: 'dark_dimmed', lang,
      loading: 'lazy',
    });
    mount.replaceChildren(s);
    giscusLoaded = true;
  } else {
    const frame = document.querySelector('iframe.giscus-frame');
    frame?.contentWindow.postMessage({ giscus: { setConfig: { term, lang } } }, 'https://giscus.app');
  }
}
// Call loadComments(currentId) when the Comments tab is shown and on ←/→ while it's active.
```

- [ ] **Step 3: Commit** `git commit -am "feat(site): giscus comments in lightbox (lazy, per-photo, nav-synced)"`

---

## Phase 6 — Build orchestrator & first real build

### Task 6.1: `build.js` — originals → tiers → manifest → dist/

**Files:** Create `build/build.js`

- [ ] **Step 1: Implement the orchestrator**

```js
// build/build.js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readExif } from './lib/exif.js';
import { assemble } from './lib/manifest.js';
import { makeTiers } from './lib/encode.js';
import { renderAlbum, renderIndex } from './lib/render.js';

const site = JSON.parse(fs.readFileSync('config/site.json', 'utf8'));
const DIST = 'dist';
const expand = p => p.replace(/^~/, os.homedir());

async function buildAlbum(slug) {
  const album = JSON.parse(fs.readFileSync(`albums/${slug}/album.json`, 'utf8'));
  const srcDir = expand(album.source);
  const files = fs.readdirSync(srcDir).filter(f => /\.(jpe?g)$/i.test(f)).sort();
  console.log(`[${slug}] ${files.length} originals`);

  const photos = [];
  let i = 0;
  for (const f of files) {
    const src = path.join(srcDir, f);
    const meta = await readExif(src);
    await makeTiers(src, { album: slug, id: meta.id, outDir: path.join(DIST, 'img') });
    photos.push(meta);
    if (++i % 25 === 0) console.log(`  …${i}/${files.length}`);
  }
  const manifest = assemble(album, photos, site.originalsBaseUrl);
  fs.writeFileSync(`albums/${slug}/manifest.json`, JSON.stringify(manifest, null, 2));
  fs.mkdirSync(path.join(DIST, slug), { recursive: true });
  fs.writeFileSync(path.join(DIST, slug, 'index.html'), renderAlbum({ album, manifest, site }));
  return { ...album, count: manifest.count, cover: manifest.photos.find(p => p.favorite)?.tiers.thumb || manifest.photos[0].tiers.thumb };
}

async function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.cpSync('site/assets', path.join(DIST, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'CNAME'), 'gus.photos\n');
  const slugs = fs.readdirSync('albums').filter(s => fs.existsSync(`albums/${s}/album.json`));
  const albums = [];
  for (const s of slugs) albums.push(await buildAlbum(s));
  fs.writeFileSync(path.join(DIST, 'index.html'), renderIndex({ albums, site }));
  console.log('build complete →', DIST);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Smoke-build on a 12-photo subset first** (fast feedback before the ~hours-long full run)

```bash
mkdir -p /tmp/gp-sub && (cd "$HOME/maconhas-originals" && ls IMG_*.JPG | sort | head -12 | xargs -I{} cp {} /tmp/gp-sub/)
node -e "const j=require('./albums/acervo-01/album.json');j.source='/tmp/gp-sub';require('fs').writeFileSync('/tmp/album.sub.json',JSON.stringify(j))"
# temporarily point the album at the subset
cp albums/acervo-01/album.json /tmp/album.bak.json && cp /tmp/album.sub.json albums/acervo-01/album.json
npm run build
cp /tmp/album.bak.json albums/acervo-01/album.json
```
Expected: `dist/acervo-01/index.html`, `dist/img/acervo-01/IMG_*.{thumb,view,full}.avif`, and `albums/acervo-01/manifest.json` exist.

- [ ] **Step 3: Verify the subset build in the browser (Playwright)**

Run a local static server and open it:
```bash
( cd dist && python3 -m http.server 8081 >/dev/null 2>&1 & echo $! > /tmp/gp.pid )
```
Open `http://localhost:8081/acervo-01/` — confirm: thumbnails load, Timeline groups by phase/day, lightbox opens with the 2048px image + metadata, the full-res toggle flips the source, EN/PT switches. Kill: `kill $(cat /tmp/gp.pid)`.

- [ ] **Step 4: Commit** `git add build/build.js && git commit -m "feat(build): orchestrator (originals → tiers → manifest → dist)"`

### Task 6.2: Full build

- [ ] **Step 1: Run the full 500-photo build** (allow ~2–4 h at speed 6; run in a background shell)

Run: `npm run build 2>&1 | tee /tmp/gp-build.log`
Expected: 500 photos processed; `dist/img/acervo-01/` has 1500 AVIFs; `manifest.json` count = 500, firstDate `2019-05-31`, lastDate `2019-10-01`, lastDay `124`.

- [ ] **Step 2: Sanity-check totals**

```bash
echo "view+thumb on Pages:"; du -sh dist/img/acervo-01/*.view.avif dist/img/acervo-01/*.thumb.avif 2>/dev/null | tail -1
du -sh dist
node -e "const m=require('./albums/acervo-01/manifest.json');console.log('count',m.count,'days',m.lastDay,'hdr',m.photos.filter(p=>p.hdr).length)"
```
Expected: dist (minus full-res, moved next) well under 1 GB; count 500; hdr ≈ 135.

- [ ] **Step 3: Move full-res out of dist (it goes to the Release, not Pages)**

```bash
mkdir -p release/acervo-01
mv dist/img/acervo-01/*.full.avif release/acervo-01/
echo "release/" >> .gitignore
```

- [ ] **Step 4: Commit the generated manifest** `git add albums/acervo-01/manifest.json .gitignore && git commit -m "build: generate acervo-01 manifest (500 photos)"`

---

## Phase 7 — Hosting: Pages + domain

### Task 7.1: Deploy script (gh-pages branch)

**Files:** Create `build/deploy.sh`

- [ ] **Step 1: Implement `build/deploy.sh`** (publishes `dist/` to an orphan `gh-pages`, force-pushed so history doesn't accumulate)

```bash
#!/usr/bin/env bash
set -euo pipefail
test -f dist/index.html || { echo "run 'npm run build' first"; exit 1; }
tmp=$(mktemp -d)
cp -R dist/* "$tmp"/
( cd "$tmp" && git init -q && git checkout -qb gh-pages && git add -A \
  && git -c user.email=noreply@gus.photos -c user.name=deploy commit -qm "deploy $(git -C "$OLDPWD" rev-parse --short HEAD)" \
  && git push -q -f "git@github.com:Ghostavio/gus-photos.git" gh-pages )
rm -rf "$tmp"
echo "deployed dist/ → gh-pages"
```

- [ ] **Step 2: Deploy and enable Pages from gh-pages**

```bash
chmod +x build/deploy.sh && npm run deploy
gh api -X POST repos/Ghostavio/gus-photos/pages -f source.branch=gh-pages -f source.path=/ 2>/dev/null \
  || gh api -X PUT repos/Ghostavio/gus-photos/pages -f source.branch=gh-pages -f source.path=/
```
Expected: `gh-pages` pushed; Pages enabled.

- [ ] **Step 3: Commit** `git add build/deploy.sh && git commit -m "feat(deploy): gh-pages publish script"`

### Task 7.2: Domain + Cloudflare

**Files:** none (DNS/dashboard)

- [ ] **Step 1: Point DNS** — at the `gus.photos` registrar/Cloudflare, add the GitHub Pages apex records (`A` → `185.199.108–111.153`) or a Cloudflare CNAME-flatten to `ghostavio.github.io`; proxy ON (orange cloud) for caching.
- [ ] **Step 2: Set the custom domain + enforce HTTPS**

```bash
gh api -X PUT repos/Ghostavio/gus-photos/pages -f cname=gus.photos -F https_enforced=true
```
- [ ] **Step 3: Verify** — `curl -sI https://gus.photos/acervo-01/ | head -1` → `HTTP/2 200` once DNS + cert propagate.

---

## Phase 8 — Release upload + giscus enablement

### Task 8.1: `release.js` — upload full-res, originals, videos

**Files:** Create `build/release.js`

- [ ] **Step 1: Implement** (creates/updates the `acervo-01` Release and uploads assets)

```js
// build/release.js
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const tag = 'acervo-01';
const gh = (...a) => execFileSync('gh', a, { stdio: 'inherit' });
try { gh('release', 'view', tag); } catch { gh('release', 'create', tag, '-t', 'Acervo 01', '-n', 'Full-resolution AVIFs, originals, and videos for Acervo 01.'); }

const full = fs.readdirSync('release/acervo-01').map(f => `release/acervo-01/${f}`);
const origs = fs.readdirSync(os.homedir() + '/maconhas-originals').filter(f => /\.jpe?g$/i.test(f)).map(f => os.homedir() + '/maconhas-originals/' + f);
for (const batch of [full, origs]) gh('release', 'upload', tag, '--clobber', ...batch);
console.log('uploaded', full.length, 'full-res +', origs.length, 'originals');
```

- [ ] **Step 2: Run** `npm run release`
Expected: Release `acervo-01` has 500 `*.full.avif` + 500 JPEG originals; the site's `originalsBaseUrl` already points here (config/site.json), so the full-res toggle + Download original resolve.

- [ ] **Step 3: Verify a full-res URL resolves**

```bash
curl -sI "https://github.com/Ghostavio/gus-photos/releases/download/acervo-01/IMG_2223.full.avif" | grep -i 'location\|200'
```

- [ ] **Step 4: Commit** `git add build/release.js && git commit -m "feat(release): upload full-res + originals to GitHub Release"`

### Task 8.2: Enable Discussions + giscus, fill config, redeploy

**Files:** `config/site.json`

- [ ] **Step 1: Enable Discussions + create the Comments category**

```bash
gh api -X PATCH repos/Ghostavio/gus-photos -F has_discussions=true
```
Then in the repo's Discussions UI create a category **"Comments"** (format: Announcements). Install the **giscus app** at https://github.com/apps/giscus on this repo.

- [ ] **Step 2: Get the giscus IDs** from https://giscus.app (enter `Ghostavio/gus-photos`, pick the Comments category) and paste `repoId` + `categoryId` into `config/site.json`.

- [ ] **Step 3: Rebuild HTML only (manifest unchanged) + redeploy**

```bash
node build/build.js  # re-renders pages with the giscus IDs baked into window.__SITE__
npm run deploy
```

- [ ] **Step 4: Verify comments load** — open `https://gus.photos/acervo-01/`, open a photo → **Comments** → the giscus widget renders and "Sign in with GitHub" works; navigate ←/→ and confirm the thread term changes.

- [ ] **Step 5: Commit** `git commit -am "chore: wire giscus comment config"`

---

## Phase 9 — QA & polish

### Task 9.1: Color spot-check on the live site

- [ ] **Step 1:** With Playwright, open three live photos (early/mid/late), screenshot, and confirm the greens/purples match the originals (P3 preserved end-to-end). Open the same photos' `*.view.avif` with `exiftool -s3 -ProfileDescription` from `dist/` and confirm `Display P3`.

### Task 9.2: Responsive, lazy-load, Lighthouse

- [ ] **Step 1:** Playwright at 390×844 (mobile) and 1440×900: tabs, lightbox, hero scrubber, fullscreen scrubber overlay, language toggle all work; grid images are `loading="lazy"`.
- [ ] **Step 2:** Run Lighthouse (or `gh`-hosted PageSpeed) on `/acervo-01/`; confirm no layout shift on the hero and images are served as AVIF. Fix any regressions, redeploy.

### Task 9.3: Final commit & tag

- [ ] **Step 1:** `git tag v1.0.0 && git push origin v1.0.0`

---

## Self-Review

**Spec coverage:** §2 source/order/composite → Tasks 1.2, 3.1, 1.1; §3 design → Phase 4–5 (ported from the verified mockup); §3a giscus → Task 5.2 + 8.2; §4 pipeline/tiers/color → Tasks 2.2, 6 (P3-verified in 2.2); §5 hosting (Pages+Release+Cloudflare) → Phases 7–8; §6 data model/multi-album → album.json (3.2) + build.js loops all albums (6.1) + index (render.js); §7 repo restructure → Phase 0; §8 stack → package.json (0.3); §9 open items → empty-but-valid favorites/bonus/phases in album.json. **No gaps.**

**Placeholders:** giscus `repoId`/`categoryId` are intentionally empty in 0.3 and filled in 8.2 (real config, not a plan placeholder); favorites/bonus empty-by-design per spec §9. No "TODO/handle edge cases" steps.

**Type consistency:** the `photo` shape (1.x) flows unchanged into `assemble` (3.2) which adds `day/phase/favorite/tiers`; `tiers.{thumb,view,full}` names match `paths.js` (2.1), `encode.js` outputs (2.2), and `album.js` consumers (4.3/5.1); `VIEW/FULL` default-vs-toggle matches spec §3/§4.

---

## Notes for the implementer

- **Color is the one non-negotiable.** Task 2.2's test gates the whole pipeline — if any tier ever reports something other than `Display P3`, stop and fix the resize path before batch-encoding 500 photos.
- **Build time:** the 500-photo encode is the long pole (~2–4 h at speed 6). Smoke-build the 12-photo subset (6.1) first; only run the full build (6.2) once the front end is verified against the subset.
- **User-provided later (re-run cheaply):** favorites (edit `album.json` → `node build/build.js` re-renders HTML + manifest in seconds, no re-encode), phase dates (same), Bonus photos/videos (add to `album.json`; videos upload via an extended `release.js`).
