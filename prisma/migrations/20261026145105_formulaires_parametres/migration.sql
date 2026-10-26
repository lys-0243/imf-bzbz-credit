-- CreateEnum
CREATE TYPE "FormulaireCode" AS ENUM ('CF3', 'CF4', 'CF5_1_DEMANDEUR', 'CF5_1_GARANT', 'CF6_1', 'PLAN_ROUTE', 'HISTORIQUE', 'PRE_COMITE', 'DECISION_COMITE', 'APPRO_PCA', 'CF8');

-- CreateTable
CREATE TABLE "DossierFormulaire" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "code" "FormulaireCode" NOT NULL,
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierFormulaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametresImf" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametresImf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DossierFormulaire_dossierId_code_key" ON "DossierFormulaire"("dossierId", "code");

-- AddForeignKey
ALTER TABLE "DossierFormulaire" ADD CONSTRAINT "DossierFormulaire_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
