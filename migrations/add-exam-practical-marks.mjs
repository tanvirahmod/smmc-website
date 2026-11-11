// One practical-marks value per student per exam (Science group only), summed
// into the result Total. Run: node migrations/add-exam-practical-marks.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const migrationSQL = `
CREATE TABLE IF NOT EXISTS exam_practical_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  marks numeric NOT NULL DEFAULT 0,
  entered_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (exam_id, student_id),
  CHECK (marks >= 0 AND marks <= 100)
);
`;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(migrationSQL);
    console.log('exam_practical_marks ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
