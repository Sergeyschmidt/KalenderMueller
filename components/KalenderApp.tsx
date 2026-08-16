'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { useKalenderStore } from '@/lib/store';
import { Auftrag, Urlaub, BueroAusnahme, Mitarbeiter, STUNDEN, FALLBACK_MITARBEITER_LISTE, JahresEreignis, getAuftragMitarbeiterListe } from '@/lib/types';
import {
  getWochentage,
  formatDatum,
  formatWocheAnzeige,
  formatMonatAnzeige,
  formatTagKopf,
  naechsteWoche,
  vorherigeWoche,
  naechsterMonat,
  vorherigerMonat,
  parseDatum,
  getDatesInRange,
  startOfMonth,
  endOfMonth,
  getISOWeek,
} from '@/lib/dateUtils';
import {
  dbFetchAuftraege,
  dbFetchUrlaube,
  dbFetchBueroAusnahmen,
  dbFetchMitarbeiter,
  dbCreateAuftrag,
  dbUpdateAuftrag,
  dbDeleteAuftrag,
  dbCreateUrlaub,
  dbUpdateUrlaub,
  dbDeleteUrlaub,
  dbCreateBueroAusnahme,
  dbUpdateMitarbeiter,
  getSupabaseClient,
  isSupabaseConfigured,
  testVerbindung,
  SUPABASE_KONFIGURIERT,
} from '@/lib/supabase';
import {
  getVirtuelleAuftraege,
  isVirtuellerEintrag,
  parseVirtuelleId,
  extractAuftragId,
} from '@/lib/buerozeiten';
import WochenAnsicht    from './WochenAnsicht';
import MonatsAnsicht    from './MonatsAnsicht';
import TagAnsicht       from './TagAnsicht';
import AuftragModal     from './AuftragModal';
import UrlaubModal        from './UrlaubModal';
import MitarbeiterModal  from './MitarbeiterModal';

