import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Auftrag, Urlaub, BueroAusnahme, Mitarbeiter } from './types';

interface KalenderStore {
  auftraege:      Auftrag[];
  urlaube:        Urlaub[];
  bueroAusnahmen: BueroAusnahme[];
  mitarbeiter:    Mitarbeiter[];
  isAuthenticated: boolean;
  ansicht:        'woche' | 'monat' | 'tag';
  aktuellesDatum: string;
  selectedTag:    string;

  setAuftraege:      (auftraege: Auftrag[]) => void;
  addAuftrag:        (auftrag: Auftrag) => void;
  updateAuftrag:     (id: string, updates: Partial<Auftrag>) => void;
  deleteAuftrag:     (id: string) => void;

  setUrlaube:        (urlaube: Urlaub[]) => void;
  addUrlaub:         (urlaub: Urlaub) => void;
  updateUrlaub:      (id: string, updates: Partial<Urlaub>) => void;
  deleteUrlaub:      (id: string) => void;

  setBueroAusnahmen: (ausnahmen: BueroAusnahme[]) => void;
  addBueroAusnahme:  (ausnahme: BueroAusnahme) => void;

  setMitarbeiter:          (liste: Mitarbeiter[]) => void;
  addMitarbeiterItem:      (m: Mitarbeiter) => void;
  updateMitarbeiterItem:   (id: string, updates: Partial<Mitarbeiter>) => void;
  deleteMitarbeiterItem:   (id: string) => void;

  setAuthenticated:  (value: boolean) => void;
  setAnsicht:        (ansicht: 'woche' | 'monat' | 'tag') => void;
  setAktuellesDatum: (datum: string) => void;
  setSelectedTag:    (datum: string) => void;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useKalenderStore = create<KalenderStore>()(
  persist(
    (set) => ({
      auftraege:      [],
      urlaube:        [],
      bueroAusnahmen: [],
      mitarbeiter:    [],
      isAuthenticated: false,
      ansicht:        'woche',
      aktuellesDatum: todayStr(),
      selectedTag:    todayStr(),

      setAuftraege: (auftraege) => set({ auftraege }),
      addAuftrag: (auftrag) =>
        set((s) => {
          if (s.auftraege.some(a => a.id === auftrag.id)) return s;
          return { auftraege: [...s.auftraege, auftrag] };
        }),
      updateAuftrag: (id, updates) =>
        set((s) => ({ auftraege: s.auftraege.map(a => a.id === id ? { ...a, ...updates } : a) })),
      deleteAuftrag: (id) =>
        set((s) => ({ auftraege: s.auftraege.filter(a => a.id !== id) })),

      setUrlaube: (urlaube) => set({ urlaube }),
      addUrlaub: (urlaub) =>
        set((s) => {
          if (s.urlaube.some(u => u.id === urlaub.id)) return s;
          return { urlaube: [...s.urlaube, urlaub] };
        }),
      updateUrlaub: (id, updates) =>
        set((s) => ({ urlaube: s.urlaube.map(u => u.id === id ? { ...u, ...updates } : u) })),
      deleteUrlaub: (id) =>
        set((s) => ({ urlaube: s.urlaube.filter(u => u.id !== id) })),

      setBueroAusnahmen: (ausnahmen) => set({ bueroAusnahmen: ausnahmen }),
      addBueroAusnahme: (ausnahme) =>
        set((s) => {
          const key = `${ausnahme.mitarbeiter}|${ausnahme.datum}`;
          if (s.bueroAusnahmen.some(a => `${a.mitarbeiter}|${a.datum}` === key)) return s;
          return { bueroAusnahmen: [...s.bueroAusnahmen, ausnahme] };
        }),

      setMitarbeiter: (liste) => set({ mitarbeiter: liste }),
      addMitarbeiterItem: (m) =>
        set((s) => {
          if (s.mitarbeiter.some(x => x.id === m.id)) return s;
          return { mitarbeiter: [...s.mitarbeiter, m] };
        }),
      updateMitarbeiterItem: (id, updates) =>
        set((s) => ({ mitarbeiter: s.mitarbeiter.map(m => m.id === id ? { ...m, ...updates } : m) })),
      deleteMitarbeiterItem: (id) =>
        set((s) => ({ mitarbeiter: s.mitarbeiter.filter(m => m.id !== id) })),

      setAuthenticated:  (value)   => set({ isAuthenticated: value }),
      setAnsicht:        (ansicht) => set({ ansicht }),
      setAktuellesDatum: (datum)   => set({ aktuellesDatum: datum }),
      setSelectedTag:    (datum)   => set({ selectedTag: datum }),
    }),
    {
      name: 'mueller-kalender-v2',
      version: 1,
      // Migration v0→v1: Urlaube und Aufträge von Einzel-String auf mitarbeiter_liste-Array.
      // Läuft einmalig beim ersten Start nach dem Update; danach speichert Zustand v1.
      migrate: (persistedState: unknown, version: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>;
        if (version < 1) {
          if (Array.isArray(s.urlaube)) {
            s.urlaube = (s.urlaube as Record<string, unknown>[]).map(u => ({
              ...u,
              mitarbeiter_liste: u.mitarbeiter_liste ?? [u.mitarbeiter],
            }));
          }
          if (Array.isArray(s.auftraege)) {
            s.auftraege = (s.auftraege as Record<string, unknown>[]).map(a => ({
              ...a,
              mitarbeiter_liste: a.mitarbeiter_liste ?? [a.mitarbeiter],
            }));
          }
        }
        return s;
      },
      partialize: (s) => ({
        isAuthenticated: s.isAuthenticated,
        auftraege:       s.auftraege,
        urlaube:         s.urlaube,
        bueroAusnahmen:  s.bueroAusnahmen,
        mitarbeiter:     s.mitarbeiter,
      }),
    }
  )
);
