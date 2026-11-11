/*
# Add subjects column to students

1. Modified Tables
- `students`
  - `subjects` (text) - JSON array of picked subjects for Degree (BA/BSS) students
    e.g. ["Political Science","Sociology"]
2. Security
- No RLS changes. Existing policies still apply.
3. Notes
- Shown in the student profile form as a multi-select "Pick Subjects"
  field when a Degree student selects BA or BSS as their Department/Group.
- Available subjects: Islamic History and Culture, Political Science,
  Sociology, Philosophy.
- Nullable text storing a JSON array. No data loss.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS subjects text;
