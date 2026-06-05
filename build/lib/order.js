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
  // Accept either "YYYY-MM-DD" or EXIF "YYYY:MM:DD" for firstDate by normalizing separators.
  const toUTC = (s) => { const [Y, Mo, D] = s.slice(0, 10).replace(/:/g, '-').split('-').map(Number); return Date.UTC(Y, Mo - 1, D); };
  return Math.round((toUTC(localDate(dt)) - toUTC(firstDate)) / 86400000) + 1;
}

export function assignPhase(dt, phases) {
  const d = localDate(dt);
  return phases.find(p => d >= p.from && d <= p.to) || null;
}
