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
npm run dev:mobile-web   # même app, dans le navigateur
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
| RESPONSABLE_CREDIT | Ruth Mukeba | `r.mukeba@imf.local` | `Mukeba1!` | — |
| DG | Dieudonné Kabila | `d.kabila@imf.local` | `Kabila1!` | — |
| DGA | Bernadette Lumbala | `b.lumbala@imf.local` | `Lumbala1!` | — |
| CA | François Kalonji | `f.kalonji@imf.local` | `Kalonji1!` | — |
| ADMIN | Véronique Mbombo | `v.mbombo@imf.local` | `Mbombo1!` | — |

- API : http://localhost:3001/health  
- Swagger : http://localhost:3001/api  
- Web : http://localhost:3000 (agent → `/agent`, RC → `/responsable-credit`, analyste → `/analyste`, conformité → `/conformite`, DG / DGA / CA → `/direction`, admin → `/admin`)
- Mobile : Expo (émulateur Android → API `http://10.0.2.2:3001` ; appareil → IP LAN via `EXPO_PUBLIC_API_URL`)
- Réception web : http://localhost:8081 (app mobile compilée pour le navigateur ; API sur le même hôte que la page, port 3001, ou `EXPO_PUBLIC_WEB_API_URL`). L'origine doit figurer dans `WEB_ORIGIN`.

## Réception web (production)

```bash
EXPO_PUBLIC_WEB_API_URL=https://api.example.com npm run build:web -w @imf/mobile
```

Servir `apps/mobile/dist` en statique (fallback SPA vers `index.html`), ajouter son domaine à `WEB_ORIGIN` côté API et renseigner `NEXT_PUBLIC_RECEPTION_URL` pour le lien depuis le back-office.

## Circuit du crédit

Chaque étape est assistée par l’IA (Claude) et **validée par un humain** : aucune transition n’est déclenchée par l’IA, chaque écart avec son avis est justifié et tracé (`DecisionHumaine.accordAvecIa`).

| Étape | Qui | Assistance IA | Décision humaine |
|---|---|---|---|
| Réception | Réception (app mobile / web) | — | Enregistre la demande |
| Attribution | Responsable crédit | Agents classés (zone, commune, charge, retours, délais) | Choisit l’agent |
| Terrain | Agent de crédit | Résumé, pronostic et montant, pré-contrôle | Remplit, ajuste, soumet à l’analyste |
| Analyse | Analyste (file commune + prise en charge) | Contre-vérification, score proposé, brouillon de rapport | Valide le score et le rapport, ou renvoie à l’agent |
| Conformité | Agent de conformité | Évaluation RAG sur les manuels IMF / BCC avec citations | Conforme → RC, ou retour à l’analyste |
| Validation finale | Responsable crédit | Synthèse du parcours et contrôles | Transmet à la DG, renvoie à n’importe quelle étape, ou rejette |
| Décision | DG ou DGA | Note de décision, pré-remplissage du PV | Approuve (≤ 500 $ : clôturé ; > 500 $ : Conseil), renvoie au RC, rejette |
| Conseil | Conseil d’administration | Note pour le Conseil | Approuve ou rejette |
| Core banking | Plateforme | — | Envoi automatique avec reprise (Admin › Envois CBS) |

- Machine d’états : `packages/shared/src/workflow.ts` (source unique API + web).
- Score de crédit : `packages/shared/src/scoreCredit.ts` (piliers pondérés, critères éliminatoires, grille dans Admin › Paramètres).
- Avis IA : préparés en arrière-plan dès l’entrée d’un dossier dans une étape (`apps/api/src/modules/assistant`). Sans `ANTHROPIC_API_KEY`, des avis par règles prennent le relais.
- Manuels (RAG) : Admin › Manuels (PDF texte, DOCX, TXT), recherche plein texte Postgres (`french`, accents retirés par l’application, sans extension).
- Seuil du Conseil et taux de change CDF/USD : Admin › Paramètres.

Raccourcis du poste de décision : `Ctrl K` (palette), `/` (recherche), `j` / `k` / `Entrée` (file).

## Flux agent (web)

1. Connexion agent (`jp.mukendi@imf.local`)
2. Inbox `/agent` — dossiers `AFFECTE` / `DESCENTE` / `RETOUR_AGENT` (les points à corriger d’un retour s’affichent dans « ↺ Points à corriger »)
3. Renseigner checklist, CF1 / CF2, pièces, résumé exécutif ; lancer le « ✦ Pré-contrôle IA »
4. Générer le pronostic, valider le montant, soumettre → le dossier passe à l’analyse
