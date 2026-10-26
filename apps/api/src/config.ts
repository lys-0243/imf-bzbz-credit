const DEV_JWT_SECRET = 'imf-dev-jwt-secret-change-me';

export const isProduction = process.env.NODE_ENV === 'production';

/** Secret JWT : obligatoire (et différent de la valeur de dev) en production. */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (isProduction && (!secret || secret === DEV_JWT_SECRET)) {
    throw new Error(
      'JWT_SECRET manquant ou égal à la valeur de développement en production',
    );
  }
  return secret || DEV_JWT_SECRET;
}

/**
 * Origines CORS autorisées : `WEB_ORIGIN` (séparées par des virgules).
 * En dev sans `WEB_ORIGIN`, toutes les origines sont acceptées.
 * L'app mobile native n'envoie pas d'en-tête Origin : non concernée.
 */
export function corsOrigins(): string[] | true {
  const origins = (process.env.WEB_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length) return origins;
  if (isProduction) {
    throw new Error('WEB_ORIGIN requis en production (origines CORS)');
  }
  return true;
}
