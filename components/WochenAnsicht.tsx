'use client';

import { useDroppable, useDraggable } from '@dnd-kit/core';
import {
  MITARBEITER, STUNDEN, Auftrag, Urlaub,
  STATUS_BORDER_T, STATUS_DOT_COLORS,
} from '@/lib/types';
import { formatAnzeige, parseDatum, WOCHENTAGE_KURZ } from '@/lib/dateUtils';
import { isFeiertag as _isFeiertag } from '@/lib/feiertage';

// Lokale Absicherung: Fronleichnam darf NIEMALS als Feiertag erscheinen.
const VERBOTEN = new Set(['Fronleichnam', 'Corpus Christi']);
function isFeiertag(datum: string): string | null {
  const n = _isFeiertag(datum);
  return n && VERBOTEN.has(n) ? null : n;
}

// ── Hintergründe ──────────────────────────────────────────────────────────────
const X_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' preserveAspectRatio='none'%3E%3Cline x1='0' y1='0' x2='100%25' y2='100%25' stroke='%23b0bec5' stroke-width='2'/%3E%3Cline x1='100%25' y1='0' x2='0' y2='100%25' stroke='%23b0bec5' stroke-width='2'/%3E%3C%2Fsvg%3E")`;

const URLAUB_BG = `repeating-linear-gradient(
  45deg,
  #ffedd5, #ffedd5 6px,
  #fed7aa 6px, #fed7aa 13px
)`;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function kurzMA(name: string): string {
  if (name === 'Müller Heinz/Monika') return 'Müller\nH/M';
  if (name === 'Freier Platz 1')      return 'Frei 1';
  if (name === 'Freier Platz 2')      return 'Frei 2';
  return name;
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

// ── Zell-Typen ────────────────────────────────────────────────────────────────
type CellData =
  | { type: 'auftrag'; auftrag: Auftrag; colSpan: number; isFirst: boolean }
  | { type: 'urlaub';  datum: string;    colSpan: number                   }
  | { type: 'empty';   datum: string;    stunde: number;  isFirst: boolean }
  | null;

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

    // Urlaub – nur wenn kein laufendes colSpan aus Vortag
    if (colsToSkip === 0) {
      const hatUrlaub = urlaube.some(
        u => u.mitarbeiter === ma && u.datum_von <= datum && u.datum_bis >= datum
      );
      if (hatUrlaub) {
        row.push({ type: 'urlaub', datum, colSpan: STUNDEN.length });
        for (let i = 1; i < STUNDEN.length; i++) row.push(null);
        continue;
      }
    }

    const tagAuftraege = auftraege.filter(a => a.mitarbeiter === ma && a.datum === datum);
    let hi = 0;
    let isFirst = true;

    while (hi < STUNDEN.length) {
      if (colsToSkip > 0) {
        row.push(null);
        colsToSkip--;
        hi++;
        isFirst = false;
        continue;
      }

      const stunde = STUNDEN[hi];
      const auftrag = tagAuftraege.find(a => a.start_stunde === stunde);

      if (auftrag) {
        const colSpan = colSpanFuerAuftrag(auftrag, wochentage, di, hi);
        row.push({ type: 'auftrag', auftrag, colSpan, isFirst });
        colsToSkip = colSpan - 1;
      } else {
        row.push({ type: 'empty', datum, stunde, isFirst });
      }

      hi++;
      isFirst = false;
    }
  }
  return row;
}

// ── Draggable Auftragskarte ───────────────────────────────────────────────────
function AuftragKarte({ auftrag, onClick }: { auftrag: Auftrag; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: auftrag.id,
    data: { auftrag },
  });

  const subtitle = [auftrag.kunde, auftrag.datum_bis ? `bis ${auftrag.datum_bis}` : '']
    .filter(Boolean).join(' · ');

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={`${auftrag.titel}${subtitle ? ' · ' + subtitle : ''}`}
      className={`h-full w-full flex items-center gap-1 px-1.5 overflow-hidden
                  cursor-grab select-none rounded-sm border-t-[3px] transition-opacity
                  ${auftrag.typ === 'buerozeit' ? 'bg-orange-100/80 border-t-orange-400' : `bg-white/85 ${STATUS_BORDER_T[auftrag.status]}`}
                  ${isDragging ? 'opacity-25' : ''}`}
    >
      <span className={`shrink-0 w-2 h-2 rounded-full ${auftrag.typ === 'buerozeit' ? 'bg-orange-400' : STATUS_DOT_COLORS[auftrag.status]}`} />
      <span className="text-[11px] font-semibold text-slate-800 truncate leading-none min-w-0">
        {auftrag.titel}
      </span>
    </div>
  );
}

