/*
# Add education detail columns, mobile, and email to teachers

1. Modified Tables
- `teachers` - add columns:
  - `mobile_number` (text) - teacher's mobile phone number
  - `email` (text) - teacher's email address
  - `edu_ssc_year`, `edu_ssc_board`, `edu_ssc_result` (text) - SSC passing year, board, result
  - `edu_hsc_year`, `edu_hsc_board`, `edu_hsc_result` (text) - HSC passing year, board, result
  - `edu_honours_year`, `edu_honours_board`, `edu_honours_result` (text) - Honours passing year, board, result
  - `edu_masters_year`, `edu_masters_board`, `edu_masters_result` (text) - Masters passing year, board, result
2. Security
- No RLS changes. Existing public SELECT policy still applies.
3. Notes
- All new columns are nullable text columns. No data loss.
*/

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS edu_ssc_year text,
  ADD COLUMN IF NOT EXISTS edu_ssc_board text,
  ADD COLUMN IF NOT EXISTS edu_ssc_result text,
  ADD COLUMN IF NOT EXISTS edu_hsc_year text,
  ADD COLUMN IF NOT EXISTS edu_hsc_board text,
  ADD COLUMN IF NOT EXISTS edu_hsc_result text,
  ADD COLUMN IF NOT EXISTS edu_honours_year text,
  ADD COLUMN IF NOT EXISTS edu_honours_board text,
  ADD COLUMN IF NOT EXISTS edu_honours_result text,
  ADD COLUMN IF NOT EXISTS edu_masters_year text,
  ADD COLUMN IF NOT EXISTS edu_masters_board text,
  ADD COLUMN IF NOT EXISTS edu_masters_result text;
