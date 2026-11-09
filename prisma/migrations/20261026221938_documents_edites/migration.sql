-- CreateEnum
CREATE TYPE "DocumentEditable" AS ENUM ('LETTRE', 'CONTRAT', 'GAGE', 'CAUTION');

-- CreateTable
CREATE TABLE "DocumentEdite" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "doc" "DocumentEditable" NOT NULL,
    "contenuHtml" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentEdite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEdite_dossierId_doc_key" ON "DocumentEdite"("dossierId", "doc");

-- AddForeignKey
ALTER TABLE "DocumentEdite" ADD CONSTRAINT "DocumentEdite_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
