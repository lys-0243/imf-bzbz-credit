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

| Rôle | Nom | Email | Mot de passe | Zone |
|------|-----|-------|--------------|------|
| AGENT | Jean-Pierre Mukendi | `jp.mukendi@imf.local` | `Mukendi1!` | ZONE_A |
| AGENT | Grace Tshibanda | `g.tshibanda@imf.local` | `Tshibanda1!` | ZONE_B |
| AGENT | Patrick Kabongo | `p.kabongo@imf.local` | `Kabongo1!` | ZONE_C |
| AGENT | Nadine Ilunga | `n.ilunga@imf.local` | `Ilunga1!` | ZONE_D |
| RECEPTION | Marie Kalala | `m.kalala@imf.local` | `Kalala1!` | — |
| RECEPTION | Joseph Mbuyi | `j.mbuyi@imf.local` | `Mbuyi1!` | — |
| RECEPTION | Thérèse Ngalula | `t.ngalula@imf.local` | `Ngalula1!` | — |
| ANALYSTE | Christian Mwamba | `c.mwamba@imf.local` | `Mwamba1!` | — |
| ANALYSTE | Sarah Kasongo | `s.kasongo@imf.local` | `Kasongo1!` | — |
| ANALYSTE | Michel Lukusa | `m.lukusa@imf.local` | `Lukusa1!` | — |
| CONFORMITE | Esther Kabeya | `e.kabeya@imf.local` | `Kabeya1!` | — |
| CONFORMITE | André Ntumba | `a.ntumba@imf.local` | `Ntumba1!` | — |
| CONFORMITE | Clarisse Mpiana | `c.mpiana@imf.local` | `Mpiana1!` | — |
| DG | Dieudonné Kabila | `d.kabila@imf.local` | `Kabila1!` | — |
| ADMIN | Véronique Mbombo | `v.mbombo@imf.local` | `Mbombo1!` | — |

- API : http://localhost:3001/health  
- Swagger : http://localhost:3001/api  
- Web : http://localhost:3000 (login agent → `/agent`, analyste → `/analyste`, admin → `/admin`)
- Mobile : Expo (émulateur Android → API `http://10.0.2.2:3001` ; appareil → IP LAN via `EXPO_PUBLIC_API_URL`)

## Flux agent (web)

1. Connexion agent (`jp.mukendi@imf.local`)
2. Inbox `/agent` — dossiers `AFFECTE` / `DESCENTE` / `RETOUR_AGENT`
3. Démarrer la descente, renseigner checklist + uploads, résumé exécutif
4. Soumettre → dossier passe `RAPPORT_AGENT` → `SCORING` (stub) → `ANALYSTE`
5. Connexion analyste → inbox `/analyste` (lecture seule)
