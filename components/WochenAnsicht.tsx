'use client';

import { useState } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import {
  STUNDEN, Auftrag, Urlaub, Mitarbeiter,
  AbwesenheitsTyp, ABWESENHEITS_LABELS,
  STATUS_BORDER_T, STATUS_BORDER_L, STATUS_DOT_COLORS,
  JahresEreignis, getAuftragMitarbeiterListe, getUrlaubMitarbeiterListe,
} from '@/lib/types';
import { formatAnzeige, parseDatum, WOCHENTAGE_KURZ } from '@/lib/dateUtils';
import { isFeiertag } from '@/lib/feiertage';

// ── Hintergründe ──────────────────────────────────────────────────────────────
const X_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' preserveAspectRatio='none'%3E%3Cline x1='0' y1='0' x2='100%25' y2='100%25' stroke='%23b0bec5' stroke-width='2'/%3E%3Cline x1='100%25' y1='0' x2='0' y2='100%25' stroke='%23b0bec5' stroke-width='2'/%3E%3C%2Fsvg%3E")`;

function urlaubBg(typ: AbwesenheitsTyp): string {
  const farben: Record<AbwesenheitsTyp, [string, string]> = {
    urlaub:         ['#ffedd5', '#fed7aa'],
    krankheit:      ['#fee2e2', '#fca5a5'],
    militaer:       ['#f1f5f9', '#cbd5e1'],
    zivilschutz:    ['#dbeafe', '#93c5fd'],
    betriebsferien: ['#f0fdf4', '#bbf7d0'],
    uebrige:        ['#f5f5f4', '#d6d3d1'],
  };
  const [c1, c2] = farben[typ];
  return `repeating-linear-gradient(45deg, ${c1}, ${c1} 6px, ${c2} 6px, ${c2} 13px)`;
}

function urlaubBorderCls(typ: AbwesenheitsTyp): string {
  return ({
    urlaub:         'border-orange-300 border-l-orange-400',
    krankheit:      'border-red-300 border-l-red-400',
    militaer:       'border-slate-300 border-l-slate-400',
    zivilschutz:    'border-blue-300 border-l-blue-400',
    betriebsferien: 'border-green-300 border-l-green-500',
    uebrige:        'border-stone-300 border-l-stone-400',
  } as Record<AbwesenheitsTyp, string>)[typ];
}

