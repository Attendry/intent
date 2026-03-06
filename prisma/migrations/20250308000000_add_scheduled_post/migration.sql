-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'linkedin',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "firstComment" TEXT,
    "prospectIds" TEXT,
    "seriesId" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPost_userId_idx" ON "ScheduledPost"("userId");

-- CreateIndex
CREATE INDEX "ScheduledPost_scheduledAt_idx" ON "ScheduledPost"("scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledPost_status_idx" ON "ScheduledPost"("status");

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
