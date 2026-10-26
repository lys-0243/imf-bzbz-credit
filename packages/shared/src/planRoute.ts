import { num, obj, str } from './formUtils';

/** PLAN DE ROUTE — emplacements activité et domicile (croquis : pièce `plan_de_route`). */
export type PlanRouteAdresse = {
  avenue: string;
  numero: string;
  quartier: string;
  commune: string;
  reference: string;
  gps: { lat: number; lng: number; precisionM: number | null; capturedAt: string } | null;
};

export type PlanRouteData = {
  dateEtablissement: string;
  agent: string;
  activite: PlanRouteAdresse;
  domicile: PlanRouteAdresse;
  commentaire: string;
};

function emptyAdresse(): PlanRouteAdresse {
  return { avenue: '', numero: '', quartier: '', commune: '', reference: '', gps: null };
}

export function emptyPlanRoute(): PlanRouteData {
  return {
    dateEtablissement: '',
    agent: '',
    activite: emptyAdresse(),
    domicile: emptyAdresse(),
    commentaire: '',
  };
}

function normalizeAdresse(raw: unknown): PlanRouteAdresse {
  const o = obj(raw);
  const g = obj(o.gps);
  const lat = num(g.lat);
  const lng = num(g.lng);
  const hasGps = o.gps != null && (lat !== 0 || lng !== 0);
  return {
    avenue: str(o.avenue, 200),
    numero: str(o.numero, 40),
    quartier: str(o.quartier, 200),
    commune: str(o.commune, 200),
    reference: str(o.reference, 300),
    gps: hasGps
      ? {
          lat,
          lng,
          precisionM: g.precisionM == null ? null : num(g.precisionM),
          capturedAt: str(g.capturedAt, 40),
        }
      : null,
  };
}

export function normalizePlanRoute(raw: unknown): PlanRouteData {
  const o = obj(raw);
  return {
    dateEtablissement: str(o.dateEtablissement, 40),
    agent: str(o.agent, 200),
    activite: normalizeAdresse(o.activite),
    domicile: normalizeAdresse(o.domicile),
    commentaire: str(o.commentaire, 2000),
  };
}

export function formatAdresse(a: PlanRouteAdresse): string {
  return [
    a.avenue && `Av. ${a.avenue}`,
    a.numero && `n°${a.numero}`,
    a.quartier && `Q/${a.quartier}`,
    a.commune && `C/${a.commune}`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function lienCarte(a: PlanRouteAdresse): string | null {
  return a.gps ? `https://www.openstreetmap.org/?mlat=${a.gps.lat}&mlon=${a.gps.lng}#map=18/${a.gps.lat}/${a.gps.lng}` : null;
}
