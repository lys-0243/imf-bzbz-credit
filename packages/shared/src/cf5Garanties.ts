import { arr, num, obj, oneOf, rid, str } from './formUtils';

/** CF5.1 — Évaluation de la garantie (demandeur ou garant). */
export const GARANTIE_TYPES = ['BM', 'AI', 'ST', 'HYPO', 'VEH', 'CDTG', 'AUTRE'] as const;
export type GarantieType = (typeof GARANTIE_TYPES)[number];

export const GARANTIE_TYPE_LABELS: Record<GarantieType, string> = {
  BM: 'Biens du ménage',
  AI: 'Actifs immobilisés',
  ST: 'Stock',
  HYPO: 'Hypothèque (maison / terrain)',
  VEH: 'Véhicule',
  CDTG: 'Compte de dépôt à terme / caution',
  AUTRE: 'Autre',
};

export const GARANTIE_ETATS = ['', 'EXCELLENT', 'BON', 'MAUVAIS'] as const;
export type GarantieEtat = (typeof GARANTIE_ETATS)[number];

export type Cf5Bien = {
  id: string;
  type: GarantieType | '';
  description: string;
  dateFabrication: string;
  etat: GarantieEtat;
  prixAchat: string;
  valeurMarchande: string;
  source: string;
  /**
   * Ligne calculée : caution financière = % caution × montant proposé
   * (Excel CF5.1 W9 = CF2.5!D38 × 30 %).
   */
  auto?: 'CAUTION_FINANCIERE';
};

export type Cf5Data = {
  biens: Cf5Bien[];
  signatures: {
    proprietaire: string;
    conjoint: string;
    temoin: string;
    agent: string;
    date: string;
  };
};

export function newCf5Bien(): Cf5Bien {
  return {
    id: rid('bien'),
    type: '',
    description: '',
    dateFabrication: '',
    etat: '',
    prixAchat: '',
    valeurMarchande: '',
    source: '',
  };
}

export function cautionFinanciereLine(): Cf5Bien {
  return {
    ...newCf5Bien(),
    type: 'CDTG',
    description: 'CAUTION FINANCIERE',
    auto: 'CAUTION_FINANCIERE',
  };
}

export function emptyCf5(opts: { avecCautionFinanciere?: boolean } = {}): Cf5Data {
  return {
    biens: opts.avecCautionFinanciere ? [cautionFinanciereLine(), newCf5Bien()] : [newCf5Bien()],
    signatures: { proprietaire: '', conjoint: '', temoin: '', agent: '', date: '' },
  };
}

export function normalizeCf5(raw: unknown, opts: { avecCautionFinanciere?: boolean } = {}): Cf5Data {
  const src = obj(raw);
  const biens = arr(src.biens, (b) => {
    const o = obj(b);
    return {
      id: str(o.id) || rid('bien'),
      type: oneOf(o.type, ['', ...GARANTIE_TYPES] as const, ''),
      description: str(o.description, 300),
      dateFabrication: str(o.dateFabrication, 40),
      etat: oneOf(o.etat, GARANTIE_ETATS, ''),
      prixAchat: str(o.prixAchat, 40),
      valeurMarchande: str(o.valeurMarchande, 40),
      source: str(o.source, 200),
      ...(o.auto === 'CAUTION_FINANCIERE' ? { auto: 'CAUTION_FINANCIERE' as const } : {}),
    };
  }, 30);
  const sig = obj(src.signatures);
  const base = emptyCf5(opts);
  return {
    biens: biens.length || src.biens ? biens : base.biens,
    signatures: {
      proprietaire: str(sig.proprietaire, 200),
      conjoint: str(sig.conjoint, 200),
      temoin: str(sig.temoin, 200),
      agent: str(sig.agent, 200),
      date: str(sig.date, 40),
    },
  };
}

/** Valeur retenue d’un bien (caution financière calculée). */
export function valeurBien(
  b: Cf5Bien,
  ctx: { montantPropose?: number; cautionPct?: number } = {},
): number {
  if (b.auto === 'CAUTION_FINANCIERE') {
    return Math.max(0, ctx.montantPropose ?? 0) * (ctx.cautionPct ?? 0.3);
  }
  return num(b.valeurMarchande);
}

export type Cf5Totaux = {
  parType: Record<GarantieType, number>;
  total: number;
};

/** Excel CF5.1 AA28:AG28 (par type) et W28 (total). */
export function computeCf5Totaux(
  data: Cf5Data | null | undefined,
  ctx: { montantPropose?: number; cautionPct?: number } = {},
): Cf5Totaux {
  const parType = Object.fromEntries(GARANTIE_TYPES.map((t) => [t, 0])) as Record<
    GarantieType,
    number
  >;
  let total = 0;
  for (const b of data?.biens ?? []) {
    const v = valeurBien(b, ctx);
    total += v;
    if (b.type) parType[b.type] += v;
  }
  return { parType, total };
}
