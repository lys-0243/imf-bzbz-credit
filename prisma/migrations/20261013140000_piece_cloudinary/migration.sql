-- AlterTable
ALTER TABLE "Piece" ADD COLUMN "url" TEXT;
ALTER TABLE "Piece" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "Piece" ADD COLUMN "bytes" INTEGER;
ALTER TABLE "Piece" ADD COLUMN "originalName" TEXT;

-- CreateIndex
CREATE INDEX "Piece_dossierId_kind_idx" ON "Piece"("dossierId", "kind");
