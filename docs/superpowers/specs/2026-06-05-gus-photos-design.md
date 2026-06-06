# gus.photos — Design & Implementation Spec ("Acervo 01")

**Started:** 2026-06-05 · **Last updated:** 2026-06-06
**Status:** ✅ **Live** at **https://gus.photos** (served from GitHub Pages, custom domain, HTTPS enforced)
**Goal:** A fast, durable, **color-exact** static photo-archive site on GitHub Pages, launched with one 500-photo album and built to grow with more albums.

> This document is the *as-built* reference. It started as the v1 design and has been updated to match what actually shipped. Where the implementation diverged from the original plan, the change is noted in **§14 (Changes from the original design)**.

---

## 1. Overview & Goals

Replaces the retired Heroku/Node app at `Ghostavio/gus-photos` with a static site showcasing curated photo collections ("acervos"). The first release is **Acervo 01** — a 2019 seed-to-flower cannabis grow in 500 iPad Pro photos, plus a Bonus set of extra stills and videos.

**Principles**
- **Color-exact** — every displayed/downloadable image preserves the original **Display-P3** profile, byte-for-byte. (Hard requirement; the user had been burned by muted-color conversions.)
- **Fast & cheap** — small AVIF derivatives by default; hosting is free (GitHub Pages + Release + Cloudflare).
- **Durable** — no third-party image hosts that can vanish or re-encode; everything GitHub-backed.
- **Extensible** — adding an album = drop originals + a small `album.json`; the build does the rest.
- **Bilingual** — English / Brazilian-Portuguese throughout, using *maconha* and *acervo* in PT.

**Non-goals** — no CMS/admin UI, no accounts/search, no server-side anything (fully static), no true web-HDR (SDR-P3 display + an HDR *badge*).

---

## 2. Source Data

- **Location:** `~/maconhas-originals` — pristine "Export Unmodified Original" set (~1.3 GB), 500 main `IMG_*.JPG` + a stitched composite, plus a `bonus/` subfolder (extra stills + `.MOV` videos).
- **Quality:** genuine **2017 Apple Display-P3** ICC, 12 MP (4032×3024 native, EXIF-orientation flagged), 8-bit JPEG. 165 frames carry an HDR flag → an **HDR badge** (no gain map, so displayed as SDR-P3).
- **Dates:** `DateTimeOriginal` spans **2019-05-31 → 2019-10-01** (local wall-clock).
- **Edge cases handled:** the composite + 2 panoramas have **no embedded profile** and lacked `DateTimeOriginal`; synthetic interpolated dates were written so they sort/group correctly. A bonus "chart" image (`IMG_2420`, 809×630, no EXIF) is handled gracefully (no Day/date shown).

**Ordering rule:** sort by EXIF **`DateTimeOriginal` local wall-clock** via **`exiftool`** — **never `mdls`** (timezone-naive; it mis-dated frame 1). The composite was renamed `2125B13E-…​.jpg` → **`IMG_2295.jpg`** so it slots between `IMG_2290` and `IMG_2303`.

---

## 3. Information Architecture (as built)

Vanilla HTML/CSS/JS, no framework. Dark editorial theme: P3 greens, serif headings, system sans, mono for metadata. A kawaii rainbow-leaf **mascot** (AVIF, alpha) sits in the hero.

**Album page** = header (wordmark + EN/PT toggle) → hero → view tabs → content → footer.

### Hero
- Crossfade **carousel of Favorites** (auto-play ~5.2 s, two-layer crossfade, subtle Ken-Burns ≤1.045) with **play/pause**. It **starts on a random favorite and shuffles** (random next, never the one on screen).
- The **"Day 1 → Day N" line is a draggable scrubber** that scrubs the *entire* grow chronologically by capture day; scrubbing **pauses autoplay** and shows a static frame (no Ken-Burns); the handle bounces to each shown photo's day.
- Hero **fullscreen** button; in fullscreen the scrubber overlays centered at the bottom. Scrub targets are pre-warmed after first paint for responsiveness.

