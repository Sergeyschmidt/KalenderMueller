import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Auftrag, Urlaub } from './types';

export const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return url.startsWith('https://') && key.length > 20;
};

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

/** Liefert den initialisierten Supabase-Client (für Echtzeit-Subscriptions). */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getClient();
}

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
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  -- 2. Row Level Security aktivieren
  ALTER TABLE auftraege ENABLE ROW LEVEL SECURITY;
  ALTER TABLE urlaube   ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "allow_all" ON auftraege FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "allow_all" ON urlaube   FOR ALL USING (true) WITH CHECK (true);

  -- 3. Falls die Tabelle bereits existiert: neue Spalte nachträglich hinzufügen
  ALTER TABLE auftraege
    ADD COLUMN IF NOT EXISTS typ TEXT NOT NULL DEFAULT 'auftrag'
    CHECK (typ IN ('auftrag', 'buerozeit'));

  -- 4. Echtzeit-Synchronisation freischalten (WICHTIG für Live-Sync!)
  ALTER PUBLICATION supabase_realtime ADD TABLE auftraege;
  ALTER PUBLICATION supabase_realtime ADD TABLE urlaube;
  ══════════════════════════════════════════════════════════════════
*/

// ── Aufträge ──────────────────────────────────────────────────────────────────

export async function dbFetchAuftraege(): Promise<Auftrag[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getClient()
    .from('auftraege').select('*').order('datum', { ascending: true });
  if (error) { console.error('Supabase fetch auftraege:', error.message); return []; }
  return (data ?? []) as Auftrag[];
}

export async function dbCreateAuftrag(
  auftrag: Omit<Auftrag, 'id' | 'created_at' | 'updated_at'>
): Promise<Auftrag | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getClient().from('auftraege').insert(auftrag).select().single();
  if (error) { console.error('Supabase insert auftrag:', error.message); return null; }
  return data as Auftrag;
}

export async function dbUpdateAuftrag(id: string, updates: Partial<Auftrag>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getClient()
    .from('auftraege')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('Supabase update auftrag:', error.message);
}

export async function dbDeleteAuftrag(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getClient().from('auftraege').delete().eq('id', id);
  if (error) console.error('Supabase delete auftrag:', error.message);
}

// ── Urlaube ───────────────────────────────────────────────────────────────────

export async function dbFetchUrlaube(): Promise<Urlaub[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getClient()
    .from('urlaube').select('*').order('datum_von', { ascending: true });
  if (error) { console.error('Supabase fetch urlaube:', error.message); return []; }
  return (data ?? []) as Urlaub[];
}

export async function dbCreateUrlaub(
  urlaub: Omit<Urlaub, 'id'>
): Promise<Urlaub | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getClient().from('urlaube').insert(urlaub).select().single();
  if (error) { console.error('Supabase insert urlaub:', error.message); return null; }
  return data as Urlaub;
}

export async function dbDeleteUrlaub(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getClient().from('urlaube').delete().eq('id', id);
  if (error) console.error('Supabase delete urlaub:', error.message);
}
