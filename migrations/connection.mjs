// ESM entry point for the shared migration connection helper.
// Usage: import { connectionString } from './connection.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadConnectionString } = require('./connection.cjs');

export const connectionString = loadConnectionString();
