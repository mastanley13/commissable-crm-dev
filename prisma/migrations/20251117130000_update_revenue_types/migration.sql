-- Align RevenueType enum with the six business-defined revenue categories
ALTER TYPE "public"."RevenueType" ADD VALUE 'NRC_Percent' AFTER 'NRC_PerItem';
ALTER TYPE "public"."RevenueType" ADD VALUE 'NRC_Resale' BEFORE 'MRC_PerItem';

ALTER TYPE "public"."RevenueType" RENAME VALUE 'MRC_PerItem' TO 'MRC_ThirdParty';
ALTER TYPE "public"."RevenueType" RENAME VALUE 'MRC_FlatFee' TO 'MRC_House';
