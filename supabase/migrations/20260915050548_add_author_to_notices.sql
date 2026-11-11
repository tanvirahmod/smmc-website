/*
# Add `author` column to notices table
- Stores who wrote the notice (principal name or teacher name)
*/
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS author text;
