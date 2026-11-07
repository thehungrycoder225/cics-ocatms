ALTER TABLE activity
  ADD COLUMN data_classification text NOT NULL DEFAULT 'OPERATIONAL'
  CHECK (data_classification IN ('OPERATIONAL', 'SYNTHETIC_TEST'));

UPDATE activity
SET data_classification = 'SYNTHETIC_TEST'
WHERE id IN (
  '48b695de-ab49-4d95-806a-bcb5226232d7',
  '3995eae1-f95f-48a0-8d82-8f43ea63d5b2'
)
  AND title LIKE 'SYNTHETIC M4 %';

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM activity
    WHERE id IN (
      '48b695de-ab49-4d95-806a-bcb5226232d7',
      '3995eae1-f95f-48a0-8d82-8f43ea63d5b2'
    )
      AND data_classification = 'SYNTHETIC_TEST'
  ) <> 2 THEN
    RAISE EXCEPTION 'Expected both audited SYNTHETIC M4 activities to exist before classification.';
  END IF;
END;
$$;
