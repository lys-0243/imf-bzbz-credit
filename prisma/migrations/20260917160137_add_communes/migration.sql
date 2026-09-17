-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "communeId" TEXT;

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commune_code_key" ON "Commune"("code");

-- CreateIndex
CREATE INDEX "Commune_zoneId_idx" ON "Commune"("zoneId");

-- CreateIndex
CREATE INDEX "Client_communeId_idx" ON "Client"("communeId");

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;
