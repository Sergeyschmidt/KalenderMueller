'use client';

import React from 'react';
import {
  Auftrag, Urlaub, STATUS_DOT_COLORS,
  AbwesenheitsTyp, ABWESENHEITS_LABELS, ABWESENHEITS_DOT, ABWESENHEITS_TEXT, ABWESENHEITS_BOLD,
  JahresEreignis,
} from '@/lib/types';
import { getMonatsKalender, formatDatum, isToday, isSameMonth, getISOWeek } from '@/lib/dateUtils';
import { isFeiertag } from '@/lib/feiertage';

interface Props {
  datum: Date;
  auftraege: Auftrag[];
  urlaube: Urlaub[];
  jahresEreignisse?: JahresEreignis[];
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

const MAX_KAPAZITAET = 10 * 5;

export default function MonatsAnsicht({ datum, auftraege, urlaube, jahresEreignisse = [], onTagClick }: Props) {
  const wochen = getMonatsKalender(datum);

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4">
      {/* Spaltenköpfe: KW-Spalte + 7 Wochentage */}
      <div className="shrink-0 grid grid-cols-[1.75rem_repeat(7,1fr)] mb-1">
        <div className="text-center text-[10px] font-semibold py-2 text-slate-400 select-none">KW</div>
        {WOCHENTAGE.map((t, i) => (
          <div key={t} className={`text-center text-xs font-semibold py-2
            ${i >= 5 ? 'text-slate-400' : 'text-slate-500'}`}>
            {t}
          </div>
        ))}
      </div>

      {/* Kalender-Grid – flex-1 füllt verfügbaren Raum, 1fr verteilt Höhe gleichmäßig auf Zeilen */}
      <div className="flex-1 min-h-0 grid grid-cols-[1.75rem_repeat(7,1fr)] gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200"
           style={{ gridAutoRows: '1fr' }}>
        {wochen.map((woche, wi) => {
          const ersterTag = woche.find(t => t !== null) ?? null;
          const kw = ersterTag ? getISOWeek(ersterTag) : null;

          return (
            <React.Fragment key={wi}>
              {/* KW-Zelle */}
              <div className="bg-slate-100 flex items-center justify-center select-none min-h-[90px]">
                <span className="text-[11px] font-bold text-slate-400 [writing-mode:vertical-rl] rotate-180 leading-none">
                  {kw ?? ''}
                </span>
              </div>

              {/* 7 Tages-Zellen */}
              {woche.map((tag, di) => {
                if (!tag) {
                  return <div key={`leer-${wi}-${di}`} className="bg-slate-50 min-h-[90px]" />;
                }

                const tagStr       = formatDatum(tag);
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

                type Eintrag =
                  | { art: 'ereignis'; key: string; ereignis: JahresEreignis }
                  | { art: 'urlaub';   key: string; name: string; typ: AbwesenheitsTyp }
                  | { art: 'auftrag';  key: string; auftrag: Auftrag };

                const tagEreignisse = jahresEreignisse.filter(e => e.datum === tagStr);

                const eintraege: Eintrag[] = [
                  ...tagEreignisse.map((e) => ({
                    art:     'ereignis' as const,
                    key:     e.id,
                    ereignis: e,
                  })),
                  ...tagUrlaube.map((u) => ({
                    art:  'urlaub' as const,
                    key:  u.id,
                    name: u.mitarbeiter,
                    typ:  (u.typ ?? 'urlaub') as AbwesenheitsTyp,
                  })),
                  ...tagAuftraege.map((a) => ({
                    art:     'auftrag' as const,
                    key:     a.id,
                    auftrag: a,
                  })),
                ];
                const MAX_ANZEIGE = 6;
                const overflow    = Math.max(0, eintraege.length - MAX_ANZEIGE);

                let tagBg = istWE ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white hover:bg-blue-50';
                if (feiertagName) tagBg = 'bg-amber-50 hover:bg-amber-100';

                return (
                  <div
                    key={tagStr}
                    onClick={() => onTagClick(tag)}
                    className={`min-h-[90px] p-1.5 cursor-pointer transition-colors flex flex-col gap-0.5
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
                        if (e.art === 'ereignis') {
                          const isGeb = e.ereignis.typ === 'geburtstag';
                          return (
                            <div key={e.key} className="flex items-start gap-1 text-[10px] leading-tight">
                              <span className={`mt-[2px] w-1.5 h-1.5 rounded-full shrink-0
                                ${isGeb ? 'bg-purple-400' : 'bg-emerald-400'}`} />
                              <span className={`truncate min-w-0 font-semibold
                                ${isGeb ? 'text-purple-700' : 'text-emerald-700'}`}>
                                {e.ereignis.label}
                              </span>
                            </div>
                          );
                        }
                        if (e.art === 'urlaub') {
                          return (
                            <div key={e.key} className="flex items-start gap-1 text-[10px] leading-tight">
                              <span className={`mt-[2px] w-1.5 h-1.5 rounded-full shrink-0 ${ABWESENHEITS_DOT[e.typ]}`} />
                              <span className={`truncate min-w-0 ${ABWESENHEITS_TEXT[e.typ]}`}>
                                <span className={`font-semibold ${ABWESENHEITS_BOLD[e.typ]}`}>{kurzname(e.name)}:</span>
                                {' '}{ABWESENHEITS_LABELS[e.typ]}
                              </span>
                            </div>
                          );
                        }
                        const isBuero = e.auftrag.typ === 'buerozeit';
                        return (
                          <div key={e.key} className="flex items-start gap-1 text-[10px] leading-tight">
                            <span className={`mt-[2px] w-1.5 h-1.5 rounded-full shrink-0
                              ${isBuero ? 'bg-orange-400' : STATUS_DOT_COLORS[e.auftrag.status]}`} />
                            <span className={`truncate min-w-0 ${isBuero ? 'text-orange-800' : 'text-slate-700'}`}>
                              <span className={`font-semibold ${isBuero ? 'text-orange-900' : 'text-slate-900'}`}>
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
            </React.Fragment>
          );
        })}
      </div>

      {/* Legende */}
      <div className="shrink-0 flex items-center flex-wrap gap-4 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
          Feiertag (AG)
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          Geburtstag
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          Firmenjubiläum
        </div>
        {(Object.entries(ABWESENHEITS_LABELS) as [AbwesenheitsTyp, string][]).map(([typ, label]) => (
          <div key={typ} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${ABWESENHEITS_DOT[typ]}`} />
            {label}
          </div>
        ))}
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
