# Plateforme crédit IMF Bisou Bisou

Monorepo : API NestJS, back-office Next.js, app mobile Expo.

## Prérequis

Node 20+, PostgreSQL locale `bizoubizou` (user `postgres`).

## Démarrage

```bash
copy .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Comptes seed :

- `reception@imf.local` / `Reception1!`
- `agent.a@imf.local` … `agent.e@imf.local` / `Agent1!`
- `analyste@imf.local` / `Analyste1!`

- API : http://localhost:3001/health  
- Swagger : http://localhost:3001/api  
- Web : http://localhost:3000 (login agent → `/agent`, analyste → `/analyste`)
- Mobile : Expo (émulateur Android → API `http://10.0.2.2:3001` ; appareil → IP LAN via `EXPO_PUBLIC_API_URL`)

## Flux agent (web)

1. Connexion agent (`agent.a@imf.local`)
2. Inbox `/agent` — dossiers `AFFECTE` / `DESCENTE` / `RETOUR_AGENT`
3. Démarrer la descente, renseigner checklist + uploads, résumé exécutif
4. Soumettre → dossier passe `RAPPORT_AGENT` → `SCORING` (stub) → `ANALYSTE`
5. Connexion analyste → inbox `/analyste` (lecture seule)
