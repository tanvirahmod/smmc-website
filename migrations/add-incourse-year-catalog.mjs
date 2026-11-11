// In-course exam year (Honours: 4 years, Degree: 3 years) + a reusable
// subject catalog keyed by (program, year, department).
// Run: node migrations/add-incourse-year-catalog.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const migrationSQL = `
ALTER TABLE incourse_exams ADD COLUMN IF NOT EXISTS year text DEFAULT '';

CREATE TABLE IF NOT EXISTS incourse_subject_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program text NOT NULL CHECK (program IN ('Honours', 'Degree')),
  year text NOT NULL DEFAULT '',
  department_slug text NOT NULL DEFAULT '',
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (program, year, department_slug, name)
);
`;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(migrationSQL);
    console.log('incourse_exams.year + incourse_subject_catalog ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
