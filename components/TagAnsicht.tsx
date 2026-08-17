'use client';

import { useDroppable, useDraggable } from '@dnd-kit/core';
import {
  STUNDEN, Auftrag, Urlaub, Mitarbeiter,
  AbwesenheitsTyp, ABWESENHEITS_LABELS,
  STATUS_BORDER_T, STATUS_BORDER_L, STATUS_DOT_COLORS,
  JahresEreignis, getAuftragMitarbeiterListe, getUrlaubMitarbeiterListe,
} from '@/lib/types';
import { formatTagKopf, parseDatum } from '@/lib/dateUtils';
import { isFeiertag } from '@/lib/feiertage';

// ── Hintergründe ──────────────────────────────────────────────────────────────
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

// Für ein einzelnes Datum: colSpan abhängig davon ob dieser Tag Start-, Zwischen- oder Endtag ist
function colSpanFuerAuftrag(auftrag: Auftrag, datum: string, startHi: number): number {
  if (!auftrag.datum_bis || auftrag.datum_bis === auftrag.datum) {
    return auftrag.end_stunde - auftrag.start_stunde;
  }
  // Auftrag endet nach diesem Tag → bis Tagesende strecken
  if (auftrag.datum_bis > datum) {
    return STUNDEN.length - startHi;
  }
  // Endtag eines mehrtägigen Auftrags (auftrag.datum < datum === auftrag.datum_bis)
  const endHi = STUNDEN_ARR.indexOf(auftrag.end_stunde);
  return Math.max(1, (endHi === -1 ? STUNDEN.length : endHi) - startHi);
}

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
type CellData =
  | { type: 'auftrag'; auftrag: Auftrag; colSpan: number }
  | { type: 'urlaub';  datum: string;    colSpan: number; urlaubTyp: AbwesenheitsTyp; urlaubObj: Urlaub }
  | { type: 'empty';   datum: string;    stunde: number }
  | null;

interface BueroOverlay { globalStart: number; globalEnd: number; auftrag: Auftrag | null }

function computeRow(
  ma: string,
  datum: string,
  auftraege: Auftrag[],
  urlaube: Urlaub[],
): CellData[] {
  const row: CellData[] = [];

  // Ganztägiger Urlaub
  const ganztaegig = urlaube.find(
    u => getUrlaubMitarbeiterListe(u).includes(ma) && u.datum_von <= datum && u.datum_bis >= datum && !u.start_zeit
  );
  if (ganztaegig) {
    row.push({ type: 'urlaub', datum, colSpan: STUNDEN.length, urlaubTyp: ganztaegig.typ ?? 'urlaub', urlaubObj: ganztaegig });
    for (let i = 1; i < STUNDEN.length; i++) row.push(null);
    return row;
  }

  // Stundenweiser Urlaub für diesen Tag
  const stundenweisenU = urlaube.find(
    u => getUrlaubMitarbeiterListe(u).includes(ma) && u.datum_von <= datum && u.datum_bis >= datum && !!u.start_zeit
  ) ?? null;

  // Mittlere Tage + Endtag ohne Endzeit → als ganztägig rendern
  if (stundenweisenU) {
    const sIsingle = stundenweisenU.datum_von === stundenweisenU.datum_bis;
    const sIsStart = datum === stundenweisenU.datum_von;
    const sIsEnd   = datum === stundenweisenU.datum_bis;
    if (!sIsingle && !sIsStart && (!sIsEnd || !stundenweisenU.end_zeit)) {
      row.push({ type: 'urlaub', datum, colSpan: STUNDEN.length, urlaubTyp: stundenweisenU.typ ?? 'urlaub', urlaubObj: stundenweisenU });
      for (let i = 1; i < STUNDEN.length; i++) row.push(null);
      return row;
    }
  }

  // Nur reguläre Aufträge – Bürozeiten werden separat als Overlay gerendert
  // Mehrtägige Aufträge die diesen Tag überspannen werden ebenfalls erfasst
  const tagAuftraege = auftraege.filter(
    a => getAuftragMitarbeiterListe(a).includes(ma) &&
         a.datum <= datum && (a.datum_bis ?? a.datum) >= datum &&
         a.typ !== 'buerozeit'
  );

  let hi = 0;
  let colsToSkip = 0;

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

    // Aufträge die vor diesem Tag begonnen haben: am ersten Stunden-Slot einsetzen
    const auftrag = tagAuftraege.find(a =>
      a.datum < datum ? hi === 0 : a.start_stunde === stunde
    );
    if (auftrag) {
      const colSpan = colSpanFuerAuftrag(auftrag, datum, hi);
      row.push({ type: 'auftrag', auftrag, colSpan });
      colsToSkip = colSpan - 1;
    } else {
      row.push({ type: 'empty', datum, stunde });
    }
    hi++;
  }
  return row;
}

function computeBueroOverlay(
  ma: string,
  datum: string,
  auftraege: Auftrag[],
  autoBuerozeit: { start: number; end: number } | null,
  ausnahmenSet: Set<string>,
): BueroOverlay | null {
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
    return { globalStart: hiStart, globalEnd: hiEnd, auftrag: srcAuftrag };
  }
  return null;
}

