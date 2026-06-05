import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const pexec = promisify(execFile);

const SPEED = 6;          // avifenc speed/quality for the poster (matches photo tiers)
const POSTER_PX = 640;    // poster width — same as the thumb tier
const POSTER_Q = 80;

async function probeVideo(src) {
  const { stdout } = await pexec('ffprobe', ['-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height',
    '-show_entries', 'format=duration',
    '-of', 'json', src], { maxBuffer: 1 << 24 });
  const j = JSON.parse(stdout);
  const v = (j.streams && j.streams[0]) || {};
  return { vcodec: v.codec_name || '', width: Number(v.width) || 0, height: Number(v.height) || 0,
           dur: Number(j.format && j.format.duration) || 0 };
}

async function audioCodec(src) {
  try {
    const { stdout } = await pexec('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', src]);
    return stdout.trim();
  } catch { return ''; } // no audio stream
}

function fmtDur(sec) { const s = Math.round(sec); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// Transcode a bonus video to a web-playable MP4 + extract an AVIF poster, returning a manifest entry.
// The web MP4 is re-encoded to high-quality H.264 (CRF 21) — the iPad records ~15 Mbps, far more than a
// web stream needs, so this is ~3x smaller and visually transparent for this SDR footage. The pristine
// originals go to the GitHub Release for download. The poster is a representative frame ~10% in, sized
// like the photo thumbs. Videos are SDR/BT.709 here, so there's no P3/HDR concern.
const CRF = 26; // web-friendly: ~170MB for this album's 6 clips, visually transparent for SDR phone footage
export async function makeVideo(src, { album, id, distDir }) {
  const vidDir = path.join(distDir, 'vid', album);
  const imgDir = path.join(distDir, 'img', album);
  fs.mkdirSync(vidDir, { recursive: true });
  fs.mkdirSync(imgDir, { recursive: true });

  const { width, height, dur } = await probeVideo(src);
  const mp4 = path.join(vidDir, `${id}.mp4`);
  const posterAvif = path.join(imgDir, `${id}.poster.avif`);

  if (!(fs.existsSync(mp4) && fs.existsSync(posterAvif))) { // skip when already built (fast re-renders)
    const acodec = await audioCodec(src);
    const vArgs = ['-c:v', 'libx264', '-crf', String(CRF), '-preset', 'slow', '-pix_fmt', 'yuv420p'];
    const aArgs = acodec === 'aac' ? ['-c:a', 'copy']
      : (acodec ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']);
    await pexec('ffmpeg', ['-y', '-i', src, ...vArgs, ...aArgs, '-movflags', '+faststart', mp4],
      { maxBuffer: 1 << 24 });

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gpv-'));
    try {
      const png = path.join(tmp, `${id}.png`);
      const t = Math.max(0.5, dur * 0.1);
      await pexec('ffmpeg', ['-y', '-ss', String(t), '-i', src, '-frames:v', '1',
        '-vf', `scale=${POSTER_PX}:-2`, png], { maxBuffer: 1 << 24 });
      await pexec('avifenc', ['-q', String(POSTER_Q), '-d', '10', '-y', '444', '-s', String(SPEED),
        '-j', 'all', png, posterAvif], { maxBuffer: 1 << 24 });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  return {
    id,
    src: `/vid/${album}/${id}.mp4`,
    poster: `/img/${album}/${id}.poster.avif`,
    width, height,
    durSec: dur,
    dur: fmtDur(dur),
  };
}
