/*
# Add department/group column to students

1. Modified Tables
- `students`
  - `department` (text) - Degree program department/group: BA or BSS
2. Security
- No RLS changes. Existing policies still apply.
3. Notes
- Shown in the student profile form for Degree program students,
  directly below the Program field.
- Nullable text. No data loss.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS department text;
