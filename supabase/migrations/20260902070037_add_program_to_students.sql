/*
# Add program column to students

1. Modified Tables
- `students`
  - program (text) - academic program: HSC, Degree, or Honours

2. Notes
- Used in single create, CSV bulk upload, and student profile.
- Displayed on student login and public students listing.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS program text;
