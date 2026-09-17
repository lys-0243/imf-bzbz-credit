-- CreateTable
CREATE TABLE "VisiteTerrain" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "checklistJson" JSONB,
    "rapportTexte" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisiteTerrain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisiteTerrain_dossierId_key" ON "VisiteTerrain"("dossierId");

-- CreateIndex
CREATE INDEX "VisiteTerrain_agentId_idx" ON "VisiteTerrain"("agentId");

-- CreateIndex
CREATE INDEX "Dossier_agentId_idx" ON "Dossier"("agentId");

-- AddForeignKey
ALTER TABLE "VisiteTerrain" ADD CONSTRAINT "VisiteTerrain_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
