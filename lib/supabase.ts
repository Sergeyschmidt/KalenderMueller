import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Auftrag, Urlaub, BueroAusnahme, Mitarbeiter } from './types';

// Diagnose: zeigt in der Browser-Konsole ob die Env-Var vom Build eingebettet wurde.
// Steht hier "undefined" → Vercel-Redeploy nach dem Setzen der Variablen nötig.
console.log('SUPABASE_URL_CHECK:', process.env.NEXT_PUBLIC_SUPABASE_URL);

// ── Konfiguration ─────────────────────────────────────────────────────────────
// Einmalig beim Module-Load ausgelesen. NEXT_PUBLIC_* werden von Next.js/Vercel
// zur Build-Zeit in den Bundle eingebettet – kein Lazy-Lesen nötig.
const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Debug-Log: in der Browser-Konsole sichtbar beim ersten Laden
if (typeof window !== 'undefined') {
  console.log('[Supabase] URL     :', supabaseUrl  || '(nicht gesetzt – Offline-Modus!)');
  console.log('[Supabase] Key     :', supabaseAnonKey ? `${supabaseAnonKey.slice(0, 12)}… (${supabaseAnonKey.length} Zeichen)` : '(nicht gesetzt!)');
}

export const SUPABASE_KONFIGURIERT =
  supabaseUrl.startsWith('https://') && supabaseAnonKey.length > 20;

// Client wird genau einmal erzeugt – oder ist null wenn Keys fehlen.
// So werden nie createClient(undefined, undefined)-Aufrufe gemacht.
export const supabase: SupabaseClient | null = SUPABASE_KONFIGURIERT
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

// Rückwärtskompatibilität für KalenderApp.tsx
export const isSupabaseConfigured = () => SUPABASE_KONFIGURIERT;
export function getSupabaseClient(): SupabaseClient | null { return supabase; }

/*
  ══════════════════════════════════════════════════════════════════
  SQL-SCHEMA — einmalig im Supabase SQL-Editor ausführen
  ══════════════════════════════════════════════════════════════════

  -- 1. Tabellen anlegen
  CREATE TABLE auftraege (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titel        TEXT NOT NULL,
    beschreibung TEXT,
    kunde        TEXT,
    mitarbeiter  TEXT NOT NULL,
    datum        DATE NOT NULL,
    datum_bis    DATE,
    start_stunde INTEGER NOT NULL CHECK (start_stunde >= 7 AND start_stunde <= 16),
    end_stunde   INTEGER NOT NULL CHECK (end_stunde >= 8 AND end_stunde <= 17),
    status       TEXT NOT NULL DEFAULT 'erfasst'
                 CHECK (status IN ('erfasst', 'in_bearbeitung', 'fertig')),
    typ          TEXT NOT NULL DEFAULT 'auftrag'
                 CHECK (typ IN ('auftrag', 'buerozeit')),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE urlaube (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mitarbeiter TEXT NOT NULL,
    datum_von   DATE NOT NULL,
    datum_bis   DATE NOT NULL,
    notiz       TEXT,
    typ         TEXT NOT NULL DEFAULT 'urlaub'
                CHECK (typ IN ('urlaub', 'krankheit', 'militaer', 'zivilschutz')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  -- 2. Row Level Security aktivieren
  ALTER TABLE auftraege ENABLE ROW LEVEL SECURITY;
  ALTER TABLE urlaube   ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "allow_all" ON auftraege FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "allow_all" ON urlaube   FOR ALL USING (true) WITH CHECK (true);

  -- Ausnahmen für Standard-Bürozeiten (gelöschte Tage)
  CREATE TABLE buerozeit_ausnahmen (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mitarbeiter TEXT NOT NULL,
    datum       DATE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (mitarbeiter, datum)
  );
  ALTER TABLE buerozeit_ausnahmen ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "allow_all" ON buerozeit_ausnahmen FOR ALL USING (true) WITH CHECK (true);

  -- 3. Falls die Tabelle bereits existiert: neue Spalten nachträglich hinzufügen
  ALTER TABLE auftraege
    ADD COLUMN IF NOT EXISTS typ TEXT NOT NULL DEFAULT 'auftrag'
    CHECK (typ IN ('auftrag', 'buerozeit'));

  -- Abwesenheitstyp für urlaube (Migration für bestehende Tabellen)
  ALTER TABLE urlaube
    ADD COLUMN IF NOT EXISTS typ TEXT NOT NULL DEFAULT 'urlaub'
    CHECK (typ IN ('urlaub', 'krankheit', 'militaer', 'zivilschutz'));

  -- 4. Echtzeit-Synchronisation freischalten (WICHTIG für Live-Sync!)
  ALTER PUBLICATION supabase_realtime ADD TABLE auftraege;
  ALTER PUBLICATION supabase_realtime ADD TABLE urlaube;
  ALTER PUBLICATION supabase_realtime ADD TABLE buerozeit_ausnahmen;

  -- Mitarbeiter-Tabelle mit optionalen Auto-Bürozeiten
  CREATE TABLE mitarbeiter (
    id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name                  TEXT NOT NULL UNIQUE,
    reihenfolge           INTEGER NOT NULL DEFAULT 0,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    auto_buerozeit_start  INTEGER DEFAULT NULL,
    auto_buerozeit_end    INTEGER DEFAULT NULL,
    created_at            TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE mitarbeiter ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "allow_all" ON mitarbeiter FOR ALL USING (true) WITH CHECK (true);
  ALTER PUBLICATION supabase_realtime ADD TABLE mitarbeiter;

  -- Geburtsdatum + Eintrittsdatum (Migration für bestehende Tabellen)
  ALTER TABLE mitarbeiter ADD COLUMN IF NOT EXISTS geburtsdatum  DATE DEFAULT NULL;
  ALTER TABLE mitarbeiter ADD COLUMN IF NOT EXISTS eintrittsdatum DATE DEFAULT NULL;

  -- Initiale Mitarbeiterdaten (inkl. Auto-Bürozeiten für Schmidt + Scussel)
  INSERT INTO mitarbeiter (name, reihenfolge, auto_buerozeit_start, auto_buerozeit_end) VALUES
    ('Scussel',             1, 7,    9),
    ('Laabs',               2, NULL, NULL),
    ('Schmidt',             3, 9,    11),
    ('Rasekh',              4, NULL, NULL),
    ('Müller Heinz/Monika', 5, NULL, NULL),
    ('Freier Platz 1',      6, NULL, NULL),
    ('Freier Platz 2',      7, NULL, NULL);
  ══════════════════════════════════════════════════════════════════
*/

