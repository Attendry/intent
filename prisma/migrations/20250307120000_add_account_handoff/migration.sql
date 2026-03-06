-- CreateTable
CREATE TABLE "AccountHandoff" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checklist" TEXT,
    "handoffNotes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AccountHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountHandoff_companyId_idx" ON "AccountHandoff"("companyId");

-- CreateIndex
CREATE INDEX "AccountHandoff_fromUserId_idx" ON "AccountHandoff"("fromUserId");

-- CreateIndex
CREATE INDEX "AccountHandoff_toUserId_idx" ON "AccountHandoff"("toUserId");

-- CreateIndex
CREATE INDEX "AccountHandoff_status_idx" ON "AccountHandoff"("status");

-- AddForeignKey
ALTER TABLE "AccountHandoff" ADD CONSTRAINT "AccountHandoff_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHandoff" ADD CONSTRAINT "AccountHandoff_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHandoff" ADD CONSTRAINT "AccountHandoff_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
