/**
 * Gesetzliche Feiertage – Bezirk Zurzach, Kanton Aargau, Schweiz
 *
 * Fixe Feiertage:
 *   01.01  Neujahr
 *   02.01  Berchtoldstag
 *   01.08  Bundesfeiertag
 *   01.11  Allerheiligen
 *   25.12  Weihnachten
 *   26.12  Stephanstag
 *
 * Bewegliche Feiertage (relativ zu Ostersonntag):
 *   Ostern − 2   Karfreitag
 *   Ostern + 39  Auffahrt (Christi Himmelfahrt)
 *   Ostern + 60  Fronleichnam
 *
 * Ausdrücklich KEINE Feiertage im Bezirk Zurzach:
 *   Ostermontag, Pfingstmontag, 1. Mai, Mariä Himmelfahrt (15.08), Mariä Empfängnis (08.12)
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
  f.set(`${jahr}-08-01`, 'Bundesfeiertag');
  f.set(`${jahr}-11-01`, 'Allerheiligen');
  f.set(`${jahr}-12-25`, 'Weihnachten');
  f.set(`${jahr}-12-26`, 'Stephanstag');

  // Bewegliche Feiertage
  f.set(fmt(addTage(ostern, -2)), 'Karfreitag');
  f.set(fmt(addTage(ostern, 39)), 'Auffahrt');
  f.set(fmt(addTage(ostern, 60)), 'Fronleichnam');

  return f;
}

const cache = new Map<number, Map<string, string>>();

function getJahr(jahr: number): Map<string, string> {
  if (!cache.has(jahr)) cache.set(jahr, berechneFeiertage(jahr));
  return cache.get(jahr)!;
}

/** Gibt den Feiertagsnamen für 'YYYY-MM-DD' zurück, oder null. */
export function isFeiertag(datum: string): string | null {
  const jahr = parseInt(datum.slice(0, 4), 10);
  return getJahr(jahr).get(datum) ?? null;
}
