import {
  DureeUnite,
  FamilleProduit,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { KINSHASA_COMMUNES, KINSHASA_ZONES } from '@imf/shared';

const prisma = new PrismaClient();

const SEED_PRODUITS: Array<{
  code: string;
  label: string;
  montantMin: number;
  montantMax: number;
  dureeMin: number;
  dureeMax: number;
  dureeUnite: DureeUnite;
  refPrefix: string;
  famille: FamilleProduit;
  sortOrder: number;
}> = [
  {
    code: 'AGR',
    label: 'Crédit AGR',
    montantMin: 100,
    montantMax: 300000,
    dureeMin: 2,
    dureeMax: 36,
    dureeUnite: DureeUnite.MOIS,
    refPrefix: 'AGR',
    famille: FamilleProduit.ACTIVITE,
    sortOrder: 10,
  },
  {
    code: 'SALAIRE',
    label: 'Crédit salaire',
    montantMin: 100,
    montantMax: 80000,
    dureeMin: 2,
    dureeMax: 36,
    dureeUnite: DureeUnite.MOIS,
    refPrefix: 'SAL',
    famille: FamilleProduit.SALAIRE,
    sortOrder: 20,
  },
  {
    code: 'PERSONNEL',
    label: 'Crédits au Personnel',
    montantMin: 100,
    montantMax: 15000,
    dureeMin: 2,
    dureeMax: 24,
    dureeUnite: DureeUnite.MOIS,
    refPrefix: 'PER',
    famille: FamilleProduit.SALAIRE,
    sortOrder: 30,
  },
  {
    code: 'DARE_DARE',
    label: 'Crédit dare dare',
    montantMin: 100,
    montantMax: 10000,
    dureeMin: 1,
    dureeMax: 4,
    dureeUnite: DureeUnite.SEMAINES,
    refPrefix: 'DDR',
    famille: FamilleProduit.ACTIVITE,
    sortOrder: 40,
  },
  {
    code: 'AUTO',
    label: 'Crédit Auto',
    montantMin: 1000,
    montantMax: 20000,
    dureeMin: 12,
    dureeMax: 24,
    dureeUnite: DureeUnite.MOIS,
    refPrefix: 'AUT',
    famille: FamilleProduit.ACTIVITE,
    sortOrder: 50,
  },
  {
    code: 'CONSO_LIKELEMBA',
    label: 'Crédit Consommation Likelemba',
    montantMin: 500,
    montantMax: 10000,
    dureeMin: 1,
    dureeMax: 1,
    dureeUnite: DureeUnite.MOIS,
    refPrefix: 'CLK',
    famille: FamilleProduit.ACTIVITE,
    sortOrder: 60,
  },
  {
    code: 'AGR_LIKELEMBA',
    label: 'Crédit AGR Likelemba',
    montantMin: 100,
    montantMax: 50000,
    dureeMin: 1,
    dureeMax: 12,
    dureeUnite: DureeUnite.MOIS,
    refPrefix: 'ALK',
    famille: FamilleProduit.ACTIVITE,
    sortOrder: 70,
  },
  {
    code: 'PROJET',
    label: 'Crédit projet',
    montantMin: 100,
    montantMax: 80000,
    dureeMin: 2,
    dureeMax: 36,
    dureeUnite: DureeUnite.MOIS,
    refPrefix: 'PRJ',
    famille: FamilleProduit.ACTIVITE,
    sortOrder: 80,
  },
  {
    code: 'LONG_TERME',
    label: 'Crédit à Long terme',
    montantMin: 50000,
    montantMax: 300000,
    dureeMin: 37,
    dureeMax: 60,
    dureeUnite: DureeUnite.MOIS,
    refPrefix: 'LTM',
    famille: FamilleProduit.ACTIVITE,
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
    const passwordHash = await bcrypt.hash(u.password, 10);
    const zoneId = u.zoneCode ? zoneByCode[u.zoneCode].id : null;
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        displayName: u.displayName,
        role: u.role,
        zoneId,
      },
      create: {
        email: u.email,
        passwordHash,
        displayName: u.displayName,
        role: u.role,
        zoneId,
      },
    });
  }
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
