/*
# Add class_roll and session columns to students

1. Modified Tables
- `students`
  - class_roll (text) - class roll number used as login ID
  - session (text) - academic session (e.g. "2024-2025")

2. Notes
- Student login now uses class_roll as ID and mobile_number as password.
- The student_id column remains for backward compatibility but new accounts
  will store the class_roll value in student_id as well (for uniqueness).
- The CSV upload bulk-creates students with class_roll, full_name, mobile_number,
  and session.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS class_roll text,
  ADD COLUMN IF NOT EXISTS session text;
