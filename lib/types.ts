export type Status = 'erfasst' | 'in_bearbeitung' | 'fertig';

export const STATUS_LABELS: Record<Status, string> = {
  erfasst: 'Erfasst',
  in_bearbeitung: 'In Bearbeitung',
  fertig: 'Fertig',
};

export const STATUS_COLORS_LIGHT: Record<Status, string> = {
  erfasst: 'bg-red-100 border-red-400',
  in_bearbeitung: 'bg-yellow-100 border-yellow-400',
  fertig: 'bg-green-100 border-green-400',
};

export const STATUS_TEXT_COLORS: Record<Status, string> = {
  erfasst: 'text-red-900',
  in_bearbeitung: 'text-yellow-900',
  fertig: 'text-green-900',
};

export const STATUS_DOT_COLORS: Record<Status, string> = {
  erfasst: 'bg-red-500',
  in_bearbeitung: 'bg-yellow-500',
  fertig: 'bg-green-500',
};

export const STATUS_BORDER_L: Record<Status, string> = {
  erfasst: 'border-l-red-500',
  in_bearbeitung: 'border-l-yellow-500',
  fertig: 'border-l-green-500',
};

export const STATUS_BORDER_T: Record<Status, string> = {
  erfasst: 'border-t-red-500',
  in_bearbeitung: 'border-t-yellow-500',
  fertig: 'border-t-green-500',
};

export const MITARBEITER = [
  'Scussel',
  'Laabs',
  'Schmidt',
  'Rasekh',
  'Müller Heinz/Monika',
  'Freier Platz 1',
  'Freier Platz 2',
] as const;

export type MitarbeiterName = (typeof MITARBEITER)[number];

export const STUNDEN = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

export type AuftragTyp = 'auftrag' | 'buerozeit';

export const AUFTRAG_TYP_LABELS: Record<AuftragTyp, string> = {
  auftrag:   'Auftrag / Termin',
  buerozeit: 'Bürozeit',
};

export interface Auftrag {
  id: string;
  titel: string;
  beschreibung?: string;
  kunde?: string;
  mitarbeiter: string;
  datum: string;      // Startdatum YYYY-MM-DD
  datum_bis?: string; // Enddatum YYYY-MM-DD (nur bei mehrtägigen Aufträgen)
  start_stunde: number; // 7–16
  end_stunde: number;   // 8–17 (exklusiv; bei mehrtägigen Aufträgen: Endstunde am Enddatum)
  status: Status;
  typ?: AuftragTyp;  // undefined = rückwärtskompatibel → wird als 'auftrag' behandelt
  created_at?: string;
  updated_at?: string;
}

export interface AuftragFormData {
  titel: string;
  beschreibung: string;
  kunde: string;
  mitarbeiter: string;
  datum: string;
  datum_bis: string;
  start_stunde: number;
  end_stunde: number;
  status: Status;
  typ: AuftragTyp;
}

export interface Mitarbeiter {
  id: string;
  name: string;
  reihenfolge: number;
  is_active: boolean;
  auto_buerozeit_start?: number | null;
  auto_buerozeit_end?:   number | null;
  geburtsdatum?:         string | null; // YYYY-MM-DD
  eintrittsdatum?:       string | null; // YYYY-MM-DD
  created_at?: string;
}

export interface JahresEreignis {
  id: string;
  datum: string; // YYYY-MM-DD (mit angezeigtem Jahr)
  label: string; // z.B. "🎁 Schmidt" oder "🎉 Scussel (5J.)"
  typ: 'geburtstag' | 'jubilaeum';
}

/** Fallback-Liste wenn die DB-Tabelle noch nicht existiert oder leer ist. */
export const FALLBACK_MITARBEITER_LISTE: Mitarbeiter[] = [
  { id: 'fb-scussel', name: 'Scussel',             reihenfolge: 1, is_active: true, auto_buerozeit_start: 7,    auto_buerozeit_end: 9    },
  { id: 'fb-laabs',   name: 'Laabs',               reihenfolge: 2, is_active: true, auto_buerozeit_start: null, auto_buerozeit_end: null },
  { id: 'fb-schmidt', name: 'Schmidt',             reihenfolge: 3, is_active: true, auto_buerozeit_start: 9,    auto_buerozeit_end: 11   },
  { id: 'fb-rasekh',  name: 'Rasekh',              reihenfolge: 4, is_active: true, auto_buerozeit_start: null, auto_buerozeit_end: null },
  { id: 'fb-mueller', name: 'Müller Heinz/Monika', reihenfolge: 5, is_active: true, auto_buerozeit_start: null, auto_buerozeit_end: null },
  { id: 'fb-platz1',  name: 'Freier Platz 1',      reihenfolge: 6, is_active: true, auto_buerozeit_start: null, auto_buerozeit_end: null },
  { id: 'fb-platz2',  name: 'Freier Platz 2',      reihenfolge: 7, is_active: true, auto_buerozeit_start: null, auto_buerozeit_end: null },
];

/** Gespeicherte Ausnahme: dieser Mitarbeiter hat an diesem Tag KEINE Standard-Bürozeit */
export interface BueroAusnahme {
  id: string;
  mitarbeiter: string;
  datum: string; // YYYY-MM-DD
  created_at?: string;
}

export type AbwesenheitsTyp = 'urlaub' | 'krankheit' | 'militaer' | 'zivilschutz';

export const ABWESENHEITS_LABELS: Record<AbwesenheitsTyp, string> = {
  urlaub:      'Urlaub',
  krankheit:   'Krankheit',
  militaer:    'Militär',
  zivilschutz: 'Zivilschutz',
};

/** Punkt-Farbe in MonatsAnsicht */
export const ABWESENHEITS_DOT: Record<AbwesenheitsTyp, string> = {
  urlaub:      'bg-orange-400',
  krankheit:   'bg-red-400',
  militaer:    'bg-slate-500',
  zivilschutz: 'bg-blue-400',
};

/** Textfarbe (normal) */
export const ABWESENHEITS_TEXT: Record<AbwesenheitsTyp, string> = {
  urlaub:      'text-orange-700',
  krankheit:   'text-red-700',
  militaer:    'text-slate-600',
  zivilschutz: 'text-blue-700',
};

/** Textfarbe (fett/Name) */
export const ABWESENHEITS_BOLD: Record<AbwesenheitsTyp, string> = {
  urlaub:      'text-orange-900',
  krankheit:   'text-red-900',
  militaer:    'text-slate-800',
  zivilschutz: 'text-blue-900',
};

export interface Urlaub {
  id: string;
  mitarbeiter: string;
  datum_von: string; // YYYY-MM-DD
  datum_bis: string; // YYYY-MM-DD (inklusive)
  typ?: AbwesenheitsTyp; // optional – fehlend = 'urlaub' (rückwärtskompatibel)
  notiz?: string;
}
