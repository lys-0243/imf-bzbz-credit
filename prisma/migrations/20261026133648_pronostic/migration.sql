-- CreateEnum
CREATE TYPE "PronosticRecommandation" AS ENUM ('ACCORD', 'ACCORD_CONDITIONNEL', 'REFUS');

-- CreateEnum
CREATE TYPE "PronosticSource" AS ENUM ('IA', 'REGLES');

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "entityType" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Pronostic" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "moteurVersion" TEXT NOT NULL,
    "source" "PronosticSource" NOT NULL,
    "modele" TEXT,
    "facts" JSONB NOT NULL,
    "avis" JSONB NOT NULL,
    "recommandation" "PronosticRecommandation" NOT NULL,
    "montantSuggere" DOUBLE PRECISION,
    "ajuste" BOOLEAN NOT NULL DEFAULT false,
    "erreurIa" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pronostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionHumaine" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "pronosticId" TEXT,
    "actorId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "recommandation" "PronosticRecommandation" NOT NULL,
    "montantRetenu" DOUBLE PRECISION,
    "dureeRetenueMois" INTEGER,
    "accordAvecIa" BOOLEAN,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionHumaine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pronostic_dossierId_createdAt_idx" ON "Pronostic"("dossierId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionHumaine_dossierId_idx" ON "DecisionHumaine"("dossierId");

-- CreateIndex
CREATE INDEX "DecisionHumaine_pronosticId_idx" ON "DecisionHumaine"("pronosticId");

-- AddForeignKey
ALTER TABLE "Pronostic" ADD CONSTRAINT "Pronostic_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionHumaine" ADD CONSTRAINT "DecisionHumaine_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionHumaine" ADD CONSTRAINT "DecisionHumaine_pronosticId_fkey" FOREIGN KEY ("pronosticId") REFERENCES "Pronostic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionHumaine" ADD CONSTRAINT "DecisionHumaine_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