### View tabs
- **Timeline** (default) — **phase chapters** (Germination & Seedling → Vegetative → Flowering → Harvest, with a circle marker on the timeline rule) and **day-groups** beneath (date + "Day N"), photos in a responsive grid; each figure shows an EXIF chip (ƒ/exposure/ISO).
- **Grid** — all thumbs side-by-side in a uniform grid (replaced the originally-planned Masonry, which ordered columns vertically and broke chronology).
- **Favorites ★** — the curated **100** favorites (97 main + 3 that also live in Bonus).
- **Bonus** — outtakes that didn't make the cut (**11 stills**) **+ videos** (**6**): poster + ▶ overlay + duration badge; stills open the lightbox, videos open a player overlay.

### Lightbox
Large image-first with an always-visible metadata panel.
- **Metadata:** Day N · phase, capture date, **Display-P3** + **HDR** badges, dimensions, device, focal length + 35 mm-equiv, ƒ-number, exposure, ISO, color profile. Empty fields are hidden (graceful for non-camera images).
- **Favorite star** — amber ★ next to the counter for favorite photos (same treatment as the grid).
- **Navigation** — prev/next + counter; **keyboard:** ←/→ (chronological within the open view), **Z** = full-size zoom, **I** = toggle panel, **F** = fullscreen, **Esc** = close. A legible hint pill summarizes the shortcuts.
- **Full-resolution toggle** (persisted, off by default) — loads the **2048 px `view`** tier by default, or the **native `full`** tier (from the Release) when on. "Download original" links the `full` AVIF.
- **1:1 zoom + pan** — a **magnifier** button (or `Z`) loads the **native full-res** image and shows it at 100 %; **drag to pan** (clamped to the image edges); nav arrows hide while zoomed; click/`Z`/`Esc` fits back to screen.
- **Details ⇄ Comments** segmented toggle — metadata vs the per-photo **giscus** thread (§3a). The Comments tab is **hidden until giscus is configured** and shows the **live comment count** from giscus (no hardcoded number).

### Global
- **EN/PT toggle** in the header, persisted to `localStorage`; **auto-detects** Portuguese browsers on first visit (§7).
- **Scroll-to-top button** — bottom-right, appears only after the user scrolls (>400 px), smooth-scrolls up, hidden at the top and behind the lightbox.

---

## 3a. Comments (giscus)

Per-photo comments via **giscus** (GitHub Discussions), in the lightbox panel behind the **Details ⇄ Comments** toggle.

- **Mapping:** `data-mapping="specific"`, `data-term="acervo-01:<photo-id>"` — one Discussion per photo, created **lazily on first comment**.
- **Navigation:** ←/→ updates the giscus term via `postMessage`/`setConfig` (no reload); lazy-loaded on first open.
- **Theme & i18n:** `dark_dimmed` theme; `data-lang` follows the EN/PT toggle (so PT browsers get Portuguese comments UI).
- **Live wiring** (in `config/site.json`): repo `Ghostavio/gus-photos`, **category "Announcements"** (the giscus-recommended Announcement-type), `repoId` `MDEwOlJlcG9zaXRvcnkyMTEwODU3NQ==`, `categoryId` `DIC_kwDOAUIXX84C-l0-`. The album HTML embeds these via `window.__SITE__`; `album.js` hides the Comments toggle when they're empty and shows the live count from giscus's metadata message.
- **Prereqs (done):** repo public, Discussions enabled, giscus app installed, Announcements category present.

---

## 4. Image Pipeline (photos · build-time)

**Hard rule:** encode photos with **`avifenc`**, **never ffmpeg** (ffmpeg strips the ICC and tags BT.709 → muted colors). The `full` tier is `avifenc` straight on the original JPEG — the Display-P3 ICC is carried **byte-for-byte** (verified with `cmp` of extracted ICC). Resized tiers go through **`sharp`** with `.rotate()` (bake EXIF orientation) + `.keepIccProfile()` (no colorspace conversion) → PNG → `avifenc`.

**Encoder:** `avifenc -q <Q> -d 10 -y 444 -s 6 -j all` (10-bit, full 4:4:4 chroma; 4:2:0 gave ~no savings at this quality, so 4:4:4 is free).

**Tiers** (per photo, all AVIF P3):

| Tier | Long edge | Quality | ~Size | Use | Hosted on |
|---|---|---|---|---|---|
| `thumb` | 640 px | q80 | ~46 KB | grids (timeline/grid/favorites/bonus) | **Pages** |
| `view` | 2048 px | q82 | ~400 KB | **default** lightbox image | **Pages** |
| `full` | 4032 px (native) | q80 | ~1.0–1.7 MB | full-res toggle + zoom + download | **Release** |

