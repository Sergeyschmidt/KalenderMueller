import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Auftrag, Urlaub } from './types';

interface KalenderStore {
  auftraege: Auftrag[];
  urlaube: Urlaub[];
  isAuthenticated: boolean;
  ansicht: 'woche' | 'monat';
  aktuellesDatum: string;
  selectedTag: string;

  setAuftraege: (auftraege: Auftrag[]) => void;
  addAuftrag: (auftrag: Auftrag) => void;
  updateAuftrag: (id: string, updates: Partial<Auftrag>) => void;
  deleteAuftrag: (id: string) => void;

  setUrlaube: (urlaube: Urlaub[]) => void;
  addUrlaub: (urlaub: Urlaub) => void;
  deleteUrlaub: (id: string) => void;

  setAuthenticated: (value: boolean) => void;
  setAnsicht: (ansicht: 'woche' | 'monat') => void;
  setAktuellesDatum: (datum: string) => void;
  setSelectedTag: (datum: string) => void;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useKalenderStore = create<KalenderStore>()(
  persist(
    (set) => ({
      auftraege: [],
      urlaube: [],
      isAuthenticated: false,
      ansicht: 'woche',
      aktuellesDatum: todayStr(),
      selectedTag: todayStr(),

      setAuftraege: (auftraege) => set({ auftraege }),
      // Deduplizierung: verhindert Duplikate durch optimistische + Echtzeit-Updates
      addAuftrag: (auftrag) =>
        set((s) => {
          if (s.auftraege.some(a => a.id === auftrag.id)) return s;
          return { auftraege: [...s.auftraege, auftrag] };
        }),
      updateAuftrag: (id, updates) =>
        set((s) => ({
          auftraege: s.auftraege.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      deleteAuftrag: (id) =>
        set((s) => ({ auftraege: s.auftraege.filter((a) => a.id !== id) })),

      setUrlaube: (urlaube) => set({ urlaube }),
      addUrlaub: (urlaub) =>
        set((s) => {
          if (s.urlaube.some(u => u.id === urlaub.id)) return s;
          return { urlaube: [...s.urlaube, urlaub] };
        }),
      deleteUrlaub: (id) =>
        set((s) => ({ urlaube: s.urlaube.filter((u) => u.id !== id) })),

      setAuthenticated: (value) => set({ isAuthenticated: value }),
      setAnsicht: (ansicht) => set({ ansicht }),
      setAktuellesDatum: (datum) => set({ aktuellesDatum: datum }),
      setSelectedTag: (datum) => set({ selectedTag: datum }),
    }),
    {
      name: 'mueller-kalender-v2',
      partialize: (s) => ({
        isAuthenticated: s.isAuthenticated,
        auftraege: s.auftraege,
        urlaube: s.urlaube,
      }),
    }
  )
);
