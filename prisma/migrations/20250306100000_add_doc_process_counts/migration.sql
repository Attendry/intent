-- Add lastIntelCreated and lastSignalsCreated to CompanyDocument for UX feedback
ALTER TABLE "CompanyDocument" ADD COLUMN "lastIntelCreated" INTEGER;
ALTER TABLE "CompanyDocument" ADD COLUMN "lastSignalsCreated" INTEGER;
