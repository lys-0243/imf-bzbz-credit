import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { decouperManuel, KINSHASA_COMMUNES, KINSHASA_ZONES, sansAccents } from '@imf/shared';

const prisma = new PrismaClient();

type SeedProduit = {
  code: string;
  label: string;
  montantMin: number;
  montantMax: number;
  dureeMin: number;
  dureeMax: number;
  dureeUnite: 'MOIS' | 'SEMAINES';
  refPrefix: string;
  famille: 'SALAIRE' | 'ACTIVITE';
  sortOrder: number;
};

const SEED_PRODUITS: SeedProduit[] = [
  {
    code: 'AGR',
    label: 'Crédit AGR',
    montantMin: 100,
    montantMax: 300000,
    dureeMin: 2,
    dureeMax: 36,
    dureeUnite: 'MOIS',
    refPrefix: 'AGR',
    famille: 'ACTIVITE',
    sortOrder: 10,
  },
  {
    code: 'SALAIRE',
    label: 'Crédit salaire',
    montantMin: 100,
    montantMax: 80000,
    dureeMin: 2,
    dureeMax: 36,
    dureeUnite: 'MOIS',
    refPrefix: 'SAL',
    famille: 'SALAIRE',
    sortOrder: 20,
  },
  {
    code: 'PERSONNEL',
    label: 'Crédits au Personnel',
    montantMin: 100,
    montantMax: 15000,
    dureeMin: 2,
    dureeMax: 24,
    dureeUnite: 'MOIS',
    refPrefix: 'PER',
    famille: 'SALAIRE',
    sortOrder: 30,
  },
  {
    code: 'DARE_DARE',
    label: 'Crédit dare dare',
    montantMin: 100,
    montantMax: 10000,
    dureeMin: 1,
    dureeMax: 4,
    dureeUnite: 'SEMAINES',
    refPrefix: 'DDR',
    famille: 'ACTIVITE',
    sortOrder: 40,
  },
  {
    code: 'AUTO',
    label: 'Crédit Auto',
    montantMin: 1000,
    montantMax: 20000,
    dureeMin: 12,
    dureeMax: 24,
    dureeUnite: 'MOIS',
    refPrefix: 'AUT',
    famille: 'ACTIVITE',
    sortOrder: 50,
  },
  {
    code: 'CONSO_LIKELEMBA',
    label: 'Crédit Consommation Likelemba',
    montantMin: 500,
    montantMax: 10000,
    dureeMin: 1,
    dureeMax: 1,
    dureeUnite: 'MOIS',
    refPrefix: 'CLK',
    famille: 'ACTIVITE',
    sortOrder: 60,
  },
  {
    code: 'AGR_LIKELEMBA',
    label: 'Crédit AGR Likelemba',
    montantMin: 100,
    montantMax: 50000,
    dureeMin: 1,
    dureeMax: 12,
    dureeUnite: 'MOIS',
    refPrefix: 'ALK',
    famille: 'ACTIVITE',
    sortOrder: 70,
  },
  {
    code: 'PROJET',
    label: 'Crédit projet',
    montantMin: 100,
    montantMax: 80000,
    dureeMin: 2,
    dureeMax: 36,
    dureeUnite: 'MOIS',
    refPrefix: 'PRJ',
    famille: 'ACTIVITE',
    sortOrder: 80,
  },
  {
    code: 'LONG_TERME',
    label: 'Crédit à Long terme',
    montantMin: 50000,
    montantMax: 300000,
    dureeMin: 37,
    dureeMax: 60,
    dureeUnite: 'MOIS',
    refPrefix: 'LTM',
    famille: 'ACTIVITE',
    sortOrder: 90,
  },
];

type SeedUser = {
  email: string;
  password: string;
  displayName: string;
  role: Role;
  zoneCode?: string;
};

