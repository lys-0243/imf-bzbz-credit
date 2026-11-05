import { BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { FileStorage } from './file-storage';

/**
 * Pièces stockées sur le disque du serveur, sous `root`.
 * Sur DigitalOcean : uniquement sur un Droplet (idéalement un Volume monté) ;
 * le disque d'App Platform est éphémère et perdu à chaque déploiement.
 */
export class LocalFileStorage implements FileStorage {
  readonly driver = 'local';

  constructor(readonly root: string) {}

  /** Chemin absolu de la clé, refusé s'il sort de `root`. */
  private pathOf(key: string): string {
    const abs = resolve(this.root, key);
    const rel = relative(this.root, abs);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      throw new BadRequestException('Clé de stockage invalide');
    }
    return abs;
  }

  async put(key: string, body: Buffer): Promise<{ bytes: number }> {
    const abs = this.pathOf(key);
    await mkdir(dirname(abs), { recursive: true });
    // Écriture dans un fichier temporaire puis renommage : jamais de fichier tronqué.
    const tmp = `${abs}.${randomBytes(6).toString('hex')}.tmp`;
    try {
      await writeFile(tmp, body, { flag: 'wx' });
      await rename(tmp, abs);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    return { bytes: body.length };
  }

  async get(key: string) {
    const abs = this.pathOf(key);
    const info = await stat(abs).catch(() => null);
    if (!info?.isFile()) {
      throw new NotFoundException('Fichier introuvable sur le serveur');
    }
    return { stream: createReadStream(abs), bytes: info.size };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }
}
