# Déploiement — Droplet DigitalOcean + sous-domaines

Ce guide met en production la plateforme crédit IMF Bisou Bisou sur **un seul Droplet DigitalOcean**, avec Docker Compose, HTTPS automatique et trois sous-domaines. Il se suit dans l'ordre ; chaque fichier à créer est donné en entier.

> Dans tout le guide, `bisoubisou.cd` est un exemple : remplacez-le par votre domaine.
> L'app Android (APK) n'est pas couverte ici.

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Prérequis](#2-prérequis)
3. [Adapter le code avant le premier déploiement](#3-adapter-le-code-avant-le-premier-déploiement)
4. [Fichiers de déploiement](#4-fichiers-de-déploiement)
5. [Créer et sécuriser le Droplet](#5-créer-et-sécuriser-le-droplet)
6. [Connecter le domaine (sous-domaines)](#6-connecter-le-domaine-sous-domaines)
7. [Premier déploiement](#7-premier-déploiement)
8. [Mises à jour et retour arrière](#8-mises-à-jour-et-retour-arrière)
9. [Sauvegardes et restauration](#9-sauvegardes-et-restauration)
10. [Exploitation au quotidien](#10-exploitation-au-quotidien)
11. [Dépannage](#11-dépannage)
12. [Checklist de mise en production](#12-checklist-de-mise-en-production)

---

## 1. Vue d'ensemble

```
                         Internet (HTTPS 443)
                                 │
                    ┌────────────▼─────────────┐
                    │ Caddy (certificats Let's │
                    │ Encrypt automatiques)    │
                    └──┬──────────┬─────────┬──┘
     app.bisoubisou.cd │          │         │ reception.bisoubisou.cd
                       ▼          │         ▼
              web (Next.js :3000) │   fichiers statiques
                                  │   (réception, export Expo web)
              api.bisoubisou.cd   ▼
                     api (NestJS :3001) ──► postgres (réseau Docker interne)
                                  │
                                  └──► /var/lib/imf/uploads (pièces, disque du Droplet)
```

| Sous-domaine | Service | Rôle |
|---|---|---|
| `app.` | `web` | Back-office (agents, analystes, RC, conformité, direction, admin) |
| `api.` | `api` | API NestJS + workers (avis IA, envois CBS) |
| `reception.` | `caddy` (statique) | Réception web (app Expo compilée pour le navigateur) |

Principes :

- **Tout tourne dans Docker Compose** sur le Droplet : `postgres`, `migrate` (migrations Prisma, s'exécute puis s'arrête), `api`, `web`, `caddy`.
- **Postgres n'est jamais exposé** sur Internet (aucun port publié).
- **Une seule instance d'API** : les workers d'arrière-plan (avis IA, outbox CBS) ne doivent tourner qu'une fois.
- **Les images sont construites sur le Droplet** (`docker compose build`). GitHub Actions vérifie le code puis lance le script de déploiement en SSH.
- Les URL publiques (`NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_API_URL`…) sont **figées au moment du build** : changer de domaine impose de reconstruire `web` et `caddy`.

Dimensionnement : Droplet **Basic, 2 vCPU / 4 Go RAM / 80 Go** (≈ 24 $/mois) + option Sauvegardes du Droplet. 4 Go + 2 Go de swap suffisent pour construire Next.js sur place.

---

## 2. Prérequis

- Un compte DigitalOcean avec un moyen de paiement.
- Un nom de domaine et l'accès à sa zone DNS (chez le registrar, ou chez DigitalOcean).
- Une clé API Anthropic (Console Anthropic, crédits API) pour les avis IA. Sans clé, l'API bascule sur les avis par règles.
- Un accès administrateur au dépôt GitHub `lys-0243/imf-bzbz-credit` (deploy key, secrets Actions).
- Sur votre PC : un client SSH et une paire de clés (`ssh-keygen -t ed25519`).

---

## 3. Adapter le code avant le premier déploiement

Ces modifications se font une fois, dans le dépôt, puis sont fusionnées dans `main`.

### 3.1 Next.js en mode `standalone`

Produit un serveur Node autonome, beaucoup plus léger que `next start` avec tout `node_modules`.

`apps/web/next.config.ts` :

```ts
import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo : tracer les dépendances depuis la racine (node_modules hissés).
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  transpilePackages: ['@imf/shared'],
};

export default nextConfig;
```

### 3.2 Seed de production sans les comptes de démonstration

Aujourd'hui, `prisma/seed.ts` crée les 18 comptes du README (mots de passe publics) **et réécrit leur mot de passe à chaque exécution**. En production, on ne sème que les référentiels (produits, zones, communes) et **un seul administrateur**, créé à partir de variables d'environnement et jamais réécrit.

Dans `prisma/seed.ts`, ajouter en haut du fichier :

```ts
const isProduction = process.env.NODE_ENV === 'production';

/** Production : un seul ADMIN, créé s'il n'existe pas, jamais réécrit. */
async function seedAdminProduction() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (!email || password.length < 12) {
    throw new Error(
      'SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD (12 caractères min.) requis en production',
    );
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} déjà présent : inchangé`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      displayName: 'Administrateur',
      role: Role.ADMIN,
    },
  });
  console.log(`Admin ${email} créé`);
}
```

Puis, dans `main()`, entourer la boucle `for (const u of SEED_USERS) { … }` :

```ts
  if (isProduction) {
    await seedAdminProduction();
  } else {
    for (const u of SEED_USERS) {
      // … boucle existante inchangée …
    }
  }
```

Les autres comptes sont ensuite créés par l'administrateur dans **Admin › Utilisateurs**.

### 3.3 Swagger désactivé en production

`/api` documente toutes les routes : inutile de l'exposer publiquement. Dans `apps/api/src/main.ts`, entourer la création du document Swagger :

```ts
  if (!isProduction || process.env.SWAGGER_ENABLED === '1') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, { /* options existantes */ });
  }
```

(`isProduction` est déjà importé depuis `./config`.) Pour l'ouvrir ponctuellement : `SWAGGER_ENABLED=1` dans `deploy/.env`, puis `docker compose up -d api`.

### 3.4 Fins de ligne des scripts (dépôt édité sous Windows)

Un script shell enregistré en CRLF échoue sous Linux (`/usr/bin/env: 'bash\r'`). Créer `.gitattributes` à la racine :

```gitattributes
*.sh       text eol=lf
Caddyfile  text eol=lf
Dockerfile text eol=lf
*.yml      text eol=lf
```

### 3.5 Rappel : ce qui est déjà prêt dans le code

- L'API refuse de démarrer en production sans `JWT_SECRET` (différent de la valeur de dev), `WEB_ORIGIN` et `STORAGE_LOCAL_DIR` (`apps/api/src/config.ts`, `apps/api/src/modules/documents/storage/create-file-storage.ts`).
- `trust proxy` est activé en production (rate-limit du login sur la vraie IP client derrière Caddy).
- `GET /health` répond `{ "status": "ok" }` sans authentification.

---

## 4. Fichiers de déploiement

Tous les fichiers ci-dessous sont versionnés dans le dépôt (dossier `deploy/` + `.dockerignore` à la racine), **sauf `deploy/.env`** qui contient les secrets et n'existe que sur le Droplet (déjà ignoré par `.gitignore`).

```
.dockerignore
deploy/
  Dockerfile
  docker-compose.prod.yml
  Caddyfile
  .env.example
  deploy.sh
  backup.sh
.github/workflows/deploy.yml
```

### 4.1 `.dockerignore` (racine du dépôt)

```gitignore
.git
**/node_modules
**/dist
**/.next
**/.expo
**/*.tsbuildinfo
.env
.env.*
deploy/.env
uploads
apps/api/uploads
coverage
```

### 4.2 `deploy/Dockerfile`

Un seul Dockerfile multi-cibles : les dépendances (`npm ci`) et le package partagé sont construits une fois, puis réutilisés par l'API, le web et la réception.

```dockerfile
# syntax=docker/dockerfile:1.7

# ── Base commune : dépendances + package partagé + client Prisma ──────────────
FROM node:24-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g npm@11.19.0
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1

# Manifestes d'abord : la couche npm ci reste en cache tant qu'ils ne changent pas.
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/assets/package.json packages/assets/
# Le script "prepare" de @imf/shared compile ses sources pendant npm ci.
COPY packages/shared packages/shared
COPY prisma prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build:shared

# ── Outils : migrations et seed (Prisma CLI, ts-node) ─────────────────────────
FROM base AS tools
ENV NODE_ENV=production

# ── API NestJS ───────────────────────────────────────────────────────────────
FROM base AS api
RUN npm run build -w @imf/api
ENV NODE_ENV=production PORT=3001
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]

# ── Back-office Next.js (standalone) ─────────────────────────────────────────
FROM base AS web-build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build -w @imf/web

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ── Réception web (export Expo) servie par Caddy ─────────────────────────────
FROM base AS reception-build
ARG EXPO_PUBLIC_WEB_API_URL
ENV EXPO_PUBLIC_WEB_API_URL=$EXPO_PUBLIC_WEB_API_URL CI=1
RUN npm run build:web -w @imf/mobile

FROM caddy:2.10-alpine AS caddy
COPY --from=reception-build /app/apps/mobile/dist /srv/reception
```

> `npm@11.19.0` est la version utilisée en développement ; garder la même évite les écarts de comportement sur le `package-lock.json`.

### 4.3 `deploy/docker-compose.prod.yml`

```yaml
name: imf

x-logging: &logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"

x-build: &build
  context: ..
  dockerfile: deploy/Dockerfile

x-database-url: &database_url postgresql://imf:${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant}@postgres:5432/imf_credit?schema=public

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: imf
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: imf_credit
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Pas de "ports:" : Postgres n'est joignable que depuis le réseau Docker.
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U imf -d imf_credit"]
      interval: 10s
      timeout: 5s
      retries: 10
    logging: *logging

  migrate:
    build:
      <<: *build
      target: tools
    image: imf-tools
    command: ["npx", "prisma", "migrate", "deploy"]
    env_file: .env
    environment:
      DATABASE_URL: *database_url
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"
    logging: *logging

  api:
    build:
      <<: *build
      target: api
    image: imf-api
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      PORT: "3001"
      DATABASE_URL: *database_url
      WEB_ORIGIN: https://${APP_HOST},https://${RECEPTION_HOST}
      STORAGE_DRIVER: local
      STORAGE_LOCAL_DIR: /var/lib/imf/uploads
    volumes:
      - /var/lib/imf/uploads:/var/lib/imf/uploads
    depends_on:
      migrate:
        condition: service_completed_successfully
    logging: *logging

  web:
    build:
      <<: *build
      target: web
      args:
        NEXT_PUBLIC_API_URL: https://${API_HOST}
        NEXT_PUBLIC_APP_URL: https://${APP_HOST}
    image: imf-web
    restart: unless-stopped
    depends_on:
      - api
    logging: *logging

  caddy:
    build:
      <<: *build
      target: caddy
      args:
        EXPO_PUBLIC_WEB_API_URL: https://${API_HOST}
    image: imf-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    environment:
      APP_HOST: ${APP_HOST:?APP_HOST manquant}
      API_HOST: ${API_HOST:?API_HOST manquant}
      RECEPTION_HOST: ${RECEPTION_HOST:?RECEPTION_HOST manquant}
      ACME_EMAIL: ${ACME_EMAIL:?ACME_EMAIL manquant}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api
      - web
    logging: *logging

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

Points clés :

- `migrate` tourne à chaque `docker compose up` et l'API ne démarre qu'après son succès : **les migrations sont appliquées automatiquement** à chaque déploiement.
- `WEB_ORIGIN` (CORS) est construit à partir des sous-domaines : pas de risque d'oubli.
- Le volume `caddy_data` conserve les certificats : ne pas le supprimer (limites de Let's Encrypt).

### 4.4 `deploy/Caddyfile`

```caddyfile
{
	email {$ACME_EMAIL}
}

(securite) {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		X-Frame-Options "SAMEORIGIN"
		-Server
	}
}

{$API_HOST} {
	import securite
	# Manuels jusqu'à 25 Mo, pièces 10 Mo.
	request_body {
		max_size 30MB
	}
	reverse_proxy api:3001
}

{$APP_HOST} {
	import securite
	reverse_proxy web:3000
}

{$RECEPTION_HOST} {
	import securite
	root * /srv/reception
	try_files {path} /index.html
	file_server
}
```

Caddy obtient et renouvelle seul les certificats HTTPS dès que les enregistrements DNS pointent vers le Droplet et que les ports 80/443 sont ouverts. HTTP est redirigé vers HTTPS automatiquement.

### 4.5 `deploy/.env.example`

À copier en `deploy/.env` **sur le Droplet uniquement**.

```dotenv
# ── Sous-domaines publics (sans https://) ───────────────────────────
APP_HOST=app.bisoubisou.cd
API_HOST=api.bisoubisou.cd
RECEPTION_HOST=reception.bisoubisou.cd
# Adresse de contact Let's Encrypt (alertes d'expiration)
ACME_EMAIL=it@bisoubisou.cd

# ── Base de données ─────────────────────────────────────────────────
# openssl rand -hex 24   (hexadécimal : pas de caractère à échapper dans l'URL)
POSTGRES_PASSWORD=

# ── API ─────────────────────────────────────────────────────────────
# openssl rand -hex 64
JWT_SECRET=
JWT_EXPIRES_IN=7d
CORE_BANKING_PROVIDER=mock

# Claude (API Anthropic)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-5-5
ANTHROPIC_EFFORT=medium
ANTHROPIC_MODEL_PRONOSTIC=

# Workers (laisser vide = actifs)
ASSISTANT_WORKER_DISABLED=
CBS_OUTBOX_DISABLED=

# Swagger (/api) : 1 pour l'ouvrir temporairement
SWAGGER_ENABLED=

# ── Premier administrateur (seed de production) ─────────────────────
# À vider après le premier seed.
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

### 4.6 `deploy/deploy.sh`

```bash
#!/usr/bin/env bash
# Déploie une révision : deploy/deploy.sh [ref]   (défaut : origin/main)
# Exemples : deploy/deploy.sh            → dernière version de main
#            deploy/deploy.sh a1b2c3d    → révision précise (retour arrière)
set -euo pipefail

# Tout est dans main() : bash lit le script en entier avant que
# "git checkout" ne le remplace par sa nouvelle version.
main() {
  local ref="${1:-origin/main}"
  cd /opt/imf
  git fetch --prune origin
  git checkout --force --detach "$ref"
  echo "→ Déploiement de $(git log -1 --format='%h %s')"

  cd deploy
  local api_host
  api_host="$(grep -E '^API_HOST=' .env | cut -d= -f2-)"

  docker compose -f docker-compose.prod.yml build
  docker compose -f docker-compose.prod.yml up -d --remove-orphans

  for _ in $(seq 1 36); do
    if curl -fsS "https://${api_host}/health" >/dev/null 2>&1; then
      echo "✓ API en ligne : https://${api_host}/health"
      docker image prune -f >/dev/null
      return 0
    fi
    sleep 5
  done

  echo "✗ L'API ne répond pas après 3 minutes" >&2
  docker compose -f docker-compose.prod.yml ps
  docker compose -f docker-compose.prod.yml logs --tail=80 migrate api
  return 1
}

main "$@"
exit
```

### 4.7 `deploy/backup.sh`

```bash
#!/usr/bin/env bash
# Sauvegarde quotidienne : base (pg_dump) + pièces, copie hors du Droplet.
set -euo pipefail

DEST=/var/backups/imf
STAMP="$(date +%Y%m%d-%H%M)"
RETENTION_JOURS=14
mkdir -p "$DEST"

cd /opt/imf/deploy
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U imf -d imf_credit -Fc > "$DEST/db-$STAMP.dump"

find "$DEST" -name 'db-*.dump' -mtime +"$RETENTION_JOURS" -delete
echo "✓ Dump : $DEST/db-$STAMP.dump ($(du -h "$DEST/db-$STAMP.dump" | cut -f1))"

# Copie hors site si un remote rclone "offsite" est configuré (voir §9).
if command -v rclone >/dev/null && rclone listremotes | grep -q '^offsite:$'; then
  rclone copy "$DEST" offsite:imf-backups/db --max-age 25h
  # "copy" (pas "sync") : une pièce supprimée sur le serveur reste dans la sauvegarde.
  rclone copy /var/lib/imf/uploads offsite:imf-backups/uploads
  echo "✓ Copie hors site terminée"
fi
```

### 4.8 `.github/workflows/deploy.yml`

```yaml
name: Déploiement production

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  verifier:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm install -g npm@11.19.0
      - run: npm ci
      - run: npx prisma generate
      - run: npm test
      - run: npm run build -w @imf/api
      - run: npm run build -w @imf/web

  deployer:
    needs: verifier
    runs-on: ubuntu-24.04
    environment: production
    steps:
      - uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.DROPLET_HOST }}
          username: deploy
          key: ${{ secrets.DROPLET_SSH_KEY }}
          command_timeout: 40m
          script: bash /opt/imf/deploy/deploy.sh ${{ github.sha }}
```

---

## 5. Créer et sécuriser le Droplet

### 5.1 Créer le Droplet

Dans le panneau DigitalOcean : **Create › Droplets**

| Réglage | Valeur |
|---|---|
| Région | Francfort (FRA1) ou Amsterdam (AMS3), les plus proches de Kinshasa |
| Image | Ubuntu 24.04 LTS x64 |
| Taille | Basic, Regular, 2 vCPU / 4 Go / 80 Go |
| Authentification | **SSH Key** (ajouter votre clé publique), pas de mot de passe |
| Sauvegardes | Activer |
| Monitoring | Activer (agent de métriques gratuit) |
| Nom | `imf-prod` |

Notez l'**adresse IPv4** du Droplet (`203.0.113.10` dans les exemples).

### 5.2 Pare-feu DigitalOcean (Cloud Firewall)

**Networking › Firewalls › Create Firewall**, appliqué au Droplet `imf-prod` :

| Entrant | Port | Sources |
|---|---|---|
| SSH | 22 | votre IP fixe si possible, sinon toutes |
| HTTP | 80 | toutes (nécessaire aux certificats Let's Encrypt) |
| HTTPS | 443 (TCP et UDP) | toutes |

Tout le reste est bloqué. C'est la barrière principale : Docker contourne `ufw` pour les ports qu'il publie, d'où l'importance de **ne jamais ajouter `ports:` au service `postgres`**.

### 5.3 Premier accès et utilisateur `deploy`

Depuis votre PC :

```bash
ssh root@203.0.113.10
```

Sur le Droplet (en root) :

```bash
# Mises à jour et paquets de base
apt update && apt -y upgrade
apt -y install git curl ufw fail2ban unattended-upgrades

# Utilisateur d'exploitation (un mot de passe vous est demandé : il sert à sudo)
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

### 5.4 Durcir SSH

```bash
cat > /etc/ssh/sshd_config.d/00-imf.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
systemctl restart ssh
```

> Le préfixe `00-` est voulu : sshd retient la **première** valeur lue, et `50-cloud-init.conf` peut réactiver les mots de passe.
> **Avant de fermer la session root**, ouvrez un second terminal et vérifiez `ssh deploy@203.0.113.10`.

### 5.5 Pare-feu local, mises à jour automatiques, swap

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

dpkg-reconfigure -plow unattended-upgrades   # répondre "Oui"
systemctl enable --now fail2ban               # protège SSH contre le brute-force

# Swap de 2 Go (indispensable au build Next.js / Expo sur 4 Go de RAM)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 5.6 Installer Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
docker --version && docker compose version
```

Déconnectez-vous et reconnectez-vous en `deploy` pour que le groupe `docker` soit pris en compte.

### 5.7 Dossiers de l'application

```bash
sudo mkdir -p /opt/imf /var/lib/imf/uploads /var/backups/imf
sudo chown deploy:deploy /opt/imf /var/backups/imf
# L'API tourne sous l'utilisateur "node" (UID 1000) dans le conteneur.
sudo chown -R 1000:1000 /var/lib/imf/uploads
```

### 5.8 Accès du Droplet au dépôt GitHub (deploy key)

Le dépôt étant privé, le Droplet a besoin d'une clé en **lecture seule** :

```bash
ssh-keygen -t ed25519 -N "" -C "imf-prod" -f ~/.ssh/github_deploy
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
cat ~/.ssh/github_deploy.pub
```

Sur GitHub : **dépôt › Settings › Deploy keys › Add deploy key**, coller la clé publique, **sans** cocher « Allow write access ».

```bash
ssh -T git@github.com     # doit afficher "successfully authenticated"
git clone git@github.com:lys-0243/imf-bzbz-credit.git /opt/imf
```

---

## 6. Connecter le domaine (sous-domaines)

Objectif : `app.`, `api.` et `reception.` doivent résoudre vers l'IPv4 du Droplet. Faites cette étape **avant** le premier démarrage de Caddy, pour qu'il obtienne les certificats du premier coup.

Deux façons de faire, choisissez-en **une**.

### Option A — Garder le DNS chez le registrar (recommandé si le domaine sert déjà, ex. e-mails)

Dans l'interface DNS de votre registrar, ajoutez :

| Type | Nom (hôte) | Valeur | TTL |
|---|---|---|---|
| A | `app` | `203.0.113.10` | 300 |
| A | `api` | `203.0.113.10` | 300 |
| A | `reception` | `203.0.113.10` | 300 |

- Ne touchez pas aux autres enregistrements (MX, TXT des e-mails…).
- S'il existe un enregistrement **AAAA** (IPv6) sur ces noms, supprimez-le ou faites-le pointer vers l'IPv6 du Droplet : sinon une partie des visiteurs (et Let's Encrypt) iront ailleurs.
- Vous voulez regrouper sous un sous-domaine existant, ex. `credit.bisoubisou.cd` ? Créez `app.credit`, `api.credit`, `reception.credit` et reportez ces noms dans `deploy/.env`.

### Option B — Confier le DNS à DigitalOcean

1. **Networking › Domains › Add Domain** : saisir `bisoubisou.cd`, choisir le Droplet.
2. Créer les trois enregistrements A (`app`, `api`, `reception` → `imf-prod`).
3. **Recréer d'abord tous les enregistrements existants** (MX, TXT/SPF, DKIM, site vitrine…) : changer de serveurs de noms déplace **toute** la zone.
4. Chez le registrar, remplacer les serveurs de noms par `ns1.digitalocean.com`, `ns2.digitalocean.com`, `ns3.digitalocean.com`.

La propagation des NS peut prendre de quelques minutes à 48 h.

### Vérifier

Depuis votre PC (Windows, macOS ou Linux) :

```bash
nslookup app.bisoubisou.cd 8.8.8.8
nslookup api.bisoubisou.cd 1.1.1.1
nslookup reception.bisoubisou.cd 8.8.8.8
```

Les trois doivent renvoyer l'IP du Droplet. Vous pouvez aussi contrôler la propagation mondiale sur un site comme dnschecker.org.

Pièges fréquents :

- **Cloudflare** : mettre ces enregistrements en « DNS only » (nuage gris). Le proxy (nuage orange) empêche Caddy de valider le certificat.
- **Enregistrement CAA** sur le domaine : il doit autoriser `letsencrypt.org`.
- **Trop d'essais ratés** : Let's Encrypt limite les échecs. Si le DNS n'est pas prêt, arrêtez Caddy (`docker compose stop caddy`) et relancez-le une fois la résolution correcte.

---

## 7. Premier déploiement

Connecté en `deploy` sur le Droplet :

### 7.1 Renseigner les secrets

```bash
cd /opt/imf/deploy
cp .env.example .env
chmod 600 .env

openssl rand -hex 24   # → POSTGRES_PASSWORD
openssl rand -hex 64   # → JWT_SECRET
nano .env
```

Remplir : sous-domaines, `ACME_EMAIL`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (12 caractères minimum).

> Conservez `POSTGRES_PASSWORD` et `JWT_SECRET` dans un gestionnaire de mots de passe. Changer `JWT_SECRET` déconnecte tout le monde ; perdre `POSTGRES_PASSWORD` complique la restauration.

Pour ne pas répéter `-f docker-compose.prod.yml` :

```bash
echo 'export COMPOSE_FILE=/opt/imf/deploy/docker-compose.prod.yml' >> ~/.bashrc
source ~/.bashrc
```

### 7.2 Construire et migrer

```bash
cd /opt/imf/deploy
docker compose build                 # 10 à 20 min la première fois
docker compose run --rm migrate      # applique les migrations Prisma
```

### 7.3 Semer les référentiels et l'administrateur

```bash
docker compose run --rm migrate npx prisma db seed
```

Résultat attendu : produits, zones, communes et `Admin … créé`. Ensuite, **videz `SEED_ADMIN_PASSWORD`** dans `deploy/.env`.

### 7.4 Démarrer

```bash
docker compose up -d
docker compose ps                    # tous "running" / "healthy", migrate "exited (0)"
docker compose logs -f caddy         # attendre "certificate obtained successfully"
```

### 7.5 Vérifier

- `https://api.bisoubisou.cd/health` → `{"status":"ok"}`
- `https://api.bisoubisou.cd/api` → 404 (Swagger désactivé)
- `https://app.bisoubisou.cd` → page de connexion ; se connecter avec l'admin.
- **Admin › Utilisateurs** : créer les vrais comptes (réception, agents avec leur zone, analystes, conformité, RC, DG, DGA, CA).
- **Admin › Paramètres** : seuil du Conseil, taux CDF/USD, grille de score.
- **Admin › Manuels** : charger les manuels IMF / BCC (RAG conformité).
- `https://reception.bisoubisou.cd` : connexion réception, enregistrer une demande test, vérifier qu'aucune erreur CORS n'apparaît (console du navigateur, F12).
- Faire avancer le dossier test jusqu'à l'analyste ; les avis IA apparaissent (`docker compose logs api | grep -i assist`).
- Téléverser une pièce, puis `docker compose restart api` : la pièce reste consultable.
- Depuis votre PC : `Test-NetConnection 203.0.113.10 -Port 5432` (PowerShell) doit **échouer**.

---

## 8. Mises à jour et retour arrière

### 8.1 Activer le déploiement automatique (GitHub Actions)

1. Sur votre PC, générer une clé dédiée à GitHub Actions :
   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-actions" -f gha_imf
   ```
2. Ajouter `gha_imf.pub` à `/home/deploy/.ssh/authorized_keys` sur le Droplet.
3. Sur GitHub : **Settings › Environments › New environment** `production` (option : « Required reviewers » pour valider chaque mise en production à la main).
4. Dans cet environnement, ajouter les secrets :

   | Secret | Valeur |
   |---|---|
   | `DROPLET_HOST` | IP du Droplet |
   | `DROPLET_SSH_KEY` | contenu **complet** de `gha_imf` (clé privée) |

5. Supprimer la clé privée de votre PC une fois copiée.

Désormais, chaque push (ou fusion de PR) sur `main` : installe, teste, compile, puis exécute `deploy.sh` sur le Droplet (pull, build, migrations, redémarrage, vérification `/health`). Le déploiement manuel reste possible : **Actions › Déploiement production › Run workflow**.

### 8.2 Déployer à la main

```bash
bash /opt/imf/deploy/deploy.sh
```

### 8.3 Retour arrière

```bash
cd /opt/imf && git log --oneline -10          # repérer la dernière bonne révision
bash /opt/imf/deploy/deploy.sh a1b2c3d
```

Prisma n'annule pas les migrations. Pour que le retour arrière soit sûr, gardez les migrations **additives** (ajouter des colonnes/tables ; supprimer seulement dans une version ultérieure). En cas de migration destructive ratée : restaurer la sauvegarde (§9.3).

Le push suivant sur `main` redéploie automatiquement la dernière version.

---

## 9. Sauvegardes et restauration

Trois niveaux :

| Niveau | Quoi | Fréquence | Où |
|---|---|---|---|
| Sauvegardes du Droplet (DigitalOcean) | disque entier | automatique | chez DigitalOcean |
| `backup.sh` | dump Postgres | quotidien, 14 jours | `/var/backups/imf` sur le Droplet |
| `backup.sh` + rclone | dumps + pièces | quotidien | stockage externe (hors Droplet) |

### 9.1 Planifier

```bash
crontab -e
# Ajouter :
0 2 * * * bash /opt/imf/deploy/backup.sh >> /var/backups/imf/backup.log 2>&1
```

### 9.2 Copie hors site (recommandé)

Une sauvegarde sur le même Droplet ne protège ni d'une suppression du Droplet ni d'une erreur de compte. Configurez un remote rclone nommé `offsite` (DigitalOcean Spaces, Backblaze B2, Google Drive de l'IMF…) :

```bash
sudo apt -y install rclone
rclone config        # créer un remote nommé exactement "offsite"
bash /opt/imf/deploy/backup.sh   # test
```

> Ceci ne concerne que les **sauvegardes** : en exploitation, les pièces restent sur le disque du Droplet.

### 9.3 Restaurer la base

```bash
cd /opt/imf/deploy
docker compose stop api
docker compose exec -T postgres \
  pg_restore -U imf -d imf_credit --clean --if-exists --no-owner \
  < /var/backups/imf/db-20261110-0200.dump
docker compose start api
```

Pièces : `rclone copy offsite:imf-backups/uploads /var/lib/imf/uploads` puis `sudo chown -R 1000:1000 /var/lib/imf/uploads`.

### 9.4 Tester la restauration (une fois par trimestre)

```bash
docker run -d --name pg-test -e POSTGRES_PASSWORD=test postgres:16-alpine
sleep 5
docker exec -i pg-test createdb -U postgres test
docker exec -i pg-test pg_restore -U postgres -d test --no-owner < /var/backups/imf/db-AAAAMMJJ-0200.dump
docker exec pg-test psql -U postgres -d test -c 'SELECT count(*) FROM "Dossier";'
docker rm -f pg-test
```
---

## 10. Exploitation au quotidien

Toutes les commandes depuis `/opt/imf/deploy` (avec `COMPOSE_FILE` défini, §7.1).

| Besoin | Commande |
|---|---|
| État des services | `docker compose ps` |
| Logs de l'API en direct | `docker compose logs -f api` |
| Logs d'un déploiement raté | `docker compose logs --tail=200 migrate api` |
| Redémarrer l'API | `docker compose restart api` |
| Appliquer une modif de `.env` | `docker compose up -d api` |
| Console SQL | `docker compose exec postgres psql -U imf imf_credit` |
| État des migrations | `docker compose run --rm migrate npx prisma migrate status` |
| Espace disque | `df -h /` et `docker system df` |
| Libérer le cache de build | `docker builder prune -f --filter until=168h` |
| Taille des pièces | `sudo du -sh /var/lib/imf/uploads` |

Surveillance :

- **DigitalOcean › Monitoring › Alert policies** : CPU > 80 %, mémoire > 85 %, disque > 80 % pendant 5 min → e-mail.
- **Sonde externe** (UptimeRobot, Better Stack…, offre gratuite) sur `https://api.bisoubisou.cd/health` et `https://app.bisoubisou.cd`, toutes les 5 min.
- Certificats : renouvelés automatiquement par Caddy (rien à faire) ; Let's Encrypt écrit à `ACME_EMAIL` en cas de problème.
- Mises à jour de sécurité Ubuntu : automatiques ; redémarrer le Droplet quand `/var/run/reboot-required` existe (`sudo reboot`, les conteneurs repartent seuls).
- Si l'usage des pièces approche la capacité du disque : passer à un Volume DigitalOcean (monter sur `/var/lib/imf/uploads`) ou redimensionner le Droplet.

---

## 11. Dépannage

| Symptôme | Cause probable | Correctif |
|---|---|---|
| `api` redémarre en boucle, log `JWT_SECRET manquant…` | `JWT_SECRET` vide ou égal à la valeur de dev | Renseigner `deploy/.env`, `docker compose up -d api` |
| Log `WEB_ORIGIN requis` / `STORAGE_LOCAL_DIR requis` | Variable écrasée ou compose modifié | Vérifier la section `environment` du service `api` |
| `EACCES` à l'enregistrement d'une pièce | Droits sur `/var/lib/imf/uploads` | `sudo chown -R 1000:1000 /var/lib/imf/uploads` |
| Erreur CORS dans le navigateur | Origine absente de `WEB_ORIGIN` | Vérifier `APP_HOST` / `RECEPTION_HOST` (sans `https://`, sans `/` final), `docker compose up -d api` |
| Le front appelle `localhost:3001` | URL d'API figée au build avec une mauvaise valeur | Corriger `API_HOST`, puis `docker compose build --no-cache web caddy && docker compose up -d` |
| Certificat non obtenu (`docker compose logs caddy`) | DNS pas encore propagé, port 80 fermé, proxy Cloudflare, CAA, AAAA erroné | Voir §6 ; `docker compose restart caddy` une fois corrigé |
| `413 Request Entity Too Large` | Fichier > 30 Mo | Augmenter `max_size` dans le `Caddyfile` (et la limite côté API) |
| Build interrompu, code 137 | Mémoire insuffisante | Vérifier le swap (`free -h`), arrêter `web` pendant le build, ou passer à 8 Go |
| `npm ci` : module natif Linux introuvable (`@next/swc-linux-x64-gnu`, `lightningcss-linux-x64-gnu`…) | `package-lock.json` généré sous Windows sans les dépendances optionnelles Linux | Régénérer le lock (`npm install`) avec npm 11.19 et le committer ; en dernier recours, l'installer explicitement dans le Dockerfile |
| `migrate` en échec, `api` ne démarre pas | Migration invalide ou base injoignable | `docker compose logs migrate` ; `npx prisma migrate status` ; corriger puis redéployer |
| Avis IA jamais générés | Clé Anthropic absente/invalide, crédits épuisés, worker désactivé | `docker compose logs api`, vérifier `ANTHROPIC_API_KEY` et `ASSISTANT_WORKER_DISABLED` |
| Disque plein | Images et cache de build accumulés | `docker image prune -af`, `docker builder prune -af` |
| `deploy.sh` : `bash\r: No such file` | Script en fins de ligne Windows | `.gitattributes` (§3.4), puis `git add --renormalize .` et commit |

---

## 12. Checklist de mise en production

**Code**
- [ ] `next.config.ts` en `standalone` (§3.1)
- [ ] Seed de production sans comptes démo (§3.2)
- [ ] Swagger désactivé en production (§3.3)
- [ ] `.gitattributes`, `.dockerignore`, `deploy/`, workflow GitHub Actions committés et fusionnés dans `main`

**Infrastructure**
- [ ] Droplet 2 vCPU / 4 Go, Ubuntu 24.04, sauvegardes et monitoring activés
- [ ] Cloud Firewall : 22, 80, 443 seulement
- [ ] Connexion root et mots de passe SSH désactivés, `ufw`, `fail2ban`, mises à jour automatiques, swap
- [ ] Docker installé, utilisateur `deploy` dans le groupe `docker`
- [ ] Deploy key GitHub (lecture seule), dépôt cloné dans `/opt/imf`

**Domaine**
- [ ] Enregistrements A `app`, `api`, `reception` → IP du Droplet, sans AAAA parasite
- [ ] Résolution vérifiée avec `nslookup`

**Application**
- [ ] `deploy/.env` rempli, `chmod 600`, secrets sauvegardés dans un gestionnaire de mots de passe
- [ ] Migrations appliquées, seed de production exécuté, `SEED_ADMIN_PASSWORD` vidé
- [ ] HTTPS valide sur les trois sous-domaines
- [ ] Comptes réels créés, paramètres et manuels chargés
- [ ] Parcours test : réception → agent → analyste avec avis IA ; pièce conservée après redémarrage
- [ ] Port 5432 injoignable depuis l'extérieur

**Exploitation**
- [ ] Cron `backup.sh` à 02:00, copie hors site configurée, restauration testée
- [ ] Alertes DigitalOcean et sonde externe sur `/health`
- [ ] Secrets GitHub `DROPLET_HOST` / `DROPLET_SSH_KEY`, premier déploiement automatique réussi
- [ ] Retour arrière testé une fois (`deploy.sh <révision précédente>`)
