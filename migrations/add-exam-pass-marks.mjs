import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const migrationSQL = `
-- Per-subject pass marks for exams.
-- Shape: { "<subject>": { "outOfCq": 50, "cqPass": 17, "outOfMcq": 25, "mcqPass": 5 } }
-- Every field is optional; a missing cqPass/mcqPass means "no pass mark for this
-- component", which disables fail-flagging for that component.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_marks jsonb NOT NULL DEFAULT '{}'::jsonb;
`;

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(migrationSQL);
  const { rows } = await client.query(
    `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'exams' ORDER BY ordinal_position`
  );
  console.log('Migration applied. exams columns now:');
  for (const r of rows) console.log(` - ${r.column_name} (${r.data_type})`);
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
