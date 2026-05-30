'use client';

import { useState } from 'react';
import { MITARBEITER, Urlaub } from '@/lib/types';
import { useKalenderStore } from '@/lib/store';

interface Props {
  onClose: () => void;
  onAddUrlaub: (urlaub: Omit<Urlaub, 'id'>) => Promise<void>;
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

export default function UrlaubModal({ onClose, onAddUrlaub, onDeleteUrlaub }: Props) {
  const { urlaube, auftraege } = useKalenderStore();

  const [form, setForm] = useState({
    mitarbeiter: MITARBEITER[0] as string,
    datum_von: '',
    datum_bis: '',
    notiz: '',
  });
  const [fehler, setFehler] = useState('');

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.datum_von || !form.datum_bis) {
      setFehler('Von- und Bis-Datum sind Pflichtfelder.');
      return;
    }
    if (form.datum_bis < form.datum_von) {
      setFehler('Das Bis-Datum muss nach dem Von-Datum liegen.');
      return;
    }
    setSaving(true);
    await onAddUrlaub({
      mitarbeiter: form.mitarbeiter,
      datum_von: form.datum_von,
      datum_bis: form.datum_bis,
      notiz: form.notiz.trim() || undefined,
    });
    setForm({ mitarbeiter: MITARBEITER[0], datum_von: '', datum_bis: '', notiz: '' });
    setFehler('');
    setSaving(false);
  };

  // Kollisions-Warnung: Aufträge im eingetragenen Urlaub-Zeitraum
  const kollisionen =
    form.datum_von && form.datum_bis
      ? auftraege.filter(
          (a) =>
            a.mitarbeiter === form.mitarbeiter &&
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
            <h2 className="font-semibold text-sm">Urlaub verwalten</h2>
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

          {/* ── Neu eintragen ── */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Neuen Urlaub eintragen</h3>
            <div className="space-y-3">

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mitarbeiter</label>
                <select
                  value={form.mitarbeiter}
                  onChange={(e) => setForm((f) => ({ ...f, mitarbeiter: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {MITARBEITER.map((ma) => <option key={ma} value={ma}>{ma}</option>)}
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
                    <strong>{form.mitarbeiter}</strong> hat bereits{' '}
                    <strong>{kollisionen} {kollisionen === 1 ? 'Auftrag' : 'Aufträge'}</strong> in diesem
                    Zeitraum. Diese werden in der Wochenansicht vom Urlaub überdeckt.
                  </span>
                </div>
              )}

              {fehler && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {fehler}
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-60
                           text-white font-medium rounded-lg text-sm transition-colors"
              >
                {saving ? 'Wird gespeichert…' : 'Urlaub eintragen'}
              </button>
            </div>
          </section>

          {/* ── Übersicht bestehender Einträge ── */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Eingetragene Urlaubszeiten
              {sortedUrlaube.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({sortedUrlaube.length})
                </span>
              )}
            </h3>

            {sortedUrlaube.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Noch keine Urlaubseinträge vorhanden.
              </p>
            ) : (
              <div className="space-y-2">
                {sortedUrlaube.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between bg-orange-50 border border-orange-200
                               rounded-xl px-3 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{u.mitarbeiter}</div>
                      <div className="text-xs text-orange-700">
                        {anzeigeDatum(u.datum_von)} – {anzeigeDatum(u.datum_bis)}
                        <span className="ml-1.5 text-slate-400">
                          ({urlaubDauer(u)} {urlaubDauer(u) === 1 ? 'Tag' : 'Tage'})
                        </span>
                        {u.notiz && (
                          <span className="ml-2 italic text-slate-500">{u.notiz}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteUrlaub(u.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50
                                 rounded-lg transition-colors"
                      title="Urlaub löschen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
