const { Client } = require('pg');

const { loadConnectionString } = require('./connection.cjs');
const connectionString = loadConnectionString();

const migrationSQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id text UNIQUE NOT NULL,
  password text,
  full_name text,
  fathers_name text,
  mothers_name text,
  dob date,
  mobile_number text,
  email text,
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
  edu_ssc_year text,
  edu_ssc_board text,
  edu_ssc_result text,
  edu_hsc_year text,
  edu_hsc_board text,
  edu_hsc_result text,
  edu_honours_year text,
  edu_honours_board text,
  edu_honours_result text,
  edu_masters_year text,
  edu_masters_board text,
  edu_masters_result text,
  tmis_no text,
  ttis_no text,
  profile_pic_url text,
  is_principal boolean NOT NULL DEFAULT false,
  can_write_notice boolean NOT NULL DEFAULT false,
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
  class text,
  author text,
  published_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_notices" ON notices;
CREATE POLICY "public_read_notices" ON notices FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text UNIQUE NOT NULL,
  password text,
  class_roll text,
  session text,
  program text,
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
  hsc_group text,
  hsc_board text,
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

INSERT INTO teachers (teacher_id, password, full_name, designation, is_principal)
VALUES ('principal', 'principal123', 'Principal', 'Principal', true)
ON CONFLICT (teacher_id) DO NOTHING;

INSERT INTO notices (title, content, category) VALUES
('Admission Notice 2026', 'Admission for HSC 1st year 2026-2027 session will start from 15 September 2026. Interested students are requested to collect admission forms from the college office.', 'admission'),
('Exam Routine Published', 'The HSC Final Examination 2026 routine has been published. Students can collect it from the college office or download from the notice board section.', 'exam'),
('Holiday Notice', 'The college will remain closed on 16 December 2026 on the occasion of Victory Day. Classes will resume on 17 December 2026.', 'holiday'),
('Result Publication', 'HSC Examination 2025 result has been published. Our college achieved 98.5% pass rate this year. Congratulations to all successful students!', 'result')
ON CONFLICT DO NOTHING;
`;

async function runMigration() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Neon database');
    
    await client.query(migrationSQL);
    console.log('Migration completed successfully!');
    
    // Verify tables
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
    console.log('Tables in database:', tables.rows.map(r => r.table_name));
    
    // Check data
    const teachers = await client.query('SELECT * FROM teachers;');
    console.log('Teachers:', teachers.rows);
    
    const notices = await client.query('SELECT * FROM notices;');
    console.log('Notices:', notices.rows);
    
    const students = await client.query('SELECT * FROM students;');
    console.log('Students:', students.rows);
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await client.end();
  }
}

runMigration();