const SEED_USERS: SeedUser[] = [
  {
    email: 'jp.mukendi@imf.local',
    password: 'Mukendi1!',
    displayName: 'Jean-Pierre Mukendi',
    role: Role.AGENT,
    zoneCode: 'ZONE_A',
  },
  {
    email: 'g.tshibanda@imf.local',
    password: 'Tshibanda1!',
    displayName: 'Grace Tshibanda',
    role: Role.AGENT,
    zoneCode: 'ZONE_B',
  },
  {
    email: 'p.kabongo@imf.local',
    password: 'Kabongo1!',
    displayName: 'Patrick Kabongo',
    role: Role.AGENT,
    zoneCode: 'ZONE_C',
  },
  {
    email: 'n.ilunga@imf.local',
    password: 'Ilunga1!',
    displayName: 'Nadine Ilunga',
    role: Role.AGENT,
    zoneCode: 'ZONE_D',
  },
  {
    email: 'm.kalala@imf.local',
    password: 'Kalala1!',
    displayName: 'Marie Kalala',
    role: Role.RECEPTION,
  },
  {
    email: 'j.mbuyi@imf.local',
    password: 'Mbuyi1!',
    displayName: 'Joseph Mbuyi',
    role: Role.RECEPTION,
  },
  {
    email: 't.ngalula@imf.local',
    password: 'Ngalula1!',
    displayName: 'Thérèse Ngalula',
    role: Role.RECEPTION,
  },
  {
    email: 'r.mukeba@imf.local',
    password: 'Mukeba1!',
    displayName: 'Ruth Mukeba',
    role: Role.RESPONSABLE_CREDIT,
  },
  {
    email: 'c.mwamba@imf.local',
    password: 'Mwamba1!',
    displayName: 'Christian Mwamba',
    role: Role.ANALYSTE,
  },
  {
    email: 's.kasongo@imf.local',
    password: 'Kasongo1!',
    displayName: 'Sarah Kasongo',
    role: Role.ANALYSTE,
  },
  {
    email: 'm.lukusa@imf.local',
    password: 'Lukusa1!',
    displayName: 'Michel Lukusa',
    role: Role.ANALYSTE,
  },
  {
    email: 'e.kabeya@imf.local',
    password: 'Kabeya1!',
    displayName: 'Esther Kabeya',
    role: Role.CONFORMITE,
  },
  {
    email: 'a.ntumba@imf.local',
    password: 'Ntumba1!',
    displayName: 'André Ntumba',
    role: Role.CONFORMITE,
  },
  {
    email: 'c.mpiana@imf.local',
    password: 'Mpiana1!',
    displayName: 'Clarisse Mpiana',
    role: Role.CONFORMITE,
  },
  {
    email: 'd.kabila@imf.local',
    password: 'Kabila1!',
    displayName: 'Dieudonné Kabila',
    role: Role.DG,
  },
  {
    email: 'b.lumbala@imf.local',
    password: 'Lumbala1!',
    displayName: 'Bernadette Lumbala',
    role: Role.DGA,
  },
  {
    email: 'f.kalonji@imf.local',
    password: 'Kalonji1!',
    displayName: 'François Kalonji',
    role: Role.CA,
  },
  {
    email: 'v.mbombo@imf.local',
    password: 'Mbombo1!',
    displayName: 'Véronique Mbombo',
    role: Role.ADMIN,
  },
];

