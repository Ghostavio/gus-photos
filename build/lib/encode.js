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
const SPEED = 6; // batch speed/quality tradeoff

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
    const full = path.join(dir, `${id}.full.avif`);
    await avif(src, full, FULL_Q);
    tiers.full = full;
    return tiers;
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
