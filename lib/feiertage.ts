/**
 * Feiertage Kanton Aargau (Klingnau) — finale Liste
 *
 * Fixe Tage:
 *   1. Jan  Neujahr
 *   2. Jan  Berchtoldstag
 *   1. Aug  Nationalfeiertag
 *   1. Nov  Allerheiligen
 *  25. Dez  Weihnachten
 *  26. Dez  Stephanstag
 *
 * Bewegliche Tage (relativ zu Ostersonntag):
 *   Ostern − 2  Karfreitag
 *   Ostern +39  Auffahrt (Christi Himmelfahrt)
 */

function ostersonntag(jahr: number): Date {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

function addTage(datum: Date, n: number): Date {
  const d = new Date(datum);
  d.setDate(d.getDate() + n);
  return d;
}

function fmt(d: Date): string {
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  );
}

function berechneFeiertage(jahr: number): Map<string, string> {
  const ostern = ostersonntag(jahr);
  const f = new Map<string, string>();

  // Fixe Feiertage
  f.set(`${jahr}-01-01`, 'Neujahr');
  f.set(`${jahr}-01-02`, 'Berchtoldstag');
  f.set(`${jahr}-08-01`, 'Nationalfeiertag');
  f.set(`${jahr}-11-01`, 'Allerheiligen');
  f.set(`${jahr}-12-25`, 'Weihnachten');
  f.set(`${jahr}-12-26`, 'Stephanstag');

  // Bewegliche Feiertage
  f.set(fmt(addTage(ostern, -2)),  'Karfreitag');
  f.set(fmt(addTage(ostern, 39)),  'Auffahrt');

  return f;
}

// Harte Blocklist – diese Namen werden NIEMALS als Feiertag zurückgegeben,
// unabhängig davon was im Cache steht.
const KEIN_FEIERTAG = new Set([
  'Fronleichnam',
  'Corpus Christi',
]);

// Cache wird bei jedem Modulstart frisch angelegt.
const cache = new Map<number, Map<string, string>>();

function getJahr(jahr: number): Map<string, string> {
  if (!cache.has(jahr)) cache.set(jahr, berechneFeiertage(jahr));
  return cache.get(jahr)!;
}

/** Gibt den Feiertagsnamen für 'YYYY-MM-DD' zurück, oder null.
 *  Gibt IMMER null zurück für Tage in KEIN_FEIERTAG. */
export function isFeiertag(datum: string): string | null {
  const jahr = parseInt(datum.slice(0, 4), 10);
  const name = getJahr(jahr).get(datum) ?? null;
  if (name !== null && KEIN_FEIERTAG.has(name)) return null;
  return name;
}