**EXIF:** `exiftool -j -s` → `{file,id,datetime,width,height,orientation,model,focal,focal35,fnumber,exposure,iso,profile,hasProfile,hdr}`.

**Manifest:** `albums/<slug>/manifest.json` — `{slug, firstDate, lastDate, count, lastDay, photos:[…], bonus:{photos:[…], videos:[…]}}`. Each photo carries `day`, `phase{en,pt}`, `favorite`, and `tiers{thumb,view,full}` (thumb/view are Pages paths `/img/<album>/<id>.<tier>.avif`; `full` is the Release URL).

---

## 4a. Video Pipeline (Bonus videos · build-time)

Bonus videos are 2019 iPad Pro clips — **SDR Rec.709**, so **ffmpeg is correct here** (no wide gamut to preserve; the "never ffmpeg" rule is photo/P3-only). Implemented in `build/lib/video.js`:

1. **Probe** with `ffprobe` (codec, dimensions, duration).
2. **Web MP4** — re-encode to **H.264 CRF 26**, `-pix_fmt yuv420p`, **`-movflags +faststart`** (the iPad records ~15 Mbps; CRF 26 is ~3× smaller and visually transparent). Audio copied if AAC. → `/vid/<album>/<id>.mp4`, served from **Pages**.
3. **Poster** — a frame ~10 % in, scaled to 640 px, encoded to **AVIF** → `/img/<album>/<id>.poster.avif`.
4. **Originals** — the pristine `.MOV` files go to the **Release**; each video tile's "Download original" links there.

Manifest video entry: `{id, src, poster, width, height, durSec, dur, original}`. Playback is a click-to-play **overlay** (`<video controls>`, native controls, Esc / click-outside to close, download link). 6 clips → ~157 MB on Pages (CRF 26), originals ~426 MB on the Release.

---

## 5. Hosting & Delivery (as deployed)

- **GitHub Pages** = the **`gh-pages` branch** (orphan, contents of `dist/`). Serves the site + `thumb`/`view` AVIFs + posters + web MP4s ≈ **~478 MB**. `.nojekyll` + `CNAME` in the bundle. Pages serves `.avif` as `image/avif` and honors range requests (206) on `.mp4`.
- **GitHub Release `acervo-01`** = the originals the site links to: **511 full-res AVIFs** (`IMG_*.full.avif`) + **6 `.MOV`** = **517 assets**, ~1.27 GB. Manifest `tiers.full` and video `original` point at `…/releases/download/acervo-01/<name>`.
  - **Gotcha (intentional):** Release assets serve as `application/octet-stream` with `content-disposition: attachment`, but `<img src>` still renders the AVIF (browser content-sniffs) — verified, so the full-res toggle/zoom work. Do **not** "fix" this.
- **Custom domain & TLS:** `gus.photos` via the `CNAME` file. DNS at **Cloudflare** as **A records → GitHub Pages IPs** (185.199.108–111.153), **DNS-only** so GitHub could issue the Let's Encrypt cert; **HTTPS enforced** (`https_enforced=true`). Cloudflare proxy can be enabled later with Full(strict) SSL for caching.
- **No third-party image host.** Future durable upgrade if needed: Cloudflare R2.

---

## 6. URLs & Client Routing

All client-side via the URL **hash** (no server needed); `popstate` drives the UI.

- **Photos:** `…/acervo-01/#IMG_2223` — shareable; opening a photo `pushState`s the id, prev/next `replaceState` (URL tracks the current photo without piling up history), close pops back to the album/tab. Visiting a shared link or refreshing opens that photo with the correct tab behind it (Back exits to that tab).
- **Tabs:** `#grid` / `#favorites` / `#bonus` (Timeline = no hash). Clicking a tab `pushState`s it; Back/Forward and shared/bookmarked tab links work.
- **No collision:** photo ids (`IMG_*`) vs tab names are disjoint; the router distinguishes by `byId[…]` vs the tab list. Opening a photo never changes the background tab.
- **Root** `gus.photos/` is a redirect page → `/acervo-01/` (`<meta refresh>` + `location.replace`, preserving `search`/`hash`), carrying the share tags (§8) so the bare domain also unfurls.

---

## 7. Internationalization (i18n)

