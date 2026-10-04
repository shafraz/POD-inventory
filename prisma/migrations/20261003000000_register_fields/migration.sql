-- New register fields
ALTER TYPE "LookupCategory" ADD VALUE IF NOT EXISTS 'ASSIGNED_TO';
ALTER TABLE "assets" ADD COLUMN "location_remark" TEXT;
ALTER TABLE "assets" ADD COLUMN "assigned_to_remark" TEXT;
