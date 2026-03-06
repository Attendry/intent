-- CreateTable
CREATE TABLE "AccountActivityLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountActivityLog_companyId_idx" ON "AccountActivityLog"("companyId");

-- CreateIndex
CREATE INDEX "AccountActivityLog_userId_idx" ON "AccountActivityLog"("userId");

-- CreateIndex
CREATE INDEX "AccountActivityLog_createdAt_idx" ON "AccountActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AccountActivityLog" ADD CONSTRAINT "AccountActivityLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountActivityLog" ADD CONSTRAINT "AccountActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
