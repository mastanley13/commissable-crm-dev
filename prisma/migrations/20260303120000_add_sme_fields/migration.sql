-- Add SME deal flag and per-line-item SME percent helper fields
ALTER TABLE "Opportunity"
  ADD COLUMN "isSubjectMatterExpertDeal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OpportunityProduct"
  ADD COLUMN "subjectMatterExpertPercent" NUMERIC(5,2);

