# gus.photos — Design Spec (v1: "Acervo 01")

**Date:** 2026-06-05
**Status:** Draft for review
**Goal:** Rebuild `gus.photos` as a fast, durable, static photo-archive site hosted on GitHub Pages, launching with one 500-photo album and designed to grow with more albums over time.

---

## 1. Overview & Goals

Replace the retired Heroku/Node app at `Ghostavio/gus-photos` with a static site that showcases curated photo collections ("acervos"). The first release is **Acervo 01** — a 2019 seed-to-flower cannabis grow documented in 500 iPad Pro photos.

**Principles**
- **Color-exact**: every displayed image preserves the original **Display-P3** profile (the user has been burned by muted-color conversions before — this is a hard requirement).
- **Fast & cheap**: small derivatives by default; everything free (GitHub Pages + Cloudflare).
- **Durable**: no dependency on free image hosts that can vanish or re-encode; everything GitHub-backed.
- **Extensible**: adding an album = drop originals + a small config; the build does the rest.
- **Bilingual**: English / Brazilian-Portuguese, using **maconha** (weed) and **acervo** (collection) in PT.

**Non-goals (YAGNI for v1)**
- CMS / admin UI (albums are config + a build step).
- User accounts, search. *(Per-photo comments **are** in scope — via giscus, §3a.)*
- True web-HDR rendering (2019 "Smart HDR" has no standard gain map; we display SDR P3 and show an HDR *badge*).
- Server-side anything (fully static).

---

## 2. Source Data (verified)

- **Location:** `~/maconhas-originals` — pristine "Export Unmodified Original" set, **1.3 GB**, **500 files** (499 `IMG_*.JPG` + the stitched composite `2125B13E-…​.jpg`).
- **Quality:** genuine **2017 Apple Display-P3** ICC profile (not the 2022 re-processed copies in `/Users/admin/webapps/maconhas`), 12 MP (4032×3024 native, EXIF-orientation flagged), 8-bit JPEG.
- **HDR:** **135** frames flagged (`CustomRendered = HDR`, Apple `HDRImageType = HDR Image`); 30 are "Original (for HDR)" companions (possible near-dupes — flag during favorites curation, not blocking).
- **Dates:** `DateTimeOriginal` spans **2019-05-31 21:08 → 2019-10-01 23:27** (local wall-clock), matching the intro copy.
- **Edge cases:** 3 files (composite + 2 panoramas) carry **no embedded profile** and odd dimensions — handle explicitly (§4).

**Ordering rule:** sort by EXIF **`DateTimeOriginal` local wall-clock date** (via `exiftool`/`exifr`, **never `mdls`** — it is timezone-naive and mis-dated frame 1 to "June 1"). The composite's own EXIF date (Jun 4) already slots it correctly between `IMG_2290` and `IMG_2303`.

**Composite handling:** rename `2125B13E-…​.jpg` → `IMG_2295.jpg` (clean filename within the 2290–2303 gap); tag it Display-P3 (or sRGB if it decodes flat) since it lacks a profile. The build verifies date-order ≈ filename-order across the set and logs any anomalies.

---

## 3. Information Architecture (the locked design)

The mockup iterated in the browser companion (`.superpowers/brainstorm/…/content/layout-v8.html`) is the reference implementation of the front end. Dark editorial theme, P3 greens, serif headings + system sans + mono for metadata.

**Album page** — header (wordmark, EN/PT toggle), hero, view tabs, content.

- **Hero**: a crossfade **carousel of Favorites** (auto-play ~5 s, subtle Ken-Burns ≤1.045, two-layer crossfade) with **play/pause**. The **"Day 1 → Day 124" line is a draggable scrubber** that scrubs the *entire* grow chronologically; **scrubbing pauses autoplay and shows a static frame (no Ken-Burns)**, resuming only on Play. Hero has its own **fullscreen** button; in fullscreen the scrubber overlays centered at the bottom.
- **View tabs:**
  - **Timeline (default)** — **phase chapters** (e.g. *Germination & Seedling → Vegetative → Flowering → Harvest*, each with a date/day range) with **day-groups** nested beneath (date + "Day N"). Photos in a responsive grid; hover shows an EXIF chip.
  - **Masonry** — multi-column justified grid.
  - **Favorites** ★ — a curated subset (~50, user-defined later).
  - **Bonus** — outtakes that didn't make the cut **plus videos** (poster + play overlay + duration; photos open the lightbox, videos play).
