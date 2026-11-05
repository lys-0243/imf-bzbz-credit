import { num, obj, str } from './formUtils';

/**
 * PLAN DE ROUTE — pour l’activité et le domicile : photo du plan (pièce),
 * coordonnées GPS (carte Google + itinéraire) et repère libre.
 */
export type PlanRouteGps = {
  lat: number;
  lng: number;
  precisionM: number | null;
  capturedAt: string;
};

export type PlanRouteLieu = {
  gps: PlanRouteGps | null;
  repere: string;
};

export type PlanRouteData = {
  activite: PlanRouteLieu;
  domicile: PlanRouteLieu;
  commentaire: string;
};

export type PlanRouteLieuKey = 'activite' | 'domicile';

/** Kinds de pièce des photos (activité = élément « Plan de route » de la checklist). */
export const PLAN_ROUTE_PIECE_KIND: Record<PlanRouteLieuKey, string> = {
  activite: 'plan_de_route',
  domicile: 'plan_de_route_domicile',
};

function emptyLieu(): PlanRouteLieu {
  return { gps: null, repere: '' };
}

export function emptyPlanRoute(): PlanRouteData {
  return { activite: emptyLieu(), domicile: emptyLieu(), commentaire: '' };
}

function coordonneesValides(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function normalizeLieu(raw: unknown): PlanRouteLieu {
  const o = obj(raw);
  const g = obj(o.gps);
  const lat = num(g.lat);
  const lng = num(g.lng);
  // Ancien format (avenue, n°, quartier, commune, référence) → repère.
  const ancienneAdresse = [
    o.avenue && `Av. ${str(o.avenue, 200)}`,
    o.numero && `n°${str(o.numero, 40)}`,
    o.quartier && `Q/${str(o.quartier, 200)}`,
    o.commune && `C/${str(o.commune, 200)}`,
    o.reference && str(o.reference, 300),
  ]
    .filter(Boolean)
    .join(' ');
  return {
    gps:
      o.gps != null && coordonneesValides(lat, lng)
        ? {
            lat,
            lng,
            precisionM: g.precisionM == null ? null : num(g.precisionM),
            capturedAt: str(g.capturedAt, 40),
          }
        : null,
    repere: str(o.repere, 500) || ancienneAdresse,
  };
}

export function normalizePlanRoute(raw: unknown): PlanRouteData {
  const o = obj(raw);
  return {
    activite: normalizeLieu(o.activite),
    domicile: normalizeLieu(o.domicile),
    commentaire: str(o.commentaire, 2000),
  };
}

/**
 * Coordonnées saisies ou collées : « -4.3217, 15.3125 », « -4.3217 15.3125 »
 * ou un lien Google Maps (…/@-4.32,15.31,17z, ?q=-4.32,15.31, !3d-4.32!4d15.31).
 */
export function parseCoordonnees(saisie: string): { lat: number; lng: number } | null {
  const t = (saisie ?? '').trim();
  if (!t) return null;
  const nombre = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const motifs = [
    new RegExp(`!3d${nombre}!4d${nombre}`),
    new RegExp(`@${nombre},${nombre}`),
    new RegExp(`[?&](?:q|query|destination|ll)=${nombre},\\s*${nombre}`),
    new RegExp(`^${nombre}\\s*[,;\\s]\\s*${nombre}$`),
  ];
  for (const m of motifs) {
    const r = m.exec(t);
    if (!r) continue;
    const lat = Number(r[1]);
    const lng = Number(r[2]);
    if (coordonneesValides(lat, lng)) return { lat, lng };
  }
  return null;
}

const coord = (g: { lat: number; lng: number }) => `${g.lat},${g.lng}`;

/** Carte Google intégrable (iframe), sans clé API. */
export function googleMapsEmbedUrl(g: { lat: number; lng: number }): string {
  return `https://www.google.com/maps?q=${coord(g)}&z=17&output=embed`;
}

/** Itinéraire depuis la position de l’utilisateur (ouvre l’app Google Maps sur mobile). */
export function googleMapsItineraireUrl(g: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coord(g)}`;
}

export function googleMapsUrl(g: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${coord(g)}`;
}
