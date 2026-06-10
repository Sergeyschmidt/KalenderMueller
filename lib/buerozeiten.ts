import type { Auftrag, Mitarbeiter } from './types';
import { isFeiertag } from './feiertage';

// ── ID-Schema: "virtual::Schmidt::2026-06-05" ─────────────────────────────────
const PREFIX = 'virtual::';

export function isVirtuellerEintrag(id: string): boolean {
  return id.startsWith(PREFIX);
}

export function virtuelleId(mitarbeiter: string, datum: string): string {
  return `${PREFIX}${mitarbeiter}::${datum}`;
}

export function parseVirtuelleId(
  id: string
): { mitarbeiter: string; datum: string } | null {
  if (!id.startsWith(PREFIX)) return null;
  const rest   = id.slice(PREFIX.length);
  const sepIdx = rest.indexOf('::');
  if (sepIdx === -1) return null;
  return { mitarbeiter: rest.slice(0, sepIdx), datum: rest.slice(sepIdx + 2) };
}

/**
 * Generiert virtuelle Bürozeit-Aufträge für die angegebenen Daten.
 * Automatische Zeiten werden aus mitarbeiterListe (auto_buerozeit_start/end) gelesen.
 *
 * Wird unterdrückt wenn:
 *   - Der Tag ein Wochenende oder Feiertag ist
 *   - (mitarbeiter|datum) in ausnahmenSet enthalten ist
 *   - Bereits ein echter Eintrag für denselben Slot existiert
 */
export function getVirtuelleAuftraege(
  daten: string[],
  ausnahmenSet: Set<string>,
  auftraege: Auftrag[],
  mitarbeiterListe: Mitarbeiter[]
): Auftrag[] {
  // Nur Mitarbeiter mit konfigurierten Auto-Bürozeiten
  const mitAutoZeiten = mitarbeiterListe.filter(
    m => m.is_active &&
         m.auto_buerozeit_start != null &&
         m.auto_buerozeit_end   != null
  );

  if (mitAutoZeiten.length === 0) return [];

  const ergebnis: Auftrag[] = [];

  for (const datum of daten) {
    // Nur Montag–Freitag und kein Feiertag
    const [y, mo, d] = datum.split('-').map(Number);
    const wochentag  = new Date(y, mo - 1, d).getDay();
    if (wochentag === 0 || wochentag === 6) continue;
    if (isFeiertag(datum) !== null)          continue;

    for (const ma of mitAutoZeiten) {
      const start = ma.auto_buerozeit_start!;
      const end   = ma.auto_buerozeit_end!;

      // Ausnahme (manuell gelöscht für diesen Tag)?
      if (ausnahmenSet.has(`${ma.name}|${datum}`)) continue;

      // Echter Eintrag für denselben Slot bereits vorhanden?
      const vorhanden = auftraege.some(
        a =>
          a.mitarbeiter  === ma.name &&
          a.datum        === datum   &&
          a.start_stunde === start   &&
          a.end_stunde   === end     &&
          a.typ          === 'buerozeit'
      );
      if (vorhanden) continue;

      ergebnis.push({
        id:           virtuelleId(ma.name, datum),
        titel:        'Büro',
        mitarbeiter:  ma.name,
        datum,
        start_stunde: start,
        end_stunde:   end,
        status:       'erfasst',
        typ:          'buerozeit',
      });
    }
  }

  return ergebnis;
}
