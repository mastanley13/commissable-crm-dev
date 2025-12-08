-- Add house and distributor product subtype fields
ALTER TABLE "Product"
  ADD COLUMN "productSubtypeHouse" TEXT,
  ADD COLUMN "distributorProductSubtype" TEXT;

