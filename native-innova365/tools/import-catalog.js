'use strict';
const { importCatalog } = require('../lib/offline-catalog');
const [dump, destination] = process.argv.slice(2);
if (!dump || !destination) {
  process.stderr.write('Usage: node tools/import-catalog.js <pg-dump.sql> <new-local-db.sqlite>\n');
  process.exitCode = 2;
} else {
  try { process.stdout.write(JSON.stringify(importCatalog(dump, destination), null, 2) + '\n'); }
  catch (error) { process.stderr.write(String(error.message || error) + '\n'); process.exitCode = 1; }
}
