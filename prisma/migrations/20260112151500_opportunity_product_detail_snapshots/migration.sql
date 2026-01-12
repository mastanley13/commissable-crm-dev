-- AlterTable
ALTER TABLE "public"."OpportunityProduct"
ADD COLUMN     "descriptionSnapshot" TEXT,
ADD COLUMN     "distributorAccountIdSnapshot" UUID,
ADD COLUMN     "distributorProductFamilySnapshot" TEXT,
ADD COLUMN     "distributorProductSubtypeSnapshot" TEXT,
ADD COLUMN     "partNumberDistributorSnapshot" TEXT,
ADD COLUMN     "partNumberVendorSnapshot" TEXT,
ADD COLUMN     "productDescriptionDistributorSnapshot" TEXT,
ADD COLUMN     "productDescriptionVendorSnapshot" TEXT,
ADD COLUMN     "productFamilyHouseSnapshot" TEXT,
ADD COLUMN     "productFamilyVendorSnapshot" TEXT,
ADD COLUMN     "productNameDistributorSnapshot" TEXT,
ADD COLUMN     "productSubtypeHouseSnapshot" TEXT,
ADD COLUMN     "productSubtypeVendorSnapshot" TEXT,
ADD COLUMN     "vendorAccountIdSnapshot" UUID;

