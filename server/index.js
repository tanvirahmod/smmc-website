'use strict';

/**
 * Long-running Node entry point: `npm start` (or `node index.js` in server/).
 *
 * Serves the API and, when dist/ exists, the built SPA on one origin. The app
 * itself lives in app.js so the same routes can also run as a serverless
 * function (netlify/functions/api.js).
 */

require('dotenv').config();

const path = require('node:path');
const { createApp } = require('./app');

// The Vite dev server proxies /api to http://localhost:3001, so the API must
// bind there. Guard against an invalid/zero PORT (e.g. PORT=0 in the shell
// environment), which would otherwise bind a random port and break the proxy.
const parsedPort = Number.parseInt(process.env.PORT || '', 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 3001;

const app = createApp({ spaDir: path.join(__dirname, '..', 'dist') });

const server = app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: port ${PORT} is already in use. The Vite dev server proxies /api to this port, so stop the other process (or start this one with PORT=<free port> and update vite.config.ts).`);
    process.exit(1);
  }
  throw err;
});
