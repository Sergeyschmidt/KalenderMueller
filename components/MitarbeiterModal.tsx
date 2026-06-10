'use client';

import { useState, useEffect } from 'react';
import { Mitarbeiter, STUNDEN, FALLBACK_MITARBEITER_LISTE } from '@/lib/types';
import { useKalenderStore } from '@/lib/store';
import {
  dbCreateMitarbeiter,
  dbUpdateMitarbeiter,
  isSupabaseConfigured,
} from '@/lib/supabase';
import { formatStunde } from '@/lib/dateUtils';

export default function MitarbeiterModal({ onClose }: { onClose: () => void }) {
  const {
    mitarbeiter,
    setMitarbeiter,
    addMitarbeiterItem,
    updateMitarbeiterItem,
    deleteMitarbeiterItem,
  } = useKalenderStore();

  // Wenn der Store leer ist (kein DB-Zugriff), Fallback-Liste als Ausgangspunkt laden.
  // Danach sind Änderungen im Modal möglich und werden in localStorage gespeichert.
  useEffect(() => {
    if (mitarbeiter.length === 0) {
      setMitarbeiter(FALLBACK_MITARBEITER_LISTE.map(m => ({ ...m })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [neuerName,  setNeuerName]  = useState('');
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');
  const [saving,     setSaving]     = useState(false);

  const sorted   = [...mitarbeiter].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const aktive   = sorted.filter(m =>  m.is_active);
  const inaktive = sorted.filter(m => !m.is_active);

  // ── Name inline bearbeiten ────────────────────────────────────────────────
  const startEdit = (m: Mitarbeiter) => {
    setEditingId(m.id);
    setEditName(m.name);
  };

  const saveEdit = async (m: Mitarbeiter) => {
    const name = editName.trim();
    if (!name || name === m.name) { setEditingId(null); return; }
    updateMitarbeiterItem(m.id, { name });
    if (isSupabaseConfigured()) await dbUpdateMitarbeiter(m.id, { name });
    setEditingId(null);
  };

  // ── Auto-Bürozeit ─────────────────────────────────────────────────────────
  const toggleAutoBuerozeit = async (m: Mitarbeiter) => {
    const updates: Partial<Mitarbeiter> =
      m.auto_buerozeit_start != null
        ? { auto_buerozeit_start: null, auto_buerozeit_end: null }
        : { auto_buerozeit_start: 8,    auto_buerozeit_end: 9 };
    updateMitarbeiterItem(m.id, updates);
    if (isSupabaseConfigured()) await dbUpdateMitarbeiter(m.id, updates);
  };

  const updateAutoZeit = async (
    m: Mitarbeiter,
    field: 'auto_buerozeit_start' | 'auto_buerozeit_end',
    val: number
  ) => {
    updateMitarbeiterItem(m.id, { [field]: val });
    if (isSupabaseConfigured()) await dbUpdateMitarbeiter(m.id, { [field]: val });
  };

  // ── Sichtbarkeit ──────────────────────────────────────────────────────────
  const toggleAktiv = async (m: Mitarbeiter) => {
    const updates = { is_active: !m.is_active };
    updateMitarbeiterItem(m.id, updates);
    if (isSupabaseConfigured()) await dbUpdateMitarbeiter(m.id, updates);
  };

  // ── Reihenfolge ───────────────────────────────────────────────────────────
  const move = async (m: Mitarbeiter, dir: -1 | 1) => {
    const idx      = sorted.indexOf(m);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    const r1 = m.reihenfolge;
    const r2 = swapWith.reihenfolge;
    updateMitarbeiterItem(m.id,       { reihenfolge: r2 });
    updateMitarbeiterItem(swapWith.id, { reihenfolge: r1 });
    if (isSupabaseConfigured()) {
      await Promise.all([
        dbUpdateMitarbeiter(m.id,        { reihenfolge: r2 }),
        dbUpdateMitarbeiter(swapWith.id, { reihenfolge: r1 }),
      ]);
    }
  };

  // ── Neu hinzufügen ────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const name = neuerName.trim();
    if (!name || saving) return;
    const maxR  = Math.max(0, ...mitarbeiter.map(m => m.reihenfolge));
    setSaving(true);
    const tempId  = crypto.randomUUID();
    const tempMa: Mitarbeiter = { id: tempId, name, reihenfolge: maxR + 1, is_active: true };
    addMitarbeiterItem(tempMa);
    if (isSupabaseConfigured()) {
      const result = await dbCreateMitarbeiter(name, maxR + 1);
      if (result) { deleteMitarbeiterItem(tempId); addMitarbeiterItem(result); }
    }
    setNeuerName('');
    setSaving(false);
  };

  // ── Zeile rendern ─────────────────────────────────────────────────────────
  const renderRow = (m: Mitarbeiter, idx: number, list: Mitarbeiter[]) => (
    <div
      key={m.id}
      className={`rounded-xl border p-3 space-y-2 transition-opacity
        ${m.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
    >
      {/* Zeile 1: Name + Reihenfolge + Aktiv-Toggle */}
      <div className="flex items-center gap-2">
        {editingId === m.id ? (
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={() => saveEdit(m)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveEdit(m);
              if (e.key === 'Escape') setEditingId(null);
            }}
            className="flex-1 px-2 py-1 border border-blue-400 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => startEdit(m)}
            title="Klicken zum Umbenennen"
            className="flex-1 text-left px-2 py-1 rounded-lg text-sm font-semibold
                       text-slate-800 hover:bg-slate-100 transition-colors"
          >
            {m.name}
            <span className="ml-1 text-[10px] text-slate-400 font-normal">(klicken zum Umbenennen)</span>
          </button>
        )}

        {/* Reihenfolge-Buttons */}
        <button
          type="button"
          onClick={() => move(m, -1)}
          disabled={idx === 0}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100
                     disabled:opacity-20 transition-colors text-xs"
          title="Nach oben"
        >▲</button>
        <button
          type="button"
          onClick={() => move(m, 1)}
          disabled={idx === list.length - 1}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100
                     disabled:opacity-20 transition-colors text-xs"
          title="Nach unten"
        >▼</button>

        {/* Aktiv-Toggle */}
        <button
          type="button"
          onClick={() => toggleAktiv(m)}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors
            ${m.is_active
              ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
              : 'bg-slate-200 text-slate-500 hover:bg-green-100 hover:text-green-700'
            }`}
        >
          {m.is_active ? 'Aktiv' : 'Einblenden'}
        </button>
      </div>

      {/* Zeile 2: Datumsfelder */}
      <div className="flex items-center gap-4 pl-1 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          🎁
          <span className="text-slate-500">Geburtstag</span>
          <input
            type="date"
            value={m.geburtsdatum ?? ''}
            onChange={async (e) => {
              const val = e.target.value || null;
              updateMitarbeiterItem(m.id, { geburtsdatum: val });
              if (isSupabaseConfigured()) await dbUpdateMitarbeiter(m.id, { geburtsdatum: val });
            }}
            className="px-1.5 py-0.5 border border-slate-300 rounded-md text-xs
                       focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          🎉
          <span className="text-slate-500">Eintritt</span>
          <input
            type="date"
            value={m.eintrittsdatum ?? ''}
            onChange={async (e) => {
              const val = e.target.value || null;
              updateMitarbeiterItem(m.id, { eintrittsdatum: val });
              if (isSupabaseConfigured()) await dbUpdateMitarbeiter(m.id, { eintrittsdatum: val });
            }}
            className="px-1.5 py-0.5 border border-slate-300 rounded-md text-xs
                       focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
          />
        </label>
      </div>

      {/* Zeile 3: Auto-Bürozeit */}
      <div className="flex items-center gap-2 pl-1 flex-wrap">
        {/* Toggle-Schalter */}
        <button
          type="button"
          onClick={() => toggleAutoBuerozeit(m)}
          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors shrink-0
            ${m.auto_buerozeit_start != null ? 'bg-orange-500' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform
            ${m.auto_buerozeit_start != null ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-xs text-slate-600 font-medium">Auto-Bürozeit</span>

        {m.auto_buerozeit_start != null && (
          <>
            <select
              value={m.auto_buerozeit_start}
              onChange={e => updateAutoZeit(m, 'auto_buerozeit_start', Number(e.target.value))}
              className="text-xs px-1.5 py-0.5 border border-slate-300 rounded-md
                         focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {STUNDEN.map(s => <option key={s} value={s}>{formatStunde(s)}</option>)}
            </select>
            <span className="text-xs text-slate-400">–</span>
            <select
              value={m.auto_buerozeit_end ?? 9}
              onChange={e => updateAutoZeit(m, 'auto_buerozeit_end', Number(e.target.value))}
              className="text-xs px-1.5 py-0.5 border border-slate-300 rounded-md
                         focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {[...STUNDEN.filter(s => s > (m.auto_buerozeit_start ?? 7)), 17].map(s => (
                <option key={s} value={s}>{formatStunde(s)}</option>
              ))}
            </select>
            <span className="text-[10px] text-orange-600 font-medium">tägl. Mo–Fr</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg
                      overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-blue-900 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-sm">Mitarbeiter verwalten</h2>
            <p className="text-blue-300 text-[11px] mt-0.5">
              Namen klicken zum Umbenennen · Auto-Bürozeit erscheint tägl. Mo–Fr automatisch
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="p-1 hover:bg-blue-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Aktive Mitarbeiter */}
          {aktive.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Aktive Mitarbeiter ({aktive.length})
              </h3>
              <div className="space-y-2">
                {aktive.map((m, i) => renderRow(m, i, aktive))}
              </div>
            </section>
          )}

          {/* Neuen hinzufügen */}
          <section className="border-t pt-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Neuen Mitarbeiter hinzufügen
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={neuerName}
                onChange={e => setNeuerName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="z. B. Müller Thomas"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!neuerName.trim() || saving}
                className="px-4 py-2 bg-blue-900 text-white text-sm font-medium rounded-lg
                           hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {saving ? '…' : 'Hinzufügen'}
              </button>
            </div>
          </section>

          {/* Ausgeblendete Mitarbeiter */}
          {inaktive.length > 0 && (
            <section className="border-t pt-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Ausgeblendet ({inaktive.length})
              </h3>
              <div className="space-y-2">
                {inaktive.map((m, i) => renderRow(m, i, inaktive))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