- **Lightbox**: large image-first, **always-visible metadata panel** (device, focal length + 35mm-equiv, ƒ-number, exposure, ISO, color profile, dimensions, capture date, "Day N · phase", P3 + HDR badges). **Keyboard nav** (←/→ **always chronological** regardless of view, Esc, I = toggle panel, F = fullscreen), prev/next, counter, **Download original**. A persisted **"Load full-resolution photos" toggle (off by default)** controls whether the lightbox loads the 2048px derivative (default) or the full-res original. A **Details ⇄ Comments** toggle at the top of the panel switches between the metadata and a per-photo **giscus** thread (§3a).
- **i18n**: EN default, PT-BR toggle (persisted to `localStorage`); PT copy uses *maconha* / *acervo*.

**Intro copy (approved, tweakable later)**
- EN: *"From May 31 to October 1, 2019, I grew three plants of my own — start to finish, seed to flower. This is the complete collection: 500 photographs documenting all five months of the grow, shot on an iPad Pro."*
- PT: *"De 31 de maio a 1º de outubro de 2019, cultivei minha própria maconha — três plantas, da semente à flor. Este é o acervo completo: 500 fotografias documentando os cinco meses de cultivo, do início ao fim, registradas num iPad Pro."*

---

## 3a. Comments (giscus)

Per-photo comments via **giscus** (GitHub Discussions), embedded in the lightbox panel behind the **Details ⇄ Comments** toggle (Details default; thread gets the full panel height).

- **Mapping:** `data-mapping="specific"`, `data-term="<album>:<photo-id>"` — one Discussion per photo, created **lazily on first comment** (no 500 empty threads).
- **Navigation:** on ←/→ the giscus iframe's term is updated via `postMessage`/`setConfig` (no full reload); the widget is lazy-loaded the first time the Comments tab is opened.
- **Theme & i18n:** giscus dark theme to match; `data-lang` follows the EN/PT toggle (`en`/`pt`).
- **Auth/moderation:** visitors comment with a GitHub account; reactions supported; moderation via the repo's Discussions.
- **Prerequisites (one-time):** repo **public** (already required for Pages), **Discussions enabled**, the **giscus GitHub App** installed on the repo, and a **"Comments" Discussion category** (Announcements-style — only maintainers open threads). The `data-repo` / `data-repo-id` / `data-category` / `data-category-id` come from giscus.app and live in site config.
- **Privacy note:** threads are public GitHub Discussions tied to commenters' GitHub identities — appropriate for a public archive, flagged so it's a conscious choice.

---

## 4. Image Pipeline (build-time)

**Hard rule:** encode with **`avifenc`**, **never ffmpeg** (it strips ICC and tags BT.709 → muted colors). The `full` tier is `avifenc` straight on the original — the Display-P3 ICC (536 bytes) is carried **byte-for-byte identical** (verified). The resized `thumb`/`view` tiers are resampled **ICC-aware first** (see "Color-safe resizing"), then `avifenc`; the P3 profile must survive the resize.

**EXIF:** extract with `exiftool` (cross-platform, already installed) → per-photo JSON.

**Tiers** (per photo; all AVIF, **`-d 10 -y 444`** 10-bit 4:4:4, ICC preserved; **chroma 4:2:0 gives ~no savings here, so 4:4:4 is free**):

| Tier | Long edge | Quality | ~Size | Use | Hosted on |
|---|---|---|---|---|---|
| `thumb` | 640px | q80 | ~46 KB | grids (timeline/masonry/favorites/bonus) | Pages |
| `view` | 2048px | q82 | ~400 KB | **default** lightbox | Pages |
| `full` | 4032px (native) | q80 | ~1.0–1.7 MB | lightbox toggle + download | **Release** |

**Color-safe resizing:** for `thumb`/`view`, resize with an ICC-aware resampler (libvips/`sharp`, Lanczos) that **applies EXIF orientation** and **re-embeds the Display-P3 profile**, then `avifenc`. `full` needs no resize (native), so ICC is trivially preserved. **Verify** on a sample that every tier's output still reports `ProfileDescription = Display P3` before batch-running.

**Projected weights (worst-case detail samples; real average lower):** Pages-side derivatives ≈ **~24 MB thumbs + ~200 MB view = ~224 MB**; full-res tier ≈ **~590 MB** (on Release).

**Build performance:** `-s 4` ≈ 27 s/full-res frame (~hours for 500). Use **`-s 6`** for the batch (one-time, much faster, negligible size cost) or `-s 4` if time allows. `avifenc -j all` saturates cores per image.

