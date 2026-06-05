# gus.photos

A static, **color-accurate** photo archive. Live at **[gus.photos](https://gus.photos)**.

The guiding constraint is fidelity: every photo is shot in **Display P3**, and the build preserves that
wide-gamut profile **byte-for-byte** all the way to the browser. No muted colors, no sRGB flattening.

The first collection, **`acervo-01`**, documents a 2019 grow — 500 photographs from seed to flower
(May 31 → October 1), plus a Bonus set of extra stills and videos, presented as a capture-date timeline.

---

## How it works

No framework. A small Node build reads the original JPEGs, extracts EXIF, encodes AVIF tiers, and
templates plain HTML/CSS/JS from a per-album JSON manifest.

### The color pipeline (the whole point)

- Photos are encoded with **`avifenc` directly on the original JPEG** — this carries the embedded
  Display-P3 ICC profile through untouched (verified bit-identical). Resized tiers go through
  `sharp` with `.keepIccProfile()` (no colorspace conversion), then `avifenc`.
- **Never route photos through ffmpeg** — it strips the ICC profile and tags BT.709, which mutes the
  colors. (ffmpeg *is* used for the Bonus **videos**, which are plain SDR Rec.709 — no P3 to lose.)
- Encoder settings: `avifenc -q <Q> -d 10 -y 444 -s 6 -j all` (10-bit, full 4:4:4 chroma).

### Tiers per photo

| Tier    | Size      | Quality | Where it's served            | Used for                    |
|---------|-----------|---------|------------------------------|-----------------------------|
| `thumb` | 640 px    | q80     | Pages                        | grids / timeline            |
| `view`  | 2048 px   | q82     | Pages                        | lightbox (default)          |
| `full`  | native    | q80     | **Release** `acervo-01`      | "full resolution" toggle + download |

Bonus **videos** → web **H.264 (CRF 26)** MP4 + an AVIF poster frame (served from Pages); the pristine
`.MOV` originals live on the Release for download.

---

## Build

Requirements: **Node 24+**, and the CLIs `exiftool`, `avifenc`/`avifdec`, `ffmpeg`/`ffprobe`, `gh`.

```bash
npm install
npm run build      # encode all tiers + render the site into dist/
npm test           # node --test (build/lib/*.test.js)
```

Faster iteration via env flags:

| Flag                  | Effect                                                              |
|-----------------------|--------------------------------------------------------------------|
| `GP_RENDER_ONLY=1`    | Reuse saved manifest + tiers; only re-assemble + re-render HTML     |
| `GP_SKIP_ENCODE=1`    | Re-read EXIF and re-render, but skip photo encoding                 |
| `GP_LIMIT=N`          | Encode an even-spanning subset of N photos (smoke builds)           |

---

## Project layout

```
build/
  build.js            orchestrator (EXIF → encode → manifest → render)
  lib/                exif, order, manifest, paths, encode, video, render (+ *.test.js)
site/
  templates/          base.html, album.html, index.html
  assets/             css/site.css, js/album.js, mascot.avif
  static/             favicons + site.webmanifest (served at site root)
albums/
  acervo-01/          album.json (config) + manifest.json (generated)
config/site.json      domain, release tag, originals base URL, giscus IDs
dist/                 build output (gitignored) — deployed to Pages
release/              full-res AVIFs (gitignored) — uploaded to the Release
```

### Adding an album

Create `albums/<slug>/album.json` with `slug`, bilingual `title`/`intro`, the photo `source` directory,
`phases` (date ranges → labels), a `favorites` list of IDs, and a `bonus` block. Then `npm run build`.
Each photo's timeline day is derived from its EXIF `DateTimeOriginal` (local wall-clock).

---

## Hosting

- **GitHub Pages** (`gh-pages` branch) serves the site + `thumb`/`view` AVIFs + posters + web MP4s.
- **GitHub Release `acervo-01`** holds the `full`-res AVIFs and the original `.MOV` files that the
  lightbox's full-resolution toggle and download links point to.
- **giscus** provides per-photo comments (mapped by `<slug>:<id>`), shown in the lightbox.

Redeploy: rebuild `dist/`, then publish it to `gh-pages` (force-push an orphan commit, or update changed
files via the GitHub Contents API for small edits). `config/site.json` carries the domain + giscus IDs.

---

## Branches

- `main` — this project (default).
- `legacy` — the original dormant app that previously occupied this repo, preserved for reference.
