-- Add missing Product.partNumberHouse column as optional text
-- This migration is safe to run multiple times due to IF NOT EXISTS
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "partNumberHouse" TEXT;

