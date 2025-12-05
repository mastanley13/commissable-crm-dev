-- Create a reusable sequence for auto-numbering revenue schedules
DO $$
DECLARE
  seq_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'S'
      AND relname = 'revenue_schedule_number_seq'
  )
  INTO seq_exists;

  IF NOT seq_exists THEN
    EXECUTE 'CREATE SEQUENCE revenue_schedule_number_seq AS BIGINT START WITH 10000 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1';
  END IF;
END $$;

-- Align the sequence with the highest numeric schedule name (RS-#####) if present
DO $$
DECLARE
  max_numeric BIGINT;
  next_value BIGINT;
BEGIN
  SELECT MAX((regexp_match("scheduleNumber", E'^RS-(\\d+)$'))[1]::BIGINT)
  INTO max_numeric
  FROM "RevenueSchedule"
  WHERE "scheduleNumber" ~ E'^RS-(\\d+)$';

  IF max_numeric IS NULL THEN
    next_value := 10000;
  ELSE
    next_value := GREATEST(max_numeric + 1, 10000);
  END IF;

  PERFORM setval('revenue_schedule_number_seq', next_value, false);
END $$;
