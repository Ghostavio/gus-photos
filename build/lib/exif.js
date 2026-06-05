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
