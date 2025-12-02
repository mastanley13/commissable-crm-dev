-- AlterTable
ALTER TABLE "public"."OpportunityProduct" ADD COLUMN     "commissionPercentSnapshot" DECIMAL(5,2),
ADD COLUMN     "distributorNameSnapshot" TEXT,
ADD COLUMN     "priceEachSnapshot" DECIMAL(16,2),
ADD COLUMN     "productCodeSnapshot" TEXT,
ADD COLUMN     "productNameHouseSnapshot" TEXT,
ADD COLUMN     "productNameVendorSnapshot" TEXT,
ADD COLUMN     "revenueTypeSnapshot" "public"."RevenueType",
ADD COLUMN     "vendorNameSnapshot" TEXT;
