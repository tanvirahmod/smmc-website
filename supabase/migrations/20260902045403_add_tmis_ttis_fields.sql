ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS tmis_no text,
  ADD COLUMN IF NOT EXISTS ttis_no text;
