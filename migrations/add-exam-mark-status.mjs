import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const migrationSQL = `
-- Attendance/eligibility status for an exam mark.
-- 'present' (default) = normal marks; 'absent' shows as A; 'expelled' shows as E.
-- cq/mcq stay 0 for absent/expelled students.
ALTER TABLE exam_marks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'present'
  CHECK (status IN ('present', 'absent', 'expelled'));
`;

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(migrationSQL);
  const { rows } = await client.query(
    `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'exam_marks' ORDER BY ordinal_position`
  );
  console.log('Migration applied. exam_marks columns now:');
  for (const r of rows) console.log(` - ${r.column_name} (${r.data_type})`);
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
