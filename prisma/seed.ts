import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { KINSHASA_COMMUNES, KINSHASA_ZONES } from '@imf/shared';

const prisma = new PrismaClient();

async function main() {
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

  const receptionHash = await bcrypt.hash('Reception1!', 10);
  await prisma.user.upsert({
    where: { email: 'reception@imf.local' },
    update: {
      passwordHash: receptionHash,
      displayName: 'Réception IMF',
      role: Role.RECEPTION,
      zoneId: null,
    },
    create: {
      email: 'reception@imf.local',
      passwordHash: receptionHash,
      displayName: 'Réception IMF',
      role: Role.RECEPTION,
    },
  });

  const agentHash = await bcrypt.hash('Agent1!', 10);
  for (const z of KINSHASA_ZONES) {
    const email = `agent.${z.code.slice(-1).toLowerCase()}@imf.local`;
    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: agentHash,
        displayName: `Agent ${z.name}`,
        role: Role.AGENT,
        zoneId: zoneByCode[z.code].id,
      },
      create: {
        email,
        passwordHash: agentHash,
        displayName: `Agent ${z.name}`,
        role: Role.AGENT,
        zoneId: zoneByCode[z.code].id,
      },
    });
  }

  const analysteHash = await bcrypt.hash('Analyste1!', 10);
  await prisma.user.upsert({
    where: { email: 'analyste@imf.local' },
    update: {
      passwordHash: analysteHash,
      displayName: 'Analyste crédit',
      role: Role.ANALYSTE,
      zoneId: null,
    },
    create: {
      email: 'analyste@imf.local',
      passwordHash: analysteHash,
      displayName: 'Analyste crédit',
      role: Role.ANALYSTE,
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