// ── Draggable Auftragskarte ───────────────────────────────────────────────────
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
                    : `bg-white/85 border-t-[5px] border-l-[5px] ${STATUS_BORDER_T[auftrag.status]} ${STATUS_BORDER_L[auftrag.status]} gap-1.5 px-2`}
                  ${isDragging ? 'opacity-25' : ''}`}
    >
      <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${auftrag.typ === 'buerozeit' ? 'bg-orange-400' : STATUS_DOT_COLORS[auftrag.status]}`} />
      <div className="min-w-0 overflow-hidden">
        <div className={`leading-tight font-semibold truncate
          ${auftrag.typ === 'buerozeit'
            ? 'text-[11px] text-orange-700'
            : 'text-[13px] text-slate-800'}`}>
          {hauptText}
        </div>
        {nebenText && (
          <div className="text-[11px] text-slate-500 truncate">{nebenText}</div>
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
  datum: string;
  auftraege: Auftrag[];
  urlaube: Urlaub[];
  mitarbeiterNamen: string[];
  mitarbeiterListe: Mitarbeiter[];
  ausnahmenSet: Set<string>;
  jahresEreignisse?: JahresEreignis[];
  onZelleClick: (datum: string, mitarbeiter: string, stunde: number) => void;
  onAuftragClick: (auftrag: Auftrag) => void;
}

export default function TagAnsicht({
  datum, auftraege, urlaube, mitarbeiterNamen, mitarbeiterListe, ausnahmenSet,
  jahresEreignisse = [],
  onZelleClick, onAuftragClick,
}: Props) {
  const heute        = todayStr();
  const feiertagName = isFeiertag(datum);
  const isHeu        = datum === heute;
  const bg           = feiertagName ? 'bg-amber-700' : isHeu ? 'bg-blue-500' : 'bg-blue-900';
  const dayLabel     = formatTagKopf(parseDatum(datum));
  const dayEvents    = jahresEreignisse.filter(e => e.datum === datum);
  const totalCols    = STUNDEN.length;

  return (
    <div className="h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-hidden">
        <table
          className="border-collapse w-full"
          style={{ tableLayout: 'fixed', height: '100%' }}
        >
          <colgroup>
            <col style={{ width: '72px' }} />
            {STUNDEN.map((_, i) => <col key={i} />)}
          </colgroup>

          {/* ── Kopfzeilen ── */}
          <thead>
            {/* Zeile 1: Tagesname */}
            <tr>
              <th
                rowSpan={2}
                className="border border-slate-400 bg-slate-800 text-white text-xs
                           font-semibold text-center align-middle px-1 leading-snug
                           sticky left-0 z-20"
              >
                Mitarbeiter
              </th>
              <th colSpan={totalCols}
                className={`border border-slate-400 text-center leading-none py-1.5 text-white ${bg}`}>
                <div className="text-[13px] font-bold tracking-tight">{dayLabel}</div>
                {feiertagName && (
                  <div className="text-[10px] italic font-normal opacity-90 mt-px">{feiertagName}</div>
                )}
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
            </tr>

            {/* Zeile 2: Stundenzahlen */}
            <tr>
              {STUNDEN.map((h, hi) => (
                <th key={h}
                  className={`border-b border-r border-slate-300 bg-slate-100
                              text-xs font-semibold text-slate-500 text-center py-1.5
                              ${hi === 0 ? 'border-l border-l-slate-400' : ''}
                              ${hi === STUNDEN.length - 1 ? 'border-r-[3px] border-r-slate-400' : ''}`}>
                  {h}:00
                </th>
              ))}
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
              const cells      = computeRow(ma, datum, auftraege, urlaube);
              const bueroOverlay = computeBueroOverlay(ma, datum, auftraege, autoBuerozeit, ausnahmenSet);

              return (
                <tr key={ma} style={{ height: '0' }}
                  className={mi % 2 === 1 ? 'bg-slate-50/40' : ''}>

                  {/* Mitarbeitername */}
                  <td
                    className="border border-slate-300 bg-slate-700 p-0 relative overflow-hidden sticky left-0 z-10"
                  >
                    <div className="absolute inset-0 flex items-center justify-center px-1.5 overflow-hidden">
                      <span className="text-[11px] font-semibold text-white text-center
                                       leading-tight whitespace-pre-line">
                        {kurzMA(ma)}
                      </span>
                    </div>
                  </td>

                  {/* Datenbereich: CSS-Grid + Büro-Overlay */}
                  <td colSpan={totalCols} className="border-b border-slate-200 p-0 relative">
                    <div
                      className="absolute inset-0"
                      style={{ display: 'grid', gridTemplateColumns: `repeat(${totalCols}, 1fr)`, gridTemplateRows: '1fr' }}
                    >
                      {/* ── Bürozeit-Hintergrundblock ── */}
                      {bueroOverlay && (
                        <div
                          className="absolute pointer-events-none select-none flex items-start overflow-hidden"
                          style={{
                            left:        `${(bueroOverlay.globalStart / totalCols) * 100}%`,
                            width:       `${((bueroOverlay.globalEnd - bueroOverlay.globalStart) / totalCols) * 100}%`,
                            top:         0,
                            height:      '100%',
                            paddingTop:  '3px',
                            paddingLeft: '5px',
                            backgroundColor: '#ffedd5',
                            borderTop:    '2px solid #fed7aa',
                            borderBottom: '2px solid #fed7aa',
                            zIndex: 1,
                          }}
                        >
                          <span className="text-[9px] text-orange-400 font-semibold tracking-wider uppercase leading-none">
                            Büro
                          </span>
                        </div>
                      )}

                      {/* ── Inhaltszellen ── */}
                      {cells.map((cell, ci) => {
                        if (cell === null) return null;
                        const gridCol = ci + 1;

                        if (cell.type === 'urlaub') {
                          const _u  = cell.urlaubObj;
                          const _sz = _u.start_zeit;
                          const _ez = _u.end_zeit;
                          const _multi   = _u.datum_von !== _u.datum_bis;
                          const _isStart = cell.datum === _u.datum_von;
                          const _isEnd   = cell.datum === _u.datum_bis;
                          const zeitLabel = (() => {
                            if (!_sz)            return null;
                            if (!_multi)         return _ez
                              ? `${_sz.slice(0,5)}–${_ez.slice(0,5)}`
                              : `ab ${_sz.slice(0,5)}`;
                            if (_isStart)        return `ab ${_sz.slice(0,5)}`;
                            if (_isEnd && _ez)   return `bis ${_ez.slice(0,5)}`;
                            return null;
                          })();
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
                                <span className={`text-sm font-bold ${urlaubTextCls(cell.urlaubTyp)}`}>
                                  {ABWESENHEITS_LABELS[cell.urlaubTyp]}
                                </span>
                                {zeitLabel && (
                                  <span className={`text-xs font-medium ${urlaubTextCls(cell.urlaubTyp)} opacity-75`}>
                                    {zeitLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (cell.type === 'auftrag') {
                          // Unsichtbarer Platzhalter – Karte kommt im Auftrags-Overlay darunter
                          return (
                            <div
                              key={`a_spacer_${cell.auftrag.id}`}
                              style={{ gridColumn: `${gridCol} / span ${cell.colSpan}` }}
                            />
                          );
                        }

                        const bueroAtCell = bueroOverlay &&
                          bueroOverlay.globalStart <= ci && ci < bueroOverlay.globalEnd
                          ? bueroOverlay : null;
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

                    {/* Auftrags-Overlay: absolut über dem Grid, Überschneidungen vertikal gestapelt */}
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
                      {(() => {
                        const tagAuftraege = auftraege.filter(a =>
                          getAuftragMitarbeiterListe(a).includes(ma) &&
                          a.datum <= datum && (a.datum_bis ?? a.datum) >= datum &&
                          a.typ !== 'buerozeit'
                        );
                        if (tagAuftraege.length === 0) return null;

                        // Greedy Lane-Zuweisung für diesen Tag
                        const withRanges = tagAuftraege.map(a => ({
                          a,
                          s: a.datum < datum ? STUNDEN[0] : a.start_stunde,
                          e: (a.datum_bis && a.datum_bis > datum) ? 17 : a.end_stunde,
                        }));
                        const sorted = [...withRanges].sort((x, y) => x.s - y.s || x.e - y.e);
                        const laneEnds: number[] = [];
                        const laneAssign = new Map<string, number>();
                        for (const { a, s, e } of sorted) {
                          const free = laneEnds.findIndex(t => t <= s);
                          const ln   = free !== -1 ? free : laneEnds.length;
                          if (free !== -1) laneEnds[free] = e; else laneEnds.push(e);
                          laneAssign.set(a.id, ln);
                        }
                        const maxLanes = laneEnds.length;

                        return tagAuftraege.map(a => {
                          const isStart = a.datum === datum;
                          const startHi = isStart
                            ? (STUNDEN_ARR.indexOf(a.start_stunde) >= 0 ? STUNDEN_ARR.indexOf(a.start_stunde) : 0)
                            : 0;
                          const colSpan = colSpanFuerAuftrag(a, datum, startHi);
                          const lane    = laneAssign.get(a.id) ?? 0;
                          return (
                            <div
                              key={`ao_${a.id}`}
                              className="absolute pointer-events-auto overflow-hidden"
                              style={{
                                left:   `${(startHi / totalCols) * 100}%`,
                                width:  `${(colSpan / totalCols) * 100}%`,
                                top:    maxLanes <= 1 ? '12.5%' : `${(lane / maxLanes) * 100 + 1}%`,
                                height: maxLanes <= 1 ? '75%'   : `${(1 / maxLanes) * 100 - 2}%`,
                              }}
                            >
                              <AuftragKarte auftrag={a} rowMitarbeiter={ma} onClick={() => onAuftragClick(a)} />
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
