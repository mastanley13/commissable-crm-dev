-- Backfill "Other - Part Number" for existing products.
-- Historically, some vendor part numbers were stored in Product.productCode (formerly labeled "Vendor Part # (Primary)").
-- This migrates those values into Product.partNumberVendor when it is currently empty.

UPDATE "public"."Product"
SET "partNumberVendor" = "productCode"
WHERE ("partNumberVendor" IS NULL OR btrim("partNumberVendor") = '')
  AND btrim("productCode") <> '';

