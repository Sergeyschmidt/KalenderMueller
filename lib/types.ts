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
}

export interface Urlaub {
  id: string;
  mitarbeiter: string;
  datum_von: string; // YYYY-MM-DD
  datum_bis: string; // YYYY-MM-DD (inklusive)
  notiz?: string;
}
