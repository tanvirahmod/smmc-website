// Department staff assignments + department-scoped notices.
// Run: node migrations/add-department-staff-notices.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const migrationSQL = `
CREATE TABLE IF NOT EXISTS department_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_slug text NOT NULL,
  teacher_id text NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('head', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (department_slug, teacher_id)
);

ALTER TABLE notices ADD COLUMN IF NOT EXISTS department text;
`;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(migrationSQL);
    console.log('department_staff + notices.department ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
