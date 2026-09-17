-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RECEPTION', 'AGENT', 'ANALYSTE', 'CONFORMITE', 'DG', 'CA', 'ADMIN');

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('SALAIRE', 'INDIVIDUEL', 'DARE_DARE');

-- CreateEnum
CREATE TYPE "DossierEtat" AS ENUM ('ENREGISTRE', 'AFFECTE', 'DESCENTE', 'RAPPORT_AGENT', 'SCORING', 'ANALYSTE', 'RETOUR_AGENT', 'CONFORMITE', 'RETOUR_ANALYSTE', 'DIRECTION', 'CONSEIL', 'A_DECAISSER', 'REJETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "entraObjectId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "activityAddress" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "CreditType" NOT NULL,
    "etat" "DossierEtat" NOT NULL DEFAULT 'ENREGISTRE',
    "payload" JSONB NOT NULL,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT,
    "agentValideAt" TIMESTAMP(3),
    "scoreValue" INTEGER,
    "scoreReasons" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transition" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "fromEtat" "DossierEtat",
    "toEtat" "DossierEtat" NOT NULL,
    "comment" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piece" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_entraObjectId_key" ON "User"("entraObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "Client_fullName_idx" ON "Client"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Dossier_reference_key" ON "Dossier"("reference");

-- CreateIndex
CREATE INDEX "Dossier_reference_idx" ON "Dossier"("reference");

-- CreateIndex
CREATE INDEX "Dossier_etat_idx" ON "Dossier"("etat");

-- CreateIndex
CREATE INDEX "Transition_dossierId_idx" ON "Transition"("dossierId");

-- CreateIndex
CREATE INDEX "AuditLog_dossierId_idx" ON "AuditLog"("dossierId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transition" ADD CONSTRAINT "Transition_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
