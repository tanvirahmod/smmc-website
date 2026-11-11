// Gender and religion on teacher profiles.
// Run: node migrations/add-teacher-gender-religion.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const COLUMNS = ['gender', 'religion'];

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    for (const col of COLUMNS) {
      await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS ${col} text DEFAULT ''`);
      console.log(`teachers.${col} ready`);
    }
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
