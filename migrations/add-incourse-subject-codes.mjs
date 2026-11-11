// In-course subjects become [{name, code}] objects (was plain text[]).
// Run: node migrations/add-incourse-subject-codes.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`ALTER TABLE incourse_exams ADD COLUMN IF NOT EXISTS subjects_new jsonb DEFAULT '[]'::jsonb`);
    await client.query(`
      UPDATE incourse_exams SET subjects_new = COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('name', s, 'code', '')) FROM unnest(subjects) AS s),
        '[]'::jsonb
      )`);
    await client.query(`ALTER TABLE incourse_exams DROP COLUMN subjects`);
    await client.query(`ALTER TABLE incourse_exams RENAME COLUMN subjects_new TO subjects`);
    const check = await client.query(`SELECT id, subjects FROM incourse_exams`);
    console.log('rows=' + check.rows.length + ' sample=' + JSON.stringify(check.rows.slice(0, 2)));
    console.log('subjects column is now jsonb [{name, code}]');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
