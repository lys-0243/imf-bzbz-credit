import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Charge le `.env` (racine du monorepo) avant tout module qui lit
 * `process.env` au chargement (JwtModule, BankingModule…).
 * Doit rester le premier import de `main.ts`.
 * Les variables déjà définies (shell, hébergeur) ne sont pas écrasées.
 */
const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '../../../.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}
