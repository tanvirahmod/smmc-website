/*
# Create students table

1. New Tables
- `students`
  - id (uuid, pk)
  - student_id (text, unique) - login ID (SSC Roll)
  - password (text) - login password (Phone number)
  - full_name (text)
  - fathers_name (text)
  - mothers_name (text)
  - ssc_gpa (text)
  - ssc_group (text)
  - ssc_passing_year (text)
  - ssc_board (text)
  - ssc_roll (text)
  - ssc_regi (text)
  - ssc_institute (text)
  - mobile_number (text)
  - present_address (text)
  - permanent_address (text)
  - created_at, updated_at (timestamptz)
2. Security
- RLS enabled, public SELECT for anon+authenticated.
- All writes through edge function with service role key.
3. Notes
- Student login uses SSC Roll as ID and Phone as password.
- Principal creates student accounts.
*/

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text UNIQUE NOT NULL,
  password text,
  full_name text,
  fathers_name text,
  mothers_name text,
  ssc_gpa text,
  ssc_group text,
  ssc_passing_year text,
  ssc_board text,
  ssc_roll text,
  ssc_regi text,
  ssc_institute text,
  mobile_number text,
  present_address text,
  permanent_address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_students" ON students;
CREATE POLICY "public_read_students" ON students FOR SELECT
  TO anon, authenticated USING (true);
