-- Option B: store commission split % fields as percent points (0-100)
-- Converts existing fraction values (0-1) to points and reduces precision to 2 decimals.

-- IMPORTANT:
-- This migration must temporarily widen the existing DECIMAL(5,4) columns before multiplying by 100,
-- otherwise values like 0.5000 -> 50.0000 overflow (DECIMAL(5,4) max is 9.9999).

-- 0) Temporarily widen precision so point values (e.g., 50.0000) can be stored safely.
ALTER TABLE "Opportunity"
  ALTER COLUMN "houseRepPercent" TYPE DECIMAL(9,4) USING "houseRepPercent"::numeric,
  ALTER COLUMN "houseSplitPercent" TYPE DECIMAL(9,4) USING "houseSplitPercent"::numeric,
  ALTER COLUMN "subagentPercent" TYPE DECIMAL(9,4) USING "subagentPercent"::numeric;

ALTER TABLE "RevenueSchedule"
  ALTER COLUMN "houseSplitPercentOverride" TYPE DECIMAL(9,4) USING "houseSplitPercentOverride"::numeric,
  ALTER COLUMN "houseRepSplitPercentOverride" TYPE DECIMAL(9,4) USING "houseRepSplitPercentOverride"::numeric,
  ALTER COLUMN "subagentSplitPercentOverride" TYPE DECIMAL(9,4) USING "subagentSplitPercentOverride"::numeric;

-- 1) Backfill Opportunity splits: multiply by 100 only when the row clearly looks fraction-based.
UPDATE "Opportunity"
SET
  "houseSplitPercent" = CASE
    WHEN "houseSplitPercent" IS NULL THEN NULL
    WHEN (
      (COALESCE(ABS("houseSplitPercent"), 0) <= 1.0) AND
      (COALESCE(ABS("houseRepPercent"), 0) <= 1.0) AND
      (COALESCE(ABS("subagentPercent"), 0) <= 1.0) AND
      (COALESCE("houseSplitPercent", 0) + COALESCE("houseRepPercent", 0) + COALESCE("subagentPercent", 0)) <= 1.5
    )
      THEN "houseSplitPercent" * 100
    ELSE "houseSplitPercent"
  END,
  "houseRepPercent" = CASE
    WHEN "houseRepPercent" IS NULL THEN NULL
    WHEN (
      (COALESCE(ABS("houseSplitPercent"), 0) <= 1.0) AND
      (COALESCE(ABS("houseRepPercent"), 0) <= 1.0) AND
      (COALESCE(ABS("subagentPercent"), 0) <= 1.0) AND
      (COALESCE("houseSplitPercent", 0) + COALESCE("houseRepPercent", 0) + COALESCE("subagentPercent", 0)) <= 1.5
    )
      THEN "houseRepPercent" * 100
    ELSE "houseRepPercent"
  END,
  "subagentPercent" = CASE
    WHEN "subagentPercent" IS NULL THEN NULL
    WHEN (
      (COALESCE(ABS("houseSplitPercent"), 0) <= 1.0) AND
      (COALESCE(ABS("houseRepPercent"), 0) <= 1.0) AND
      (COALESCE(ABS("subagentPercent"), 0) <= 1.0) AND
      (COALESCE("houseSplitPercent", 0) + COALESCE("houseRepPercent", 0) + COALESCE("subagentPercent", 0)) <= 1.5
    )
      THEN "subagentPercent" * 100
    ELSE "subagentPercent"
  END;

-- 2) Backfill RevenueSchedule override splits: multiply by 100 only when values clearly look fraction-based.
UPDATE "RevenueSchedule"
SET
  "houseSplitPercentOverride" = CASE
    WHEN "houseSplitPercentOverride" IS NULL THEN NULL
    WHEN (
      (COALESCE(ABS("houseSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE(ABS("houseRepSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE(ABS("subagentSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE("houseSplitPercentOverride", 0) + COALESCE("houseRepSplitPercentOverride", 0) + COALESCE("subagentSplitPercentOverride", 0)) <= 1.5
    )
      THEN "houseSplitPercentOverride" * 100
    ELSE "houseSplitPercentOverride"
  END,
  "houseRepSplitPercentOverride" = CASE
    WHEN "houseRepSplitPercentOverride" IS NULL THEN NULL
    WHEN (
      (COALESCE(ABS("houseSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE(ABS("houseRepSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE(ABS("subagentSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE("houseSplitPercentOverride", 0) + COALESCE("houseRepSplitPercentOverride", 0) + COALESCE("subagentSplitPercentOverride", 0)) <= 1.5
    )
      THEN "houseRepSplitPercentOverride" * 100
    ELSE "houseRepSplitPercentOverride"
  END,
  "subagentSplitPercentOverride" = CASE
    WHEN "subagentSplitPercentOverride" IS NULL THEN NULL
    WHEN (
      (COALESCE(ABS("houseSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE(ABS("houseRepSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE(ABS("subagentSplitPercentOverride"), 0) <= 1.0) AND
      (COALESCE("houseSplitPercentOverride", 0) + COALESCE("houseRepSplitPercentOverride", 0) + COALESCE("subagentSplitPercentOverride", 0)) <= 1.5
    )
      THEN "subagentSplitPercentOverride" * 100
    ELSE "subagentSplitPercentOverride"
  END;

-- 3) Reduce precision to Decimal(5,2)
ALTER TABLE "Opportunity"
  ALTER COLUMN "houseRepPercent" TYPE DECIMAL(5,2) USING ROUND("houseRepPercent"::numeric, 2),
  ALTER COLUMN "houseSplitPercent" TYPE DECIMAL(5,2) USING ROUND("houseSplitPercent"::numeric, 2),
  ALTER COLUMN "subagentPercent" TYPE DECIMAL(5,2) USING ROUND("subagentPercent"::numeric, 2);

ALTER TABLE "RevenueSchedule"
  ALTER COLUMN "houseSplitPercentOverride" TYPE DECIMAL(5,2) USING ROUND("houseSplitPercentOverride"::numeric, 2),
  ALTER COLUMN "houseRepSplitPercentOverride" TYPE DECIMAL(5,2) USING ROUND("houseRepSplitPercentOverride"::numeric, 2),
  ALTER COLUMN "subagentSplitPercentOverride" TYPE DECIMAL(5,2) USING ROUND("subagentSplitPercentOverride"::numeric, 2);
