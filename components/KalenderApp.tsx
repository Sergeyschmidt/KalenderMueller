'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Auftrag, Urlaub, STUNDEN } from '@/lib/types';
import {
  getWochentage,
  formatDatum,
  formatWocheAnzeige,
  formatMonatAnzeige,
  naechsteWoche,
  vorherigeWoche,
  naechsterMonat,
  vorherigerMonat,
  parseDatum,
} from '@/lib/dateUtils';
import {
  dbFetchAuftraege,
  dbFetchUrlaube,
  dbCreateAuftrag,
  dbUpdateAuftrag,
  dbDeleteAuftrag,
  dbCreateUrlaub,
  dbDeleteUrlaub,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/lib/supabase';
import WochenAnsicht from './WochenAnsicht';
import MonatsAnsicht from './MonatsAnsicht';
import AuftragModal from './AuftragModal';
import UrlaubModal from './UrlaubModal';

export default function KalenderApp() {
  const {
    auftraege,
    urlaube,
    ansicht,
    aktuellesDatum,
    setAuftraege,
    setUrlaube,
    setAnsicht,
    setAktuellesDatum,
    setSelectedTag,
    addAuftrag,
    updateAuftrag,
    deleteAuftrag,
    addUrlaub,
    deleteUrlaub,
    setAuthenticated,
  } = useKalenderStore();

  const [modalState, setModalState] = useState<{
    open: boolean;
    auftrag?: Auftrag;
    prefill?: Partial<Auftrag>;
  }>({ open: false });

  const [activeAuftrag, setActiveAuftrag] = useState<Auftrag | null>(null);
  const [supabaseActive, setSupabaseActive] = useState(false);
  const [urlaubModalOffen, setUrlaubModalOffen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // ── Supabase: Initialdaten + Echtzeit-Synchronisation ───────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // Daten beim Start laden
    Promise.all([dbFetchAuftraege(), dbFetchUrlaube()]).then(([a, u]) => {
      setAuftraege(a);
      setUrlaube(u);
      setSupabaseActive(true);
    });

    const client = getSupabaseClient();
    if (!client) return;

    // Echtzeit-Kanal: empfängt Änderungen aller anderen Geräte
    const channel = client
      .channel('kalender-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auftraege' },
        ({ new: row }) => addAuftrag(row as Auftrag))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auftraege' },
        ({ new: row }) => updateAuftrag((row as Auftrag).id, row as Partial<Auftrag>))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'auftraege' },
        ({ old: row }) => deleteAuftrag((row as { id: string }).id))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'urlaube' },
        ({ new: row }) => addUrlaub(row as Urlaub))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'urlaube' },
        ({ old: row }) => deleteUrlaub((row as { id: string }).id))
      .subscribe((status) => {
        setSupabaseActive(status === 'SUBSCRIBED');
      });

    return () => { client.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aktuellesDatumObj = parseDatum(aktuellesDatum);
  const wochentage        = getWochentage(aktuellesDatumObj);
  const wochentageStr     = wochentage.map(formatDatum);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragStart = (e: DragStartEvent) => {
    const a = auftraege.find((x) => x.id === e.active.id);
    if (a) setActiveAuftrag(a);
  };

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveAuftrag(null);
      const { active, over } = e;
      if (!over) return;

      const auftrag = auftraege.find((a) => a.id === active.id);
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
        const startRest   = STUNDEN.length - startHi;
        const middle      = endDi - startDi - 1;
        const endHiRaw    = STUNDEN_ARR.indexOf(auftrag.end_stunde);
        const endHi       = endHiRaw === -1 ? STUNDEN.length : endHiRaw;
        totalCols = startRest + middle * STUNDEN.length + endHi;
      }

      const neuStartDi = wochentageStr.indexOf(neuDatum);
      const neuStartHi = STUNDEN_ARR.indexOf(neuStart);
      if (neuStartDi === -1 || neuStartHi === -1) return;

      let newDi = neuStartDi;
      let newHi = neuStartHi;
      for (let step = 0; step < totalCols; step++) {
        newHi++;
        if (newHi >= STUNDEN.length) { newDi++; newHi = 0; }
        if (newDi >= wochentageStr.length) return;
      }

      const neuDatumBis = wochentageStr[newDi];
      const neuEnd      = newHi >= STUNDEN.length ? 17 : (STUNDEN_ARR[newHi] as number);

      let neuDi = neuStartDi;
      let neuHi = neuStartHi;
      for (let step = 0; step < totalCols; step++) {
        const slotDatum  = wochentageStr[neuDi];
        const slotStunde = STUNDEN_ARR[neuHi];
        const konflikt = auftraege.some(
          a =>
            a.id !== auftrag.id &&
            a.mitarbeiter === neuMA &&
            a.datum <= slotDatum &&
            (a.datum_bis || a.datum) >= slotDatum &&
            a.start_stunde <= slotStunde &&
            a.end_stunde > slotStunde
        );
        if (konflikt) return;
        neuHi++;
        if (neuHi >= STUNDEN.length) { neuDi++; neuHi = 0; }
        if (neuDi >= wochentageStr.length) break;
      }

      const updates: Partial<Auftrag> = {
        mitarbeiter:  neuMA,
        datum:        neuDatum,
        datum_bis:    neuDatumBis !== neuDatum ? neuDatumBis : undefined,
        start_stunde: neuStart,
        end_stunde:   neuEnd,
      };
      updateAuftrag(auftrag.id, updates);
      if (supabaseActive) dbUpdateAuftrag(auftrag.id, updates);
    },
    [auftraege, updateAuftrag, supabaseActive, wochentageStr]
  );

  // ── Auftrag CRUD ─────────────────────────────────────────────────────────────
  const handleZelleClick = (datum: string, mitarbeiter: string, stunde: number) => {
    setModalState({
      open: true,
      prefill: { mitarbeiter, datum, start_stunde: stunde, end_stunde: Math.min(stunde + 1, 17) },
    });
  };

  const handleAuftragClick = (auftrag: Auftrag) => {
    setModalState({ open: true, auftrag });
  };

  const handleSave = async (data: Omit<Auftrag, 'id'>) => {
    if (modalState.auftrag) {
      // Bearbeiten: optimistisch + DB
      updateAuftrag(modalState.auftrag.id, data);
      if (supabaseActive) await dbUpdateAuftrag(modalState.auftrag.id, data);
    } else {
      // Neu: optimistisch mit temporärer ID; Echtzeit ersetzt mit echter DB-ID
      const tempId = crypto.randomUUID();
      addAuftrag({ ...data, id: tempId });
      if (supabaseActive) {
        const dbResult = await dbCreateAuftrag(data);
        if (dbResult) {
          deleteAuftrag(tempId);       // temporäre ID entfernen
          addAuftrag(dbResult);        // Store-Deduplizierung verhindert Duplikat
        }
      }
    }
    setModalState({ open: false });
  };

  const handleDelete = async (id: string) => {
    deleteAuftrag(id);
    if (supabaseActive) await dbDeleteAuftrag(id);
    setModalState({ open: false });
  };

  // ── Urlaub CRUD (Supabase-aware) ─────────────────────────────────────────────
  const handleAddUrlaub = async (urlaubData: Omit<Urlaub, 'id'>) => {
    const tempId = crypto.randomUUID();
    addUrlaub({ ...urlaubData, id: tempId });
    if (supabaseActive) {
      const dbResult = await dbCreateUrlaub(urlaubData);
      if (dbResult) {
        deleteUrlaub(tempId);
        addUrlaub(dbResult);
      }
    }
  };

  const handleDeleteUrlaub = async (id: string) => {
    deleteUrlaub(id);
    if (supabaseActive) await dbDeleteUrlaub(id);
  };

  // ── Navigation ───────────────────────────────────────────────────────────────
  const navigiereZurueck = () => {
    if (ansicht === 'woche') {
      setAktuellesDatum(formatDatum(vorherigeWoche(aktuellesDatumObj)));
    } else {
      setAktuellesDatum(formatDatum(vorherigerMonat(aktuellesDatumObj)));
    }
  };

  const navigiereVorwaerts = () => {
    if (ansicht === 'woche') {
      setAktuellesDatum(formatDatum(naechsteWoche(aktuellesDatumObj)));
    } else {
      setAktuellesDatum(formatDatum(naechsterMonat(aktuellesDatumObj)));
    }
  };

  const navigiereHeute = () => {
    const todayStr = formatDatum(new Date());
    setAktuellesDatum(todayStr);
    setSelectedTag(todayStr);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen overflow-hidden bg-slate-100 flex flex-col">

        {/* Header */}
        <header className="bg-blue-900 text-white px-4 py-3 shadow-lg shrink-0 sticky top-0 z-40">
          <div className="max-w-screen-2xl mx-auto flex items-center gap-4 flex-wrap">

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

            {/* Ansicht-Umschalter */}
            <div className="flex items-center bg-blue-800/60 rounded-lg p-1 gap-0.5">
              {(['woche', 'monat'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAnsicht(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${ansicht === v ? 'bg-white text-blue-900' : 'text-blue-200 hover:text-white'}`}
                >
                  {v === 'woche' ? 'Woche' : 'Monat'}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={navigiereHeute}
                className="px-2.5 py-1.5 rounded-lg bg-blue-800/60 hover:bg-blue-700 text-xs font-medium transition-colors"
              >
                Heute
              </button>
              <button onClick={navigiereZurueck} className="p-1.5 rounded-lg hover:bg-blue-800 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium min-w-[190px] text-center select-none">
                {ansicht === 'woche'
                  ? formatWocheAnzeige(aktuellesDatumObj)
                  : formatMonatAnzeige(aktuellesDatumObj)}
              </span>
              <button onClick={navigiereVorwaerts} className="p-1.5 rounded-lg hover:bg-blue-800 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Urlaub-Button */}
              <button
                onClick={() => setUrlaubModalOffen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500
                           hover:bg-orange-400 text-white text-xs font-medium transition-colors"
                title="Urlaub verwalten"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Urlaub
              </button>

              <button
                onClick={() => setAuthenticated(false)}
                className="ml-1 p-1.5 rounded-lg hover:bg-blue-800 transition-colors opacity-60 hover:opacity-100"
                title="Abmelden"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Inhalt */}
        <main className="flex-1 min-h-0 max-w-screen-2xl mx-auto w-full p-4 pb-2 flex flex-col gap-3">

          {ansicht === 'woche' ? (
            <div className="flex-1 min-h-0">
              <WochenAnsicht
                wochentage={wochentageStr}
                auftraege={auftraege}
                urlaube={urlaube}
                onZelleClick={handleZelleClick}
                onAuftragClick={handleAuftragClick}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <MonatsAnsicht
                datum={aktuellesDatumObj}
                auftraege={auftraege}
                urlaube={urlaube}
                onTagClick={(tag) => {
                  setAnsicht('woche');
                  setAktuellesDatum(formatDatum(tag));
                  setSelectedTag(formatDatum(tag));
                }}
              />
            </div>
          )}

          {/* Legende + Sync-Status */}
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
              <span className={`w-2 h-2 rounded-full ${supabaseActive ? 'bg-green-500' : 'bg-slate-400'}`} />
              <span className={supabaseActive ? 'text-green-600 font-medium' : 'text-slate-400'}>
                {supabaseActive ? 'Live-Sync aktiv' : 'Offline (lokaler Speicher)'}
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* Drag-Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeAuftrag && (
          <div className="bg-blue-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-xl opacity-90 pointer-events-none">
            ↕ {activeAuftrag.titel}
          </div>
        )}
      </DragOverlay>

      {/* Auftrags-Modal */}
      {modalState.open && (
        <AuftragModal
          auftrag={modalState.auftrag}
          prefill={modalState.prefill}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalState({ open: false })}
        />
      )}

      {/* Urlaubs-Modal */}
      {urlaubModalOffen && (
        <UrlaubModal
          onClose={() => setUrlaubModalOffen(false)}
          onAddUrlaub={handleAddUrlaub}
          onDeleteUrlaub={handleDeleteUrlaub}
        />
      )}
    </DndContext>
  );
}
