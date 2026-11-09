'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DossierEtat, PronosticRecommandation, RapportAnalyseData, ConstatConformite } from '@imf/shared';

/**
 * Brouillon de décision partagé entre le copilote IA (qui propose) et la
 * barre de décision / les panneaux de travail (où l'humain décide).
 */
export type PointRetour = {
  id: string;
  constat: string;
  correction?: string;
  gravite?: string;
  rubrique?: string;
};

export type Brouillon = {
  motif: string;
  details: PointRetour[];
  /** Action pré-sélectionnée dans la barre de décision. */
  action: DossierEtat | null;
  decision: { recommandation: PronosticRecommandation; montant: string; dureeMois: string } | null;
  rapport: Partial<RapportAnalyseData> | null;
  constats: ConstatConformite[] | null;
  pv: { montant: string; dureeMois: string; observations: string } | null;
};

const VIDE: Brouillon = {
  motif: '',
  details: [],
  action: null,
  decision: null,
  rapport: null,
  constats: null,
  pv: null,
};

type Ctx = {
  brouillon: Brouillon;
  maj: (patch: Partial<Brouillon>) => void;
  basculerPoint: (p: PointRetour) => void;
  reinitialiser: () => void;
  toast: (msg: string) => void;
  message: string | null;
};

const BrouillonContext = createContext<Ctx | null>(null);

export function BrouillonProvider({ children }: { children: ReactNode }) {
  const [brouillon, setBrouillon] = useState<Brouillon>(VIDE);
  const [message, setMessage] = useState<string | null>(null);

  const maj = useCallback((patch: Partial<Brouillon>) => setBrouillon((b) => ({ ...b, ...patch })), []);
  const basculerPoint = useCallback(
    (p: PointRetour) =>
      setBrouillon((b) => ({
        ...b,
        details: b.details.some((x) => x.id === p.id) ? b.details.filter((x) => x.id !== p.id) : [...b.details, p],
      })),
    [],
  );
  const reinitialiser = useCallback(() => setBrouillon(VIDE), []);
  const toast = useCallback((msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage((m) => (m === msg ? null : m)), 3500);
  }, []);

  const value = useMemo(
    () => ({ brouillon, maj, basculerPoint, reinitialiser, toast, message }),
    [brouillon, maj, basculerPoint, reinitialiser, toast, message],
  );
  return <BrouillonContext.Provider value={value}>{children}</BrouillonContext.Provider>;
}

export function useBrouillon() {
  const ctx = useContext(BrouillonContext);
  if (!ctx) throw new Error('useBrouillon hors BrouillonProvider');
  return ctx;
}
