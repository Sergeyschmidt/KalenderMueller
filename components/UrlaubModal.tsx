'use client';

import { useState } from 'react';
import {
  Urlaub, AbwesenheitsTyp, ABWESENHEITS_LABELS,
  ABWESENHEITS_TYPEN_SICHTBAR, getUrlaubMitarbeiterListe,
} from '@/lib/types';
import { useKalenderStore } from '@/lib/store';

interface Props {
  onClose: () => void;
  mitarbeiterNamen: string[];
  onAddUrlaub: (urlaub: Omit<Urlaub, 'id'>) => Promise<void>;
  onUpdateUrlaub: (id: string, urlaub: Omit<Urlaub, 'id'>) => Promise<void>;
  onDeleteUrlaub: (id: string) => Promise<void>;
}

function anzeigeDatum(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

function urlaubDauer(u: Urlaub): number {
  const von = new Date(u.datum_von);
  const bis = new Date(u.datum_bis);
  return Math.round((bis.getTime() - von.getTime()) / 86_400_000) + 1;
}

const TYP_BG_BORDER: Record<AbwesenheitsTyp, string> = {
  urlaub:         'bg-orange-50 border-orange-200',
  krankheit:      'bg-red-50 border-red-200',
  militaer:       'bg-slate-50 border-slate-200',
  zivilschutz:    'bg-blue-50 border-blue-200',
  betriebsferien: 'bg-green-50 border-green-200',
  uebrige:        'bg-stone-50 border-stone-200',
};

const TYP_TEXT: Record<AbwesenheitsTyp, string> = {
  urlaub:         'text-orange-700',
  krankheit:      'text-red-700',
  militaer:       'text-slate-600',
  zivilschutz:    'text-blue-700',
  betriebsferien: 'text-green-700',
  uebrige:        'text-stone-600',
};

export default function UrlaubModal({ onClose, mitarbeiterNamen, onAddUrlaub, onUpdateUrlaub, onDeleteUrlaub }: Props) {
  const { urlaube, auftraege } = useKalenderStore();

  const leeresFormular = {
    mitarbeiterListe: mitarbeiterNamen.length > 0 ? [mitarbeiterNamen[0]] : [] as string[],
    datum_von:   '',
    datum_bis:   '',
    typ:         'urlaub' as AbwesenheitsTyp,
    notiz:       '',
    ganztaegig:  true,
    start_zeit:  '',
    end_zeit:    '',
  };

  const [form, setForm]           = useState(leeresFormular);
  const [fehler, setFehler]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleMitarbeiter = (ma: string) => {
    setForm(f => ({
      ...f,
      mitarbeiterListe: f.mitarbeiterListe.includes(ma)
        ? f.mitarbeiterListe.filter(x => x !== ma)
        : [...f.mitarbeiterListe, ma],
    }));
  };

  const startEdit = (u: Urlaub) => {
    setEditingId(u.id);
    setForm({
      mitarbeiterListe: getUrlaubMitarbeiterListe(u),
      datum_von:        u.datum_von,
      datum_bis:        u.datum_bis,
      typ:              u.typ ?? 'urlaub',
      notiz:            u.notiz ?? '',
      ganztaegig:       !u.start_zeit,
      start_zeit:       u.start_zeit ?? '',
      end_zeit:         u.end_zeit ?? '',
    });
    setFehler('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(leeresFormular);
    setFehler('');
  };

  const handleSave = async () => {
    if (form.mitarbeiterListe.length === 0) {
      setFehler('Bitte mindestens einen Mitarbeiter auswählen.');
      return;
    }
    if (!form.datum_von || !form.datum_bis) {
      setFehler('Von- und Bis-Datum sind Pflichtfelder.');
      return;
    }
    if (form.datum_bis < form.datum_von) {
      setFehler('Das Bis-Datum muss nach dem Von-Datum liegen.');
      return;
    }
    if (!form.ganztaegig && (!form.start_zeit || !form.end_zeit)) {
      setFehler('Bitte Start- und Endzeit angeben.');
      return;
    }
    if (!form.ganztaegig && form.start_zeit >= form.end_zeit) {
      setFehler('Die Endzeit muss nach der Startzeit liegen.');
      return;
    }
    setSaving(true);
    const payload: Omit<Urlaub, 'id'> = {
      mitarbeiter:      form.mitarbeiterListe[0],
      mitarbeiter_liste: form.mitarbeiterListe,
      datum_von:        form.datum_von,
      datum_bis:        form.datum_bis,
      typ:              form.typ,
      notiz:            form.notiz.trim() || undefined,
      start_zeit:       form.ganztaegig ? null : form.start_zeit,
      end_zeit:         form.ganztaegig ? null : form.end_zeit,
    };
    if (editingId) {
      await onUpdateUrlaub(editingId, payload);
    } else {
      await onAddUrlaub(payload);
    }
    setForm(leeresFormular);
    setEditingId(null);
    setFehler('');
    setSaving(false);
  };

  // Kollisions-Warnung: Aufträge ausgewählter Mitarbeiter im eingetragenen Zeitraum
  const kollisionen =
    form.datum_von && form.datum_bis && form.mitarbeiterListe.length > 0
      ? auftraege.filter(a =>
          form.mitarbeiterListe.includes(a.mitarbeiter) &&
          a.datum >= form.datum_von &&
          a.datum <= form.datum_bis
        ).length
      : 0;

  const sortedUrlaube = [...urlaube].sort((a, b) => a.datum_von.localeCompare(b.datum_von));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-orange-600 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="font-semibold text-sm">Abwesenheiten verwalten</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-orange-500 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">

          {/* ── Neu eintragen / Bearbeiten ── */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {editingId ? 'Abwesenheit bearbeiten' : 'Neue Abwesenheit eintragen'}
            </h3>
            <div className="space-y-3">

              {/* Mitarbeiter – Mehrfachauswahl */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Mitarbeiter
                  {form.mitarbeiterListe.length > 1 && (
                    <span className="ml-1.5 text-slate-400 font-normal">
                      ({form.mitarbeiterListe.length} ausgewählt)
                    </span>
                  )}
                </label>
                <div className="border border-slate-300 rounded-lg divide-y divide-slate-100 max-h-36 overflow-y-auto">
                  {mitarbeiterNamen.map((ma) => (
                    <label key={ma}
                      className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={form.mitarbeiterListe.includes(ma)}
                        onChange={() => toggleMitarbeiter(ma)}
                        className="w-4 h-4 rounded border-slate-300 accent-orange-600"
                      />
                      <span className="text-slate-700">{ma}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Art der Abwesenheit */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Art der Abwesenheit</label>
                <select
                  value={form.typ}
                  onChange={(e) => setForm((f) => ({ ...f, typ: e.target.value as AbwesenheitsTyp }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {ABWESENHEITS_TYPEN_SICHTBAR.map(key => (
                    <option key={key} value={key}>{ABWESENHEITS_LABELS[key]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Von</label>
                  <input
                    type="date"
                    value={form.datum_von}
                    onChange={(e) => setForm((f) => ({ ...f, datum_von: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bis (inkl.)</label>
                  <input
                    type="date"
                    value={form.datum_bis}
                    min={form.datum_von || undefined}
                    onChange={(e) => setForm((f) => ({ ...f, datum_bis: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Ganztägig-Toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.ganztaegig}
                  onChange={(e) => setForm((f) => ({ ...f, ganztaegig: e.target.checked, start_zeit: '', end_zeit: '' }))}
                  className="w-4 h-4 rounded border-slate-300 accent-orange-600"
                />
                <span className="text-sm font-medium text-slate-700">Ganztägig</span>
              </label>

              {/* Zeitfelder – nur wenn NICHT ganztägig */}
              {!form.ganztaegig && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Von (Uhrzeit)</label>
                    <input
                      type="time"
                      value={form.start_zeit}
                      onChange={(e) => setForm((f) => ({ ...f, start_zeit: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Bis (Uhrzeit)</label>
                    <input
                      type="time"
                      value={form.end_zeit}
                      min={form.start_zeit || undefined}
                      onChange={(e) => setForm((f) => ({ ...f, end_zeit: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notiz (optional)</label>
                <input
                  type="text"
                  value={form.notiz}
                  onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))}
                  placeholder="z. B. Sommerurlaub"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Kollisionswarnung */}
              {kollisionen > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-300
                                rounded-lg text-xs text-amber-800">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>
                    {form.mitarbeiterListe.length === 1
                      ? <><strong>{form.mitarbeiterListe[0]}</strong> hat bereits</>
                      : <>Ausgewählte Mitarbeiter haben insgesamt</>
                    }{' '}
                    <strong>{kollisionen} {kollisionen === 1 ? 'Auftrag' : 'Aufträge'}</strong> in diesem
                    Zeitraum. Diese werden in der Wochenansicht überdeckt.
                  </span>
                </div>
              )}

              {fehler && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {fehler}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || form.mitarbeiterListe.length === 0}
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-60
                             text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {saving ? 'Wird gespeichert…' : editingId ? 'Änderungen speichern' : 'Abwesenheit eintragen'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-60
                               text-slate-600 font-medium rounded-lg text-sm transition-colors"
                  >
                    Abbrechen
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── Übersicht bestehender Einträge ── */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Eingetragene Abwesenheiten
              {sortedUrlaube.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({sortedUrlaube.length})
                </span>
              )}
            </h3>

            {sortedUrlaube.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Noch keine Einträge vorhanden.
              </p>
            ) : (
              <div className="space-y-2">
                {sortedUrlaube.map((u) => {
                  const typ  = u.typ ?? 'urlaub';
                  const malist = getUrlaubMitarbeiterListe(u);
                  return (
                    <div
                      key={u.id}
                      className={`flex items-center justify-between border rounded-xl px-3 py-2.5
                                  ${TYP_BG_BORDER[typ]} ${editingId === u.id ? 'ring-2 ring-orange-400' : ''}`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {malist.length === 1
                            ? malist[0]
                            : `${malist[0]} +${malist.length - 1}`}
                        </div>
                        <div className={`text-xs ${TYP_TEXT[typ]}`}>
                          <span className="font-medium">{ABWESENHEITS_LABELS[typ]}</span>
                          {u.start_zeit && u.end_zeit && (
                            <span className="ml-1 font-semibold">
                              {u.start_zeit.slice(0, 5)}–{u.end_zeit.slice(0, 5)}
                            </span>
                          )}
                          {' · '}
                          {anzeigeDatum(u.datum_von)} – {anzeigeDatum(u.datum_bis)}
                          <span className="ml-1.5 text-slate-400">
                            ({urlaubDauer(u)} {urlaubDauer(u) === 1 ? 'Tag' : 'Tage'})
                          </span>
                          {u.notiz && (
                            <span className="ml-2 italic text-slate-500">{u.notiz}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50
                                     rounded-lg transition-colors"
                          title="Eintrag bearbeiten"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteUrlaub(u.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50
                                     rounded-lg transition-colors"
                          title="Eintrag löschen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
