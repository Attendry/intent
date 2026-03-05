-- CreateTable
CREATE TABLE "KnowledgeFragment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "prospectId" TEXT,
    "type" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeFragment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeFragment_userId_idx" ON "KnowledgeFragment"("userId");

-- CreateIndex
CREATE INDEX "KnowledgeFragment_companyId_idx" ON "KnowledgeFragment"("companyId");

-- CreateIndex
CREATE INDEX "KnowledgeFragment_prospectId_idx" ON "KnowledgeFragment"("prospectId");

-- CreateIndex
CREATE INDEX "KnowledgeFragment_type_idx" ON "KnowledgeFragment"("type");

-- CreateIndex
CREATE INDEX "KnowledgeFragment_status_idx" ON "KnowledgeFragment"("status");

-- CreateIndex
CREATE INDEX "KnowledgeFragment_createdAt_idx" ON "KnowledgeFragment"("createdAt");

-- AddForeignKey
ALTER TABLE "KnowledgeFragment" ADD CONSTRAINT "KnowledgeFragment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeFragment" ADD CONSTRAINT "KnowledgeFragment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeFragment" ADD CONSTRAINT "KnowledgeFragment_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
