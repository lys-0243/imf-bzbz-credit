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
