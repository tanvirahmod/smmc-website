import pg from 'pg';
const { Client } = pg;

import { connectionString } from './connection.mjs';

const migrationSQL = `
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS basic_scale text;
`;

async function runMigration() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Neon database');

    await client.query(migrationSQL);
    console.log('Migration completed successfully!');

    const columns = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'teachers' ORDER BY ordinal_position;"
    );
    console.log('Teachers columns:', columns.rows.map((r) => r.column_name));
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await client.end();
  }
}

runMigration();
