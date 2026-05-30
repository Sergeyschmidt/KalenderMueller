'use client';

import { Auftrag, Urlaub, STATUS_DOT_COLORS } from '@/lib/types';
import { getMonatsKalender, formatDatum, isToday, isSameMonth } from '@/lib/dateUtils';
import { isFeiertag as _isFeiertag } from '@/lib/feiertage';
const _FT_VERBOTEN = new Set(['Fronleichnam', 'Corpus Christi']);
function isFeiertag(datum: string): string | null {
  const n = _isFeiertag(datum);
  return n && _FT_VERBOTEN.has(n) ? null : n;
}

interface Props {
  datum: Date;
  auftraege: Auftrag[];
  urlaube: Urlaub[];
  onTagClick: (tag: Date) => void;
}

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function kurzname(name: string): string {
  const first = name.split(' ')[0];
  return first.length > 8 ? first.slice(0, 7) + '.' : first;
}

function gebuchteStunden(auftraege: Auftrag[], datum: string): number {
  return auftraege
    .filter((a) => a.datum === datum)
    .reduce((s, a) => s + (a.end_stunde - a.start_stunde), 0);
}

const MAX_KAPAZITAET = 10 * 5; // 10h × 5 Mitarbeiter

export default function MonatsAnsicht({ datum, auftraege, urlaube, onTagClick }: Props) {
  const wochen = getMonatsKalender(datum);

  return (
    <div className="p-4">
      {/* Spaltenköpfe */}
      <div className="grid grid-cols-7 mb-1">
        {WOCHENTAGE.map((t, i) => (
          <div key={t} className={`text-center text-xs font-semibold py-2
            ${i >= 5 ? 'text-slate-400' : 'text-slate-500'}`}>
            {t}
          </div>
        ))}
      </div>

      {/* Kalender-Grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
        {wochen.flat().map((tag, i) => {
          if (!tag) {
            return <div key={`leer-${i}`} className="bg-slate-50 min-h-[110px]" />;
          }

          const tagStr       = formatDatum(tag);
          // Mehrtägige Aufträge erscheinen an jedem Tag ihres Zeitraums
          const tagAuftraege = auftraege.filter(
            (a) => a.datum <= tagStr && (a.datum_bis || a.datum) >= tagStr
          );
          const tagUrlaube   = urlaube.filter(
            (u) => u.datum_von <= tagStr && u.datum_bis >= tagStr
          );
          const feiertagName = isFeiertag(tagStr);
          const istAktMonat  = isSameMonth(tag, datum);
          const istHeute     = isToday(tag);
          const istWE        = tag.getDay() === 0 || tag.getDay() === 6;
          const gebH         = gebuchteStunden(auftraege, tagStr);
          const auslastung   = Math.min((gebH / MAX_KAPAZITAET) * 100, 100);

          // Alle Einträge kombiniert für Anzeige (Urlaube + Aufträge)
          type Eintrag =
            | { art: 'urlaub'; key: string; name: string }
            | { art: 'auftrag'; key: string; auftrag: Auftrag };

          const eintraege: Eintrag[] = [
            ...tagUrlaube.map((u) => ({
              art: 'urlaub' as const,
              key: u.id,
              name: u.mitarbeiter,
            })),
            ...tagAuftraege.map((a) => ({
              art: 'auftrag' as const,
              key: a.id,
              auftrag: a,
            })),
          ];
          const MAX_ANZEIGE = 6;
          const overflow    = Math.max(0, eintraege.length - MAX_ANZEIGE);

          // Hintergrundfarbe des Tages
          let tagBg = istWE ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white hover:bg-blue-50';
          if (feiertagName) tagBg = 'bg-amber-50 hover:bg-amber-100';

          return (
            <div
              key={tagStr}
              onClick={() => onTagClick(tag)}
              className={`min-h-[110px] p-1.5 cursor-pointer transition-colors flex flex-col gap-0.5
                ${tagBg} ${!istAktMonat ? 'opacity-30' : ''}`}
            >
              {/* Tageszahl + Auslastungsbalken */}
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-semibold shrink-0
                  ${istHeute ? 'bg-blue-900 text-white' : feiertagName ? 'text-amber-800' : 'text-slate-600'}`}>
                  {tag.getDate()}
                </span>
                {(tagAuftraege.length > 0 || tagUrlaube.length > 0) && !feiertagName && (
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full
                        ${auslastung < 40 ? 'bg-green-400'
                          : auslastung < 75 ? 'bg-yellow-400'
                          : 'bg-red-400'}`}
                      style={{ width: `${Math.max(auslastung, 8)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Feiertag-Label */}
              {feiertagName && (
                <div className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded
                                font-semibold leading-tight mb-0.5 truncate">
                  {feiertagName}
                </div>
              )}

              {/* Einträge */}
              <div className="flex flex-col gap-0.5 flex-1">
                {eintraege.slice(0, MAX_ANZEIGE).map((e) => {
                  if (e.art === 'urlaub') {
                    return (
                      <div key={e.key} className="flex items-start gap-1 text-[10px] leading-tight">
                        <span className="mt-[2px] w-1.5 h-1.5 rounded-full shrink-0 bg-orange-400" />
                        <span className="truncate text-orange-800 min-w-0">
                          <span className="font-semibold">{kurzname(e.name)}:</span> Urlaub
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={e.key} className="flex items-start gap-1 text-[10px] leading-tight">
                      <span className={`mt-[2px] w-1.5 h-1.5 rounded-full shrink-0
                        ${STATUS_DOT_COLORS[e.auftrag.status]}`} />
                      <span className="truncate text-slate-700 min-w-0">
                        <span className="font-semibold text-slate-900">
                          {kurzname(e.auftrag.mitarbeiter)}:
                        </span>{' '}
                        {e.auftrag.titel}
                      </span>
                    </div>
                  );
                })}

                {overflow > 0 && (
                  <div className="text-[10px] text-blue-500 font-medium pl-2.5 mt-0.5">
                    +{overflow} weitere
                  </div>
                )}
              </div>

              {/* Stunden-Info */}
              {gebH > 0 && (
                <div className="text-[9px] text-slate-400 text-right mt-auto pt-0.5">
                  {gebH}h gebucht
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex items-center flex-wrap gap-4 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
          Feiertag (AG)
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
          Urlaub
        </div>
        <div className="ml-auto flex items-center gap-4 text-slate-400">
          <span className="font-medium text-slate-500">Auslastung:</span>
          {[
            { label: '< 40 %', color: 'bg-green-400' },
            { label: '40–75 %', color: 'bg-yellow-400' },
            { label: '> 75 %', color: 'bg-red-400' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`w-3 h-1 rounded-full ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
