-- AlterTable CompanyIntel: add createdById
ALTER TABLE "CompanyIntel" ADD COLUMN "createdById" TEXT;

-- CreateTable FindingShare
CREATE TABLE "FindingShare" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "sharedWithId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,
    "shareType" TEXT NOT NULL DEFAULT 'fyi',

    CONSTRAINT "FindingShare_pkey" PRIMARY KEY ("id")
);

-- AlterTable SavedFinding: add createdById
ALTER TABLE "SavedFinding" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FindingShare_findingId_sharedWithId_key" ON "FindingShare"("findingId", "sharedWithId");

-- CreateIndex
CREATE INDEX "FindingShare_findingId_idx" ON "FindingShare"("findingId");

-- CreateIndex
CREATE INDEX "FindingShare_sharedWithId_idx" ON "FindingShare"("sharedWithId");

-- AddForeignKey
ALTER TABLE "CompanyIntel" ADD CONSTRAINT "CompanyIntel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingShare" ADD CONSTRAINT "FindingShare_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "SavedFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingShare" ADD CONSTRAINT "FindingShare_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingShare" ADD CONSTRAINT "FindingShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFinding" ADD CONSTRAINT "SavedFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
