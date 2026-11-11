// Seniority priority on teacher profiles (1 = most senior) for ordered exports.
// Run: node migrations/add-teacher-seniority-priority.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS seniority_priority integer`);
    console.log('teachers.seniority_priority ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
