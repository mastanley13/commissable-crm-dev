-- Add explicit month-to-month lifecycle state for opportunity products.
ALTER TYPE "OpportunityProductStatus" ADD VALUE IF NOT EXISTS 'BillingM2M';
