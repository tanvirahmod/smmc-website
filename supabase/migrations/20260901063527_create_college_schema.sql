/*
# College Website Schema - Teachers, Notices, Principal

1. New Tables
- `teachers` - stores teacher profiles and login credentials
- `notices` - stores public notices for the notice board
2. Security
- RLS enabled on both tables.
- Public (anon) can read teachers and notices.
- All writes go through edge functions using the service role key (bypasses RLS).
3. Notes
- Principal account seeded: teacher_id='principal', password='principal123'
*/

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id text UNIQUE NOT NULL,
  password text,
  full_name text,
  fathers_name text,
  mothers_name text,
  dob date,
  current_address text,
  permanent_address text,
  nid_number text,
  joining_date date,
  appointment_date date,
  designation text,
  subject text,
  mpo_date date,
  index_number text,
  salary_grade text,
  training_names text,
  education_ssc text,
  education_hsc text,
  education_honours text,
  education_masters text,
  profile_pic_url text,
  is_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_teacher_info" ON teachers;
CREATE POLICY "public_read_teacher_info" ON teachers FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  published_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_notices" ON notices;
CREATE POLICY "public_read_notices" ON notices FOR SELECT
  TO anon, authenticated USING (true);

INSERT INTO teachers (teacher_id, password, full_name, designation, is_principal)
VALUES ('principal', 'principal123', 'Principal', 'Principal', true)
ON CONFLICT (teacher_id) DO NOTHING;

INSERT INTO notices (title, content, category) VALUES
('Admission Notice 2026', 'Admission for HSC 1st year 2026-2027 session will start from 15 September 2026. Interested students are requested to collect admission forms from the college office.', 'admission'),
('Exam Routine Published', 'The HSC Final Examination 2026 routine has been published. Students can collect it from the college office or download from the notice board section.', 'exam'),
('Holiday Notice', 'The college will remain closed on 16 December 2026 on the occasion of Victory Day. Classes will resume on 17 December 2026.', 'holiday'),
('Result Publication', 'HSC Examination 2025 result has been published. Our college achieved 98.5% pass rate this year. Congratulations to all successful students!', 'result')
ON CONFLICT DO NOTHING;
