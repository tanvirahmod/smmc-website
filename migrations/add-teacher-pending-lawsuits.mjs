// Pending-lawsuits flag on teacher profiles (YES / NO).
// Run: node migrations/add-teacher-pending-lawsuits.mjs
import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS pending_lawsuits text DEFAULT ''`);
    console.log('teachers.pending_lawsuits ready');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
