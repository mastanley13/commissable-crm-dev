-- Extend Product with detailed fields per Product Detail spec
ALTER TABLE "Product"
  ADD COLUMN "productFamilyHouse" TEXT,
  ADD COLUMN "productFamilyVendor" TEXT,
  ADD COLUMN "productSubtypeVendor" TEXT,
  ADD COLUMN "productNameDistributor" TEXT,
  ADD COLUMN "partNumberVendor" TEXT,
  ADD COLUMN "partNumberDistributor" TEXT,
  ADD COLUMN "distributorProductFamily" TEXT,
  ADD COLUMN "productDescriptionVendor" TEXT,
  ADD COLUMN "productDescriptionDistributor" TEXT;

