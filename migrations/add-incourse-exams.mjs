// In-course exams for Honours and Degree (Pass): exam headers + per-subject
// paper/attendance marks. Subjects are free-type text (no subject master yet).
// Run: node migrations/add-incourse-exams.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const migrationSQL = `
CREATE TABLE IF NOT EXISTS incourse_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  program text NOT NULL CHECK (program IN ('Honours', 'Degree')),
  session text NOT NULL,
  department_slug text NOT NULL,
  subjects text[] NOT NULL DEFAULT '{}',
  paper_out_of numeric NOT NULL DEFAULT 80,
  attendance_out_of numeric NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incourse_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES incourse_exams(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  subject text NOT NULL,
  paper numeric NOT NULL DEFAULT 0,
  attendance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  entered_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (exam_id, student_id, subject)
);
`;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(migrationSQL);
    console.log('incourse_exams + incourse_marks ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
