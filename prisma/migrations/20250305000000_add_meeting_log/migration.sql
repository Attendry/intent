-- CreateTable
CREATE TABLE "MeetingLog" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notes" TEXT,
    "summary" TEXT,
    "actionItems" TEXT,
    "suggestedStage" TEXT,
    "outcome" TEXT,
    "meetingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingLog_prospectId_idx" ON "MeetingLog"("prospectId");

-- CreateIndex
CREATE INDEX "MeetingLog_userId_idx" ON "MeetingLog"("userId");

-- CreateIndex
CREATE INDEX "MeetingLog_createdAt_idx" ON "MeetingLog"("createdAt");

-- AddForeignKey
ALTER TABLE "MeetingLog" ADD CONSTRAINT "MeetingLog_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
