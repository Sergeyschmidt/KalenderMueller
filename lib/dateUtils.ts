import {
  startOfWeek,
  endOfMonth,
  startOfMonth,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  getDay,
  getISOWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';

export { isToday, isSameMonth };

export const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

/** Liefert Mo–Fr der Woche, die das Datum enthält. */
export function getWochentage(datum: Date): Date[] {
  const montag = startOfWeek(datum, { weekStartsOn: 1 });
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(montag);
    d.setDate(montag.getDate() + i);
    return d;
  });
}

/** Date → 'YYYY-MM-DD' (Lokalzeit, kein TZ-Shift) */
export function formatDatum(datum: Date): string {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → Date (Lokalzeit-Mitternacht) */
export function parseDatum(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatAnzeige(datum: Date): string {
  return format(datum, 'dd.MM.', { locale: de });
}

export function formatWocheAnzeige(datum: Date): string {
  const mon = startOfWeek(datum, { weekStartsOn: 1 });
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return `${format(mon, 'dd.', { locale: de })} – ${format(fri, 'dd. MMMM yyyy', { locale: de })}`;
}

export function formatMonatAnzeige(datum: Date): string {
  return format(datum, 'MMMM yyyy', { locale: de });
}

export const naechsteWoche   = (d: Date) => addWeeks(d, 1);
export const vorherigeWoche  = (d: Date) => subWeeks(d, 1);
export const naechsterMonat  = (d: Date) => addMonths(d, 1);
export const vorherigerMonat = (d: Date) => subMonths(d, 1);

/** Gibt ein 2D-Array (Wochen × 7 Tage) zurück; leere Felder = null */
export function getMonatsKalender(datum: Date): (Date | null)[][] {
  const firstDay = startOfMonth(datum);
  const lastDay = endOfMonth(datum);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });

  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  // Mo=1 … So=7
  const startPad = ((getDay(firstDay) + 6) % 7); // 0 = Montag
  for (let i = 0; i < startPad; i++) week.push(null);

  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return weeks;
}

export function formatStunde(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** "Montag, 26. Mai" – Kopfzeile der Tages-Tabelle */
export function formatTagKopf(datum: Date): string {
  return format(datum, 'EEEE, dd. MMMM', { locale: de });
}

/** Alle Tage (YYYY-MM-DD) zwischen start und end (inklusive). */
export function getDatesInRange(start: Date, end: Date): string[] {
  const result: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(),   end.getMonth(),   end.getDate());
  while (d <= e) {
    result.push(formatDatum(d));
    d.setDate(d.getDate() + 1);
  }
  return result;
}

export { startOfMonth, endOfMonth, getISOWeek };
