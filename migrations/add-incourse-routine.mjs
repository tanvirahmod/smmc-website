// One flexible exam routine per in-course exam (day/date/time/subject rows).
// Run: node migrations/add-incourse-routine.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`ALTER TABLE incourse_exams ADD COLUMN IF NOT EXISTS routine jsonb DEFAULT '[]'`);
    console.log('incourse_exams.routine ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
