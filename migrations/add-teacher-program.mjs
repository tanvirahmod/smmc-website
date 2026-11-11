// Program column on teacher profiles (HSC / Honours / Degree), set by bulk import.
// Run: node migrations/add-teacher-program.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS program text DEFAULT ''`);
    console.log('teachers.program ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
