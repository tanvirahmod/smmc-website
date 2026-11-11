// Extra identity/guardian fields on student profiles.
// Run: node migrations/add-student-profile-fields.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const COLUMNS = [
  'birth_certificate_number',
  'gender',
  'religion',
  'blood_group',
  'father_alive',
  'mother_alive',
  'guardian_occupation',
  'guardian_phone',
  'guardian_annual_income',
];

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    for (const col of COLUMNS) {
      await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS ${col} text DEFAULT ''`);
      console.log(`students.${col} ready`);
    }
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