// ── Droppable leere Zelle ─────────────────────────────────────────────────────
function DroppableZelle({
  datum, mitarbeiter, stunde, isFirst, isToday, isHoliday, onClick,
}: {
  datum: string; mitarbeiter: string; stunde: number;
  isFirst: boolean; isToday: boolean; isHoliday: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${datum}||${mitarbeiter}||${stunde}`,
    data: { datum, mitarbeiter, stunde },
  });

  return (
    <td
      ref={setNodeRef}
      onClick={onClick}
      className={`border-b border-r border-slate-200 cursor-pointer transition-colors
                  ${isFirst    ? 'border-l border-l-slate-300' : ''}
                  ${isOver     ? 'bg-blue-200'
                  : isToday    ? 'bg-blue-50/50'
                  : isHoliday  ? 'bg-amber-50/80'
                  : 'hover:bg-blue-50/70'}`}
    />
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
interface Props {
  wochentage: string[];
  auftraege: Auftrag[];
  urlaube: Urlaub[];
  onZelleClick: (datum: string, mitarbeiter: string, stunde: number) => void;
  onAuftragClick: (auftrag: Auftrag) => void;
}

export default function WochenAnsicht({
  wochentage, auftraege, urlaube, onZelleClick, onAuftragClick,
}: Props) {
  const heute         = todayStr();
  const feiertagNamen = wochentage.map(d => isFeiertag(d));

  return (
    <div className="h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <table
          className="border-collapse w-full"
          style={{ tableLayout: 'fixed', minWidth: '720px', height: '100%' }}
        >
          <colgroup>
            <col style={{ width: '96px' }} />
            {Array.from({ length: 50 }).map((_, i) => <col key={i} />)}
          </colgroup>

          {/* ── Kopfzeilen ── */}
          <thead>
            {/* Zeile 1: Tagesnamen */}
            <tr>
              <th
                rowSpan={2}
                className="border border-slate-400 bg-slate-800 text-white text-xs
                           font-semibold text-center align-middle px-1 leading-snug"
              >
                Mitarbeiter
              </th>
              {wochentage.map((datum, di) => {
                // HARTE SPERRE direkt im Rendering – Fronleichnam NIEMALS orange
                let ft = feiertagNamen[di];
                if (ft && (ft.includes('Fronleichnam') || ft.includes('Corpus'))) ft = null;
                const isHeu = datum === heute;
                const bg    = ft ? 'bg-amber-700' : isHeu ? 'bg-blue-500' : 'bg-blue-900';
                return (
                  <th key={datum} colSpan={10}
                    className={`border border-slate-400 text-center leading-none py-1.5 text-white ${bg}`}>
                    <div className="text-[11px] font-bold tracking-tight">
                      {WOCHENTAGE_KURZ[di]}&nbsp;{formatAnzeige(parseDatum(datum))}
                    </div>
                    {ft && <div className="text-[9px] italic font-normal opacity-90 mt-px">{ft}</div>}
                  </th>
                );
              })}
            </tr>

            {/* Zeile 2: Stundenzahlen */}
            <tr>
              {wochentage.map((datum) =>
                STUNDEN.map((h, hi) => (
                  <th key={`${datum}-${h}`}
                    className={`border-b border-r border-slate-300 bg-slate-100
                                text-[10px] font-semibold text-slate-500 text-center py-1
                                ${hi === 0 ? 'border-l border-l-slate-400' : ''}`}>
                    {h}
                  </th>
                ))
              )}
            </tr>
          </thead>

          {/* ── Datenzeilen ── */}
          <tbody>
            {MITARBEITER.map((ma, mi) => {
              const cells = computeRow(ma, wochentage, auftraege, urlaube);

              return (
                <tr key={ma} style={{ height: '0' }}
                  className={mi % 2 === 1 ? 'bg-slate-50/40' : ''}>

                  {/* Mitarbeitername */}
                  <td className="border border-slate-300 bg-slate-700 text-white text-[11px]
                                 font-semibold text-center px-1 align-middle whitespace-pre-line
                                 leading-tight">
                    {kurzMA(ma)}
                  </td>

                  {/* Stunden-Zellen */}
                  {cells.map((cell, ci) => {
                    if (cell === null) return null;

                    if (cell.type === 'urlaub') {
                      return (
                        <td key={`u${ci}`} colSpan={cell.colSpan}
                          className="border-b border-r border-l-2 border-orange-300
                                     border-l-orange-400 text-center align-middle"
                          style={{ background: URLAUB_BG }}
                          title={`${ma}: Urlaub`}>
                          <span className="text-[11px] font-bold text-orange-800">Urlaub</span>
                        </td>
                      );
                    }

                    if (cell.type === 'auftrag') {
                      const _ftRaw = isFeiertag(cell.auftrag.datum);
                      const ft = _ftRaw && (_ftRaw.includes('Fronleichnam') || _ftRaw.includes('Corpus')) ? null : _ftRaw;
                      const isBuerozeit = cell.auftrag.typ === 'buerozeit';
                      return (
                        <td key={`a${cell.auftrag.id}`} colSpan={cell.colSpan}
                          className={`border-b border-r p-0 align-middle
                                      ${cell.isFirst ? 'border-l border-l-slate-300' : ''}
                                      ${isBuerozeit ? 'border-orange-200' : ''}`}
                          style={isBuerozeit
                            ? { backgroundColor: '#fff7ed' }  // orange-50, kein X
                            : {
                                backgroundImage: X_BG,
                                backgroundRepeat: 'no-repeat',
                                backgroundSize: '100% 100%',
                                backgroundColor: ft ? '#fef9c3' : '#eceff1',
                              }
                          }>
                          <AuftragKarte
                            auftrag={cell.auftrag}
                            onClick={() => onAuftragClick(cell.auftrag)}
                          />
                        </td>
                      );
                    }

                    // Leere droppable Zelle
                    return (
                      <DroppableZelle
                        key={`e${cell.datum}${cell.stunde}`}
                        datum={cell.datum}
                        mitarbeiter={ma}
                        stunde={cell.stunde}
                        isFirst={cell.isFirst}
                        isToday={cell.datum === heute}
                        isHoliday={(() => { const n = isFeiertag(cell.datum); return !!n && !n.includes('Fronleichnam') && !n.includes('Corpus'); })()}
                        onClick={() => onZelleClick(cell.datum, ma, cell.stunde)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
