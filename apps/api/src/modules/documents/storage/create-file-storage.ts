import { Logger } from '@nestjs/common';
import { resolve } from 'node:path';
import { isProduction } from '../../../config';
import type { FileStorage } from './file-storage';
import { LocalFileStorage } from './local-file-storage';

/**
 * `STORAGE_DRIVER` : `local` (défaut).
 * `STORAGE_LOCAL_DIR` : dossier racine, chemin absolu hors du dossier de l'appli.
 * Obligatoire en production ; en dev, défaut `./uploads` du répertoire courant.
 */
export function createFileStorage(): FileStorage {
  const driver = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
  const logger = new Logger('FileStorage');

  switch (driver) {
    case 'local': {
      const dir = process.env.STORAGE_LOCAL_DIR?.trim();
      if (isProduction && !dir) {
        throw new Error(
          'STORAGE_LOCAL_DIR requis en production (ex. /var/lib/imf/uploads)',
        );
      }
      const root = resolve(dir || resolve(process.cwd(), 'uploads'));
      logger.log(`Stockage local des pièces : ${root}`);
      return new LocalFileStorage(root);
    }
    default:
      throw new Error(`STORAGE_DRIVER inconnu : "${driver}" (valeurs : local)`);
  }
}
