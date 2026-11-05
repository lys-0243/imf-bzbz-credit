import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary n'est plus utilisé pour les nouveaux envois.
 * Conservé uniquement pour supprimer les anciennes pièces (champ `url` renseigné)
 * lorsqu'elles sont remplacées. Lecture : via `piece.url`, sans identifiants.
 */
let configured = false;

function configureCloudinary(): boolean {
  if (configured) return true;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) return false;
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
  return true;
}

/** Suppression best-effort d'une ancienne pièce Cloudinary (image ou PDF/raw). */
export async function destroyLegacyCloudinary(publicId: string): Promise<void> {
  if (!configureCloudinary()) return;
  for (const resource_type of ['image', 'raw'] as const) {
    try {
      const res = await cloudinary.uploader.destroy(publicId, { resource_type });
      if (res?.result === 'ok') return;
    } catch {
      /* best-effort */
    }
  }
}
