/*
# Add HSC academic detail fields to students

1. Modified Tables
- `students` - add columns:
  - `hsc_gpa` (text) - HSC GPA
  - `hsc_passing_year` (text) - HSC passing year
  - `hsc_roll` (text) - HSC roll number
  - `hsc_regi` (text) - HSC registration number
  - `hsc_institute` (text) - HSC institute name
2. Security
- No RLS changes. Existing policies still apply.
3. Notes
- Mirrors the existing SSC academic detail fields (ssc_gpa, ssc_passing_year,
  ssc_roll, ssc_regi, ssc_institute) so the Degree program form can store
  full HSC academic background.
- Used in the student profile form for the Degree program.
- All new columns are nullable text. No data loss.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS hsc_gpa text,
  ADD COLUMN IF NOT EXISTS hsc_passing_year text,
  ADD COLUMN IF NOT EXISTS hsc_roll text,
  ADD COLUMN IF NOT EXISTS hsc_regi text,
  ADD COLUMN IF NOT EXISTS hsc_institute text;
