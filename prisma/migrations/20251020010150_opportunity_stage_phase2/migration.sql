-- Phase 2: Opportunity stage extensions and opportunity product status field

-- Add new values to OpportunityStage enum
ALTER TYPE "OpportunityStage" ADD VALUE 'OnHold';
ALTER TYPE "OpportunityStage" ADD VALUE 'ClosedWon_Provisioning';
ALTER TYPE "OpportunityStage" ADD VALUE 'ClosedWon_Billing';
ALTER TYPE "OpportunityStage" ADD VALUE 'ClosedWon_BillingEnded';

-- Create OpportunityProductStatus enum
CREATE TYPE "OpportunityProductStatus" AS ENUM ('Provisioning', 'ActiveBilling', 'BillingEnded', 'Cancelled');

-- Add status column to OpportunityProduct with default Provisioning
ALTER TABLE "OpportunityProduct"
  ADD COLUMN "status" "OpportunityProductStatus" NOT NULL DEFAULT 'Provisioning';
