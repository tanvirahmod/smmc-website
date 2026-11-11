/*
# Add basic_scale column to teachers

1. Modified Tables
- `teachers`
  - `basic_scale` (text) - Basic Scale/Salary (e.g. "16000", "22000-5400")
2. Security
- No RLS changes. Existing policies still apply.
3. Notes
- Shown in the teacher profile form next to the Salary Grade field,
  and in the principal's teacher edit/view modals.
- Nullable text. No data loss.
*/

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS basic_scale text;