- **Static text:** bilingual `<span class="en">/<span class="pt">` pairs; CSS toggles by `body.lang-en|pt` (no re-render). The header EN/PT buttons call `setLang`, persisted to `localStorage`.
- **Auto-detect:** on first visit (no saved choice), default to **PT** when `navigator.languages` matches `/^pt\b/` (pt, pt-BR, pt-PT), else EN.
- **JS-generated text** uses a `t(en,pt)` helper emitting the same bilingual spans, so toggling needs no re-render: hero caption ("Day N / Dia N" + phase), timeline day headers, scrubber labels, the resolution note, etc.
- **Dates:** facts row → EN "May 31, 2019" / PT **"31/05/2019"** (DD/MM/YYYY); timeline headers → "May 31" / "31 mai" (PT month abbreviations); lightbox → "May 31, 2019 · 21:08" / "31 de maio de 2019 · 21:08". The lightbox date + day re-render on toggle.
- **Tooltips** (`title`) can't hold spans, so buttons carry `data-ten`/`data-tpt` and `setLang` sets `title` from the active language (fullscreen, details, close, zoom, play/pause, favorite, back-to-top, …).
- **giscus** receives the active `lang`, so the comments UI is Portuguese for PT users.

---

## 8. SEO & Social

- **Open Graph / Twitter / meta description** on the album page (via `base.html`) **and** the root redirect page. `og:image` = **`https://gus.photos/og.jpg`** (a 1200×630 sRGB card generated from `IMG_3634` via `sharp`, cropped 100 px from top; `site/static/og.jpg`). `og:title`/`description` from the album title/intro (HTML-attribute-escaped). `twitter:card=summary_large_image`.
  - Hash deep-links share one album card (crawlers don't fetch `#hash` variants); per-photo unfurls would need pre-generated per-photo pages — deferred.
  - Social platforms cache unfurls; refresh via each platform's debugger after changing tags/image.
- **Analytics:** Google Analytics **gtag `G-TP03HWPPH4`** in `<head>` of the album page (not the instant-redirect root). gtag is loaded without SRI by design (Google rotates the file).
- The root redirect uses a canonical → `/acervo-01/` to consolidate SEO.

---

## 9. Data Model & Multi-Album

```
/                      → redirect to the (first) album (single-album site for now)
/acervo-01/            → album page
albums/
  acervo-01/
    album.json         → slug, kicker, title{en,pt}, intro{en,pt}, source,
                         phases:[{from,to,label{en,pt}}], favorites:[ids],
                         bonus:{photos:[], videos:[]}
    manifest.json      → generated (§4); includes bonus.{photos,videos}
config/site.json       → domain, releaseTag, originalsBaseUrl, giscus{repo,repoId,category,categoryId}
```

A new album = new folder + `album.json` + originals → the build emits its manifest, tiers, page. **Phases (acervo-01):** Germination & Seedling 05-31→06-27, Vegetative 06-28→**08-05**, Flowering **08-06**→09-30, Harvest 10-01. `firstDate` is anchored on the earliest `phase.from` so Day 1 = May 31. Date range in the facts row is computed at render time (not stored).

---

## 10. Repo, Branches & Domain (as done)

- **`main`** — the new site (repo **default branch**).
- **`legacy`** — the original dormant Heroku/Node app, preserved (identical to the old `master` HEAD `2081bed`).
- **`gh-pages`** — the published `dist/` bundle (orphan, force-pushed).
- **`master`** — **deleted** (old app preserved on `legacy`).
- **Commits:** no `Co-Authored-By` trailer (project rule).
- **`.gitignore`:** `node_modules`, `dist/`, `release/`, source originals, `/favicon/`, `/mascot.png`, `.superpowers/`, root screenshots — never committed.

---

## 11. Build & Tooling

**Lean Node build → static output** (no SPA framework). **Node 24+**, ESM. CLIs: `exiftool`, `avifenc`/`avifdec`, `ffmpeg`/`ffprobe`, `gh`. npm dep: `sharp` (libvips, ICC-aware resize).

```
build/
  build.js            orchestrator: EXIF → encode → manifest → render; copies assets/static; writes CNAME
  lib/
    exif.js           readExif (exiftool)
    order.js          local-date parsing, day numbering, phase assignment
    manifest.js       assemble() → per-photo day/phase/favorite/tiers + firstDate anchor
    paths.js          tierPath (root-relative /img/…), fullUrl (Release)
    encode.js         makeTiers (sharp resize + avifenc; full = avifenc on original)
    video.js          makeVideo (ffprobe → H.264 CRF26 MP4 + AVIF poster)
    render.js         renderAlbum / renderIndex (token-fill of templates)
    *.test.js         node --test (10 tests)
site/
  templates/          base.html, album.html, index.html (root redirect)
  assets/             css/site.css, js/album.js, mascot.avif
  static/             favicons, site.webmanifest, og.jpg (served at site root)
albums/acervo-01/     album.json (config) + manifest.json (generated)
config/site.json
dist/                 build output (gitignored) → deployed to gh-pages
release/acervo-01/    full-res AVIFs (gitignored) → uploaded to the Release
```

**Commands & modes:**
- `npm run build` — full build (re-encode everything into `dist/`).
- `npm test` — `node --test 'build/**/*.test.js'`.
- `GP_RENDER_ONLY=1` — reuse saved manifest + tiers; re-assemble (apply album.json), run `buildBonus`, re-render HTML, re-copy assets. The fast iteration path.
- `GP_SKIP_ENCODE=1` — re-read EXIF + re-render, skip photo encoding. `GP_LIMIT=N` — even-spanning subset for smoke builds.

---

## 12. Deploy & Redeploy

- **Full deploy:** build `dist/`, move the 11 bonus `*.full.avif` into the Release set, strip `.DS_Store`, keep `.nojekyll`+`CNAME`; publish by **force-pushing an orphan commit of `dist/` to `gh-pages`** (built in a throwaway repo: `git init`, `cp -a dist/. .`, commit, `git push -f`). Push `main`. Upload originals: `gh release upload acervo-01 release/acervo-01/*.avif ~/maconhas-originals/bonus/*.MOV --clobber`.
- **Small edits (HTML/CSS/JS):** update individual files on `gh-pages` via the **GitHub Contents API** (no media re-push). For large files (the album HTML ~376 KB base64) pass the base64 to `jq` with **`--rawfile`**, not `--arg` (a large shell arg intermittently fails the PUT with a misleading "Requires authentication").
- **Preview before DNS:** `curl --resolve gus.photos:80:185.199.108.153 http://gus.photos/…`.
- **Verify:** poll `gh api repos/Ghostavio/gus-photos/pages/builds/latest` until `built`, then curl the live URL.

---

## 13. QA

Playwright-driven verification of every feature (color spot-check, tabs/timeline/grid/favorites/bonus counts, lightbox open/zoom/pan, video playback + range requests, deep-link + tab routing + Back/Forward, i18n PT pass, scroll-to-top, favorite star, og.jpg byte-match, giscus render). Unit tests: 10/10. Live HTTPS serving verified (200/206, `image/avif`, full-res AVIF renders from the Release).

---

## 14. Changes from the original design

- **Masonry → Grid** (Masonry ordered columns vertically, breaking chronology).
- **Favorites: ~50 → 100** curated (3 also in Bonus); the tab count is dynamic.
- **Video pipeline added** (`video.js`, H.264 CRF 26 + AVIF poster) — not in the original sketch.
- **Lightbox 1:1 zoom + drag-to-pan**, **favorite star**, **live comment count**, **scroll-to-top** — added.
- **Per-photo + per-tab hash routing** — added (original spec only had `/` and `/acervo-01/`).
- **Comprehensive i18n** of JS-generated text + dates + tooltips + **browser-language auto-detect** — expanded well beyond the original toggle.
- **SEO/social** (og:image, meta description, Twitter cards) + **Google Analytics** — added.
- **Root is a redirect** to the album (single-album site) rather than an album-cards index — deferred until album #2.
- **giscus category is "Announcements"** (recommended type), not a dedicated "Comments" category.
- **Hosting:** Pages is served from a **`gh-pages` branch** (force-pushed `dist/`), not directly from `main`; redeploys of small files use the **Contents API**.
- **Tiers:** `view` is **q82**, `full`/`thumb` **q80** (chosen from the quality A/B). Real footprint: Pages ~478 MB, Release ~1.27 GB.
- Intro copy tweaked: EN "from start to finish"; PT uses a comma instead of the em-dash.
