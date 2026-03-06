-- CreateTable
CREATE TABLE "AccountCollaborator" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "invitedBy" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "AccountCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountCollaborator_companyId_userId_key" ON "AccountCollaborator"("companyId", "userId");

-- CreateIndex
CREATE INDEX "AccountCollaborator_companyId_idx" ON "AccountCollaborator"("companyId");

-- CreateIndex
CREATE INDEX "AccountCollaborator_userId_idx" ON "AccountCollaborator"("userId");

-- AddForeignKey
ALTER TABLE "AccountCollaborator" ADD CONSTRAINT "AccountCollaborator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCollaborator" ADD CONSTRAINT "AccountCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCollaborator" ADD CONSTRAINT "AccountCollaborator_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