**Manifest:** `manifest.json` per album — ordered array of `{ id, file, datetime, day, width, height, orientation, hdr, exif:{model,focal,focal35,fnumber,exposure,iso,profile}, favorite, composite, tiers:{thumb,view,full} }`.

---

## 5. Hosting & Delivery

- **GitHub Pages** (the repo): site (HTML/CSS/JS) + `thumb` + `view` tiers ≈ **~224 MB** — well under the **1 GB** published-site limit, with room for future albums.
- **GitHub Release** (e.g. `acervo-01`): `full` AVIFs + bit-exact JPEG originals + Bonus videos, as assets (no 1 GB limit, GitHub-CDN backed; optional jsDelivr for extra caching). The full-res toggle and "Download original" link here.
- **Cloudflare (free)** in front of `gus.photos` for global caching — also removes the Pages 100 GB/month bandwidth concern.
- **No third-party image host.** (`imgcdn.dev` lacks AVIF + durability; `statically.io` would mean committing 1.3 GB into git. Both rejected.) Future durable upgrade if needed: **Cloudflare R2** (free 10 GB, no egress) at `originals.gus.photos`.
- **Videos (Bonus):** posters generated as AVIF tiers; video files (mp4/webm) as Release assets, lazy-loaded on play.

---

## 6. Data Model & Multi-Album

```
/                      → albums index (cards)
/acervo-01/            → album page
albums/
  acervo-01/
    album.json         → title{en,pt}, intro{en,pt}, dateRange,
                         phases:[{from,to,label{en,pt}}],
                         favorites:[ids], bonus:{photos:[ids], videos:[{poster,src,dur}]},
                         source:"~/maconhas-originals"
    manifest.json      → generated (§4)
```

A new album = new folder + `album.json` + originals; the build emits its manifest, derivatives, page, and an index card. Shared templates/CSS/JS across albums.

---

## 7. Repo Restructure & Domain

1. **Preserve old app:** create `legacy` from current `master`; push it.
2. **Default branch → `main`:** rename `master`→`main` (history continuous), set `main` as the GitHub default, then build the new site on `main` (old app files removed from `main`, still intact on `legacy`).
3. **Retire `master`** on the remote once `legacy` + `main` are confirmed.
4. **Domain:** add `CNAME` = `gus.photos`, enable Pages from `main`, configure DNS (apex `A`/`ALIAS` → Pages, or via Cloudflare), enable HTTPS.
5. `.gitignore`: keep `.superpowers/` (brainstorm scratch) and source originals out of git; originals live in the source folder / Release, never committed.

*(Default-branch swap and `master` deletion are GitHub-side actions via `gh`/web; called out in the plan.)*

---

## 8. Tech Stack

**Lean Node build → static output** (no SPA framework). Rationale: full control over the color-critical `avifenc` step, minimal/fast output, and the interactivity (tabs, lightbox, hero scrubber, i18n) is modest and already proven in vanilla JS in the mockup. Multi-album handled by data-driven templating over `album.json` + `manifest.json`.

- Build deps: `node`, `exiftool`, `avifenc` (libavif), `sharp`/libvips (ICC-aware resize).
- Output: plain `index.html` + per-album pages + `assets/` (CSS/JS) + image tiers + `manifest.json`.
- Optional: GitHub Actions to rebuild + deploy + publish Release on push (originals provided to CI or built locally and committed-as-artifacts).

---

## 9. Open Items (user provides later — not blocking the build skeleton)

- Final **Favorites** selection (~50 ids).
- **Bonus** outtakes + **video** files.
- **Phase boundary** dates/labels for the timeline chapters.
- Any **intro-copy** wording tweaks.
- Confirm **q80/q82** after seeing them on real full-album content (already chosen from the A/B).

---

## 10. Implementation Phases (preview for the plan)

1. **Repo restructure** — `legacy` branch, `master`→`main`, `.gitignore`, scaffold, commit this spec on `main`.
2. **Build pipeline** — originals → `exiftool` manifest → `avifenc` tiers (color-verified) → ordered `manifest.json`; composite rename + edge-case tagging.
3. **Front end** — productionize the v8 mockup as data-driven templates wired to the manifest (all views, lightbox + full-res toggle, hero scrubber/carousel, i18n).
4. **Hosting & comments** — Pages deploy, Release upload (full-res + originals + videos), `CNAME` + Cloudflare, DNS; enable Discussions + install the giscus app + create the Comments category, then wire the giscus config.
5. **Polish & QA** — Playwright pass (color spot-check, nav, i18n, responsive, fullscreen), Lighthouse, lazy-loading.
