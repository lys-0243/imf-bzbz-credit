-- CreateEnum
CREATE TYPE "EtapeWorkflow" AS ENUM ('AFFECTATION', 'AGENT', 'ANALYSE', 'CONFORMITE', 'VALIDATION_RC', 'DIRECTION', 'CONSEIL');

-- CreateEnum
CREATE TYPE "TypeAvisIa" AS ENUM ('SUGGESTION_AGENTS', 'PRECONTROLE', 'ANALYSE', 'CONFORMITE', 'SYNTHESE_RC', 'SYNTHESE_DIRECTION', 'SYNTHESE_CONSEIL');

-- CreateEnum
CREATE TYPE "StatutAvisIa" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'PRET', 'ECHEC');

-- CreateEnum
CREATE TYPE "SourceManuel" AS ENUM ('IMF', 'BCC');

-- CreateEnum
CREATE TYPE "StatutCbsEnvoi" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ECHEC');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FormulaireCode" ADD VALUE 'RAPPORT_ANALYSE';
ALTER TYPE "FormulaireCode" ADD VALUE 'AVIS_CONFORMITE';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DGA';

-- AlterTable
ALTER TABLE "DecisionHumaine" ADD COLUMN     "avisIaId" TEXT,
ADD COLUMN     "etape" "EtapeWorkflow";

-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN     "analysteId" TEXT,
ADD COLUMN     "conformiteId" TEXT,
ADD COLUMN     "etatDepuis" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Transition" ADD COLUMN     "details" JSONB;

-- CreateTable
CREATE TABLE "AvisIa" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "type" "TypeAvisIa" NOT NULL,
    "etape" "EtapeWorkflow" NOT NULL,
    "statut" "StatutAvisIa" NOT NULL DEFAULT 'EN_ATTENTE',
    "source" "PronosticSource",
    "modele" TEXT,
    "entreeHash" TEXT,
    "contenu" JSONB,
    "sources" JSONB,
    "erreurIa" TEXT,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisIa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manuel" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "source" "SourceManuel" NOT NULL,
    "reference" TEXT,
    "version" TEXT NOT NULL,
    "dateEffet" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "blobPath" TEXT,
    "mimeType" TEXT,
    "nomFichier" TEXT,
    "nbMots" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManuelSection" (
    "id" TEXT NOT NULL,
    "manuelId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "numero" TEXT NOT NULL DEFAULT '',
    "titre" TEXT NOT NULL DEFAULT '',
    "contenu" TEXT NOT NULL,
    "titreRecherche" TEXT NOT NULL DEFAULT '',
    "contenuRecherche" TEXT NOT NULL DEFAULT '',
    -- Accents retirés par l'application (pas d'extension unaccent requise).
    "tsv" tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('french'::regconfig, coalesce("titreRecherche", '')), 'A') ||
      setweight(to_tsvector('french'::regconfig, coalesce("contenuRecherche", '')), 'B')
    ) STORED,

    CONSTRAINT "ManuelSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbsEnvoi" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statut" "StatutCbsEnvoi" NOT NULL DEFAULT 'EN_ATTENTE',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "dernierMessage" TEXT,
    "prochainEssaiAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbsEnvoi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvisIa_dossierId_type_createdAt_idx" ON "AvisIa"("dossierId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AvisIa_statut_idx" ON "AvisIa"("statut");

-- CreateIndex
CREATE INDEX "Manuel_actif_idx" ON "Manuel"("actif");

-- CreateIndex
CREATE INDEX "ManuelSection_manuelId_ordre_idx" ON "ManuelSection"("manuelId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "CbsEnvoi_idempotencyKey_key" ON "CbsEnvoi"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CbsEnvoi_statut_prochainEssaiAt_idx" ON "CbsEnvoi"("statut", "prochainEssaiAt");

-- CreateIndex
CREATE INDEX "CbsEnvoi_dossierId_idx" ON "CbsEnvoi"("dossierId");

-- CreateIndex
CREATE INDEX "DecisionHumaine_avisIaId_idx" ON "DecisionHumaine"("avisIaId");

-- CreateIndex
CREATE INDEX "Dossier_analysteId_idx" ON "Dossier"("analysteId");

-- CreateIndex
CREATE INDEX "Dossier_conformiteId_idx" ON "Dossier"("conformiteId");

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_analysteId_fkey" FOREIGN KEY ("analysteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_conformiteId_fkey" FOREIGN KEY ("conformiteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionHumaine" ADD CONSTRAINT "DecisionHumaine_avisIaId_fkey" FOREIGN KEY ("avisIaId") REFERENCES "AvisIa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisIa" ADD CONSTRAINT "AvisIa_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManuelSection" ADD CONSTRAINT "ManuelSection_manuelId_fkey" FOREIGN KEY ("manuelId") REFERENCES "Manuel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbsEnvoi" ADD CONSTRAINT "CbsEnvoi_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index plein texte
CREATE INDEX "ManuelSection_tsv_idx" ON "ManuelSection" USING GIN ("tsv");

-- Reprise : l'ancienne validation RC (avant analyse) devient la validation finale.
-- Les dossiers qui y attendaient n'ont pas encore été analysés : ils passent à l'analyste.
UPDATE "Dossier" SET "etat" = 'ANALYSTE' WHERE "etat" = 'EN_ATTENTE_VALIDATION_RC';
UPDATE "Dossier" SET "etatDepuis" = "updatedAt";