export default function KalenderApp() {
  const {
    auftraege,
    urlaube,
    bueroAusnahmen,
    mitarbeiter,
    ansicht,
    aktuellesDatum,
    setAuftraege,
    setUrlaube,
    setBueroAusnahmen,
    setMitarbeiter,
    setAnsicht,
    setAktuellesDatum,
    setSelectedTag,
    addAuftrag,
    updateAuftrag,
    deleteAuftrag,
    addUrlaub,
    updateUrlaub,
    deleteUrlaub,
    addBueroAusnahme,
    updateMitarbeiterItem,
    setAuthenticated,
  } = useKalenderStore();

  const [modalState, setModalState] = useState<{
    open: boolean;
    auftrag?: Auftrag;
    prefill?: Partial<Auftrag>;
    isStandard?: boolean;
  }>({ open: false });

  const [activeAuftrag,         setActiveAuftrag]         = useState<Auftrag | null>(null);
  // dbBereit: DB wurde mind. einmal erfolgreich geladen → Writes zur DB erlaubt.
  // Getrennt von supabaseActive (Realtime-Verbindungsstatus), weil der Realtime-Channel
  // zeitweise CHANNEL_ERROR / TIMED_OUT meldet und früher fälschlicherweise alle
  // DB-Writes blockiert hat.
  const [dbBereit,              setDbBereit]              = useState(false);
  const [supabaseActive,        setSupabaseActive]         = useState(false);
  // verbinde: true solange der initiale Verbindungsaufbau läuft (max. ~5 Sek.)
  // Verhindert dass "Offline" sofort angezeigt wird bevor die DB überhaupt probiert wurde.
  const [verbinde,              setVerbinde]              = useState(SUPABASE_KONFIGURIERT);
  const [urlaubModalOffen,       setUrlaubModalOffen]       = useState(false);
  const [mitarbeiterModalOffen,  setMitarbeiterModalOffen]  = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // ── Einmalige Migration: alte Bürozeit-Titel im LocalStorage umbenennen ─────
  useEffect(() => {
    const altTitel = new Set(['bürozeit', 'fixe bürozeit', 'buerozeit', 'burozeit']);
    const zuMigrieren = auftraege.filter(
      a => altTitel.has(a.titel.toLowerCase().trim()) && a.titel !== 'Büro'
    );
    if (zuMigrieren.length === 0) return;
    setAuftraege(
      auftraege.map(a =>
        altTitel.has(a.titel.toLowerCase().trim())
          ? { ...a, titel: 'Büro', typ: 'buerozeit' as const }
          : a
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Supabase: Initialdaten + Echtzeit ─────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setVerbinde(false);
      return;
    }

    // Retry-Loop: 3 Versuche à 1.5 s Pause = max. ~5 Sekunden
    const ladeInitialDaten = async () => {
      const MAX_VERSUCHE = 3;
      for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
        if (versuch > 1) {
          console.log(`[DB] Verbindungsversuch ${versuch}/${MAX_VERSUCHE}…`);
          await new Promise(r => setTimeout(r, 1500));
        }

        const erreichbar = await testVerbindung();
        if (!erreichbar) continue;

        // Verbindung steht → alle Tabellen laden
        try {
          const [a, u, ba, ma] = await Promise.all([
            dbFetchAuftraege(),
            dbFetchUrlaube(),
            dbFetchBueroAusnahmen(),
            dbFetchMitarbeiter(),
          ]);
          setAuftraege(a);
          setUrlaube(u);
          setBueroAusnahmen(ba);
          if (ma !== null) setMitarbeiter(ma);
          setDbBereit(true);
          setSupabaseActive(true);
        } catch (err) {
          console.error('[DB] Datenladen nach Verbindungstest fehlgeschlagen:', err);
        }

        setVerbinde(false);
        return; // Erfolg – Retry-Loop beenden
      }

      // Alle Versuche erschöpft
      console.error('[DB] Nicht erreichbar nach', MAX_VERSUCHE, 'Versuchen – Offline-Modus');
      setVerbinde(false);
    };

    ladeInitialDaten();

    // ── Realtime-Subscription (unabhängig vom Retry-Loop) ─────────────────
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel('kalender-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auftraege' },
        ({ new: row }) => addAuftrag(row as Auftrag))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auftraege' },
        ({ new: row }) => updateAuftrag((row as Auftrag).id, row as Partial<Auftrag>))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'auftraege' },
        ({ old: row }) => deleteAuftrag((row as { id: string }).id))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'urlaube' },
        ({ new: row }) => addUrlaub(row as Urlaub))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'urlaube' },
        ({ old: row }) => deleteUrlaub((row as { id: string }).id))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buerozeit_ausnahmen' },
        ({ new: row }) => addBueroAusnahme(row as BueroAusnahme))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mitarbeiter' },
        () => { dbFetchMitarbeiter().then(r => { if (r !== null) setMitarbeiter(r); }); })
      .subscribe((status) => {
        // Nur auf SUBSCRIBED reagieren – transiente Fehler (CHANNEL_ERROR, TIMED_OUT)
        // sollen eine bereits aufgebaute Verbindung nicht auf "Offline" kippen.
        if (status === 'SUBSCRIBED') setSupabaseActive(true);
      });

    return () => { client.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Aktive Mitarbeiterliste (mit Fallback inkl. auto_buerozeit-Daten) ────
  const aktiveMitarbeiterListe = useMemo(() => {
    if (mitarbeiter.length > 0) {
      return mitarbeiter
        .filter(m => m.is_active)
        .sort((a, b) => a.reihenfolge - b.reihenfolge);
    }
    // Fallback: hardcodierte Liste wenn DB-Tabelle noch nicht existiert
    return FALLBACK_MITARBEITER_LISTE;
  }, [mitarbeiter]);

  const aktiveMitarbeiterNamen = useMemo(
    () => aktiveMitarbeiterListe.map(m => m.name),
    [aktiveMitarbeiterListe]
  );

  // ── Datum-Berechnungen ────────────────────────────────────────────────────
  const aktuellesDatumObj = parseDatum(aktuellesDatum);
  const wochentage        = getWochentage(aktuellesDatumObj);
  const wochentageStr     = wochentage.map(formatDatum);

  // ── Jährliche Ereignisse (Geburtstag / Firmenjubiläum) ────────────────────
  const jahresEreignisse = useMemo((): JahresEreignis[] => {
    const year = aktuellesDatumObj.getFullYear();
    const events: JahresEreignis[] = [];
    for (const ma of aktiveMitarbeiterListe) {
      const kurzname = ma.name.split(' ')[0];
      if (ma.geburtsdatum) {
        const p = ma.geburtsdatum.split('-');
        if (p.length === 3) {
          events.push({
            id:    `geb-${ma.id}`,
            datum: `${year}-${p[1]}-${p[2]}`,
            label: `🎁 Geburtstag ${kurzname}`,
            typ:   'geburtstag',
          });
        }
      }
      if (ma.eintrittsdatum) {
        const p = ma.eintrittsdatum.split('-');
        if (p.length === 3) {
          const jahre = year - Number(p[0]);
          if (jahre > 0) {
            // Immer: Jahrestag im Kalender anzeigen
            const istMeilenstein = jahre % 5 === 0;
            events.push({
              id:    `jul-${ma.id}`,
              datum: `${year}-${p[1]}-${p[2]}`,
              label: istMeilenstein
                ? `🏆 ${jahre}J. Jubiläum ${kurzname}`
                : `💼 Eintritt ${kurzname}`,
              typ:   'jubilaeum',
            });
          }
        }
      }
    }
    return events;
  }, [aktiveMitarbeiterListe, aktuellesDatumObj]);

  // ── Virtuelle Einträge ────────────────────────────────────────────────────
  const ausnahmenSet = useMemo(
    () => new Set(bueroAusnahmen.map(a => `${a.mitarbeiter}|${a.datum}`)),
    [bueroAusnahmen]
  );

  const viewDates = useMemo(() => {
    const monStart = startOfMonth(aktuellesDatumObj);
    const monEnd   = endOfMonth(aktuellesDatumObj);
    const start = new Date(Math.min(monStart.getTime(), wochentage[0].getTime()));
    const end   = new Date(Math.max(monEnd.getTime(),   wochentage[4].getTime()));
    return getDatesInRange(start, end);
  }, [aktuellesDatum]);

  const virtuelleAuftraege = useMemo(
    () => getVirtuelleAuftraege(viewDates, ausnahmenSet, auftraege, aktiveMitarbeiterListe),
    [viewDates, ausnahmenSet, auftraege, aktiveMitarbeiterListe]
  );

  const alleAuftraege = useMemo(
    () => [...auftraege, ...virtuelleAuftraege],
    [auftraege, virtuelleAuftraege]
  );

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragStart = (e: DragStartEvent) => {
    const realId = extractAuftragId(String(e.active.id));
    if (isVirtuellerEintrag(realId)) return;
    const a = auftraege.find(x => x.id === realId);
    if (a) setActiveAuftrag(a);
  };

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveAuftrag(null);
      const { active, over } = e;
      if (!over) return;
      const realId = extractAuftragId(String(active.id));
      if (isVirtuellerEintrag(realId)) return;

      const auftrag = auftraege.find(a => a.id === realId);
      if (!auftrag) return;

      const { datum: neuDatum, mitarbeiter: neuMA, stunde: neuStart } = over.data.current as {
        datum: string; mitarbeiter: string; stunde: number;
      };

      const STUNDEN_ARR = STUNDEN as readonly number[];
      const startDi  = wochentageStr.indexOf(auftrag.datum);
      const startHi  = STUNDEN_ARR.indexOf(auftrag.start_stunde);
      const endDate  = auftrag.datum_bis || auftrag.datum;
      const endDi    = wochentageStr.indexOf(endDate);
      let totalCols: number;

      if (!auftrag.datum_bis || auftrag.datum_bis === auftrag.datum || endDi <= startDi || startDi === -1) {
        totalCols = auftrag.end_stunde - auftrag.start_stunde;
      } else {
        const startRest = STUNDEN.length - startHi;
        const middle    = endDi - startDi - 1;
        const endHiRaw  = STUNDEN_ARR.indexOf(auftrag.end_stunde);
        const endHi     = endHiRaw === -1 ? STUNDEN.length : endHiRaw;
        totalCols = startRest + middle * STUNDEN.length + endHi;
      }

      const neuStartDi = wochentageStr.indexOf(neuDatum);
      const neuStartHi = STUNDEN_ARR.indexOf(neuStart);
      if (neuStartDi === -1 || neuStartHi === -1) return;

      let newDi = neuStartDi, newHi = neuStartHi;
      for (let step = 0; step < totalCols; step++) {
        newHi++;
        if (newHi >= STUNDEN.length) { newDi++; newHi = 0; }
        if (newDi >= wochentageStr.length) return;
      }

      const neuDatumBis = wochentageStr[newDi];
      const neuEnd      = newHi >= STUNDEN.length ? 17 : (STUNDEN_ARR[newHi] as number);

      let neuDi = neuStartDi, neuHi = neuStartHi;
      for (let step = 0; step < totalCols; step++) {
        const slotDatum  = wochentageStr[neuDi];
        const slotStunde = STUNDEN_ARR[neuHi];
        if (alleAuftraege.some(a =>
          !isVirtuellerEintrag(a.id) && a.id !== auftrag.id &&
          getAuftragMitarbeiterListe(a).includes(neuMA) &&
          a.datum <= slotDatum && (a.datum_bis || a.datum) >= slotDatum &&
          a.start_stunde <= slotStunde && a.end_stunde > slotStunde
        )) return;
        neuHi++;
        if (neuHi >= STUNDEN.length) { neuDi++; neuHi = 0; }
        if (neuDi >= wochentageStr.length) break;
      }

      const updates: Partial<Auftrag> = {
        mitarbeiter:       neuMA,
        mitarbeiter_liste: [neuMA],
        datum:             neuDatum,
        datum_bis:         neuDatumBis !== neuDatum ? neuDatumBis : undefined,
        start_stunde:      neuStart,
        end_stunde:        neuEnd,
      };
      updateAuftrag(auftrag.id, updates);
      if (dbBereit) dbUpdateAuftrag(auftrag.id, updates);
    },
    [auftraege, alleAuftraege, updateAuftrag, dbBereit, wochentageStr]
  );

  // ── CRUD Aufträge ─────────────────────────────────────────────────────────
  const handleZelleClick = (datum: string, ma: string, stunde: number) => {
    setModalState({ open: true, prefill: { mitarbeiter: ma, datum, start_stunde: stunde, end_stunde: Math.min(stunde + 1, 17) } });
  };

  const handleAuftragClick = (auftrag: Auftrag) => {
    setModalState({ open: true, auftrag, isStandard: isVirtuellerEintrag(auftrag.id) });
  };

  const handleSave = async (data: Omit<Auftrag, 'id'>) => {
    // ── Virtuellen Standard-Bürozeit-Eintrag überschreiben ────────────────────
    if (modalState.auftrag && isVirtuellerEintrag(modalState.auftrag.id)) {
      const parsed = parseVirtuelleId(modalState.auftrag.id)!;
      // Ausnahme lokal speichern
      addBueroAusnahme({ id: crypto.randomUUID(), mitarbeiter: parsed.mitarbeiter, datum: parsed.datum });
      if (dbBereit) dbCreateBueroAusnahme(parsed.mitarbeiter, parsed.datum);

      // Neuen echten Eintrag anlegen
      const tempId = crypto.randomUUID();
      addAuftrag({ ...data, id: tempId });
      if (dbBereit) {
        try {
          const r = await dbCreateAuftrag(data);
          if (r) {
            deleteAuftrag(tempId);
            addAuftrag(r);
          } else {
            console.error('handleSave (virtual override): dbCreateAuftrag gab null zurück – Eintrag nur lokal gespeichert');
          }
        } catch (err) {
          console.error('handleSave (virtual override): Unerwarteter Fehler beim DB-Insert:', err);
        }
      }
      setModalState({ open: false });
      return;
    }

    // ── Bestehenden Eintrag bearbeiten ────────────────────────────────────────
    if (modalState.auftrag) {
      updateAuftrag(modalState.auftrag.id, data);
      if (dbBereit) {
        try {
          await dbUpdateAuftrag(modalState.auftrag.id, data);
        } catch (err) {
          console.error('handleSave (update): Fehler beim DB-Update:', err);
        }
      }
      setModalState({ open: false });
      return;
    }

    // ── Neuen Eintrag anlegen ─────────────────────────────────────────────────
    const tempId = crypto.randomUUID();
    addAuftrag({ ...data, id: tempId }); // optimistisches Update – sofort sichtbar

    if (dbBereit) {
      try {
        const r = await dbCreateAuftrag(data);
        if (r) {
          // Temp-Eintrag durch DB-bestätigten Eintrag ersetzen
          deleteAuftrag(tempId);
          addAuftrag(r);
        } else {
          console.error('handleSave (new): dbCreateAuftrag gab null zurück – Eintrag bleibt lokal mit ID', tempId);
        }
      } catch (err) {
        console.error('handleSave (new): Unerwarteter Fehler beim DB-Insert:', err);
      }
    }

    setModalState({ open: false });
  };

  const handleDelete = async (id: string) => {
    if (isVirtuellerEintrag(id)) {
      const parsed = parseVirtuelleId(id);
      if (!parsed) return;
      addBueroAusnahme({ id: crypto.randomUUID(), mitarbeiter: parsed.mitarbeiter, datum: parsed.datum });
      if (dbBereit) {
        try {
          await dbCreateBueroAusnahme(parsed.mitarbeiter, parsed.datum);
        } catch (err) {
          console.error('handleDelete (virtual): Fehler beim Speichern der Ausnahme:', err);
        }
      }
      setModalState({ open: false });
      return;
    }
    deleteAuftrag(id);
    if (dbBereit) {
      try {
        await dbDeleteAuftrag(id);
      } catch (err) {
        console.error('handleDelete: Fehler beim DB-Löschen:', err);
      }
    }
    setModalState({ open: false });
  };

  // ── CRUD Urlaube ──────────────────────────────────────────────────────────
  const handleAddUrlaub = async (urlaubData: Omit<Urlaub, 'id'>) => {
    const tempId = crypto.randomUUID();
    addUrlaub({ ...urlaubData, id: tempId });
    if (dbBereit) {
      try {
        const r = await dbCreateUrlaub(urlaubData);
        if (r) {
          deleteUrlaub(tempId);
          addUrlaub(r);
        } else {
          console.error('handleAddUrlaub: dbCreateUrlaub gab null zurück – Abwesenheit nur lokal gespeichert');
        }
      } catch (err) {
        console.error('handleAddUrlaub: Fehler beim DB-Insert:', err);
      }
    }
  };

  const handleUpdateUrlaub = async (id: string, updates: Omit<Urlaub, 'id'>) => {
    updateUrlaub(id, updates);
    if (dbBereit) {
      try {
        await dbUpdateUrlaub(id, updates);
      } catch (err) {
        console.error('handleUpdateUrlaub: Fehler beim DB-Update:', err);
      }
    }
  };

  const handleDeleteUrlaub = async (id: string) => {
    deleteUrlaub(id);
    if (dbBereit) {
      try {
        await dbDeleteUrlaub(id);
      } catch (err) {
        console.error('handleDeleteUrlaub: Fehler beim DB-Löschen:', err);
      }
    }
  };

  // ── Mitarbeiter umbenennen ────────────────────────────────────────────────
  const handleMitarbeiterRename = useCallback(async (altName: string, neuName: string) => {
    if (mitarbeiter.length === 0) {
      // Offline-Modus: Fallback-Liste in Store laden und Namen direkt anpassen
      const seeded = FALLBACK_MITARBEITER_LISTE.map(m =>
        m.name === altName ? { ...m, name: neuName } : { ...m }
      );
      setMitarbeiter(seeded);
      return;
    }
    const ma = mitarbeiter.find(m => m.name === altName);
    if (!ma) return;
    updateMitarbeiterItem(ma.id, { name: neuName });
    if (dbBereit) {
      try {
        await dbUpdateMitarbeiter(ma.id, { name: neuName });
      } catch (err) {
        console.error('handleMitarbeiterRename: Fehler beim DB-Update:', err);
      }
    }
  }, [mitarbeiter, setMitarbeiter, updateMitarbeiterItem, dbBereit]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigiereZurueck = () => {
    if (ansicht === 'tag') {
      const d = new Date(aktuellesDatumObj); d.setDate(d.getDate() - 1);
      const s = formatDatum(d); setAktuellesDatum(s); setSelectedTag(s);
    } else {
      setAktuellesDatum(formatDatum(ansicht === 'woche'
        ? vorherigeWoche(aktuellesDatumObj)
        : vorherigerMonat(aktuellesDatumObj)));
    }
  };
  const navigiereVorwaerts = () => {
    if (ansicht === 'tag') {
      const d = new Date(aktuellesDatumObj); d.setDate(d.getDate() + 1);
      const s = formatDatum(d); setAktuellesDatum(s); setSelectedTag(s);
    } else {
      setAktuellesDatum(formatDatum(ansicht === 'woche'
        ? naechsteWoche(aktuellesDatumObj)
        : naechsterMonat(aktuellesDatumObj)));
    }
  };
  const navigiereHeute = () => {
    const s = formatDatum(new Date());
    setAktuellesDatum(s); setSelectedTag(s);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen overflow-hidden bg-slate-100 flex flex-col">

        {/* Fehler-Banner: Supabase-Konfiguration fehlt */}
        {!SUPABASE_KONFIGURIERT && (
          <div className="shrink-0 bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 z-50">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="text-sm">
              <span className="font-bold">Datenbankverbindung fehlt!</span>
              {' '}Die Umgebungsvariablen{' '}
              <code className="bg-red-800/60 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code>
              {' '}und{' '}
              <code className="bg-red-800/60 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              {' '}sind nicht gesetzt. Bitte in Vercel → Project Settings → Environment Variables prüfen und neu deployen.
              Aktuell werden Daten nur lokal gespeichert.
            </div>
          </div>
        )}

        {/* Header */}
        <header className="bg-blue-900 text-white px-4 py-3 shadow-lg shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 mr-2">
              <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="leading-none">
                <div className="font-bold text-sm">Müller Biegetechnik AG</div>
                <div className="text-blue-300 text-[11px]">Produktionskalender</div>
              </div>
            </div>

            <div className="flex items-center bg-blue-800/60 rounded-lg p-1 gap-0.5">
              {([['tag', 'Tag'], ['woche', 'Woche'], ['monat', 'Monat']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setAnsicht(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${ansicht === v ? 'bg-white text-blue-900' : 'text-blue-200 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <button onClick={navigiereHeute}
                className="px-2.5 py-1.5 rounded-lg bg-blue-800/60 hover:bg-blue-700 text-xs font-medium transition-colors">
                Heute
              </button>
              <button onClick={navigiereZurueck} className="p-1.5 rounded-lg hover:bg-blue-800 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium min-w-[220px] text-center select-none">
                {ansicht === 'tag'
                  ? formatTagKopf(aktuellesDatumObj)
                  : ansicht === 'woche'
                    ? <><span className="text-blue-300 font-bold">KW&nbsp;{getISOWeek(aktuellesDatumObj)}</span>
                        <span className="mx-1.5 text-blue-500">·</span>
                        {formatWocheAnzeige(aktuellesDatumObj)}</>
                    : formatMonatAnzeige(aktuellesDatumObj)}
              </span>
              <button onClick={navigiereVorwaerts} className="p-1.5 rounded-lg hover:bg-blue-800 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Mitarbeiter-Button */}
              <button onClick={() => setMitarbeiterModalOffen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-700
                           hover:bg-blue-600 text-white text-xs font-medium transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Mitarbeiter
              </button>

              {/* Urlaub-Button */}
              <button onClick={() => setUrlaubModalOffen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500
                           hover:bg-orange-400 text-white text-xs font-medium transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Abwesenheit
              </button>

              <button onClick={() => setAuthenticated(false)}
                className="ml-1 p-1.5 rounded-lg hover:bg-blue-800 transition-colors opacity-60 hover:opacity-100"
                title="Abmelden">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Inhalt */}
        <main className="flex-1 min-h-0 w-full px-4 pt-3 pb-2 flex flex-col gap-3">
          {ansicht === 'tag' ? (
            <div className="flex-1 min-h-0">
              <TagAnsicht
                datum={aktuellesDatum}
                auftraege={alleAuftraege}
                urlaube={urlaube}
                mitarbeiterNamen={aktiveMitarbeiterNamen}
                mitarbeiterListe={aktiveMitarbeiterListe}
                ausnahmenSet={ausnahmenSet}
                jahresEreignisse={jahresEreignisse}
                onZelleClick={handleZelleClick}
                onAuftragClick={handleAuftragClick}
              />
            </div>
          ) : ansicht === 'woche' ? (
            <div className="flex-1 min-h-0">
              <WochenAnsicht
                wochentage={wochentageStr}
                auftraege={alleAuftraege}
                urlaube={urlaube}
                mitarbeiterNamen={aktiveMitarbeiterNamen}
                mitarbeiterListe={aktiveMitarbeiterListe}
                ausnahmenSet={ausnahmenSet}
                jahresEreignisse={jahresEreignisse}
                onZelleClick={handleZelleClick}
                onAuftragClick={handleAuftragClick}
                onMitarbeiterRename={handleMitarbeiterRename}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <MonatsAnsicht
                datum={aktuellesDatumObj}
                auftraege={alleAuftraege}
                urlaube={urlaube}
                jahresEreignisse={jahresEreignisse}
                onTagClick={(tag) => {
                  setAnsicht('woche');
                  setAktuellesDatum(formatDatum(tag));
                  setSelectedTag(formatDatum(tag));
                }}
              />
            </div>
          )}

          <div className="shrink-0 flex items-center gap-5 text-xs text-slate-500 px-1">
            {[
              { label: 'Erfasst',        dot: 'bg-red-500'    },
              { label: 'In Bearbeitung', dot: 'bg-yellow-500' },
              { label: 'Fertig',         dot: 'bg-green-500'  },
            ].map(({ label, dot }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                {label}
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              {verbinde ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-yellow-600 font-medium">Verbinde…</span>
                </>
              ) : supabaseActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-green-600 font-medium">Live-Sync aktiv</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-slate-400">Offline (lokaler Speicher)</span>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeAuftrag && (
          <div className="bg-blue-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-xl opacity-90 pointer-events-none">
            ↕ {activeAuftrag.titel}
          </div>
        )}
      </DragOverlay>

      {modalState.open && (
        <AuftragModal
          auftrag={modalState.auftrag}
          prefill={modalState.prefill}
          isStandard={modalState.isStandard}
          mitarbeiterNamen={aktiveMitarbeiterNamen}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalState({ open: false })}
        />
      )}

      {urlaubModalOffen && (
        <UrlaubModal
          onClose={() => setUrlaubModalOffen(false)}
          mitarbeiterNamen={aktiveMitarbeiterNamen}
          onAddUrlaub={handleAddUrlaub}
          onUpdateUrlaub={handleUpdateUrlaub}
          onDeleteUrlaub={handleDeleteUrlaub}
        />
      )}

      {mitarbeiterModalOffen && (
        <MitarbeiterModal onClose={() => setMitarbeiterModalOffen(false)} />
      )}

    </DndContext>
  );
}
