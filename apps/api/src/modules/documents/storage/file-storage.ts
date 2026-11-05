import type { Readable } from 'node:stream';

/** Jeton d'injection du stockage des pièces (driver choisi par `STORAGE_DRIVER`). */
export const FILE_STORAGE = Symbol('FILE_STORAGE');

/**
 * Stockage binaire des pièces, adressé par une clé relative
 * (`dossiers/<dossierId>/<fichier>`), indépendante du fournisseur.
 * Implémentations : disque local (tests / Droplet) ; à venir : DigitalOcean Spaces (S3).
 */
export interface FileStorage {
  readonly driver: string;
  put(key: string, body: Buffer, contentType?: string): Promise<{ bytes: number }>;
  /** Lève NotFoundException si la clé n'existe pas. */
  get(key: string): Promise<{ stream: Readable; bytes: number }>;
  /** Idempotent : ne lève pas si la clé n'existe pas. */
  delete(key: string): Promise<void>;
}
