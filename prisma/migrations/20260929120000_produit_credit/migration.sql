-- CreateEnum
CREATE TYPE "DureeUnite" AS ENUM ('MOIS', 'SEMAINES');

-- CreateEnum
CREATE TYPE "FamilleProduit" AS ENUM ('SALAIRE', 'ACTIVITE');

-- CreateTable
CREATE TABLE "ProduitCredit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "montantMin" DOUBLE PRECISION NOT NULL,
    "montantMax" DOUBLE PRECISION NOT NULL,
    "dureeMin" INTEGER NOT NULL,
    "dureeMax" INTEGER NOT NULL,
    "dureeUnite" "DureeUnite" NOT NULL,
    "refPrefix" TEXT NOT NULL,
    "famille" "FamilleProduit" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProduitCredit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProduitCredit_code_key" ON "ProduitCredit"("code");
CREATE INDEX "ProduitCredit_actif_sortOrder_idx" ON "ProduitCredit"("actif", "sortOrder");

-- Seed products (fixed ids for backfill)
INSERT INTO "ProduitCredit" ("id", "code", "label", "montantMin", "montantMax", "dureeMin", "dureeMax", "dureeUnite", "refPrefix", "famille", "actif", "sortOrder", "createdAt", "updatedAt") VALUES
('prod_agr', 'AGR', 'Crédit AGR', 100, 300000, 2, 36, 'MOIS', 'AGR', 'ACTIVITE', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('prod_salaire', 'SALAIRE', 'Crédit salaire', 100, 80000, 2, 36, 'MOIS', 'SAL', 'SALAIRE', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('prod_personnel', 'PERSONNEL', 'Crédits au Personnel', 100, 15000, 2, 24, 'MOIS', 'PER', 'SALAIRE', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('prod_dare_dare', 'DARE_DARE', 'Crédit dare dare', 100, 10000, 1, 4, 'SEMAINES', 'DDR', 'ACTIVITE', true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('prod_auto', 'AUTO', 'Crédit Auto', 1000, 20000, 12, 24, 'MOIS', 'AUT', 'ACTIVITE', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('prod_conso_likelemba', 'CONSO_LIKELEMBA', 'Crédit Consommation Likelemba', 500, 10000, 1, 1, 'MOIS', 'CLK', 'ACTIVITE', true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('prod_agr_likelemba', 'AGR_LIKELEMBA', 'Crédit AGR Likelemba', 100, 50000, 1, 12, 'MOIS', 'ALK', 'ACTIVITE', true, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('prod_projet', 'PROJET', 'Crédit projet', 100, 80000, 2, 36, 'MOIS', 'PRJ', 'ACTIVITE', true, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('prod_long_terme', 'LONG_TERME', 'Crédit à Long terme', 50000, 300000, 37, 60, 'MOIS', 'LTM', 'ACTIVITE', true, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add produitId (nullable first for backfill)
ALTER TABLE "Dossier" ADD COLUMN "produitId" TEXT;

UPDATE "Dossier" SET "produitId" = 'prod_salaire' WHERE "type" = 'SALAIRE';
UPDATE "Dossier" SET "produitId" = 'prod_dare_dare' WHERE "type" = 'DARE_DARE';
UPDATE "Dossier" SET "produitId" = 'prod_agr' WHERE "type" = 'INDIVIDUEL';

ALTER TABLE "Dossier" ALTER COLUMN "produitId" SET NOT NULL;

ALTER TABLE "Dossier" DROP COLUMN "type";

DROP TYPE "CreditType";

CREATE INDEX "Dossier_produitId_idx" ON "Dossier"("produitId");

ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ProduitCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
