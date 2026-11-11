/*
# Add `class` column to notices and `can_write_notice` to teachers

1. Modified Tables
- `notices` - add `class` (text, nullable) - target class/program for the notice (e.g. HSC, Degree, Honours, or blank for all)
- `teachers` - add `can_write_notice` (boolean, default false) - principal grants notice-writing access
2. Security
- No RLS changes. Existing public SELECT policy on both tables still applies.
3. Notes
- Both new columns are nullable/defaulted. No data loss.
*/

ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS class text;

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS can_write_notice boolean NOT NULL DEFAULT false;