// ── Verbindungstest ───────────────────────────────────────────────────────────
// Gibt true zurück wenn die DB antwortet, false bei jedem Fehler.
// Wird von KalenderApp für den Retry-Loop verwendet.
export async function testVerbindung(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('auftraege').select('id').limit(1);
    if (error) {
      console.error('[Supabase] testVerbindung Fehler:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] testVerbindung Exception:', err);
    return false;
  }
}

// ── Aufträge ──────────────────────────────────────────────────────────────────

export async function dbFetchAuftraege(): Promise<Auftrag[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('auftraege').select('*').order('datum', { ascending: true });
  if (error) { console.error('[Supabase] fetch auftraege:', error.message); return []; }
  return (data ?? []) as Auftrag[];
}

export async function dbCreateAuftrag(
  auftrag: Omit<Auftrag, 'id' | 'created_at' | 'updated_at'>
): Promise<Auftrag | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('auftraege').insert(auftrag).select().single();
  if (error) {
    console.error('[Supabase] insert auftrag:', error.message, '| Code:', error.code, '| Details:', error.details);
    return null;
  }
  return data as Auftrag;
}

export async function dbUpdateAuftrag(id: string, updates: Partial<Auftrag>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('auftraege')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[Supabase] update auftrag:', error.message, '| Code:', error.code);
}

export async function dbDeleteAuftrag(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('auftraege').delete().eq('id', id);
  if (error) console.error('[Supabase] delete auftrag:', error.message);
}

// ── Urlaube ───────────────────────────────────────────────────────────────────

export async function dbFetchUrlaube(): Promise<Urlaub[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('urlaube').select('*').order('datum_von', { ascending: true });
  if (error) { console.error('[Supabase] fetch urlaube:', error.message); return []; }
  return (data ?? []) as Urlaub[];
}

export async function dbCreateUrlaub(
  urlaub: Omit<Urlaub, 'id'>
): Promise<Urlaub | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('urlaube').insert(urlaub).select().single();
  if (error) {
    console.error('[Supabase] insert urlaub:', error.message, '| Code:', error.code, '| Details:', error.details);
    return null;
  }
  return data as Urlaub;
}

export async function dbDeleteUrlaub(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('urlaube').delete().eq('id', id);
  if (error) console.error('[Supabase] delete urlaub:', error.message);
}

// ── Bürozeit-Ausnahmen (gelöschte Standard-Bürozeiten) ────────────────────────

export async function dbFetchBueroAusnahmen(): Promise<BueroAusnahme[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('buerozeit_ausnahmen').select('*');
  if (error) { console.error('[Supabase] fetch bueroAusnahmen:', error.message); return []; }
  return (data ?? []) as BueroAusnahme[];
}

export async function dbCreateBueroAusnahme(
  mitarbeiter: string, datum: string
): Promise<BueroAusnahme | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('buerozeit_ausnahmen')
    .insert({ mitarbeiter, datum })
    .select().single();
  if (error) { console.error('[Supabase] insert bueroAusnahme:', error.message); return null; }
  return data as BueroAusnahme;
}

export async function dbDeleteBueroAusnahme(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('buerozeit_ausnahmen').delete().eq('id', id);
  if (error) console.error('[Supabase] delete bueroAusnahme:', error.message);
}

// ── Mitarbeiter ───────────────────────────────────────────────────────────────

export async function dbFetchMitarbeiter(): Promise<Mitarbeiter[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('mitarbeiter').select('*').order('reihenfolge', { ascending: true });
  if (error) { console.error('[Supabase] fetch mitarbeiter:', error.message); return null; }
  return (data ?? []) as Mitarbeiter[];
}

export async function dbCreateMitarbeiter(
  name: string, reihenfolge: number
): Promise<Mitarbeiter | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('mitarbeiter').insert({ name, reihenfolge }).select().single();
  if (error) { console.error('[Supabase] insert mitarbeiter:', error.message); return null; }
  return data as Mitarbeiter;
}

export async function dbUpdateMitarbeiter(
  id: string, updates: Partial<Mitarbeiter>
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('mitarbeiter').update(updates).eq('id', id);
  if (error) console.error('[Supabase] update mitarbeiter:', error.message);
}

export async function dbDeleteMitarbeiter(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('mitarbeiter').delete().eq('id', id);
  if (error) console.error('[Supabase] delete mitarbeiter:', error.message);
}