function urlaubTextCls(typ: AbwesenheitsTyp): string {
  return ({
    urlaub:         'text-orange-800',
    krankheit:      'text-red-800',
    militaer:       'text-slate-600',
    zivilschutz:    'text-blue-800',
    betriebsferien: 'text-green-800',
    uebrige:        'text-stone-600',
  } as Record<AbwesenheitsTyp, string>)[typ];
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function kurzMA(name: string): string {
  if (name.length <= 9) return name;
  const slashIdx = name.indexOf('/');
  if (slashIdx > 0) return name.slice(0, slashIdx) + '\n' + name.slice(slashIdx + 1);
  const lastSpace = name.lastIndexOf(' ');
  if (lastSpace > 0) return name.slice(0, lastSpace) + '\n' + name.slice(lastSpace + 1);
  return name.slice(0, 8) + '…';
}

const STUNDEN_ARR = STUNDEN as readonly number[];

/**
 * Berechnet den colSpan eines Auftrags (inkl. mehrtägiger Aufträge).
 * startHi = Index in STUNDEN[] (0–9) des Startzeitpunkts.
 */
function colSpanFuerAuftrag(
  auftrag: Auftrag,
  wochentage: string[],
  startDi: number,
  startHi: number,
): number {
  const endDatum = auftrag.datum_bis || auftrag.datum;

  // Eintägig
  if (!auftrag.datum_bis || auftrag.datum_bis === auftrag.datum) {
    return auftrag.end_stunde - auftrag.start_stunde;
  }

  const endDi = wochentage.indexOf(endDatum);
  if (endDi === startDi) return auftrag.end_stunde - auftrag.start_stunde;

  // Enddatum liegt ausserhalb der angezeigten Woche → bis Tabellenende dehnen
  if (endDi === -1) {
    return STUNDEN.length * (wochentage.length - startDi) - startHi;
  }

  const startDayRest  = STUNDEN.length - startHi;
  const mittelTage    = endDi - startDi - 1;
  const endHiRaw      = STUNDEN_ARR.indexOf(auftrag.end_stunde);
  const endHi         = endHiRaw === -1 ? STUNDEN.length : endHiRaw;

  return startDayRest + mittelTage * STUNDEN.length + endHi;
}

// ── Zeit-Hilfe: "HH:MM" oder "HH:MM:SS" → Index in STUNDEN[] ────────────────
function parseZeitAlsStundeIdx(zeit: string, roundUp: boolean): number {
  const parts = zeit.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const ziel = roundUp && m > 0 ? h + 1 : h;
  const exact = STUNDEN_ARR.indexOf(ziel);
  if (exact !== -1) return exact;
  if (ziel <= STUNDEN_ARR[0]) return 0;
  if (ziel > STUNDEN_ARR[STUNDEN_ARR.length - 1]) return STUNDEN_ARR.length;
  for (let i = 0; i < STUNDEN_ARR.length - 1; i++) {
    if (STUNDEN_ARR[i] <= ziel && ziel < STUNDEN_ARR[i + 1]) return roundUp ? i + 1 : i;
  }
  return STUNDEN_ARR.length;
}

// ── Zell-Typen ────────────────────────────────────────────────────────────────
// Bürozeit wird NICHT als CellData modelliert – sie ist ein eigenständiger Hintergrund-Overlay.
type CellData =
  | { type: 'auftrag'; auftrag: Auftrag; colSpan: number }
  | { type: 'urlaub';  datum: string;    colSpan: number; urlaubTyp: AbwesenheitsTyp; urlaubObj: Urlaub }
  | { type: 'empty';   datum: string;    stunde: number }
  | null;

// Globaler Index im 50-Spalten-Grid (0-basiert, Tag × 10 + Stundenindex)
interface BueroOverlay { globalStart: number; globalEnd: number; auftrag: Auftrag | null }

function computeRow(
  ma: string,
  wochentage: string[],
  auftraege: Auftrag[],
  urlaube: Urlaub[],
): CellData[] {
  const row: CellData[] = [];
  let colsToSkip = 0;

  for (let di = 0; di < wochentage.length; di++) {
    const datum = wochentage[di];

    // Ganztägiger Urlaub (kein start_zeit) – nur wenn kein laufendes colSpan aus Vortag
    if (colsToSkip === 0) {
      const ganztaegig = urlaube.find(
        u => getUrlaubMitarbeiterListe(u).includes(ma) && u.datum_von <= datum && u.datum_bis >= datum && !u.start_zeit
      );
      if (ganztaegig) {
        row.push({ type: 'urlaub', datum, colSpan: STUNDEN.length, urlaubTyp: ganztaegig.typ ?? 'urlaub', urlaubObj: ganztaegig });
        for (let i = 1; i < STUNDEN.length; i++) row.push(null);
        continue;
      }
    }

    // Stundenweiser Urlaub für diesen Tag (start_zeit gesetzt)
    const stundenweisenU = urlaube.find(
      u => getUrlaubMitarbeiterListe(u).includes(ma) && u.datum_von <= datum && u.datum_bis >= datum && !!u.start_zeit
    ) ?? null;

    // Mittlere Tage + Endtag ohne Endzeit → als ganztägig rendern
    if (stundenweisenU && colsToSkip === 0) {
      const sIsingle = stundenweisenU.datum_von === stundenweisenU.datum_bis;
      const sIsStart = datum === stundenweisenU.datum_von;
      const sIsEnd   = datum === stundenweisenU.datum_bis;
      if (!sIsingle && !sIsStart && (!sIsEnd || !stundenweisenU.end_zeit)) {
        row.push({ type: 'urlaub', datum, colSpan: STUNDEN.length, urlaubTyp: stundenweisenU.typ ?? 'urlaub', urlaubObj: stundenweisenU });
        for (let i = 1; i < STUNDEN.length; i++) row.push(null);
        continue;
      }
    }

    // Nur reguläre Aufträge – Bürozeiten werden separat als Overlay gerendert
    const tagAuftraege = auftraege.filter(
      a => getAuftragMitarbeiterListe(a).includes(ma) && a.datum === datum && a.typ !== 'buerozeit'
    );

    let hi = 0;

    while (hi < STUNDEN.length) {
      if (colsToSkip > 0) { row.push(null); colsToSkip--; hi++; continue; }

      const stunde = STUNDEN[hi];

      // Zeitbasierte Abwesenheit: Starttag oder eintägig, bzw. Endtag mit Endzeit
      if (stundenweisenU && stundenweisenU.start_zeit) {
        const sIsingle = stundenweisenU.datum_von === stundenweisenU.datum_bis;
        const sIsStart = datum === stundenweisenU.datum_von;
        const sIsEnd   = datum === stundenweisenU.datum_bis;
        // Endtag mit Endzeit: Block von Tagesbeginn bis Endzeit
        if (sIsEnd && !sIsingle && stundenweisenU.end_zeit && hi === 0) {
          const endIdx  = parseZeitAlsStundeIdx(stundenweisenU.end_zeit, true);
          const colSpan = Math.max(1, Math.min(endIdx, STUNDEN.length));
          row.push({ type: 'urlaub', datum, colSpan, urlaubTyp: stundenweisenU.typ ?? 'urlaub', urlaubObj: stundenweisenU });
          colsToSkip = colSpan - 1;
          hi++;
          continue;
        }
        // Eintägig oder Starttag: Block ab Startzeit
        if (sIsingle || sIsStart) {
          const startIdx = parseZeitAlsStundeIdx(stundenweisenU.start_zeit, false);
          if (hi === startIdx) {
            const colSpan = (sIsingle && stundenweisenU.end_zeit)
              ? Math.max(1, Math.min(parseZeitAlsStundeIdx(stundenweisenU.end_zeit, true) - startIdx, STUNDEN.length - hi))
              : STUNDEN.length - startIdx;
            row.push({ type: 'urlaub', datum, colSpan, urlaubTyp: stundenweisenU.typ ?? 'urlaub', urlaubObj: stundenweisenU });
            colsToSkip = colSpan - 1;
            hi++;
            continue;
          }
        }
      }

      const auftrag = tagAuftraege.find(a => a.start_stunde === stunde);
      if (auftrag) {
        const colSpan = colSpanFuerAuftrag(auftrag, wochentage, di, hi);
        row.push({ type: 'auftrag', auftrag, colSpan });
        colsToSkip = colSpan - 1;
      } else {
        row.push({ type: 'empty', datum, stunde });
      }
      hi++;
    }
  }
  return row;
}

// Berechnet absolut positionierte Bürozeit-Hintergrundblöcke pro Zeile
function computeBueroOverlays(
  ma: string,
  wochentage: string[],
  auftraege: Auftrag[],
  autoBuerozeit: { start: number; end: number } | null,
  ausnahmenSet: Set<string>,
): BueroOverlay[] {
  const overlays: BueroOverlay[] = [];
  for (let di = 0; di < wochentage.length; di++) {
    const datum = wochentage[di];
    const autoAktiv = autoBuerozeit !== null && isFeiertag(datum) === null && !ausnahmenSet.has(`${ma}|${datum}`);

    const tagBuerozeiten = auftraege.filter(
      a => getAuftragMitarbeiterListe(a).includes(ma) &&
           a.datum <= datum && (a.datum_bis ?? a.datum) >= datum &&
           a.typ === 'buerozeit'
    );

    let hiStart: number | null = null;
    let hiEnd:   number | null = null;
    let srcAuftrag: Auftrag | null = null;
    if (tagBuerozeiten.length > 0) {
      const b = tagBuerozeiten[0];
      const s = STUNDEN_ARR.indexOf(b.start_stunde);
      let   e = STUNDEN_ARR.indexOf(b.end_stunde);
      if (e === -1) e = STUNDEN_ARR.length;
      if (s !== -1) { hiStart = s; hiEnd = e; srcAuftrag = b; }
    } else if (autoAktiv && autoBuerozeit) {
      const s = STUNDEN_ARR.indexOf(autoBuerozeit.start);
      let   e = STUNDEN_ARR.indexOf(autoBuerozeit.end);
      if (e === -1) e = STUNDEN_ARR.length;
      if (s !== -1) { hiStart = s; hiEnd = e; }
    }

    if (hiStart !== null && hiEnd !== null && hiEnd > hiStart) {
      overlays.push({
        globalStart: di * STUNDEN.length + hiStart,
        globalEnd:   di * STUNDEN.length + hiEnd,
        auftrag: srcAuftrag,
      });
    }
  }
  return overlays;
}

// ── Draggable Auftragskarte ───────────────────────────────────────────────────
// dragId statt auftrag.id: ein Auftrag mit mehreren Mitarbeitern wird in mehreren
// Zeilen gerendert – dnd-kit braucht pro Zeile eine eindeutige id, sonst kollidieren
// die registrierten Draggable-Knoten. Beim Drag-Ende wird die echte Auftrag-id
// wieder über extractAuftragId() herausgelöst.
function AuftragKarte({ auftrag, rowMitarbeiter, onClick }: { auftrag: Auftrag; rowMitarbeiter: string; onClick: () => void }) {
  const mehrfachZugewiesen = getAuftragMitarbeiterListe(auftrag).length > 1;
  const dragId = mehrfachZugewiesen ? `${auftrag.id}::${rowMitarbeiter}` : auftrag.id;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { auftrag },
  });

  const hauptText  = auftrag.kunde || auftrag.titel;
  const nebenText  = auftrag.kunde && auftrag.titel ? auftrag.titel : null;
  const tooltipExtra = [nebenText, auftrag.datum_bis ? `bis ${auftrag.datum_bis}` : ''].filter(Boolean).join(' · ');

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={`${hauptText}${tooltipExtra ? ' · ' + tooltipExtra : ''}`}
      className={`h-full w-full flex items-center overflow-hidden
                  cursor-grab select-none rounded-sm transition-opacity
                  ${auftrag.typ === 'buerozeit'
                    ? 'bg-orange-100/80 border-t-[3px] border-t-orange-400 gap-0.5 px-0.5'
                    : `bg-white/85 border-t-[5px] border-l-[4px] ${STATUS_BORDER_T[auftrag.status]} ${STATUS_BORDER_L[auftrag.status]} gap-1 px-1.5`}
                  ${isDragging ? 'opacity-25' : ''}`}
    >
      <span className={`shrink-0 w-2 h-2 rounded-full ${auftrag.typ === 'buerozeit' ? 'bg-orange-400' : STATUS_DOT_COLORS[auftrag.status]}`} />
      <div className="min-w-0 overflow-hidden">
        <div className={`leading-tight font-semibold truncate
          ${auftrag.typ === 'buerozeit'
            ? 'text-[10px] text-orange-700'
            : 'text-[11px] text-slate-800'}`}>
          {hauptText}
        </div>
        {nebenText && (
          <div className="text-[9px] text-slate-500 truncate leading-tight">{nebenText}</div>
        )}
      </div>
    </div>
  );
}

