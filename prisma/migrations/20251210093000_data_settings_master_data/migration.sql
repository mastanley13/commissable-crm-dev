-- Master data for AccountType, ProductFamily, and ProductSubtype

-- Add active/system flags to AccountType
ALTER TABLE "public"."AccountType"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Create ProductFamily table
CREATE TABLE "public"."ProductFamily" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

-- Create ProductSubtype table
CREATE TABLE "public"."ProductSubtype" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productFamilyId" UUID,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductSubtype_pkey" PRIMARY KEY ("id")
);

-- Relationships
ALTER TABLE "public"."ProductFamily"
  ADD CONSTRAINT "ProductFamily_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ProductSubtype"
  ADD CONSTRAINT "ProductSubtype_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ProductSubtype"
  ADD CONSTRAINT "ProductSubtype_productFamilyId_fkey"
  FOREIGN KEY ("productFamilyId") REFERENCES "public"."ProductFamily"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes / uniqueness
CREATE UNIQUE INDEX "ProductFamily_tenantId_code_key"
  ON "public"."ProductFamily"("tenantId", "code");

CREATE UNIQUE INDEX "ProductFamily_tenantId_name_key"
  ON "public"."ProductFamily"("tenantId", "name");

CREATE UNIQUE INDEX "ProductSubtype_tenantId_code_key"
  ON "public"."ProductSubtype"("tenantId", "code");

CREATE UNIQUE INDEX "ProductSubtype_tenantId_name_key"
  ON "public"."ProductSubtype"("tenantId", "name");

CREATE INDEX "ProductSubtype_tenantId_productFamilyId_idx"
  ON "public"."ProductSubtype"("tenantId", "productFamilyId");

