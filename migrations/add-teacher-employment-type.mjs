// Employment-type field on teacher profiles (MPO / NON-MPO / Part Time).
// Run: node migrations/add-teacher-employment-type.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employment_type text DEFAULT ''`);
    console.log('teachers.employment_type ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
