# Plateforme crédit IMF Bisou Bisou

Monorepo : API NestJS, back-office Next.js (placeholder), app mobile Expo.

## Prérequis

Node 20+, PostgreSQL locale `bizoubizou` (user `postgres`).

## Démarrage

```bash
copy .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev:api
npm run dev:mobile
```

Comptes seed :

- `reception@imf.local` / `Reception1!`
- `agent.a@imf.local` … `agent.e@imf.local` / `Agent1!`

- API : http://localhost:3001/health  
- Swagger : http://localhost:3001/api  
- Mobile : Expo (émulateur Android → API `http://10.0.2.2:3001` ; appareil → IP LAN via `EXPO_PUBLIC_API_URL`)
