// Blood group on teacher profiles (A+, A-, B+, B-, O+, O-, AB+, AB-).
// Run: node migrations/add-teacher-blood-group.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS blood_group text DEFAULT ''`);
    console.log('teachers.blood_group ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