// ── Droppable leere Zelle ─────────────────────────────────────────────────────
function DroppableZelle({
  datum, mitarbeiter, stunde, isToday, isHoliday, onClick, gridColumn,
}: {
  datum: string; mitarbeiter: string; stunde: number;
  isToday: boolean; isHoliday: boolean;
  onClick: () => void;
  gridColumn: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${datum}||${mitarbeiter}||${stunde}`,
    data: { datum, mitarbeiter, stunde },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{ gridColumn, position: 'relative', zIndex: 2 }}
      className={`border-r border-slate-200 cursor-pointer transition-colors
                  ${isOver     ? 'bg-blue-200'
                  : isToday    ? 'bg-blue-50/50'
                  : isHoliday  ? 'bg-amber-50/80'
                  : ''}`}
    />
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
interface Props {
  wochentage: string[];
  auftraege: Auftrag[];
  urlaube: Urlaub[];
  mitarbeiterNamen: string[];
  mitarbeiterListe: Mitarbeiter[];
  ausnahmenSet: Set<string>;
  jahresEreignisse?: JahresEreignis[];
  onZelleClick: (datum: string, mitarbeiter: string, stunde: number) => void;
  onAuftragClick: (auftrag: Auftrag) => void;
  onMitarbeiterRename?: (altName: string, neuName: string) => void;
}

export default function WochenAnsicht({
  wochentage, auftraege, urlaube, mitarbeiterNamen, mitarbeiterListe, ausnahmenSet,
  jahresEreignisse = [],
  onZelleClick, onAuftragClick, onMitarbeiterRename,
}: Props) {
  const heute         = todayStr();
  const feiertagNamen = wochentage.map(d => isFeiertag(d));
  const [editingMA,  setEditingMA]  = useState<string | null>(null);
  const [editMAName, setEditMAName] = useState('');

  return (
    <div className="h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="relative h-full" style={{ minWidth: '640px' }}>
        <table
          className="border-collapse w-full"
          style={{ tableLayout: 'fixed', height: '100%' }}
        >
          <colgroup>
            <col style={{ width: '72px' }} />
            {Array.from({ length: 50 }).map((_, i) => <col key={i} />)}
          </colgroup>

          {/* ── Kopfzeilen ── */}
          <thead>
            {/* Zeile 1: Tagesnamen */}
            <tr>
              <th
                rowSpan={2}
                className="border border-slate-400 bg-slate-800 text-white text-xs
                           font-semibold text-center align-middle px-1 leading-snug
                           sticky left-0 z-20"
              >
                Mitarbeiter
              </th>
              {wochentage.map((datum, di) => {
                const ft    = feiertagNamen[di];
                const isHeu = datum === heute;
                const bg       = ft ? 'bg-amber-700' : isHeu ? 'bg-blue-500' : 'bg-blue-900';
                const dayEvents = jahresEreignisse.filter(e => e.datum === datum);
                return (
                  <th key={datum} colSpan={10}
                    className={`border border-slate-300 text-center leading-none py-1.5 text-white ${bg}`}>
                    <div className="text-[11px] font-bold tracking-tight">
                      {WOCHENTAGE_KURZ[di]}&nbsp;{formatAnzeige(parseDatum(datum))}
                    </div>
                    {ft && <div className="text-[9px] italic font-normal opacity-90 mt-px">{ft}</div>}
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-0.5 mt-1">
                        {dayEvents.map(e => (
                          <span key={e.id}
                            className={`text-[9px] px-1.5 py-px rounded-full font-semibold leading-snug
                              ${e.typ === 'geburtstag'
                                ? 'bg-purple-200/30 text-purple-100 ring-1 ring-purple-300/40'
                                : 'bg-green-200/30 text-green-100 ring-1 ring-green-300/40'}`}>
                            {e.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>

            {/* Zeile 2: Stundenzahlen */}
            <tr>
              {wochentage.map((datum) =>
                STUNDEN.map((h, hi) => (
                  <th key={`${datum}-${h}`}
                    className="border-b border-r border-slate-300 bg-slate-100 text-[10px] font-semibold text-slate-500 text-center py-1">
                    {h}
                  </th>
                ))
              )}
            </tr>
          </thead>

          {/* ── Datenzeilen ── */}
          <tbody>
            {mitarbeiterNamen.map((ma, mi) => {
              const maInfo = mitarbeiterListe.find(m => m.name === ma);
              const autoBuerozeit =
                (maInfo?.auto_buerozeit_start != null && maInfo?.auto_buerozeit_end != null)
                  ? { start: maInfo.auto_buerozeit_start!, end: maInfo.auto_buerozeit_end! }
                  : null;
              const cells        = computeRow(ma, wochentage, auftraege, urlaube);
              const bueroOverlays = computeBueroOverlays(ma, wochentage, auftraege, autoBuerozeit, ausnahmenSet);
              const totalCols    = wochentage.length * STUNDEN.length;

              return (
                <tr key={ma} style={{ height: '0' }}
                  className={mi % 2 === 1 ? 'bg-slate-50/40' : ''}>

                  {/* Mitarbeitername – klicken zum Umbenennen */}
                  <td
                    className="border border-slate-300 bg-slate-700 p-0 relative overflow-hidden group sticky left-0 z-10"
                    style={{ cursor: 'text' }}
                    title={`${ma} – klicken zum Umbenennen`}
                    onClick={() => {
                      if (editingMA === null) {
                        setEditingMA(ma);
                        setEditMAName(ma);
                      }
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center px-1.5 overflow-hidden">
                      {editingMA === ma ? (
                        <input
                          autoFocus
                          value={editMAName}
                          onChange={e => setEditMAName(e.target.value)}
                          onBlur={() => {
                            const v = editMAName.trim();
                            if (v && v !== ma) onMitarbeiterRename?.(ma, v);
                            setEditingMA(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const v = editMAName.trim();
                              if (v && v !== ma) onMitarbeiterRename?.(ma, v);
                              setEditingMA(null);
                            }
                            if (e.key === 'Escape') setEditingMA(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-slate-600 text-white text-center text-[11px]
                                     font-semibold outline-none rounded px-1 py-0.5
                                     border border-slate-400 focus:border-blue-400"
                        />
                      ) : (
                        <span className="text-[11px] font-semibold text-white text-center
                                         leading-tight whitespace-pre-line">
                          {kurzMA(ma)}
                        </span>
                      )}
                    </div>
                    {editingMA !== ma && (
                      <span className="absolute bottom-0.5 right-0.5 text-[8px] text-white/40
                                       opacity-0 group-hover:opacity-100 transition-opacity
                                       pointer-events-none select-none leading-none">
                        ✎
                      </span>
                    )}
                  </td>

                  {/* Datenbereich: eine einzelne td mit CSS-Grid + Büro-Overlay dahinter.
                      Das Grid ist absolut positioniert → beeinflusst die Reihenhöhe NICHT.
                      grid-template-rows: 1fr → eine Zeile füllt die volle td-Höhe (align-items: stretch default). */}
                  <td colSpan={totalCols} className="border-b border-slate-200 p-0 relative">
                    <div
                      className="absolute inset-0"
                      style={{ display: 'grid', gridTemplateColumns: `repeat(${totalCols}, 1fr)`, gridTemplateRows: '1fr' }}
                    >
                      {/* ── Bürozeit-Hintergrundblöcke (z-index: 1, hinter allem) ── */}
                      {bueroOverlays.map((o, i) => (
                        <div
                          key={i}
                          className="absolute pointer-events-none select-none flex items-start overflow-hidden"
                          style={{
                            left:        `${(o.globalStart / totalCols) * 100}%`,
                            width:       `${((o.globalEnd - o.globalStart) / totalCols) * 100}%`,
                            top:         0,
                            height:      '100%',
                            paddingTop:  '2px',
                            paddingLeft: '3px',
                            backgroundColor: '#ffedd5',
                            borderTop:    '2px solid #fed7aa',
                            borderBottom: '2px solid #fed7aa',
                            zIndex: 1,
                          }}
                        >
                          <span className="text-[8px] text-orange-400 font-semibold tracking-wider uppercase leading-none">
                            Büro
                          </span>
                        </div>
                      ))}

                      {/* ── Inhaltszellen (z-index: 2, vor Büro-Overlay) ── */}
                      {cells.map((cell, ci) => {
                        if (cell === null) return null;
                        const gridCol = ci + 1;

                        if (cell.type === 'urlaub') {
                          const zeitLabel = cell.urlaubObj.start_zeit && cell.urlaubObj.end_zeit
                            ? `${cell.urlaubObj.start_zeit.slice(0, 5)}–${cell.urlaubObj.end_zeit.slice(0, 5)}`
                            : null;
                          return (
                            <div
                              key={`u${ci}`}
                              className={`border-r border-l-2 relative overflow-hidden ${urlaubBorderCls(cell.urlaubTyp)}`}
                              style={{
                                gridColumn: `${gridCol} / span ${cell.colSpan}`,
                                background: urlaubBg(cell.urlaubTyp),
                                position: 'relative',
                                zIndex: 2,
                              }}
                              title={`${ma}: ${ABWESENHEITS_LABELS[cell.urlaubTyp]}${zeitLabel ? ` (${zeitLabel})` : ''}`}
                            >
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-[11px] font-bold ${urlaubTextCls(cell.urlaubTyp)}`}>
                                  {ABWESENHEITS_LABELS[cell.urlaubTyp]}
                                </span>
                                {zeitLabel && (
                                  <span className={`text-[9px] font-medium ${urlaubTextCls(cell.urlaubTyp)} opacity-75`}>
                                    {zeitLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (cell.type === 'auftrag') {
                          return (
                            <div
                              key={`a${cell.auftrag.id}`}
                              className="border-r border-slate-200 overflow-hidden"
                              style={{
                                gridColumn: `${gridCol} / span ${cell.colSpan}`,
                                position: 'relative',
                                zIndex: 2,
                                // Kein opaker Hintergrund – Büro-Orange scheint durch die Streifen oben/unten durch
                              }}
                            >
                              {/* Karte auf 75 % Höhe zentriert → 12,5 % Streifen oben + unten zeigen Büro-Hintergrund */}
                              <div className="absolute inset-x-0 overflow-hidden"
                                style={{ top: '12.5%', height: '75%' }}>
                                <AuftragKarte
                                  auftrag={cell.auftrag}
                                  rowMitarbeiter={ma}
                                  onClick={() => onAuftragClick(cell.auftrag)}
                                />
                              </div>
                            </div>
                          );
                        }

                        const bueroAtCell = bueroOverlays.find(
                          o => o.globalStart <= ci && ci < o.globalEnd
                        );
                        return (
                          <DroppableZelle
                            key={`e${cell.datum}${cell.stunde}`}
                            datum={cell.datum}
                            mitarbeiter={ma}
                            stunde={cell.stunde}
                            isToday={cell.datum === heute}
                            isHoliday={!!isFeiertag(cell.datum)}
                            onClick={bueroAtCell?.auftrag
                              ? () => onAuftragClick(bueroAtCell.auftrag!)
                              : () => onZelleClick(cell.datum, ma, cell.stunde)
                            }
                            gridColumn={gridCol}
                          />
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {wochentage.slice(1).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-30"
            style={{
              left: `calc(72px + (100% - 72px) * ${i + 1} / ${wochentage.length})`,
              backgroundColor: '#94a3b8',
            }}
          />
        ))}
        </div>
      </div>
    </div>
  );
}
