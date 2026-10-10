import type { Metadata } from 'next';

export const SITE_NAME = 'IMF Bisou Bisou';
export const SITE_DESCRIPTION =
  'Plateforme crédit — back-office agent, analyste et postes métier.';

/**
 * Métadonnées de page. Le titre est complété par le template racine
 * (`%s · IMF Bisou Bisou`).
 *
 * Pour une nouvelle page :
 * - composant serveur : `export const metadata = pageMetadata('Mon titre')`
 * - page `'use client'` : créer un `layout.tsx` voisin avec le même export
 *   (le favicon / OG racine s’appliquent automatiquement).
 */
export function pageMetadata(
  title: string,
  description?: string,
): Metadata {
  return {
    title,
    description: description ?? SITE_DESCRIPTION,
    openGraph: {
      title,
      description: description ?? SITE_DESCRIPTION,
      siteName: SITE_NAME,
    },
  };
}
