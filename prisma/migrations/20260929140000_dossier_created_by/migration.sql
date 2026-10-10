-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN "createdById" TEXT;

-- Backfill from DOSSIER_CREATED audit logs
UPDATE "Dossier" d
SET "createdById" = a."actorId"
FROM "AuditLog" a
WHERE a."dossierId" = d."id"
  AND a."action" = 'DOSSIER_CREATED'
  AND a."actorId" IS NOT NULL
  AND d."createdById" IS NULL;

-- Fallback: first transition actor
UPDATE "Dossier" d
SET "createdById" = t."actorId"
FROM (
  SELECT DISTINCT ON ("dossierId") "dossierId", "actorId"
  FROM "Transition"
  ORDER BY "dossierId", "createdAt" ASC
) t
WHERE t."dossierId" = d."id"
  AND d."createdById" IS NULL;

-- CreateIndex
CREATE INDEX "Dossier_createdById_idx" ON "Dossier"("createdById");

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
