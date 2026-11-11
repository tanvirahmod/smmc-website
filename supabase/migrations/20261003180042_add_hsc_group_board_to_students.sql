/*
# Add HSC group and HSC board columns to students

1. Modified Tables
- `students` - add columns:
  - `hsc_group` (text) - HSC group: Science, Business, or Humanities
  - `hsc_board` (text) - HSC education board name
2. Security
- No RLS changes. Existing policies still apply.
3. Notes
- Both new columns are nullable text. No data loss.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS hsc_group text,
  ADD COLUMN IF NOT EXISTS hsc_board text;
