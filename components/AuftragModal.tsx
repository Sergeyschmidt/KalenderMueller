'use client';

import { useState } from 'react';
import { Auftrag, STUNDEN, Status, STATUS_LABELS, AuftragFormData, AuftragTyp, AUFTRAG_TYP_LABELS, getAuftragMitarbeiterListe } from '@/lib/types';
import { formatStunde } from '@/lib/dateUtils';

interface Props {
  auftrag?: Auftrag;
  prefill?: Partial<Auftrag>;
  mitarbeiterNamen: string[];
  onSave: (data: Omit<Auftrag, 'id'>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  isStandard?: boolean;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUSES: Status[] = ['erfasst', 'in_bearbeitung', 'fertig'];

const STATUS_BTN: Record<Status, string> = {
  erfasst:        'bg-red-500 text-white border-red-500',
  in_bearbeitung: 'bg-yellow-500 text-white border-yellow-500',
  fertig:         'bg-green-500 text-white border-green-500',
};

export default function AuftragModal({ auftrag, prefill, mitarbeiterNamen, onSave, onDelete, onClose, isStandard }: Props) {
  const startDatum = auftrag?.datum ?? prefill?.datum ?? todayStr();

  const [form, setForm] = useState<AuftragFormData>(() => ({
    titel:        auftrag?.titel         ?? '',
    beschreibung: auftrag?.beschreibung  ?? '',
    kunde:        auftrag?.kunde         ?? '',
    mitarbeiterListe: auftrag
      ? getAuftragMitarbeiterListe(auftrag)
      : prefill?.mitarbeiter
        ? [prefill.mitarbeiter]
        : mitarbeiterNamen[0] ? [mitarbeiterNamen[0]] : [],
    datum:        startDatum,
    datum_bis:    auftrag?.datum_bis     ?? startDatum,
    start_stunde: auftrag?.start_stunde  ?? prefill?.start_stunde ?? 8,
    end_stunde:   auftrag?.end_stunde    ?? prefill?.end_stunde   ?? 9,
    status:       auftrag?.status        ?? 'erfasst',
    typ:          auftrag?.typ           ?? 'auftrag',
  }));

  const [mehrtaegig, setMehrtaegig] = useState(
    !!(auftrag?.datum_bis && auftrag.datum_bis !== auftrag.datum)
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleMitarbeiter = (ma: string) => {
    setForm(f => ({
      ...f,
      mitarbeiterListe: f.mitarbeiterListe.includes(ma)
        ? f.mitarbeiterListe.filter(x => x !== ma)
        : [...f.mitarbeiterListe, ma],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titel.trim()) return;
    if (form.mitarbeiterListe.length === 0) return;
    if (!mehrtaegig && form.end_stunde <= form.start_stunde) return;

    onSave({
      titel:             form.titel.trim(),
      beschreibung:      form.beschreibung.trim() || undefined,
      kunde:             form.kunde.trim()        || undefined,
      mitarbeiter:       form.mitarbeiterListe[0],
      mitarbeiter_liste: form.mitarbeiterListe,
      datum:             form.datum,
      datum_bis:         mehrtaegig && form.datum_bis > form.datum ? form.datum_bis : undefined,
      start_stunde:      form.start_stunde,
      end_stunde:        form.end_stunde,
      status:            form.status,
      typ:               form.typ,
    });
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">
              {auftrag ? 'Eintrag bearbeiten' : 'Neuer Auftrag'}
            </h2>
            {isStandard && (
              <span className="text-[10px] bg-orange-500/80 border border-orange-400/50
                               text-white px-2 py-0.5 rounded-full font-medium">
                Standard
              </span>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="p-1 hover:bg-blue-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[82vh]">

          {/* ── Typ-Auswahl ── */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(['auftrag', 'buerozeit'] as AuftragTyp[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(f => ({ ...f, typ: t }))}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors
                  ${form.typ === t
                    ? t === 'buerozeit'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-blue-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200'
                  }`}
              >
                {AUFTRAG_TYP_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Titel */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Auftragsbezeichnung *</label>
            <input type="text" value={form.titel} required autoFocus
              onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
              placeholder="z. B. Biegeprogramm erstellen"
              className={inputCls} />
          </div>

          {/* Kunde */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kunde</label>
            <input type="text" value={form.kunde}
              onChange={e => setForm(f => ({ ...f, kunde: e.target.value }))}
              placeholder="Kundenname" className={inputCls} />
          </div>

          {/* Mitarbeiter (Mehrfachauswahl) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Mitarbeiter {form.mitarbeiterListe.length > 1 && (
                <span className="text-slate-400 font-normal">({form.mitarbeiterListe.length} ausgewählt)</span>
              )}
            </label>
            <div className="border border-slate-300 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {mitarbeiterNamen.map(ma => (
                <label key={ma}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.mitarbeiterListe.includes(ma)}
                    onChange={() => toggleMitarbeiter(ma)}
                    className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                  />
                  <span className="text-slate-700">{ma}</span>
                </label>
              ))}
            </div>
            {form.mitarbeiterListe.length === 0 && (
              <p className="text-xs text-red-600 mt-1">Bitte mindestens einen Mitarbeiter auswählen.</p>
            )}
          </div>

          {/* Mehrtägig-Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMehrtaegig(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                ${mehrtaegig ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                ${mehrtaegig ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm font-medium text-slate-700">Mehrtägiger Auftrag</span>
          </div>

          {/* Datum + Zeit */}
          {!mehrtaegig ? (
            /* Eintägig */
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Datum</label>
                <input type="date" value={form.datum}
                  onChange={e => setForm(f => ({ ...f, datum: e.target.value, datum_bis: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Von</label>
                <select value={form.start_stunde}
                  onChange={e => setForm(f => ({
                    ...f,
                    start_stunde: Number(e.target.value),
                    end_stunde: Math.max(f.end_stunde, Number(e.target.value) + 1),
                  }))}
                  className={inputCls}>
                  {STUNDEN.map(s => <option key={s} value={s}>{formatStunde(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bis</label>
                <select value={form.end_stunde}
                  onChange={e => setForm(f => ({ ...f, end_stunde: Number(e.target.value) }))}
                  className={inputCls}>
                  {[...STUNDEN.filter(s => s > form.start_stunde), 17].map(s => (
                    <option key={s} value={s}>{formatStunde(s)}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            /* Mehrtägig */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Startdatum</label>
                  <input type="date" value={form.datum}
                    onChange={e => setForm(f => ({
                      ...f, datum: e.target.value,
                      datum_bis: f.datum_bis < e.target.value ? e.target.value : f.datum_bis,
                    }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Enddatum (inkl.)</label>
                  <input type="date" value={form.datum_bis} min={form.datum}
                    onChange={e => setForm(f => ({ ...f, datum_bis: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Startzeit</label>
                  <select value={form.start_stunde}
                    onChange={e => setForm(f => ({ ...f, start_stunde: Number(e.target.value) }))}
                    className={inputCls}>
                    {STUNDEN.map(s => <option key={s} value={s}>{formatStunde(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Endzeit (am Enddatum)</label>
                  <select value={form.end_stunde}
                    onChange={e => setForm(f => ({ ...f, end_stunde: Number(e.target.value) }))}
                    className={inputCls}>
                    {[...STUNDEN, 17].map(s => <option key={s} value={s}>{formatStunde(s)}</option>)}
                  </select>
                </div>
              </div>
              {form.datum_bis > form.datum && (
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Auftrag läuft von <strong>{form.datum}</strong> {formatStunde(form.start_stunde)} bis{' '}
                  <strong>{form.datum_bis}</strong> {formatStunde(form.end_stunde)}
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <div className="flex gap-2">
              {STATUSES.map(s => (
                <button key={s} type="button"
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`flex-1 py-2 px-1.5 rounded-lg text-xs font-medium border transition-colors
                    ${form.status === s
                      ? STATUS_BTN[s]
                      : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Beschreibung (optional)</label>
            <textarea value={form.beschreibung} rows={2} placeholder="Weitere Details…"
              onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
              className={`${inputCls} resize-none`} />
          </div>

          {/* Aktionen */}
          <div className="flex gap-2 pt-1">
            {auftrag && (
              <button type="button"
                onClick={() => confirmDelete ? onDelete(auftrag.id) : setConfirmDelete(true)}
                onBlur={() => setTimeout(() => setConfirmDelete(false), 200)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${confirmDelete
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'}`}>
                {confirmDelete ? 'Sicher?' : isStandard ? 'Heute entfernen' : 'Löschen'}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 py-2 px-4 bg-slate-100 text-slate-600 rounded-lg text-sm
                         font-medium hover:bg-slate-200 transition-colors">
              Abbrechen
            </button>
            <button type="submit"
              disabled={form.mitarbeiterListe.length === 0}
              className="flex-1 py-2 px-4 bg-blue-900 text-white rounded-lg text-sm
                         font-medium hover:bg-blue-800 disabled:opacity-50 disabled:hover:bg-blue-900
                         transition-colors">
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
