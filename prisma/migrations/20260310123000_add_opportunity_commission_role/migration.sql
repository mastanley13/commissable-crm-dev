ALTER TABLE "Opportunity"
ADD COLUMN "commissionRole" TEXT;

UPDATE "Opportunity"
SET "commissionRole" = 'Subject Matter Expert'
WHERE "isSubjectMatterExpertDeal" = true
  AND "commissionRole" IS NULL;
