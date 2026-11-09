import { arr, num, obj, rid, str } from './formUtils';

/** CF3 — Analyse des coûts de production (activités de transformation). */
export type Cf3MaterielLine = {
  id: string;
  quantite: string;
  materiel: string;
  prixUnitaire: string;
};

export type Cf3Produit = {
  id: string;
  nom: string;
  unitesProduites: string;
  materiels: Cf3MaterielLine[];
};

export type Cf3MbmpLine = {
  id: string;
  produit: string;
  coutUnitaire: string;
  prixVente: string;
  qteVendueMois: string;
};

export type Cf3Data = {
  produits: Cf3Produit[];
  mbmp: Cf3MbmpLine[];
};

export function newCf3MaterielLine(): Cf3MaterielLine {
  return { id: rid('mat'), quantite: '', materiel: '', prixUnitaire: '' };
}

export function newCf3Produit(): Cf3Produit {
  return {
    id: rid('prd'),
    nom: '',
    unitesProduites: '',
    materiels: Array.from({ length: 6 }, newCf3MaterielLine),
  };
}

export function newCf3MbmpLine(): Cf3MbmpLine {
  return { id: rid('mb'), produit: '', coutUnitaire: '', prixVente: '', qteVendueMois: '' };
}

export function emptyCf3(): Cf3Data {
  return {
    produits: [newCf3Produit(), newCf3Produit(), newCf3Produit()],
    mbmp: Array.from({ length: 6 }, newCf3MbmpLine),
  };
}

export function normalizeCf3(raw: unknown): Cf3Data {
  const src = obj(raw);
  const produits = arr(src.produits, (p) => {
    const o = obj(p);
    return {
      id: str(o.id) || rid('prd'),
      nom: str(o.nom, 200),
      unitesProduites: str(o.unitesProduites, 40),
      materiels: arr(o.materiels, (m) => {
        const l = obj(m);
        return {
          id: str(l.id) || rid('mat'),
          quantite: str(l.quantite, 40),
          materiel: str(l.materiel, 200),
          prixUnitaire: str(l.prixUnitaire, 40),
        };
      }, 20),
    };
  }, 6);
  const mbmp = arr(src.mbmp, (m) => {
    const l = obj(m);
    return {
      id: str(l.id) || rid('mb'),
      produit: str(l.produit, 200),
      coutUnitaire: str(l.coutUnitaire, 40),
      prixVente: str(l.prixVente, 40),
      qteVendueMois: str(l.qteVendueMois, 40),
    };
  }, 20);
  const base = emptyCf3();
  return {
    produits: produits.length ? produits : base.produits,
    mbmp: mbmp.length ? mbmp : base.mbmp,
  };
}

/** Excel K9 = B9×I9 ; K15 = Σ. */
export function coutTotalProduit(p: Cf3Produit): number {
  return p.materiels.reduce((acc, m) => acc + num(m.quantite) * num(m.prixUnitaire), 0);
}

/** Coût total / nombre d’unités produites. */
export function coutParUnite(p: Cf3Produit): number | null {
  const unites = num(p.unitesProduites);
  return unites > 0 ? coutTotalProduit(p) / unites : null;
}

export type Cf3MbmpRow = {
  id: string;
  marge: number | null;
  coutMensuel: number;
  venteMensuelle: number;
};

export function computeMbmpRows(data: Cf3Data): Cf3MbmpRow[] {
  return data.mbmp.map((l) => {
    const cout = num(l.coutUnitaire);
    const pv = num(l.prixVente);
    const qte = num(l.qteVendueMois);
    return {
      id: l.id,
      marge: pv > 0 ? 1 - cout / pv : null,
      coutMensuel: cout * qte,
      venteMensuelle: pv * qte,
    };
  });
}

/**
 * Marge brute moyenne pondérée par les ventes :
 * 1 − Σ coûts mensuels / Σ ventes mensuelles.
 */
export function computeMbmp(data: Cf3Data): {
  coutMensuel: number;
  venteMensuelle: number;
  mbmp: number | null;
} {
  const rows = computeMbmpRows(data);
  const coutMensuel = rows.reduce((a, r) => a + r.coutMensuel, 0);
  const venteMensuelle = rows.reduce((a, r) => a + r.venteMensuelle, 0);
  return {
    coutMensuel,
    venteMensuelle,
    mbmp: venteMensuelle > 0 ? 1 - coutMensuel / venteMensuelle : null,
  };
}