async function main() {
  for (const p of SEED_PRODUITS) {
    await prisma.produitCredit.upsert({
      where: { code: p.code },
      update: {
        label: p.label,
        montantMin: p.montantMin,
        montantMax: p.montantMax,
        dureeMin: p.dureeMin,
        dureeMax: p.dureeMax,
        dureeUnite: p.dureeUnite,
        refPrefix: p.refPrefix,
        famille: p.famille,
        sortOrder: p.sortOrder,
        actif: true,
      },
      create: p,
    });
  }

  for (const z of KINSHASA_ZONES) {
    await prisma.zone.upsert({
      where: { code: z.code },
      update: { name: z.name },
      create: { code: z.code, name: z.name },
    });
  }

  const zones = await prisma.zone.findMany();
  const zoneByCode = Object.fromEntries(zones.map((z) => [z.code, z]));

  for (const c of KINSHASA_COMMUNES) {
    await prisma.commune.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        zoneId: zoneByCode[c.zoneCode].id,
      },
      create: {
        code: c.code,
        name: c.name,
        zoneId: zoneByCode[c.zoneCode].id,
      },
    });
  }

  for (const u of SEED_USERS) {
    const email = u.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(u.password, 10);
    const zoneId = u.zoneCode ? zoneByCode[u.zoneCode]?.id ?? null : null;
    if (u.zoneCode && !zoneId) {
      throw new Error(`Zone introuvable pour ${u.email}: ${u.zoneCode}`);
    }
    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        displayName: u.displayName,
        role: u.role,
        zoneId,
        disabledAt: null,
      },
      create: {
        email,
        passwordHash,
        displayName: u.displayName,
        role: u.role,
        zoneId,
      },
    });
  }

  await seedManuelTest();

  console.log(
    `Seed OK — ${SEED_PRODUITS.length} produits, ${SEED_USERS.length} utilisateurs`,
  );
}

/**
 * Manuel FICTIF pour le développement du RAG de conformité. Il ne reflète ni
 * les procédures réelles de l'IMF ni la réglementation BCC : à remplacer par
 * les manuels officiels (Admin › Manuels).
 */
const MANUEL_TEST = `MANUEL DE PROCÉDURES DE CRÉDIT — VERSION DE TEST (NON OFFICIEL)
Ce document fictif sert uniquement aux essais de la plateforme.

CHAPITRE 1 - Dispositions générales
Article 1 : Champ d'application
Le présent manuel s'applique à toute demande de crédit instruite par l'institution, quel que soit le produit.

Article 2 : Identification du client
Toute demande doit comporter une pièce d'identité en cours de validité, une preuve d'adresse et une photo récente du demandeur. Le client ne doit pas figurer sur une liste noire.

CHAPITRE 2 - Instruction
Article 3 : Visite terrain
L'agent de crédit effectue une visite de l'activité et du domicile avant toute analyse. Le plan de route est joint au dossier.

Article 4 : Capacité de remboursement
La mensualité ne doit pas dépasser 40 % de la capacité de paiement mensuelle (DSR). Une capacité de paiement nulle ou négative entraîne le refus.

Article 5 : Garanties
Tout crédit doit être couvert par des garanties d'une valeur d'au moins 120 % du principal augmenté des intérêts. Une caution financière de 30 % du montant est exigée à l'octroi.

Article 6 : Taux et frais
Le taux applicable est celui de la grille en vigueur pour la tranche de montant. Les frais de dossier et de décaissement sont prélevés à l'octroi.

CHAPITRE 3 - Décision
Article 7 : Circuit d'approbation
Le dossier est contre-vérifié par l'analyste, contrôlé par la conformité, validé par le responsable crédit puis approuvé par la Direction générale. Les crédits supérieurs à 500 USD sont soumis à l'approbation du Conseil d'administration.

Article 8 : Parties liées
Les crédits accordés aux dirigeants, administrateurs et employés sont soumis à l'approbation du Conseil d'administration quel que soit le montant.
`;

async function seedManuelTest() {
  const titre = 'Manuel de crédit — TEST (non officiel)';
  const existe = await prisma.manuel.findFirst({ where: { titre } });
  if (existe) return;
  const sections = decouperManuel(MANUEL_TEST);
  await prisma.manuel.create({
    data: {
      titre,
      source: 'IMF',
      reference: 'TEST',
      version: '0.1-test',
      actif: true,
      nomFichier: 'manuel-test.txt',
      mimeType: 'text/plain',
      nbMots: MANUEL_TEST.split(/\s+/).filter(Boolean).length,
      sections: {
        create: sections.map((s) => ({
          ordre: s.ordre,
          numero: s.numero,
          titre: s.titre,
          contenu: s.contenu,
          titreRecherche: sansAccents(`${s.numero} ${s.titre}`),
          contenuRecherche: sansAccents(s.contenu),
        })),
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
